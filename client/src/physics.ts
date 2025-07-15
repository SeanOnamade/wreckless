import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FirstPersonController } from './controller';
import { loadExternalTrack, SPAWN_POS } from './track/ExternalTrack';
import { DeveloperTools } from './dev/DeveloperTools';

export interface PhysicsWorld {
  world: RAPIER.World;
  playerBody: RAPIER.RigidBody;
  playerController: RAPIER.KinematicCharacterController;
  fpsController: FirstPersonController;
  devTools: DeveloperTools;
  step: (deltaTime: number) => void;
}

export default async function initPhysics(scene: THREE.Scene, camera: THREE.Camera): Promise<PhysicsWorld> {
  // Initialize Rapier
  await RAPIER.init();
  
  // Create physics world
  // Note: Gravity mainly affects dynamic bodies, not kinematic character controller
  const gravity = { x: 0.0, y: -25.0, z: 0.0 }; // Balanced gravity (controller uses context-sensitive gravity)
  const world = new RAPIER.World(gravity);
  
  // Create ground
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.1, 50.0);
  world.createCollider(groundColliderDesc);
  
  // Add visual ground with texture
  const groundGeometry = new THREE.BoxGeometry(100, 0.2, 100);
  
  // Create a grid texture for better distance perception
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Fill with base color
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(0, 0, 512, 512);
  
  // Draw grid lines
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 2;
  
  const gridSize = 32; // Grid cell size
  for (let i = 0; i <= 512; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  
  // Add some diagonal lines for better depth perception
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += gridSize * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + gridSize, gridSize);
    ctx.stroke();
  }
  
  const groundTexture = new THREE.CanvasTexture(canvas);
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(8, 8); // Repeat texture 8 times in each direction
  
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    map: groundTexture,
    color: 0x888888,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.castShadow = false; // Ground doesn't need to cast shadows
  groundMesh.position.y = -0.1;
  scene.add(groundMesh);
  
  // Create external track
  await loadExternalTrack(scene, world);
  
  // Create player capsule
  const capsuleRadius = 0.5;
  const capsuleHeight = 1.0; // Half height
  
  // Create kinematic rigid body for player
  // Start at proper spawn position on track
  const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(SPAWN_POS.x, SPAWN_POS.y, SPAWN_POS.z);
  const playerBody = world.createRigidBody(playerBodyDesc);
  
  // Create capsule collider
  const playerColliderDesc = RAPIER.ColliderDesc.capsule(capsuleHeight, capsuleRadius);
  world.createCollider(playerColliderDesc, playerBody);
  
  // Create character controller
  const playerController = world.createCharacterController(0.01);
  playerController.setApplyImpulsesToDynamicBodies(true);
  playerController.enableAutostep(0.3, 0.1, true);
  playerController.enableSnapToGround(0.05); // Reduced for better ground detection
  playerController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
  playerController.setMinSlopeSlideAngle(30 * Math.PI / 180);
  
  // Create first-person controller
  const fpsController = new FirstPersonController(
    camera,
    playerBody,
    playerController,
    world
  );
  
  // Create developer tools
  const devTools = new DeveloperTools(playerBody);
  
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
    devTools,
    step
  };
} 