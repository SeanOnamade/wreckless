import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface GrappleAbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

export interface GrappleState {
  isActive: boolean;
  anchorPoint: THREE.Vector3 | null;
  joint: RAPIER.ImpulseJoint | null;
  hookMesh: THREE.Mesh | null;
  ropeMesh: THREE.Line | null;
  attachTime: number;
}

// Global grapple state (local-only for now)
let grappleState: GrappleState = {
  isActive: false,
  anchorPoint: null,
  joint: null,
  hookMesh: null,
  ropeMesh: null,
  attachTime: 0
};

/**
 * Grapple Swing - Rope joint ability
 * Shoots a grappling hook and creates a swing joint if it hits a valid anchor
 */
export function executeGrapple(context: GrappleAbilityContext): void {
  const { playerBody, world, camera, scene } = context;
  
  // If already grappling, release the grapple
  if (grappleState.isActive) {
    releaseGrapple(scene);
    return;
  }
  
  // Get player position and camera direction
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Get camera direction for grapple aim
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Grapple parameters
  const maxGrappleDistance = 20.0; // Max grapple range
  const hookSpeed = 50.0; // How fast the hook travels
  
  // Raycast to find grapple target
  const ray = new RAPIER.Ray(playerPosition, direction);
  const hit = world.castRay(ray, maxGrappleDistance, true);
  
  if (hit) {
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    const anchorPoint = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
    
    // Create grapple hook
    attachGrapple(context, anchorPoint);
    
    console.log(`🪝 GRAPPLE attached at distance: ${hit.timeOfImpact.toFixed(1)}m`);
  } else {
    console.log('🪝 GRAPPLE missed - no valid anchor point found');
    
    // Could add a failed grapple animation here
    // For now, just dispatch event for feedback
    window.dispatchEvent(new CustomEvent('grappleMissed', {
      detail: { direction: direction, maxDistance: maxGrappleDistance }
    }));
  }
  
  // Dispatch ability used event
  window.dispatchEvent(new CustomEvent('abilityUsed', {
    detail: {
      ability: 'grapple',
      position: playerPosition,
      direction: direction,
      hit: hit !== null
    }
  }));
}

/**
 * Attach grapple to a point and create swing joint
 */
function attachGrapple(context: GrappleAbilityContext, anchorPoint: THREE.Vector3): void {
  const { playerBody, world, scene } = context;
  
  // Create rope constraint
  const playerPos = playerBody.translation();
  const distance = anchorPoint.distanceTo(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
  
  // TODO: Create actual rope joint with Rapier
  // For now, we'll simulate with stored state and manual force application
  
  grappleState.isActive = true;
  grappleState.anchorPoint = anchorPoint.clone();
  grappleState.attachTime = Date.now();
  
  // Create visual hook and rope (placeholder)
  createGrappleVisuals(scene, anchorPoint, new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
  
  // Schedule auto-release at swing apex (simplified)
  setTimeout(() => {
    if (grappleState.isActive) {
      releaseGrapple(scene);
    }
  }, 3000); // 3 second max swing time
}

/**
 * Release the grapple and clean up
 */
function releaseGrapple(scene: THREE.Scene): void {
  if (!grappleState.isActive) return;
  
  // Remove joint if exists
  if (grappleState.joint) {
    // world.removeImpulseJoint(grappleState.joint);
    grappleState.joint = null;
  }
  
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
  grappleState.isActive = false;
  grappleState.anchorPoint = null;
  grappleState.attachTime = 0;
  
  console.log('🪝 GRAPPLE released');
  
  // Dispatch release event
  window.dispatchEvent(new CustomEvent('grappleReleased', {}));
}

/**
 * Create visual representations of hook and rope
 */
function createGrappleVisuals(scene: THREE.Scene, anchorPoint: THREE.Vector3, playerPos: THREE.Vector3): void {
  // Create hook mesh (small sphere at anchor point)
  const hookGeometry = new THREE.SphereGeometry(0.1, 8, 6);
  const hookMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  grappleState.hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
  grappleState.hookMesh.position.copy(anchorPoint);
  scene.add(grappleState.hookMesh);
  
  // Create rope line
  const points = [playerPos, anchorPoint];
  const ropeGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const ropeMaterial = new THREE.LineBasicMaterial({ color: 0x654321 });
  grappleState.ropeMesh = new THREE.Line(ropeGeometry, ropeMaterial);
  scene.add(grappleState.ropeMesh);
}

/**
 * Update grapple physics and visuals (call from game loop)
 */
export function updateGrapple(context: GrappleAbilityContext): void {
  if (!grappleState.isActive || !grappleState.anchorPoint) return;
  
  const { playerBody, scene } = context;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  // Update rope visual
  if (grappleState.ropeMesh) {
    const points = [playerPosition, grappleState.anchorPoint];
    const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
    grappleState.ropeMesh.geometry.dispose();
    grappleState.ropeMesh.geometry = newGeometry;
  }
  
  // TODO: Apply rope constraint forces
  // This would calculate the rope tension and apply forces to keep the player
  // at the correct distance from the anchor point
}

/**
 * Get current grapple state for external systems
 */
export function getGrappleState(): GrappleState {
  return grappleState;
} 