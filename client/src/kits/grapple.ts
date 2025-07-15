import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SWING } from './swingConfig';
import { getCurrentPlayerKit, getRemainingCooldown } from './classKit';

export interface GrappleAbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

export interface GrappleState {
  isSwinging: boolean;
  anchorPoint: THREE.Vector3 | null;
  ropeLength: number;
  hookMesh: THREE.Mesh | null;
  ropeLine: THREE.Line | null;
  predictionMesh: THREE.Mesh | null;
  attachTime: number;
  lastInputTime: number; // Track for auto-release
}

// Global swing state
let swingState: GrappleState = {
  isSwinging: false,
  anchorPoint: null,
  ropeLength: 0,
  hookMesh: null,
  ropeLine: null,
  predictionMesh: null,
  attachTime: 0,
  lastInputTime: 0
};

// Pressed keys tracking for air control
const pressedKeys = new Set<string>();

// Listen for forced grapple release (during respawn, etc.)
window.addEventListener('forceReleaseGrapple', (event: Event) => {
  const customEvent = event as CustomEvent;
  const reason = customEvent.detail?.reason || 'forced';
  
  if (swingState.isSwinging) {
    // Create a dummy context for cleanup - we only need scene for visual cleanup
    const dummyContext = {
      scene: swingState.hookMesh?.parent || swingState.ropeLine?.parent
    } as any;
    
    if (dummyContext.scene) {
      releaseSwing(reason, dummyContext);
    } else {
      // Manual cleanup if no scene reference
      swingState.isSwinging = false;
      swingState.anchorPoint = null;
      swingState.ropeLength = 0;
      swingState.attachTime = 0;
      swingState.lastInputTime = 0;
      notifySwingState(false);
    }
  }
});

/**
 * TRUE PENDULUM SWING - Sphere constraint with momentum preservation
 */
export function executeGrapple(context: GrappleAbilityContext): void {
  const { playerBody, world, camera, scene } = context;
  
  // If already swinging, release
  if (swingState.isSwinging) {
    releaseSwing("manual", context);
    return;
  }
  
  // Get player position and camera direction
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Perform raycast
  const hit = performGrappleRaycast(world, playerPosition, direction);
  
  if (hit) {
    const anchorPoint = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
    
    // Validate grapple target (must be above player) - relaxed validation
    if (anchorPoint.y <= playerPosition.y + 0.5) {
      console.log(`🚫 Grapple blocked: anchor too low Y=${anchorPoint.y.toFixed(1)} (no cooldown applied)`);
      // NO COOLDOWN - just block the attempt
      return;
    }
    
    // Initialize swing state
    swingState.isSwinging = true;
    swingState.anchorPoint = anchorPoint.clone();
    swingState.ropeLength = Math.max(hit.distance - 0.5, SWING.minRope);
    swingState.attachTime = Date.now();
    swingState.lastInputTime = Date.now();
    
    // Create visuals
    createSwingVisuals(scene, anchorPoint, playerPosition);
    
    // Hide prediction sphere
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
    
    // Notify controller of swing state
    notifySwingState(true);
    
    console.log(`✅ Swing attached: dist=${hit.distance.toFixed(1)}m, rope=${swingState.ropeLength.toFixed(1)}m`);
    
  } else {
    console.log('🪝 Grapple missed - no valid target (no cooldown applied)');
    // NO COOLDOWN - allow immediate retry
  }
}

/**
 * Perform raycast for grapple targeting
 */
function performGrappleRaycast(world: RAPIER.World, origin: THREE.Vector3, direction: THREE.Vector3) {
  // Offset ray start to avoid self-collision
  const rayOrigin = origin.clone().add(direction.clone().multiplyScalar(0.5));
  
  const ray = new RAPIER.Ray(rayOrigin, direction);
  const hit = world.castRay(ray, SWING.maxDistance, true);
  
  if (hit) {
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    return {
      point: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
      distance: hit.timeOfImpact + 0.5 // Add back offset
    };
  }
  
  return null;
}

/**
 * CORE PENDULUM PHYSICS - True sphere constraint
 * Based on "ADVANCED SWINGING in 9 MINUTES" methodology
 */
