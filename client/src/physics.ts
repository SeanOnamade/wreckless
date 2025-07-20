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
  
  // Create physics world (fixed deprecation warning)
  // Note: Gravity mainly affects dynamic bodies, not kinematic character controller
  const world = new RAPIER.World({ x: 0.0, y: -25.0, z: 0.0 }); // Balanced gravity
  
  // Ground physics collider removed - only track and ceiling provide collision surfaces
  // This allows for proper floating track effect without invisible ground collision
  
  // Create external track with error handling
  try {
    await loadExternalTrack(scene, world);
    console.log('✅ Track loaded successfully');
  } catch (error) {
    console.error('❌ Track loading failed:', error);
    console.warn('⚠️ Continuing without external track - using ground plane only');
  }
  
  // Create player capsule
  const capsuleRadius = 0.5;
  const capsuleHeight = 1.0; // Half height
  
  // Create kinematic rigid body for player
  // Start at proper spawn position on track
  const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(SPAWN_POS.x, SPAWN_POS.y, SPAWN_POS.z);
  const playerBody = world.createRigidBody(playerBodyDesc);
  
  // CRITICAL: Tag player for HitVolume detection
  playerBody.userData = { 
    isPlayer: true, 
    id: 'localPlayer',
    type: 'Player'
  };
  
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