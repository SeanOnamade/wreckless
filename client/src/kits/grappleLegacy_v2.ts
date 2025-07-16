import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

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
}

// Pendulum physics constants (tweakable at top)
const AIR_STRAFE_FORCE = 40;      // Force for A/D
const FORWARD_BOOST = 25;         // Force for W  
const REEL_SPEED = 0.75;          // m per sec
const MAX_GRAPPLE_DISTANCE = 35.0; // Increased to reach ceiling at Y=35
const AUTO_DETACH_TIME = 6.0;      // Reduced from 15s to 6s as requested
const ROPE_CONSTRAINT_FORCE = 500.0; // Force to pull back when overstretched (reduced for gentler physics)
const INITIAL_SWING_BOOST = 30.0;    // Initial lateral momentum when attaching (increased)
const UPWARD_LIFT_FORCE = 500.0;     // Very strong upward force for initial pull-up

// Global grapple state
let grappleState: GrappleState = {
  isSwinging: false,
  anchorPoint: null,
  ropeLength: 0,
  hookMesh: null,
  ropeLine: null,
  predictionMesh: null,
  attachTime: 0
};

// Store pressed keys for continuous input
const pressedKeys = new Set<string>();

/**
 * TRUE PENDULUM SWING - Improved physics with impulse-based constraints
 */
export function executeGrapple(context: GrappleAbilityContext): void {
  const { playerBody, world, camera, scene } = context;
  
  // If already swinging, detach
  if (grappleState.isSwinging) {
    detachGrapple(context);
    return;
  }
  
  // Get player position and camera direction
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Ray/sphere-cast forward
  const hit = performSphereCast(world, playerPosition, direction, MAX_GRAPPLE_DISTANCE);
  
  if (hit) {
    const anchorPoint = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
    
    // PREVENT FLOOR ATTACHMENTS: Only allow grappling to points above the player
    if (anchorPoint.y <= playerPosition.y + 1.0) {
      console.log(`🚫 Grapple blocked: hit point Y=${anchorPoint.y.toFixed(1)} too low (player Y=${playerPosition.y.toFixed(1)})`);
      
      // Whiff cooldown for floor attempts
      window.dispatchEvent(new CustomEvent('abilityWhiffed', {
        detail: { ability: 'grapple', cooldown: 0.5 }
      }));
      return;
    }
    
    const ropeLength = hit.distance - 0.5; // hitDist - 0.5m
    
    // Store anchor and rope length
    grappleState.isSwinging = true;
    grappleState.anchorPoint = anchorPoint.clone();
    grappleState.ropeLength = Math.max(ropeLength, 3.0); // Min 3m
    grappleState.attachTime = Date.now();
    
    // Add initial swing momentum based on player's current velocity and camera direction
    addInitialSwingMomentum(context);
    
    // Create visuals
    createSwingVisuals(scene, anchorPoint, playerPosition);
    
    // Hide prediction sphere
    if (grappleState.predictionMesh) {
      grappleState.predictionMesh.visible = false;
    }
    
    // Notify controller of swing state (speed override)
    window.dispatchEvent(new CustomEvent('swingStateChanged', {
      detail: { isSwinging: true }
    }));
    
    console.log(`✅ Swing dist ${hit.distance.toFixed(1)}m, ropeLength ${grappleState.ropeLength.toFixed(1)}m`);
    
  } else {
    console.log('🪝 Grapple missed - no valid anchor point');
    
    // Whiff cooldown
    window.dispatchEvent(new CustomEvent('abilityWhiffed', {
      detail: { ability: 'grapple', cooldown: 0.5 }
    }));
  }
}

/**
 * Add initial swing momentum when attaching to prevent getting stuck
 */
function addInitialSwingMomentum(context: GrappleAbilityContext): void {
  const { playerBody } = context;
  
  if (!grappleState.anchorPoint) return;
  
  // Calculate direction toward anchor point for initial pull
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  const toAnchor = grappleState.anchorPoint.clone().sub(playerPosition).normalize();
  
  // Strong initial pull toward anchor point
  const pullForce = toAnchor.multiplyScalar(INITIAL_SWING_BOOST);
  
  // Add extra upward component to lift player off ground
  const upwardBoost = new THREE.Vector3(0, 25, 0);
  
  // Combine both forces
  const totalMomentum = pullForce.add(upwardBoost);
  
  playerBody.applyImpulse(totalMomentum, true);
  
  console.log(`🪝 Initial momentum toward anchor: pull=${INITIAL_SWING_BOOST}N, upward=25N`);
}

