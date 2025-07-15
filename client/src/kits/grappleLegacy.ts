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
  ropeMesh: THREE.Mesh | null;
  predictionMesh: THREE.Mesh | null;
  attachTime: number;
  lastVerticalVelocity: number;
  passedApex: boolean;
}

// Global grapple state
let grappleState: GrappleState = {
  isSwinging: false,
  anchorPoint: null,
  ropeLength: 0,
  hookMesh: null,
  ropeMesh: null,
  predictionMesh: null,
  attachTime: 0,
  lastVerticalVelocity: 0,
  passedApex: false
};

// Grapple constants
const MAX_GRAPPLE_DISTANCE = 20.0;
const AIR_FORCE = 40.0;
const PREDICTION_SPHERE_RADIUS = 0.5;
const AUTO_RELEASE_TIME = 1.2; // seconds
const HOOK_VISUAL_SIZE = 0.15;
const ROPE_CONSTRAINT_FORCE = 800.0; // Force to maintain rope length
const ROPE_DAMPING = 0.85; // Damping for rope physics

// Store pressed keys for continuous input
const pressedKeys = new Set<string>();

/**
 * Grapple Swing - Omnidirectional rope joint ability
 */
export function executeGrapple(context: GrappleAbilityContext): void {
  const { playerBody, world, camera } = context;
  
  // If already grappling, release the grapple
  if (grappleState.isSwinging) {
    releaseGrapple(context);
    return;
  }
  
  // Get player position and camera direction
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Get camera direction for grapple aim
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Use spherecast for better hit detection
  const hit = performSphereCast(world, playerPosition, direction, MAX_GRAPPLE_DISTANCE, PREDICTION_SPHERE_RADIUS);
  
  if (hit) {
    const hitPoint = hit.point;
    const anchorPoint = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
    
    // Create grapple attachment with proper rope physics
    attachGrapple(context, anchorPoint, hit.distance);
    
    console.log(`🪝 Swing attached @ (${anchorPoint.x.toFixed(1)}, ${anchorPoint.y.toFixed(1)}, ${anchorPoint.z.toFixed(1)}) distance: ${hit.distance.toFixed(1)}m`);
    
    // Notify controller of swing state
    window.dispatchEvent(new CustomEvent('swingStateChanged', {
      detail: { isSwinging: true }
    }));
  } else {
    console.log('🪝 Swing missed - no valid anchor point found');
    
    // Put ability on whiff cooldown (0.5s)
    window.dispatchEvent(new CustomEvent('abilityWhiffed', {
      detail: { ability: 'grapple', cooldown: 0.5 }
    }));
  }
}

/**
 * Perform spherecast for grapple prediction and attachment
 */
function performSphereCast(world: RAPIER.World, origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, _radius: number) {
  const ray = new RAPIER.Ray(origin, direction);
  const hit = world.castRay(ray, maxDistance, true);
  
  if (hit) {
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    return {
      point: hitPoint,
      distance: hit.timeOfImpact,
      normal: null // Could get normal from collider if needed
    };
  }
  
  return null;
}

/**
 * Attach grapple to anchor point with manual rope physics
 */
function attachGrapple(context: GrappleAbilityContext, anchorPoint: THREE.Vector3, distance: number): void {
  const { playerBody, scene } = context;
  
  // Set rope physics state (no joints, manual physics)
  const ropeLength = Math.max(distance - 1.0, 3.0); // Minimum 3m rope
  
  grappleState.isSwinging = true;
  grappleState.anchorPoint = anchorPoint.clone();
  grappleState.ropeLength = ropeLength;
  grappleState.attachTime = Date.now();
  grappleState.lastVerticalVelocity = playerBody.linvel().y;
  grappleState.passedApex = false;
  
  // Create visual elements
  createGrappleVisuals(scene, anchorPoint, new THREE.Vector3(playerBody.translation().x, playerBody.translation().y, playerBody.translation().z));
  
  // Remove prediction sphere
  removePredictionMesh(scene);
  
  console.log(`🪝 Cable length: ${ropeLength.toFixed(1)}m`);
}

/**
 * Release the grapple and clean up
 */
function releaseGrapple(context: GrappleAbilityContext): void {
  const { scene } = context;
  
  if (!grappleState.isSwinging) return;
  
  // Remove visuals
  if (grappleState.hookMesh) {
    scene.remove(grappleState.hookMesh);
    grappleState.hookMesh = null;
  }
  
  if (grappleState.ropeMesh) {
    scene.remove(grappleState.ropeMesh);
    grappleState.ropeMesh = null;
  }
  
  // Reset state
  grappleState.isSwinging = false;
  grappleState.anchorPoint = null;
  grappleState.ropeLength = 0;
  grappleState.attachTime = 0;
  grappleState.passedApex = false;
  
  console.log('🪝 Swing released');
  
  // Notify controller of swing state change
  window.dispatchEvent(new CustomEvent('swingStateChanged', {
    detail: { isSwinging: false }
  }));
}

