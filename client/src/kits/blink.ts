import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface BlinkAbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  isSpacePressed?: boolean; // For vertical boost detection
}

export interface BlinkState {
  isInIFrames: boolean;
  iFramesEndTime: number;
  regenDisabledUntil: number;
  blinkWindowEndTime: number; // For combo damage bonus
}

// Global blink state (local-only for now)
let blinkState: BlinkState = {
  isInIFrames: false,
  iFramesEndTime: 0,
  regenDisabledUntil: 0,
  blinkWindowEndTime: 0
};

/**
 * Blink Dash - Teleport ability
 * Teleports player forward with brief invincibility and bonus damage window
 * Includes collision detection, killzone prevention, and optional vertical boost
 */
export function executeBlink(context: BlinkAbilityContext): void {
  const { playerBody, world, camera, isSpacePressed = false } = context;
  
  // Get player position and camera direction
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Get camera direction for blink direction
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Blink parameters
  const blinkDistance = 10.0; // 10 meters forward (increased from 8m for better traversal)
  const iFramesDuration = 100; // 0.1 seconds of invincibility
  const regenDisableDuration = 1000; // 1 second no regen
  const blinkWindowDuration = 500; // 0.5 second bonus damage window
  // const verticalBoost = 3.0; // Upward boost when holding Space - unused
  const safetyBuffer = 0.5; // Distance to stop before collision
  const forwardImpulseStrength = 3.0; // Forward momentum after blink
  
  // Killzone boundaries (from controller logic)
  const CRITICAL_KILLZONE = 0.8; // Immediate respawn
  const VOID_THRESHOLD = 1.5; // Void detection threshold
  const SAFE_MIN_HEIGHT = 2.0; // Minimum safe height
  
  // Apply vertical boost if Space is held
  const blinkDirection = direction.clone();
  if (isSpacePressed) {
    blinkDirection.y += 0.4; // Add upward component
    blinkDirection.normalize();
    console.log('⚡ Blink with vertical boost activated');
  }
  
  // Calculate initial target position
  const initialTarget = playerPosition.clone().add(
    blinkDirection.clone().multiplyScalar(blinkDistance)
  );
  
  // Perform raycast to detect collisions
  const raycastResult = performBlinkRaycast(world, playerPosition, blinkDirection, blinkDistance);
  
  let finalTargetPosition: THREE.Vector3;
  let blinkSuccess = false;
  let blockReason = '';
  
  if (raycastResult.hit) {
    // Collision detected - position before the hit point
    const safeDistance = Math.max(0.5, raycastResult.distance - safetyBuffer);
    finalTargetPosition = playerPosition.clone().add(
      blinkDirection.clone().multiplyScalar(safeDistance)
    );
    console.log(`⚡ Collision detected at ${raycastResult.distance.toFixed(1)}m, adjusting to ${safeDistance.toFixed(1)}m`);
  } else {
    // No collision - use full distance
    finalTargetPosition = initialTarget.clone();
  }
  
  // Check killzone conditions
  if (finalTargetPosition.y < CRITICAL_KILLZONE) {
    // Critical killzone - cancel blink entirely
    blockReason = 'critical killzone';
    console.log('⚡ BLINK blocked - would teleport into critical killzone');
  } else if (finalTargetPosition.y < VOID_THRESHOLD) {
    // Void threshold - snap to safe height
    finalTargetPosition.y = SAFE_MIN_HEIGHT;
    console.log(`⚡ Blink Y-position adjusted to safe height: ${SAFE_MIN_HEIGHT}`);
    blinkSuccess = true;
  } else {
    // Safe position
    blinkSuccess = true;
  }
  
  // Perform final collision check at target position
  if (blinkSuccess && checkBlinkTarget(world, finalTargetPosition)) {
    // Execute the blink
    playerBody.setTranslation(finalTargetPosition, true);
    
    // Apply forward impulse for momentum preservation and feel
    const forwardImpulse = direction.clone().multiplyScalar(forwardImpulseStrength);
    window.dispatchEvent(new CustomEvent('blinkMomentumImpulse', {
      detail: { 
        impulse: forwardImpulse,
        blinkDirection: direction,
        distance: playerPosition.distanceTo(finalTargetPosition)
      }
    }));
    
    // Activate i-frames and other effects
    const now = Date.now();
    blinkState.isInIFrames = true;
    blinkState.iFramesEndTime = now + iFramesDuration;
    blinkState.regenDisabledUntil = now + regenDisableDuration;
    blinkState.blinkWindowEndTime = now + blinkWindowDuration;
    
    const actualDistance = playerPosition.distanceTo(finalTargetPosition);
    console.log(`⚡ BLINK executed to position: ${finalTargetPosition.x.toFixed(1)}, ${finalTargetPosition.y.toFixed(1)}, ${finalTargetPosition.z.toFixed(1)} (${actualDistance.toFixed(1)}m) with forward impulse`);
    
    // Visual feedback effect
    createBlinkEffect(playerPosition, finalTargetPosition);
    
  } else {
    // Blink blocked
    blinkSuccess = false;
    if (!blockReason) {
      blockReason = 'target collision';
    }
    console.log(`⚡ BLINK blocked - ${blockReason}`);
    
    // Dispatch blocked event for feedback
    window.dispatchEvent(new CustomEvent('blinkBlocked', {
      detail: { 
        fromPosition: playerPosition, 
        targetPosition: finalTargetPosition,
        reason: blockReason
      }
    }));
  }
  
  // Dispatch ability used event
  window.dispatchEvent(new CustomEvent('abilityUsed', {
    detail: {
      ability: 'blink',
      position: playerPosition,
      targetPosition: finalTargetPosition,
      success: blinkSuccess,
      distance: blinkSuccess ? playerPosition.distanceTo(finalTargetPosition) : 0,
      verticalBoost: isSpacePressed,
      blockReason: blockReason || undefined
    }
  }));
}