/**
 * Perform spherecast for grapple targeting
 */
function performSphereCast(world: RAPIER.World, origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number) {
  // Start raycast slightly ahead of player to avoid self-collision
  const rayOrigin = origin.clone().add(direction.clone().multiplyScalar(0.5));
  
  const ray = new RAPIER.Ray(rayOrigin, direction);
  const hit = world.castRay(ray, maxDistance, true);
  
  if (hit) {
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    const actualDistance = hit.timeOfImpact + 0.5; // Add back the offset
    
    // Ensure proper coordinate conversion from Rapier to Three.js
    return {
      point: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
      distance: actualDistance
    };
  }
  
  return null;
}

/**
 * Detach grapple and restore normal physics
 */
function detachGrapple(context: GrappleAbilityContext): void {
  const { scene } = context;
  
  if (!grappleState.isSwinging) return;
  
  // Remove visuals
  if (grappleState.hookMesh) {
    scene.remove(grappleState.hookMesh);
    grappleState.hookMesh = null;
  }
  
  if (grappleState.ropeLine) {
    scene.remove(grappleState.ropeLine);
    grappleState.ropeLine = null;
  }
  
  // Reset state
  grappleState.isSwinging = false;
  grappleState.anchorPoint = null;
  grappleState.ropeLength = 0;
  grappleState.attachTime = 0;
  
  // Notify controller (restore normal maxSpeed)
  window.dispatchEvent(new CustomEvent('swingStateChanged', {
    detail: { isSwinging: false }
  }));
  
  console.log('🪝 Swing released');
}

/**
 * Create swing visuals (hook + rope line)
 */
function createSwingVisuals(scene: THREE.Scene, anchorPoint: THREE.Vector3, playerPos: THREE.Vector3): void {
  // Hook at anchor point
  const hookGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  const hookMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  grappleState.hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
  grappleState.hookMesh.position.copy(anchorPoint);
  scene.add(grappleState.hookMesh);
  
  // Rope line using LineBasicMaterial
  const ropeGeometry = new THREE.BufferGeometry().setFromPoints([
    playerPos, anchorPoint
  ]);
  const ropeMaterial = new THREE.LineBasicMaterial({ 
    color: 0x8B4513, // Brown
    linewidth: 2 
  });
  grappleState.ropeLine = new THREE.Line(ropeGeometry, ropeMaterial);
  scene.add(grappleState.ropeLine);
}

/**
 * Update prediction sphere when not swinging
 */
function updatePrediction(context: GrappleAbilityContext): void {
  const { world, camera, scene } = context;
  
  if (grappleState.isSwinging) {
    // Hide prediction when swinging
    if (grappleState.predictionMesh) {
      grappleState.predictionMesh.visible = false;
    }
    return;
  }
  
  const playerBody = context.playerBody;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Perform raycast to find target
  const hit = performSphereCast(world, playerPosition, direction, MAX_GRAPPLE_DISTANCE);
  
  if (hit && hit.distance > 2.0 && hit.point.y > playerPosition.y + 1.0) { // Valid grapple point
    // Create prediction sphere if it doesn't exist
    if (!grappleState.predictionMesh) {
      const predGeometry = new THREE.SphereGeometry(0.2, 8, 6); // Slightly bigger for visibility
      const predMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,  // GREEN
        transparent: true, 
        opacity: 0.9 
      });
      grappleState.predictionMesh = new THREE.Mesh(predGeometry, predMaterial);
      scene.add(grappleState.predictionMesh);
    }
    
    // Update position with proper coordinate handling
    const hitPoint = hit.point;
    // Add small offset toward camera to make sphere more visible
    const offsetDirection = direction.clone().negate().multiplyScalar(0.3);
    const displayPosition = hitPoint.clone().add(offsetDirection);
    
    grappleState.predictionMesh.position.set(displayPosition.x, displayPosition.y, displayPosition.z);
    grappleState.predictionMesh.visible = true;
    
    // Debug logging (occasionally)
    if (Math.random() < 0.02) { // 2% chance to reduce spam
      console.log(`🎯 Valid grapple target @ (${hitPoint.x.toFixed(1)}, ${hitPoint.y.toFixed(1)}, ${hitPoint.z.toFixed(1)}) dist: ${hit.distance.toFixed(1)}m`);
    }
    
  } else {
    // No valid hit or hit is too low/close - hide prediction sphere
    if (grappleState.predictionMesh) {
      grappleState.predictionMesh.visible = false;
    }
  }
}