/**
 * Create visual representations of hook and rope using more reliable rendering
 */
function createGrappleVisuals(scene: THREE.Scene, anchorPoint: THREE.Vector3, playerPos: THREE.Vector3): void {
  // Create hook mesh (small sphere at anchor point)
  const hookGeometry = new THREE.SphereGeometry(HOOK_VISUAL_SIZE, 8, 6);
  const hookMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  grappleState.hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
  grappleState.hookMesh.position.copy(anchorPoint);
  scene.add(grappleState.hookMesh);
  
  // Create rope using TubeGeometry for better visibility
  const tubeGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([playerPos, anchorPoint]),
    8,
    0.02,
    8,
    false
  );
  const ropeMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown rope color
  grappleState.ropeMesh = new THREE.Mesh(tubeGeometry, ropeMaterial);
  scene.add(grappleState.ropeMesh);
}

/**
 * Update prediction visualization when not swinging
 */
function updatePredictionVisualization(context: GrappleAbilityContext): void {
  const { world, camera, scene } = context;
  
  if (grappleState.isSwinging) {
    removePredictionMesh(scene);
    return;
  }
  
  // Get player position and camera direction
  const playerBody = context.playerBody;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Perform prediction spherecast
  const hit = performSphereCast(world, playerPosition, direction, MAX_GRAPPLE_DISTANCE, PREDICTION_SPHERE_RADIUS);
  
  if (hit) {
    // Show prediction sphere at hit point (GREEN not red)
    if (!grappleState.predictionMesh) {
      const predGeometry = new THREE.SphereGeometry(0.3, 8, 6);
      const predMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,  // GREEN instead of red
        transparent: true, 
        opacity: 0.7 
      });
      grappleState.predictionMesh = new THREE.Mesh(predGeometry, predMaterial);
      scene.add(grappleState.predictionMesh);
    }
    
    // Update position and ensure visibility
    grappleState.predictionMesh.position.set(hit.point.x, hit.point.y, hit.point.z);
    grappleState.predictionMesh.visible = true;
  } else {
    // Hide prediction sphere if no hit
    if (grappleState.predictionMesh) {
      grappleState.predictionMesh.visible = false;
    }
  }
}

/**
 * Remove prediction mesh from scene
 */
function removePredictionMesh(_scene: THREE.Scene): void {
  if (grappleState.predictionMesh) {
    grappleState.predictionMesh.visible = false;
  }
}

/**
 * Apply rope physics constraints manually
 */
function applyRopePhysics(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging || !grappleState.anchorPoint) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Calculate current distance to anchor
  const currentDistance = playerPosition.distanceTo(grappleState.anchorPoint);
  
  // If rope is stretched beyond its length, apply constraint force
  if (currentDistance > grappleState.ropeLength) {
    // Calculate direction from player to anchor
    const constraintDirection = grappleState.anchorPoint.clone()
      .sub(playerPosition)
      .normalize();
    
    // Calculate how much the rope is overstretched
    const overstretch = currentDistance - grappleState.ropeLength;
    
    // Apply force proportional to overstretch (Hooke's law)
    const constraintForce = constraintDirection.multiplyScalar(
      ROPE_CONSTRAINT_FORCE * overstretch
    );
    
    // Apply the force to pull player toward anchor
    playerBody.applyImpulse(constraintForce, true);
    
    // Apply damping to current velocity for stability
    const currentVel = playerBody.linvel();
    const dampedVel = {
      x: currentVel.x * ROPE_DAMPING,
      y: currentVel.y * ROPE_DAMPING,
      z: currentVel.z * ROPE_DAMPING
    };
    playerBody.setLinvel(dampedVel, true);
  }
}

/**
 * Handle omnidirectional air control while swinging
 */
