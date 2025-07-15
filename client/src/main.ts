import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import initPhysics from './physics';
import type { PhysicsWorld } from './physics';
import { DebugUI } from './ui';
import { GameMenu } from './menu';
import { LapController } from './systems/LapController';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { LapHUD } from './hud/Hud';
import { GameHUD } from './hud/GameHUD';
import { AbilityManager } from './kits/useAbility';
import { setPlayerClass, getCurrentPlayerKit } from './kits/classKit';
import { AbilityHUD } from './kits/AbilityHUD';

// Archive confirmation
console.info("🗄️ Legacy swing archived:", ["grappleLegacy_v2.ts"]);

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x99D8F5); // Light sky blue (lighter than #87CEEB)
// scene.fog = new THREE.Fog(0x99D8F5, 50, 180); // Fog removed for better visibility

// Camera setup
const camera = new THREE.PerspectiveCamera(
  90, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.set(0, 2, 5);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Add crosshair to center of screen
const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
document.body.appendChild(crosshair);

// Lighting setup
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
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

/**
 * Add ceiling at Y=35 with grey-white checkerboard pattern for swing testing
 */
function addSwingTestCeiling(scene: THREE.Scene, world?: RAPIER.World): void {
  const ceilingY = 35;
  const ceilingSize = 200; // 200x200 units
  
  // Create ceiling geometry
  const ceilingGeometry = new THREE.PlaneGeometry(ceilingSize, ceilingSize);
  
  // Create checkerboard pattern texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  const tileSize = 32; // 16x16 tiles
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      const isEven = (x + y) % 2 === 0;
      ctx.fillStyle = isEven ? '#E0E0E0' : '#F8F8F8'; // Light grey and white
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8); // Repeat pattern 8x8 times
  
  // Create ceiling material
  const ceilingMaterial = new THREE.MeshLambertMaterial({ 
    map: texture,
    side: THREE.DoubleSide
  });
  
  // Create ceiling mesh
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2; // Rotate to face downward
  ceiling.position.set(0, ceilingY, 0);
  ceiling.receiveShadow = true;
  
  scene.add(ceiling);
  
  // Create physics collider for the ceiling (CRITICAL for grapple!)
  if (world) {
    const ceilingBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, ceilingY, 0)
    );
    const ceilingCollider = RAPIER.ColliderDesc.cuboid(ceilingSize / 2, 0.1, ceilingSize / 2);
    world.createCollider(ceilingCollider, ceilingBody);
    
    console.log(`🏗️ Added ceiling at Y=${ceilingY} with ${ceilingSize}x${ceilingSize} checkerboard pattern + collision`);
  } else {
    console.log(`🏗️ Added ceiling at Y=${ceilingY} with ${ceilingSize}x${ceilingSize} checkerboard pattern (no collision)`);
  }
}

/**
 * Movement trail system for visual feedback
 */
class MovementTrail {
  private trail: THREE.Vector3[] = [];
  private trailMeshes: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private maxTrailLength = 20;
  private trailSpacing = 0.5; // Minimum distance between trail points
  private lastPosition: THREE.Vector3 | null = null;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  update(playerPosition: THREE.Vector3, activeKit: string): void {
    // Only add trail point if player has moved enough
    if (!this.lastPosition || playerPosition.distanceTo(this.lastPosition) > this.trailSpacing) {
      this.trail.push(playerPosition.clone());
      this.lastPosition = playerPosition.clone();
      
      // Limit trail length
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }
    
    // Clear old trail meshes
    this.trailMeshes.forEach(mesh => this.scene.remove(mesh));
    this.trailMeshes = [];
    
    // Create new trail meshes
    const colors = {
      blast: 0xff0000,   // Red
      grapple: 0x00ff00, // Green
      blink: 0x0088ff    // Blue
    };
    
    const trailColor = colors[activeKit as keyof typeof colors] || 0xffffff;
    
    for (let i = 0; i < this.trail.length; i++) {
      const opacity = (i / this.trail.length) * 0.8; // Fade out older points
      const size = 0.1 + (i / this.trail.length) * 0.1; // Smaller for older points
      
      const geometry = new THREE.SphereGeometry(size, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: trailColor,
        transparent: true,
        opacity: opacity
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(this.trail[i]);
      
      this.scene.add(mesh);
      this.trailMeshes.push(mesh);
    }
  }
  
  clear(): void {
    this.trail = [];
    this.trailMeshes.forEach(mesh => this.scene.remove(mesh));
    this.trailMeshes = [];
    this.lastPosition = null;
  }
}

// Initialize UI
const debugUI = new DebugUI();
const gameMenu = new GameMenu();

// Initialize ability system
const abilityManager = new AbilityManager();
let abilityHUD: AbilityHUD | null = null;

// Initialize movement trail
let movementTrail: MovementTrail | null = null;

// gameMenu is used via event handlers

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
  
