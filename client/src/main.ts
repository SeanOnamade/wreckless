// TODO: switch between ProceduralTrack and ExternalTrack via URL param `?debugTrack=proc`
import './style.css';
import * as THREE from 'three';
import initPhysics from './physics';
import type { PhysicsWorld } from './physics';
import { DebugUI } from './ui';
import { GameMenu } from './menu';
import { LapController } from './systems/LapController';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { LapHUD } from './hud/Hud';
import { GameHUD } from './hud/GameHUD';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x99D8F5); // Light sky blue (lighter than #87CEEB)
scene.fog = new THREE.Fog(0x99D8F5, 50, 180); // Reduced fog intensity (increased distances)

// Camera setup
const camera = new THREE.PerspectiveCamera(
  90, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.set(0, 2, 5);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.6); // Sky blue ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Brighter directional light
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024; // Reduced from default 2048 for performance
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Clock for delta time
const clock = new THREE.Clock();

// Fixed timestep for physics
const fixedTimeStep = 1 / 60; // 60 Hz physics
let accumulator = 0;

// Initialize UI
const debugUI = new DebugUI();
const gameMenu = new GameMenu();

// Suppress unused variable warning (gameMenu is used via event handlers)
void gameMenu;

// Handle reset event from menu
window.addEventListener('game-reset', () => {
  if (physicsWorld) {
    physicsWorld.fpsController.reset();
  }
});

// Initialize physics and checkpoint system
let physicsWorld: PhysicsWorld | null = null;
let lapController: LapController | null = null;
let checkpointSystem: CheckpointSystem | null = null;
let lapHUD: LapHUD | null = null;
let gameHUD: GameHUD | null = null;

initPhysics(scene, camera).then((world) => {
  physicsWorld = world;
  
  // Initialize lap controller with callbacks
  lapController = new LapController(
    (lapTime, totalLaps) => {
      console.log(`🏁 Lap ${totalLaps} completed in ${(lapTime / 1000).toFixed(2)}s`);
      lapHUD?.flashLapComplete(lapTime);
      gameHUD?.onLapComplete(lapTime, totalLaps);
    },
    (checkpoint, isValid) => {
      console.log(`${isValid ? '✓' : '✗'} Checkpoint ${checkpoint} ${isValid ? 'valid' : 'invalid'}`);
      lapHUD?.flashCheckpoint(checkpoint, isValid);
      gameHUD?.onCheckpointVisited(checkpoint, isValid);
    }
  );
  
  // Initialize checkpoint system
  checkpointSystem = new CheckpointSystem(scene, world.world, lapController);
  
  // Set checkpoint system on the FPS controller for respawning
  world.fpsController.setCheckpointSystem(checkpointSystem);
  
  // Initialize lap HUD (debug)
  lapHUD = new LapHUD(lapController, debugUI.getContainer());
  
  // Initialize game HUD (main UI)
  gameHUD = new GameHUD(lapController);
  
  animate();
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time to prevent spiral of death
  accumulator += deltaTime;
  
  // Fixed timestep physics
  while (accumulator >= fixedTimeStep) {
    if (physicsWorld) {
      physicsWorld.step(fixedTimeStep);
    }
    accumulator -= fixedTimeStep;
  }
  
  // Update UI and checkpoint system
  if (physicsWorld) {
    const velocity = physicsWorld.fpsController.getVelocity();
    const grounded = physicsWorld.fpsController.getIsGrounded();
    const sliding = physicsWorld.fpsController.getIsSliding();
    const position = physicsWorld.devTools.getCurrentPosition();
    debugUI.update(velocity, grounded, sliding, position);
    
    // Update checkpoint system
    if (checkpointSystem) {
      const playerPosition = new THREE.Vector3(position.x, position.y, position.z);
      checkpointSystem.update(playerPosition);
    }
    
    // Update lap HUD (debug)
    if (lapHUD) {
      lapHUD.update();
    }
    
    // Update game HUD (main UI)
    if (gameHUD) {
      gameHUD.update();
    }
  }
  
  renderer.render(scene, camera);
}
