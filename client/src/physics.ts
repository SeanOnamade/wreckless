import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface PhysicsWorld {
  world: RAPIER.World;
  playerBody: RAPIER.RigidBody;
  playerController: RAPIER.KinematicCharacterController;
  step: () => void;
}

export default async function initPhysics(scene: THREE.Scene, camera: THREE.Camera): Promise<PhysicsWorld> {
  // Initialize Rapier
  await RAPIER.init();
  
  // Create physics world
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  const world = new RAPIER.World(gravity);
  
  // Create ground
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.1, 50.0);
  world.createCollider(groundColliderDesc);
  
  // Add visual ground
  const groundGeometry = new THREE.BoxGeometry(100, 0.2, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444,
    roughness: 0.8,
    metalness: 0.2
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.position.y = -0.1;
  scene.add(groundMesh);
  
  // Create player capsule
  const capsuleRadius = 0.5;
  const capsuleHeight = 1.0; // Half height
  
  // Create kinematic rigid body for player
  const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(0, capsuleHeight + capsuleRadius + 0.5, 0);
  const playerBody = world.createRigidBody(playerBodyDesc);
  
  // Create capsule collider
  const playerColliderDesc = RAPIER.ColliderDesc.capsule(capsuleHeight, capsuleRadius);
  world.createCollider(playerColliderDesc, playerBody);
  
  // Create character controller
  const playerController = world.createCharacterController(0.01);
  playerController.setApplyImpulsesToDynamicBodies(true);
  playerController.enableAutostep(0.5, 0.2, true);
  playerController.enableSnapToGround(0.5);
  
  // Visual representation (optional, for debugging)
  const capsuleGeometry = new THREE.CapsuleGeometry(capsuleRadius, capsuleHeight * 2, 4, 8);
  const capsuleMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5
  });
  const capsuleMesh = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
  capsuleMesh.castShadow = true;
  scene.add(capsuleMesh);
  
  // Update function
  const step = () => {
    world.step();
    
    // Update visual capsule position
    const translation = playerBody.translation();
    capsuleMesh.position.set(translation.x, translation.y, translation.z);
    
    // Update camera position to follow player
    camera.position.set(
      translation.x,
      translation.y + capsuleHeight,
      translation.z
    );
  };
  
  return {
    world,
    playerBody,
    playerController,
    step
  };
} 