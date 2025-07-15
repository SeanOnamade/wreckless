// ===================================================================
// LEGACY BLAST IMPLEMENTATION - ARCHIVED FOR FALLBACK
// This is the old radial impulse system replaced by the new rocket jump
// Keep intact for comparison and potential fallback if needed
// ===================================================================

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface BlastAbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
}

export interface BlastState {
  isInLockout: boolean;
  lockoutEndTime: number;
}

// Global blast state (local-only for now)
let blastState: BlastState = {
  isInLockout: false,
  lockoutEndTime: 0
};

/**
 * Legacy Blast Jump - Radial impulse ability
 * Applies upward force to player and pushes nearby dynamic objects
 */
export function legacyBlast(context: BlastAbilityContext): void {
  const { playerBody, world, camera } = context;
  
  // Check lockout
  if (isInBlastLockout()) {
    console.log('💥 BLAST blocked - still in lockout period');
    return;
  }
  
  // Get player position
  const playerPos = playerBody.translation();
  const position = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Blast parameters
  const blastForce = 15.0; // Base blast force
  const blastRadius = 5.0; // Radius of effect (5m as requested)
  const upwardMultiplier = 1.5; // Extra upward force
  const lockoutDuration = 300; // 300ms lockout to prevent rapid firing
  const maxImpulse = 20.0; // Maximum impulse for nearby objects
  const minImpulse = 2.0; // Minimum impulse at max range
  
  // Get camera direction for forward component
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  // Create self blast impulse (upward + small forward)
  const selfImpulse = new THREE.Vector3(
    cameraDirection.x * 2.0, // Small forward component
    blastForce * upwardMultiplier, // Strong upward component
    cameraDirection.z * 2.0  // Small forward component
  );
  
  // Apply blast to player (kinematic body - handled via event)
  console.log(`💥 BLAST self-impulse: ${selfImpulse.x.toFixed(1)}, ${selfImpulse.y.toFixed(1)}, ${selfImpulse.z.toFixed(1)}`);
  window.dispatchEvent(new CustomEvent('blastSelfImpulse', {
    detail: { impulse: selfImpulse }
  }));
  
  // Find and blast nearby dynamic bodies
  const nearbyBodies = findNearbyDynamicBodies(world, position, blastRadius, playerBody);
  let affectedCount = 0;
  
  for (const bodyData of nearbyBodies) {
    const { body, distance } = bodyData;
    
    // Calculate impulse based on distance (inverse relationship)
    const distanceRatio = Math.max(0, 1 - (distance / blastRadius));
    const impulseStrength = minImpulse + (maxImpulse - minImpulse) * distanceRatio;
    
    // Calculate direction from blast center to body
    const bodyPos = body.translation();
    const direction = new THREE.Vector3(
      bodyPos.x - position.x,
      bodyPos.y - position.y + 0.5, // Add slight upward component
      bodyPos.z - position.z
    );
    
    // Normalize and scale by impulse strength
    if (direction.length() > 0.1) { // Avoid division by zero
      direction.normalize().multiplyScalar(impulseStrength);
      
      // Apply impulse to the body
      body.applyImpulse(direction, true);
      affectedCount++;
      
      console.log(`💥 Blasted body at distance ${distance.toFixed(1)}m with impulse ${impulseStrength.toFixed(1)}`);
    }
  }
  
  // Activate lockout
  activateBlastLockout(lockoutDuration);
  
  // Visual/audio feedback
  console.log(`💥 BLAST executed at position: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  console.log(`💥 Affected ${affectedCount} nearby objects within ${blastRadius}m radius`);
  
  // Dispatch event for visual effects
  window.dispatchEvent(new CustomEvent('abilityUsed', {
    detail: {
      ability: 'blast',
      position: position,
      force: blastForce,
      radius: blastRadius,
      affectedCount: affectedCount,
      selfImpulse: selfImpulse
    }
  }));
}

/**
 * Find dynamic rigid bodies within blast radius
 */
function findNearbyDynamicBodies(
  world: RAPIER.World, 
  center: THREE.Vector3, 
  radius: number,
  excludeBody: RAPIER.RigidBody
): Array<{ body: RAPIER.RigidBody; distance: number }> {
  const nearbyBodies: Array<{ body: RAPIER.RigidBody; distance: number }> = [];
  
  // Iterate through all rigid bodies in the world
  world.forEachRigidBody((body) => {
    // Skip the triggering player
    if (body.handle === excludeBody.handle) {
      return;
    }
    
    // Only affect dynamic bodies
    if (body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
      return;
    }
    
    // Check distance
    const bodyPos = body.translation();
    const bodyPosition = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
    const distance = center.distanceTo(bodyPosition);
    
    if (distance <= radius) {
      nearbyBodies.push({ body, distance });
    }
  });
  
  return nearbyBodies;
}

/**
 * Check if blast is currently in lockout period
 */
function isInBlastLockout(): boolean {
  return blastState.isInLockout && Date.now() < blastState.lockoutEndTime;
}

/**
 * Activate blast lockout for specified duration
 */
function activateBlastLockout(duration: number): void {
  blastState.isInLockout = true;
  blastState.lockoutEndTime = Date.now() + duration;
}

/**
 * Update blast state (call from game loop)
 */
export function updateLegacyBlast(): void {
  // Update lockout state
  if (blastState.isInLockout && Date.now() >= blastState.lockoutEndTime) {
    blastState.isInLockout = false;
    console.log('💥 Blast lockout ended');
  }
}

/**
 * Get current blast state
 */
export function getLegacyBlastState(): BlastState {
  return blastState;
}

/**
 * Reset blast state (useful for respawn, etc.)
 */
export function resetLegacyBlastState(): void {
  blastState.isInLockout = false;
  blastState.lockoutEndTime = 0;
} 