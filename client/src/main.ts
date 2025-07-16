import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import initPhysics from './physics';
import type { PhysicsWorld } from './physics';
import { DebugUI } from './ui';
// import { GameMenu } from './menu';
import { LapController } from './systems/LapController';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { LapHUD } from './hud/Hud';
import { GameHUD } from './hud/GameHUD';
import { AbilityManager } from './kits/useAbility';
import { setPlayerClass, getCurrentPlayerKit } from './kits/classKit';
import { AbilityHUD } from './kits/AbilityHUD';
import { MeleeCombat, type MeleeTarget } from './combat';
import { DummyPlacementManager } from './combat/DummyPlacementManager';
import { DummyLoader } from './data/DummyLoader';
import { registerHitVolumes, getHitVolume } from './systems/HitVolume';
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
  const ceilingSize = 600; // 600x600 units (expanded for grapple accommodation)
  
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
 * Movement trail system for visual feedback with smooth fading
 */
class MovementTrail {
  private trailPoints: Array<{
    mesh: THREE.Mesh;
    spawnTime: number;
    position: THREE.Vector3;
  }> = [];
  private scene: THREE.Scene;
  private maxTrailLength = 30;
  private trailSpacing = 0.3; // Minimum distance between trail points
  private fadeTime = 2000; // Trail fades over 2 seconds
  private lastPosition: THREE.Vector3 | null = null;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  update(playerPosition: THREE.Vector3, activeKit: string): void {
    const now = Date.now();
    
    // Only add trail point if player has moved enough
    if (!this.lastPosition || playerPosition.distanceTo(this.lastPosition) > this.trailSpacing) {
      this.addTrailPoint(playerPosition, activeKit, now);
      this.lastPosition = playerPosition.clone();
    }
    
    // Update existing trail points with smooth fading
    const pointsToRemove: number[] = [];
    
    for (let i = 0; i < this.trailPoints.length; i++) {
      const point = this.trailPoints[i];
      const age = now - point.spawnTime;
      
      if (age > this.fadeTime) {
        // Remove expired points
        this.scene.remove(point.mesh);
        point.mesh.geometry.dispose();
        (point.mesh.material as THREE.Material).dispose();
        pointsToRemove.push(i);
      } else {
        // Update opacity based on age
        const fadeProgress = age / this.fadeTime;
        const opacity = Math.max(0, (1 - fadeProgress) * 0.8);
        const size = 0.08 + (1 - fadeProgress) * 0.12; // Start small, grow slightly, then fade
        
        // Update material opacity
        const material = point.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = opacity;
        
        // Subtle size animation
        const scale = size / 0.1; // Base size was 0.1
        point.mesh.scale.setScalar(scale);
      }
    }
    
    // Remove expired points (reverse order to maintain indices)
    for (let i = pointsToRemove.length - 1; i >= 0; i--) {
      this.trailPoints.splice(pointsToRemove[i], 1);
    }
    
    // Limit trail length
    while (this.trailPoints.length > this.maxTrailLength) {
      const point = this.trailPoints.shift()!;
      this.scene.remove(point.mesh);
      point.mesh.geometry.dispose();
      (point.mesh.material as THREE.Material).dispose();
    }
  }
  
