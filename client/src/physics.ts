import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SPAWN_POS, loadExternalTrack } from './track/ExternalTrack';
import { FirstPersonController } from './controller';
import { DeveloperTools } from './dev/DeveloperTools';
import type { LoadingScreen } from './ui/LoadingScreen';
import { PhysicsSafetyManager } from './physics/PhysicsSafetyManager';

export interface PhysicsWorld {
  world: RAPIER.World;
  playerBody: RAPIER.RigidBody;
  fpsController: FirstPersonController;
  devTools: DeveloperTools;
  step: (deltaTime: number) => void;
  isSafeForPhysicsQueries: () => boolean;
}

export default async function initPhysics(scene: THREE.Scene, camera: THREE.Camera, loadingScreen?: LoadingScreen): Promise<PhysicsWorld> {
  // Initialize RAPIER physics engine
  const rapier = await import('@dimforge/rapier3d-compat');
  await rapier.init();
  
  if (loadingScreen) {
    loadingScreen.setStepComplete('physics-engine', 'Physics engine loaded');
  }

  // Create physics world
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  const world = new rapier.World(gravity);

  // Initialize track loader and load model
  loadingScreen?.updateStatus('Loading race track...');
  
  try {
    await loadExternalTrack(scene, world);
    loadingScreen?.setStepComplete('race-track', 'Race track loaded');
    console.log('✅ Track loaded successfully');
  } catch (error) {
    console.error('❌ Track loading failed:', error);
    console.warn('⚠️ Continuing without external track');
    loadingScreen?.setStepComplete('race-track', 'Using fallback track');
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
  
  // Get the global physics safety manager
  const safetyManager = PhysicsSafetyManager.getInstance();
  
  // Update function with comprehensive safety tracking
  const step = (deltaTime: number) => {
    safetyManager.startPhysicsStep();
    try {
      world.step();
    } finally {
      safetyManager.endPhysicsStep();
    }
    fpsController.update(deltaTime);
  };
  
  // Safety check function for Rapier API calls
  const isSafeForPhysicsQueries = () => safetyManager.isSafeForPhysicsQueries();
  
  return {
    world,
    playerBody,
    fpsController,
    devTools,
    step,
    isSafeForPhysicsQueries
  };
} 