function applyPendulumConstraint(context: GrappleAbilityContext): void {
  if (!swingState.isSwinging || !swingState.anchorPoint) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Step 1: Compute ropeVec = playerPos - anchor
  const ropeVec = playerPosition.clone().sub(swingState.anchorPoint);
  const currentDistance = ropeVec.length();
  
  // Step 2: If distance > ropeLength + slack, apply sphere constraint
  const effectiveRopeLength = swingState.ropeLength + SWING.ropeSlack;
  if (currentDistance > effectiveRopeLength) {
    
    // Project player onto sphere surface (using effective rope length)
    const constrainedPosition = swingState.anchorPoint.clone()
      .add(ropeVec.normalize().multiplyScalar(effectiveRopeLength));
    
    // Get current velocity
    const currentVel = playerBody.linvel();
    const velocity = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z);
    
    // Step 3: Decompose velocity into radial and tangential components
    const ropeDirection = ropeVec.normalize();
    const radialVelocity = velocity.dot(ropeDirection); // v_r (outward)
    const tangentialVelocity = velocity.clone().sub(ropeDirection.multiplyScalar(radialVelocity)); // v_t
    
    // Step 4: Handle radial velocity based on constraint
    let newRadialVelocity = 0;
    if (radialVelocity > 0) {
      // Moving away from anchor - zero or reflect with low elasticity
      newRadialVelocity = -radialVelocity * SWING.elasticity;
    } else {
      // Moving toward anchor - preserve
      newRadialVelocity = radialVelocity;
    }
    
    // Step 5: Reconstruct velocity with preserved tangential component
    const newVelocity = tangentialVelocity.add(ropeDirection.multiplyScalar(newRadialVelocity));
    
    // Apply constraint: position and velocity
    playerBody.setTranslation(constrainedPosition, true);
    playerBody.setLinvel(newVelocity, true);
    

  }
}

/**
 * Handle air control while swinging
 */
function handleAirControl(context: GrappleAbilityContext, deltaTime: number): void {
  if (!swingState.isSwinging) return;
  
  const { playerBody, camera } = context;
  let hasInput = false;
  
  // Get camera orientation for control directions
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  const cameraRight = new THREE.Vector3();
  camera.getWorldDirection(cameraRight);
  cameraRight.cross(camera.up).normalize();
  
  const forceVector = new THREE.Vector3();
  
  // A/D - Lateral tangential forces
  if (pressedKeys.has('KeyA')) {
    forceVector.add(cameraRight.clone().negate().multiplyScalar(SWING.lateralForce));
    hasInput = true;
  }
  if (pressedKeys.has('KeyD')) {
    forceVector.add(cameraRight.multiplyScalar(SWING.lateralForce));
    hasInput = true;
  }
  
  // W - Forward tangential force
  if (pressedKeys.has('KeyW')) {
    forceVector.add(cameraDirection.multiplyScalar(SWING.forwardForce));
    hasInput = true;
  }
  
  // Space - Pull in (shorten rope)
  if (pressedKeys.has('Space')) {
    const oldLength = swingState.ropeLength;
    swingState.ropeLength = Math.max(swingState.ropeLength - SWING.shortenRate * deltaTime, SWING.minRope);
    
    // Apply inward pull force
    if (swingState.anchorPoint) {
      const playerPos = playerBody.translation();
      const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      const pullDirection = swingState.anchorPoint.clone().sub(playerPosition).normalize();
      forceVector.add(pullDirection.multiplyScalar(SWING.pullForce));
    }
    
    hasInput = true;
    if (Math.random() < 0.1) {
      console.log(`🪝 Reel in: ${oldLength.toFixed(1)}m -> ${swingState.ropeLength.toFixed(1)}m`);
    }
  }
  
  // S - Let out (extend rope)
  if (pressedKeys.has('KeyS')) {
    const oldLength = swingState.ropeLength;
    swingState.ropeLength = Math.min(swingState.ropeLength + SWING.extendRate * deltaTime, SWING.maxRope);
    hasInput = true;
    
    if (Math.random() < 0.1) {
      console.log(`🪝 Reel out: ${oldLength.toFixed(1)}m -> ${swingState.ropeLength.toFixed(1)}m`);
    }
  }
  
  // Apply combined forces
  if (forceVector.length() > 0) {
    playerBody.applyImpulse(forceVector, true);
  }
  
  // Update input time for auto-release
  if (hasInput) {
    swingState.lastInputTime = Date.now();
  }
}

/**
 * Check auto-release conditions
 */
function checkAutoRelease(context: GrappleAbilityContext): void {
  if (!swingState.isSwinging) return;
  
  const currentTime = Date.now();
  const timeSinceInput = (currentTime - swingState.lastInputTime) / 1000;
  
  // Auto-release after no input
  if (timeSinceInput > SWING.maxSwingTime) {
    releaseSwing("auto_timeout", context);
    return;
  }
  
  // Auto-release if rope too long
  if (swingState.ropeLength >= SWING.autoReleaseDistance) {
    releaseSwing("overstretch", context);
    return;
  }
}