/**
 * FIXED ROPE PHYSICS - Gentle constraint that allows swinging motion
 */
function applyRopeConstraint(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging || !grappleState.anchorPoint) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Calculate current distance to anchor
  const currentDistance = playerPosition.distanceTo(grappleState.anchorPoint);
  const overstretch = currentDistance - grappleState.ropeLength;
  
  // Only apply constraint when significantly overstretched AND moving away
  if (overstretch > 0.5) { // Only when 50cm+ overstretched
    
    // Check if player is moving away from anchor
    const currentVelocity = playerBody.linvel();
    const velocity = new THREE.Vector3(currentVelocity.x, currentVelocity.y, currentVelocity.z);
    const toAnchor = grappleState.anchorPoint.clone().sub(playerPosition).normalize();
    const radialVelocity = velocity.dot(toAnchor);
    
    // Only apply constraint if moving away from anchor (negative radial velocity)
    if (radialVelocity < -1.0) { // Moving away at > 1 m/s
      
      // Apply gentle pulling force toward anchor
      const pullForce = toAnchor.multiplyScalar(ROPE_CONSTRAINT_FORCE * overstretch * 0.1); // Much gentler
      playerBody.applyImpulse(pullForce, true);
      
      // Slightly reduce outward velocity (don't eliminate completely)
      const dampedRadialVelocity = radialVelocity * 0.8; // Only 20% reduction
      const velocityCorrection = toAnchor.multiplyScalar((radialVelocity - dampedRadialVelocity));
      const newVelocity = velocity.add(velocityCorrection);
      playerBody.setLinvel(newVelocity, true);
      
      console.log(`🪝 Rope constraint: dist=${currentDistance.toFixed(1)}m, overstretch=${overstretch.toFixed(1)}m`);
    }
  }
  
  // Lift player off ground when first attaching (extended time)
  const swingTime = (Date.now() - grappleState.attachTime) / 1000;
  if (swingTime < 1.0) { // First 1000ms (extended)
    const upwardForce = new THREE.Vector3(0, UPWARD_LIFT_FORCE, 0); // Very strong upward force
    playerBody.applyImpulse(upwardForce, true);
    
    if (Math.random() < 0.05) {
      console.log(`🪝 Applying upward lift: ${UPWARD_LIFT_FORCE}N (time: ${swingTime.toFixed(2)}s)`);
    }
  }
  
  // Debug logging with less spam
  const currentVelocity = playerBody.linvel();
  const speed = Math.sqrt(currentVelocity.x ** 2 + currentVelocity.y ** 2 + currentVelocity.z ** 2);
  
  if (Math.random() < 0.05) { // Only log 5% of the time to reduce spam
    console.log(`Swing dist ${currentDistance.toFixed(1)}m, vel ${speed.toFixed(1)}m/s, overstretch ${overstretch.toFixed(1)}m, swingTime ${swingTime.toFixed(1)}s`);
  }
}

/**
 * Handle air control forces
 */