function handleAirControl(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging || !grappleState.anchorPoint) return;
  
  const { playerBody, camera } = context;
  
  // Get camera orientation vectors
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  const cameraRight = new THREE.Vector3();
  camera.getWorldDirection(cameraRight);
  cameraRight.cross(camera.up).normalize();
  
  const cameraLeft = cameraRight.clone().negate();
  
  // Apply air control forces based on input
  const forceVector = new THREE.Vector3();
  
  if (pressedKeys.has('KeyA')) {
    forceVector.add(cameraLeft.multiplyScalar(AIR_FORCE));
  }
  if (pressedKeys.has('KeyD')) {
    forceVector.add(cameraRight.multiplyScalar(AIR_FORCE));
  }
  if (pressedKeys.has('KeyW')) {
    forceVector.add(cameraDirection.multiplyScalar(AIR_FORCE * 0.7));
  }
  
  // Apply accumulated force
  if (forceVector.length() > 0) {
    playerBody.applyImpulse(forceVector, true);
  }
  
  // Handle cable length control
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  const currentDistance = playerPosition.distanceTo(grappleState.anchorPoint);
  
  if (pressedKeys.has('Space')) {
    // Shorten cable
    grappleState.ropeLength = Math.max(grappleState.ropeLength - 0.1, 2.0);
    
    // Apply additional pull force
    const pullDirection = grappleState.anchorPoint.clone().sub(playerPosition).normalize();
    const pullForce = pullDirection.multiplyScalar(AIR_FORCE * 2);
    playerBody.applyImpulse(pullForce, true);
    
    console.log(`🪝 Cable shorten: ${currentDistance.toFixed(1)}m -> ${grappleState.ropeLength.toFixed(1)}m`);
  }
  
  if (pressedKeys.has('KeyS')) {
    // Extend cable
    grappleState.ropeLength = Math.min(grappleState.ropeLength + 0.1, MAX_GRAPPLE_DISTANCE);
    console.log(`🪝 Cable extend: ${currentDistance.toFixed(1)}m -> ${grappleState.ropeLength.toFixed(1)}m`);
  }
}

/**
 * Update rope visual to match current player position
 */
function updateRopeVisual(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging || !grappleState.anchorPoint || !grappleState.ropeMesh) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Create new tube geometry for rope
  const ropeCurve = new THREE.CatmullRomCurve3([
    playerPosition,
    grappleState.anchorPoint
  ]);
  
  const newGeometry = new THREE.TubeGeometry(
    ropeCurve,
    8,
    0.02,
    8,
    false
  );
  
  // Update the rope mesh geometry
  grappleState.ropeMesh.geometry.dispose();
  grappleState.ropeMesh.geometry = newGeometry;
}

/**
 * Check for auto-release conditions
 */
function checkAutoRelease(context: GrappleAbilityContext): void {
  if (!grappleState.isSwinging) return;
  
  const { playerBody } = context;
  const currentTime = Date.now();
  const swingDuration = (currentTime - grappleState.attachTime) / 1000;
  
  // Auto-release after max time
  if (swingDuration > AUTO_RELEASE_TIME) {
    console.log(`🪝 Auto-release: max time (${AUTO_RELEASE_TIME}s) exceeded`);
    releaseGrapple(context);
    return;
  }
  
  // Auto-release at apex (when vertical velocity changes from + to -)
  const currentVerticalVel = playerBody.linvel().y;
  
  if (!grappleState.passedApex && grappleState.lastVerticalVelocity > 0.5 && currentVerticalVel < -0.5) {
    grappleState.passedApex = true;
    console.log(`🪝 Auto-release: passed apex (vel: ${grappleState.lastVerticalVelocity.toFixed(1)} -> ${currentVerticalVel.toFixed(1)})`);
    releaseGrapple(context);
    return;
  }
  
  grappleState.lastVerticalVelocity = currentVerticalVel;
}

/**
 * Update grapple physics and visuals (call from game loop)
 */
export function updateGrapple(context: GrappleAbilityContext): void {
  // Update prediction visualization when not swinging
  updatePredictionVisualization(context);
  
  // Handle swinging logic
  if (grappleState.isSwinging && grappleState.anchorPoint) {
    // Apply rope physics constraints
    applyRopePhysics(context);
    
    // Handle air control
    handleAirControl(context);
    
    // Update rope visual
    updateRopeVisual(context);
    
    // Check auto-release conditions
    checkAutoRelease(context);
  }
}

/**
 * Handle key down events for air control
 */
export function onKeyDown(event: KeyboardEvent): void {
  pressedKeys.add(event.code);
}

/**
 * Handle key up events for air control
 */
export function onKeyUp(event: KeyboardEvent): void {
  pressedKeys.delete(event.code);
}

/**
 * Get current grapple state for external systems
 */
export function getGrappleState(): GrappleState {
  return grappleState;
}

/**
 * Check if player is currently swinging (for speed override)
 */
export function isSwinging(): boolean {
  return grappleState.isSwinging;
} 