/**
 * Release swing and restore normal physics
 */
function releaseSwing(reason: string, context: GrappleAbilityContext): void {
  if (!swingState.isSwinging) return;
  
  const { scene } = context;
  
  // Remove visuals
  if (swingState.hookMesh) {
    scene.remove(swingState.hookMesh);
    swingState.hookMesh = null;
  }
  
  if (swingState.ropeLine) {
    scene.remove(swingState.ropeLine);
    swingState.ropeLine = null;
  }
  
  // Reset state
  swingState.isSwinging = false;
  swingState.anchorPoint = null;
  swingState.ropeLength = 0;
  swingState.attachTime = 0;
  swingState.lastInputTime = 0;
  
  // Capture current momentum before notifying controller
  const currentVel = context.playerBody.linvel();
  let releaseVelocity = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z);
  
  // SWING ARC MOMENTUM BOOST: Add extra upward momentum at bottom of swing arc
  if (swingState.anchorPoint && swingState.isSwinging) {
    const playerPos = context.playerBody.translation();
    const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    const anchorPoint = swingState.anchorPoint as THREE.Vector3; // Explicit type assertion
    const toAnchor = anchorPoint.clone().sub(playerPosition);
    const heightDiff = anchorPoint.y - playerPosition.y;
    const horizontalSpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);
    
    // If player is below anchor point and has significant horizontal speed (bottom of arc)
    if (heightDiff > swingState.ropeLength * 0.7 && horizontalSpeed > 5.0) {
      const arcBoost = Math.min(horizontalSpeed * 0.4, 15.0); // Convert some horizontal speed to upward
      releaseVelocity.y += arcBoost;
    }
  }
  
  // Send swing momentum to controller (like blast impulse)
  window.dispatchEvent(new CustomEvent('swingReleaseImpulse', {
    detail: { 
      velocity: releaseVelocity,
      reason: reason
    }
  }));
  
  // Notify controller
  notifySwingState(false);
  
  // Apply cooldown when swing is actually released (this is the only place cooldown is set for grapple)
  const kit = getCurrentPlayerKit();
  const remainingCooldown = getRemainingCooldown(kit);
  
  if (remainingCooldown <= 0) {
    // Set proper cooldown using the ability system
    kit.ability.lastUsed = Date.now();
    kit.ability.isReady = false;
    console.log(`🪝 Grapple cooldown applied after swing release (${reason})`);
  } else {
    console.log(`🪝 Swing released during existing cooldown - no additional cooldown applied`);
  }
  
  console.log(`🪝 Swing released (${reason})`);
}

/**
 * Update prediction sphere when not swinging
 */
function updatePredictionSphere(context: GrappleAbilityContext): void {
  const { world, camera, scene } = context;
  
  if (swingState.isSwinging) {
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
    return;
  }
  
  const playerBody = context.playerBody;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  const hit = performGrappleRaycast(world, playerPosition, direction);
  
  // Debug logging for prediction issues (occasional)
  if (Math.random() < 0.01) { // 1% chance to reduce spam
    if (hit) {
      const heightDiff = hit.point.y - playerPosition.y;
      console.log(`🎯 Raycast hit: dist=${hit.distance.toFixed(1)}m, height diff=${heightDiff.toFixed(1)}m, valid=${hit.distance > 1.0 && heightDiff > 0.5}`);
    } else {
      console.log(`🎯 Raycast miss: no hit detected`);
    }
  }
  
  if (hit && hit.distance > 1.0 && hit.point.y > playerPosition.y + 0.5) {
    // Create prediction sphere if needed
    if (!swingState.predictionMesh) {
      const geometry = new THREE.SphereGeometry(0.2, 8, 6);
      const material = new THREE.MeshBasicMaterial({ 
        color: SWING.predictionColor, 
        transparent: true, 
        opacity: 0.9 
      });
      swingState.predictionMesh = new THREE.Mesh(geometry, material);
      scene.add(swingState.predictionMesh);
    }
    
    // Position sphere at hit point
    const hitPoint = hit.point;
    const offset = direction.clone().negate().multiplyScalar(0.3);
    const displayPosition = hitPoint.clone().add(offset);
    
    swingState.predictionMesh.position.copy(displayPosition);
    swingState.predictionMesh.visible = true;
    
  } else {
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
  }
}

/**
 * Create visual elements (hook + rope)
 */
