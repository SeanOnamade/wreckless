import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FirstPersonController } from './controller';

export interface PhysicsWorld {
  world: RAPIER.World;
  playerBody: RAPIER.RigidBody;
  playerController: RAPIER.KinematicCharacterController;
  fpsController: FirstPersonController;
  step: (deltaTime: number) => void;
}

export default async function initPhysics(scene: THREE.Scene, camera: THREE.Camera): Promise<PhysicsWorld> {
  // Initialize Rapier
  await RAPIER.init();
  
  // Create physics world
  const gravity = { x: 0.0, y: -30.0, z: 0.0 }; // Increased gravity to match controller
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
  groundMesh.castShadow = false; // Ground doesn't need to cast shadows
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
  
  // Create first-person controller
  const fpsController = new FirstPersonController(
    camera,
    playerBody,
    playerController,
    world
  );
  
  // Update function
  const step = (deltaTime: number) => {
    world.step();
    fpsController.update(deltaTime);
  };
  
  return {
    world,
    playerBody,
    playerController,
    fpsController,
    step
  };
} 