  // Initialize ability system with game context
  abilityManager.initialize({
    playerBody: world.playerBody,
    world: world.world,
    camera: camera,
    scene: scene
  });
  
  // Initialize ability HUD
  abilityHUD = new AbilityHUD(abilityManager);
  
  // Initialize lap controller with callbacks
  lapController = new LapController(
    (lapTime, totalLaps) => {
      if (import.meta.env.DEV) {
        console.log(`🏁 Lap ${totalLaps} completed in ${(lapTime / 1000).toFixed(2)}s`);
      }
      lapHUD?.flashLapComplete(lapTime);
      gameHUD?.onLapComplete(lapTime, totalLaps);
    },
    (checkpoint, isValid) => {
      if (import.meta.env.DEV) {
        console.log(`${isValid ? '✓' : '✗'} Checkpoint ${checkpoint} ${isValid ? 'valid' : 'invalid'}`);
      }
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
  
  // Add developer class switching (keys 1, 2, 3)
  if (import.meta.env.DEV) {
    console.log('🎮 Ability System initialized:');
    console.log('  ⚡ Press E to use ability');
    console.log('  🔥 Press 1 for Blast class');
    console.log('  🪝 Press 2 for Grapple class');
    console.log('  ✨ Press 3 for Blink class');
    console.log('  🚀 Press L to toggle Rocket Jump / Legacy Blast');
    
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Digit1') {
        setPlayerClass('blast');
        console.log('🔥 Switched to Blast class');
      } else if (event.code === 'Digit2') {
        setPlayerClass('grapple');
        console.log('🪝 Switched to Grapple class');
      } else if (event.code === 'Digit3') {
        setPlayerClass('blink');
        console.log('✨ Switched to Blink class');
      }
    });
  }
  
  // Add ceiling for grapple testing
  addSwingTestCeiling(scene, physicsWorld?.world);
  
  // Initialize movement trail
  movementTrail = new MovementTrail(scene);
  
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
  
  // Update movement trail
  if (physicsWorld && movementTrail) {
    const position = physicsWorld.devTools.getCurrentPosition();
    const currentKit = getCurrentPlayerKit(); // Get current player class
    movementTrail.update(position, currentKit.className);
  }
  
  // Update UI and checkpoint system
  if (physicsWorld) {
    const velocity = physicsWorld.fpsController.getVelocity();
    const grounded = physicsWorld.fpsController.getIsGrounded();
    const sliding = physicsWorld.fpsController.getIsSliding();
    const currentSpeed = physicsWorld.fpsController.getCurrentSpeed();
    const isRocketJumping = physicsWorld.fpsController.getIsRocketJumping();
    const rocketJumpSpeed = physicsWorld.fpsController.getRocketJumpSpeed();
    const position = physicsWorld.devTools.getCurrentPosition();
    debugUI.update(velocity, grounded, sliding, position, currentSpeed, isRocketJumping, rocketJumpSpeed);
    
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