function createSwingVisuals(scene: THREE.Scene, anchorPoint: THREE.Vector3, playerPos: THREE.Vector3): void {
  // Hook sphere at anchor
  const hookGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  const hookMaterial = new THREE.MeshBasicMaterial({ color: SWING.hookColor });
  swingState.hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
  swingState.hookMesh.position.copy(anchorPoint);
  scene.add(swingState.hookMesh);
  
  // Rope line
  const ropeGeometry = new THREE.BufferGeometry().setFromPoints([playerPos, anchorPoint]);
  const ropeMaterial = new THREE.LineBasicMaterial({ color: SWING.ropeColor, linewidth: 2 });
  swingState.ropeLine = new THREE.Line(ropeGeometry, ropeMaterial);
  scene.add(swingState.ropeLine);
}

/**
 * Update rope visual line
 */
function updateRopeVisual(context: GrappleAbilityContext): void {
  if (!swingState.isSwinging || !swingState.anchorPoint || !swingState.ropeLine) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const newGeometry = new THREE.BufferGeometry().setFromPoints([
    playerPosition, swingState.anchorPoint
  ]);
  
  swingState.ropeLine.geometry.dispose();
  swingState.ropeLine.geometry = newGeometry;
}

// Helper functions

function notifySwingState(isSwinging: boolean): void {
  window.dispatchEvent(new CustomEvent('swingStateChanged', {
    detail: { isSwinging }
  }));
}

/**
 * Main update loop - TRUE PENDULUM PHYSICS
 */
export function updateGrapple(context: GrappleAbilityContext, deltaTime: number = 1/60): void {
  // Always update prediction sphere
  updatePredictionSphere(context);
  
  // Handle swing physics
  if (swingState.isSwinging && swingState.anchorPoint) {
    // Step 1: Apply gravity + air control forces
    handleAirControl(context, deltaTime);
    
    // Step 2: Apply pendulum constraint (sphere projection + velocity decomposition)
    applyPendulumConstraint(context);
    
    // Step 3: Update visuals
    updateRopeVisual(context);
    
    // Step 4: Check auto-release conditions
    checkAutoRelease(context);
  }
}

// Input handling
export function onKeyDown(event: KeyboardEvent): void {
  pressedKeys.add(event.code);
}

export function onKeyUp(event: KeyboardEvent): void {
  pressedKeys.delete(event.code);
}

// State accessors
export function getGrappleState(): GrappleState {
  return swingState;
}

export function isSwinging(): boolean {
  return swingState.isSwinging;
}

/**
 * STEP 5: Debug hooks for testing
 */
function debugSwing(): void {
  if (swingState.isSwinging && swingState.anchorPoint) {
    const currentTime = Date.now();
    const swingDuration = (currentTime - swingState.attachTime) / 1000;
    const timeSinceInput = (currentTime - swingState.lastInputTime) / 1000;
    
    console.log(`
🐛 SWING DEBUG STATUS:
isSwinging: ${swingState.isSwinging}
anchorPoint: (${swingState.anchorPoint.x.toFixed(1)}, ${swingState.anchorPoint.y.toFixed(1)}, ${swingState.anchorPoint.z.toFixed(1)})
ropeLength: ${swingState.ropeLength.toFixed(1)}m (min: ${SWING.minRope}m, max: ${SWING.maxRope}m)
swingDuration: ${swingDuration.toFixed(1)}s
timeSinceInput: ${timeSinceInput.toFixed(1)}s (auto-release at ${SWING.maxSwingTime}s)
config: maxDist=${SWING.maxDistance}m, lateralF=${SWING.lateralForce}N, pullF=${SWING.pullForce}N
`);
    
    // Force release for testing
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Release swing for testing?')) {
        // Need to pass context - this is a simplified version
        console.log('🪝 Debug force release');
        swingState.isSwinging = false;
        swingState.anchorPoint = null;
        swingState.ropeLength = 0;
        notifySwingState(false);
      }
    } else {
      console.log('🪝 Debug force release (no confirmation)');
      swingState.isSwinging = false;
      swingState.anchorPoint = null;
      swingState.ropeLength = 0;
      notifySwingState(false);
    }
    
  } else {
    console.log(`
🐛 SWING DEBUG STATUS:
isSwinging: false
Ready to grapple - press E to test swing system
config: maxDist=${SWING.maxDistance}m, lateralF=${SWING.lateralForce}N, pullF=${SWING.pullForce}N
`);
  }
}

// Expose debug function to window
if (typeof window !== 'undefined') {
  (window as any).debugSwing = debugSwing;
  console.log('🧪 Debug hook enabled: Call window.debugSwing() for swing status & force release');
} 