function handleAirControl(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging) return;
  
  const { playerBody, camera } = context;
  
  // Get camera orientation vectors
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  const cameraRight = new THREE.Vector3();
  camera.getWorldDirection(cameraRight);
  cameraRight.cross(camera.up).normalize();
  
  const cameraLeft = cameraRight.clone().negate();
  
  // Apply air strafe forces
  const forceVector = new THREE.Vector3();
  
  if (pressedKeys.has('KeyA')) {
    forceVector.add(cameraLeft.multiplyScalar(AIR_STRAFE_FORCE));
  }
  if (pressedKeys.has('KeyD')) {
    forceVector.add(cameraRight.multiplyScalar(AIR_STRAFE_FORCE));
  }
  if (pressedKeys.has('KeyW')) {
    forceVector.add(cameraDirection.multiplyScalar(FORWARD_BOOST));
  }
  
  // Apply force if any input
  if (forceVector.length() > 0) {
    playerBody.applyImpulse(forceVector, true);
  }
}

/**
 * Handle rope length control
 */
function handleRopeControl(): void {
  if (!grappleState.isSwinging) return;
  
  const deltaTime = 1/60; // Assume 60fps for now
  
  if (pressedKeys.has('Space')) {
    // Reel in (Space)
    const oldLength = grappleState.ropeLength;
    grappleState.ropeLength = Math.max(grappleState.ropeLength - REEL_SPEED * deltaTime, 3.0);
    if (Math.random() < 0.1) { // Reduce log spam
      console.log(`🪝 Reel in: ${oldLength.toFixed(1)}m -> ${grappleState.ropeLength.toFixed(1)}m`);
    }
  }
  
  if (pressedKeys.has('KeyS')) {
    // Reel out (S)
    const oldLength = grappleState.ropeLength;
    grappleState.ropeLength = Math.min(grappleState.ropeLength + REEL_SPEED * deltaTime, MAX_GRAPPLE_DISTANCE);
    if (Math.random() < 0.1) { // Reduce log spam
      console.log(`🪝 Reel out: ${oldLength.toFixed(1)}m -> ${grappleState.ropeLength.toFixed(1)}m`);
    }
  }
}

/**
 * Update rope visual line
 */
function updateRopeVisual(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging || !grappleState.anchorPoint || !grappleState.ropeLine) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Update rope line geometry
  const newGeometry = new THREE.BufferGeometry().setFromPoints([
    playerPosition, grappleState.anchorPoint
  ]);
  
  grappleState.ropeLine.geometry.dispose();
  grappleState.ropeLine.geometry = newGeometry;
}

/**
 * Check auto-detach conditions
 */
function checkAutoDetach(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging) return;
  
  const currentTime = Date.now();
  const swingDuration = (currentTime - grappleState.attachTime) / 1000;
  
  // Auto-detach after max time (much longer now)
  if (swingDuration > AUTO_DETACH_TIME) {
    console.log(`🪝 Auto-detach: elapsed ${swingDuration.toFixed(1)}s > ${AUTO_DETACH_TIME}s`);
    detachGrapple(context);
    return;
  }
  
  // Auto-detach if rope too long
  if (grappleState.ropeLength >= MAX_GRAPPLE_DISTANCE) {
    console.log(`🪝 Auto-detach: rope too long ${grappleState.ropeLength.toFixed(1)}m`);
    detachGrapple(context);
    return;
  }
}

/**
 * Main update loop - called every frame
 */
export function updateGrapple(context: GrappleAbilityContext): void {
  // Update prediction when not swinging
  updatePrediction(context);
  
  // Handle swing physics
  if (grappleState.isSwinging && grappleState.anchorPoint) {
    // Improved rope constraint (impulse-based, not position-based)
    applyRopeConstraint(context);
    
    // Air control forces
    handleAirControl(context);
    
    // Rope length control
    handleRopeControl();
    
    // Update rope visual
    updateRopeVisual(context);
    
    // Check auto-detach conditions
    checkAutoDetach(context);
  }
}

/**
 * Handle key down events
 */
export function onKeyDown(event: KeyboardEvent): void {
  pressedKeys.add(event.code);
}

/**
 * Handle key up events
 */
export function onKeyUp(event: KeyboardEvent): void {
  pressedKeys.delete(event.code);
}

/**
 * Get current grapple state
 */
export function getGrappleState(): GrappleState {
  return grappleState;
}

/**
 * Check if player is currently swinging (for controller speed override)
 */
export function isSwinging(): boolean {
  return grappleState.isSwinging;
} 