/**
 * Perform raycast to detect collisions along blink path
 */
function performBlinkRaycast(
  world: RAPIER.World, 
  fromPosition: THREE.Vector3, 
  direction: THREE.Vector3, 
  maxDistance: number
): { hit: boolean; distance: number; hitPoint?: THREE.Vector3 } {
  // Start ray slightly forward to avoid hitting player's own collider
  const rayOffset = 0.6; // Start ray outside player capsule (radius 0.5)
  const rayStart = fromPosition.clone().add(direction.clone().multiplyScalar(rayOffset));
  const adjustedMaxDistance = maxDistance - rayOffset;
  
  // Create ray from offset position in blink direction
  const ray = new RAPIER.Ray(rayStart, direction);
  
  // Cast ray with max distance, excluding kinematic bodies (player) but including sensors (dummies)
  const hit = world.castRay(
    ray, 
    adjustedMaxDistance, 
    true, // solid
    RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC // Allow blink to pass through sensor dummies
  );
  
  if (hit) {
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    const actualDistance = hit.timeOfImpact + rayOffset; // Add back the offset
    return {
      hit: true,
      distance: actualDistance,
      hitPoint: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z)
    };
  }
  
  return {
    hit: false,
    distance: maxDistance
  };
}

/**
 * Check if blink target position is valid (not inside collision)
 */
function checkBlinkTarget(world: RAPIER.World, targetPosition: THREE.Vector3): boolean {
  // Create a small shape at target position to test for overlap
  const testShape = new RAPIER.Ball(0.4); // Slightly smaller than player capsule
  const testPos = { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z };
  const testRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
  
  // Check for intersections at target position
  let hasIntersection = false;
  world.intersectionsWithShape(testPos, testRot, testShape, (_collider) => {
    // If we find any collision, the position is invalid
    hasIntersection = true;
    return false; // Stop checking after first intersection
  });
  
  return !hasIntersection;
}

/**
 * Create visual effect for blink teleportation
 */
function createBlinkEffect(fromPos: THREE.Vector3, toPos: THREE.Vector3): void {
  // TODO: Add particle effects, screen flash, etc.
  // For now, just log the effect
  console.log(`⚡ Blink effect: ${fromPos.x.toFixed(1)},${fromPos.y.toFixed(1)},${fromPos.z.toFixed(1)} → ${toPos.x.toFixed(1)},${toPos.y.toFixed(1)},${toPos.z.toFixed(1)}`);
  
  // Dispatch event for visual effects system
  window.dispatchEvent(new CustomEvent('blinkEffect', {
    detail: {
      fromPosition: fromPos,
      toPosition: toPos,
      timestamp: Date.now()
    }
  }));
}

/**
 * Update blink state (call from game loop)
 */
export function updateBlink(): void {
  const now = Date.now();
  
  // Update i-frames
  if (blinkState.isInIFrames && now >= blinkState.iFramesEndTime) {
    blinkState.isInIFrames = false;
    console.log('⚡ I-frames ended');
  }
  
  // Note: regen disable and blink window are checked by external systems
}

/**
 * Check if player is currently in invincibility frames
 */
export function isInIFrames(): boolean {
  return blinkState.isInIFrames && Date.now() < blinkState.iFramesEndTime;
}

/**
 * Check if regeneration should be disabled
 */
export function isRegenDisabled(): boolean {
  return Date.now() < blinkState.regenDisabledUntil;
}

/**
 * Check if we're in the bonus damage window after blink
 */
export function isInBlinkWindow(): boolean {
  return Date.now() < blinkState.blinkWindowEndTime;
}

/**
 * Get current blink state for external systems
 */
export function getBlinkState(): BlinkState {
  return blinkState;
}

/**
 * Reset blink state (useful for respawn, etc.)
 */
export function resetBlinkState(): void {
  blinkState.isInIFrames = false;
  blinkState.iFramesEndTime = 0;
  blinkState.regenDisabledUntil = 0;
  blinkState.blinkWindowEndTime = 0;
} 