  private addTrailPoint(position: THREE.Vector3, activeKit: string, spawnTime: number): void {
    const colors = {
      blast: 0xff0000,   // Red
      grapple: 0x00ff00, // Green
      blink: 0x0088ff    // Blue
    };
    
    const trailColor = colors[activeKit as keyof typeof colors] || 0xffffff;
    
    const geometry = new THREE.SphereGeometry(0.1, 6, 6);
    const material = new THREE.MeshBasicMaterial({
      color: trailColor,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    
    this.scene.add(mesh);
    this.trailPoints.push({
      mesh,
      spawnTime,
      position: position.clone()
    });
  }
  
  clear(): void {
    this.trailPoints.forEach(point => {
      this.scene.remove(point.mesh);
      point.mesh.geometry.dispose();
      (point.mesh.material as THREE.Material).dispose();
    });
    this.trailPoints = [];
    this.lastPosition = null;
  }
}

/**
 * Screen flash system for visual feedback
 */
class ScreenFlash {
  private overlay: HTMLDivElement;
  
  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000;
      background-color: red;
      opacity: 0;
      transition: opacity 0.1s ease-out;
    `;
    document.body.appendChild(this.overlay);
  }
  
  flash(color: string = 'red', duration: number = 300): void {
    this.overlay.style.backgroundColor = color;
    this.overlay.style.opacity = '0.4';
    
    setTimeout(() => {
      this.overlay.style.transition = `opacity ${duration}ms ease-out`;
      this.overlay.style.opacity = '0';
    }, 50);
  }
}

// Initialize UI
const debugUI = new DebugUI();
// const gameMenu = new GameMenu(); // Unused variable

// Initialize ability system
const abilityManager = new AbilityManager();
// AbilityHUD is self-initializing, no variable needed

// Initialize movement trail
let movementTrail: MovementTrail | null = null;

// Initialize screen flash system
const screenFlash = new ScreenFlash();

// gameMenu is used via event handlers

// Handle reset event from menu
window.addEventListener('game-reset', () => {
  if (physicsWorld) {
    physicsWorld.fpsController.reset();
  }
});

// Listen for respawn events to trigger red flash
window.addEventListener('playerRespawn', () => {
  screenFlash.flash('red', 400);
});

// Initialize physics and checkpoint system
let physicsWorld: PhysicsWorld | null = null;
let lapController: LapController | null = null;
let checkpointSystem: CheckpointSystem | null = null;
let lapHUD: LapHUD | null = null;
let gameHUD: GameHUD | null = null;
let meleeCombat: MeleeCombat | null = null;
let targetDummies: MeleeTarget[] = [];
let dummyPlacementManager: DummyPlacementManager | null = null;
let dummyLoader: DummyLoader | null = null;

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
  new AbilityHUD(abilityManager); // Self-initializing UI component
  
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
  
  // Initialize melee combat system
  meleeCombat = new MeleeCombat(world.world, camera, world.playerBody);
  
  // Initialize HitVolume system for pass-through damage
  registerHitVolumes(world.world, world.fpsController, meleeCombat);
  console.log('🎯 HitVolume system integrated into game loop');
  
  // Initialize dummy placement manager for level design
  dummyPlacementManager = new DummyPlacementManager(scene, world.world, camera, meleeCombat);
  
  // Initialize dummy loader for loading saved dummies
  dummyLoader = new DummyLoader(scene, world.world, meleeCombat);
  
  // Initialize visual feedback system
  setupVisualFeedback(camera, renderer);
  
  // Load racing dummies from saved positions
  if (dummyLoader && import.meta.env.DEV) {
    dummyLoader.loadDummies().then((loadedDummies) => {
      console.log(`🏎️ Loaded ${loadedDummies.length} racing dummies with speed boost mechanics`);
      targetDummies = loadedDummies;
      
      // Pass loaded dummies to placement manager for editing
      if (dummyPlacementManager) {
        dummyPlacementManager.setLoadedDummies(loadedDummies);
        console.log(`🔧 Edit mode ready! Use Ctrl+Alt+F to toggle editing of JSON dummies`);
      }
    });
  }
  
  // Create test target dummies for combat testing (disabled - using racing dummies instead)
  // if (import.meta.env.DEV) {
  //   // Create dummies around the spawn area for testing
  //   const dummyPositions = [
  //     new THREE.Vector3(5, 2, 5),   // Front-right
  //     new THREE.Vector3(-5, 2, 5),  // Front-left
  //     new THREE.Vector3(0, 2, 8),   // Front center
  //     new THREE.Vector3(8, 2, 0),   // Right side
  //     new THREE.Vector3(-8, 2, 0),  // Left side
  //   ];
  //   
  //   dummyPositions.forEach((pos, index) => {
  //     const dummy = new TargetDummy(scene, world.world, pos, `dummy_${index}`);
  //     targetDummies.push(dummy);
  //     meleeCombat!.addTarget(dummy);
  //   });
  //   
  //   console.log(`🎯 Created ${targetDummies.length} target dummies for combat testing`);
  // }
  
  // Handle melee attack events from mouse input
  window.addEventListener('meleeAttack', () => {
    if (meleeCombat && physicsWorld) {
      // Get the current velocity from the controller (same source as debug UI)
      const currentVelocity = physicsWorld.fpsController.getVelocity();
      meleeCombat.performMelee(currentVelocity);
    }
  });
  
  // Add developer class switching (keys 1, 2, 3)
  if (import.meta.env.DEV) {
    console.log('🎮 Ability System initialized:');
    console.log('  ⚡ Press E to use ability');
      console.log('  🔥 Press 1 for Blast class');
  console.log('  🪝 Press 2 for Grapple class');
  console.log('  ✨ Press 3 for Blink class');
  console.log('  🚀 Press L to toggle Rocket Jump / Legacy Blast');
  console.log('  📋 Press C to copy combat log to clipboard');
    console.log('🗡️ Melee Combat initialized:');
    console.log('  🖱️ Left Click (LMB) to melee attack');
    console.log('  🎯 Target dummies spawned for testing');
    console.log('🎯 Dummy Placement System ready:');
    console.log('  F - Place dummy at current position (supports midair!)');
    console.log('  Shift+F - Remove last placed dummy');
    console.log('  Ctrl+F - Export dummy positions');
    console.log('  Ctrl+Shift+F - Remove nearest dummy');
    console.log('  Alt+F - Toggle placement preview mode');
    
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
      } else if (event.code === 'KeyC') {
        // Copy combat log to clipboard
        if (debugUI) {
          const combatLog = debugUI.getCombatLog();
          const logText = combatLog.join('\n');
          navigator.clipboard.writeText(logText).then(() => {
            console.log('📋 Combat log copied to clipboard!');
            console.log('Combat log entries:', combatLog.length);
          }).catch(err => {
            console.error('Failed to copy combat log:', err);
            // Fallback: log the combat log to console
            console.log('📋 Combat Log (copy failed):');
            combatLog.forEach(entry => console.log(entry));
          });
        }
      }
    });
  }
  
  // Add ceiling for grapple testing
  addSwingTestCeiling(scene, physicsWorld?.world);
  
  // Initialize movement trail
  movementTrail = new MovementTrail(scene);
  
  animate();
});

// Visual feedback state
let screenShakeIntensity = 0;
let screenShakeDecay = 0.95;
let hitFlashIntensity = 0;
let hitFlashDecay = 0.9;

/**
 * Setup visual feedback system for special combat hits
 */
function setupVisualFeedback(_camera: THREE.Camera, _renderer: THREE.WebGLRenderer): void {
  // Listen for special hit effects
  window.addEventListener('specialHitEffect', (event: Event) => {
    const customEvent = event as CustomEvent;
    const { type } = customEvent.detail;
    
    if (type === 'crit') {
      // Grapple crit: Strong shake + red flash
      screenShakeIntensity = Math.max(screenShakeIntensity, 0.4);
      hitFlashIntensity = Math.max(hitFlashIntensity, 0.6);
      console.log('💥 GRAPPLE CRIT visual feedback triggered!');
    } else if (type === 'bonus') {
      // Blink bonus: Medium shake + blue flash
      screenShakeIntensity = Math.max(screenShakeIntensity, 0.25);
      hitFlashIntensity = Math.max(hitFlashIntensity, 0.4);
      console.log('⚡ BLINK BONUS visual feedback triggered!');
    }
  });
  
  // Create hit flash overlay
  const hitFlashOverlay = document.createElement('div');
  hitFlashOverlay.id = 'hit-flash-overlay';
  hitFlashOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999;
    opacity: 0;
    background: radial-gradient(circle, rgba(255,100,100,0.3) 0%, rgba(255,255,255,0.1) 100%);
    transition: opacity 0.1s ease-out;
  `;
  document.body.appendChild(hitFlashOverlay);
}

/**
 * Apply visual feedback effects each frame
 */
function updateVisualFeedback(camera: THREE.Camera): void {
  // Apply screen shake
  if (screenShakeIntensity > 0.01) {
    const shakeX = (Math.random() - 0.5) * screenShakeIntensity * 0.02;
    const shakeY = (Math.random() - 0.5) * screenShakeIntensity * 0.02;
    const shakeZ = (Math.random() - 0.5) * screenShakeIntensity * 0.01;
    
    // Apply shake to camera rotation
    camera.rotation.x += shakeX;
    camera.rotation.y += shakeY;
    camera.rotation.z += shakeZ;
    
    screenShakeIntensity *= screenShakeDecay;
  }
  
  // Apply hit flash
  if (hitFlashIntensity > 0.01) {
    const hitFlashOverlay = document.getElementById('hit-flash-overlay');
    if (hitFlashOverlay) {
      hitFlashOverlay.style.opacity = hitFlashIntensity.toString();
    }
    hitFlashIntensity *= hitFlashDecay;
  } else {
    const hitFlashOverlay = document.getElementById('hit-flash-overlay');
    if (hitFlashOverlay) {
      hitFlashOverlay.style.opacity = '0';
    }
  }
}

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
  
  // Update HitVolume system for pass-through damage
  const hitVolumeSystem = getHitVolume();
  if (hitVolumeSystem) {
    hitVolumeSystem.update(deltaTime);
  }
  
  // Update movement trail
  if (physicsWorld && movementTrail) {
    const position = physicsWorld.devTools.getCurrentPosition();
    const currentKit = getCurrentPlayerKit(); // Get current player class
    movementTrail.update(position, currentKit.className);
  }
  
  // Update visual feedback effects
  updateVisualFeedback(camera);
  
  // Update UI and checkpoint system
  if (physicsWorld) {
    const velocity = physicsWorld.fpsController.getVelocity();
    const grounded = physicsWorld.fpsController.getIsGrounded();
    const sliding = physicsWorld.fpsController.getIsSliding();
    const currentSpeed = physicsWorld.fpsController.getCurrentSpeed();
    const isRocketJumping = physicsWorld.fpsController.getIsRocketJumping();
    const rocketJumpSpeed = physicsWorld.fpsController.getRocketJumpSpeed();
    const isBlinkMomentum = physicsWorld.fpsController.getIsBlinkMomentum();
    const blinkMomentumSpeed = physicsWorld.fpsController.getBlinkMomentumSpeed();
    const position = physicsWorld.devTools.getCurrentPosition();
    debugUI.update(velocity, grounded, sliding, position, currentSpeed, isRocketJumping, rocketJumpSpeed, isBlinkMomentum, blinkMomentumSpeed);
    
    // Update combat UI and range indicators
    if (meleeCombat) {
      const currentKit = getCurrentPlayerKit();
      const meleeState = meleeCombat.getMeleeState();
      const playerPosition = new THREE.Vector3(position.x, position.y, position.z);
      const nearestTarget = meleeCombat.getNearestTargetInfo(playerPosition);
      
      // Get current melee range based on class
      let meleeRange = 3.6; // Base doubled range
      if (currentKit.className === 'blast') {
        meleeRange *= 1.25; // +25% for blast
      }
      
      // Update range indicators on all dummies
      targetDummies.forEach(dummy => {
        dummy.updateRangeIndicator?.(playerPosition, meleeRange);
      });
      
      // Update placed dummies range indicators too
      if (dummyPlacementManager) {
        dummyPlacementManager.getPlacedDummies().forEach(dummy => {
          dummy.updateRangeIndicator?.(playerPosition, meleeRange);
        });
      }
      
      debugUI.updateCombat({
        currentClass: currentKit.className,
        meleeCooldown: meleeState.cooldownRemaining,
        canMelee: meleeState.canMelee,
        nearestTargetHealth: nearestTarget
      });
    }
    
    // Update dummy placement manager
    if (dummyPlacementManager) {
      dummyPlacementManager.update();
    }
    
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
