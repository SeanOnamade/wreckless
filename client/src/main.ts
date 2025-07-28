import './style.css';
import { LoadingScreen } from './ui/LoadingScreen';

// Initialize loading screen immediately
const loadingScreen = new LoadingScreen();
loadingScreen.updateStatus('Initializing game engine...');

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import initPhysics from './physics';
import type { PhysicsWorld } from './physics';
import { DebugUI } from './ui';

import { LapController } from './systems/LapController';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { LapHUD } from './hud/Hud';
import { GameHUD } from './hud/GameHUD';
import { AbilityManager } from './kits/useAbility';
import { setPlayerClass, getCurrentPlayerKit } from './kits/classKit';
import { type PlayerClass } from './kits/classKit';
import { AbilityHUD } from './kits/AbilityHUD';
import { MeleeCombat, type MeleeTarget } from './combat';
import { TargetDummy } from './combat/TargetDummy';
import { DummyPlacementManager } from './combat/DummyPlacementManager';
import { DummyLoader } from './data/DummyLoader';
import { PlayerHealth } from './player/PlayerHealth';
import { HealthHUD } from './hud/HealthHUD';
import { TestingHelpHUD } from './hud/TestingHelpHUD';
import './net'; // Initialize networking layer (only active with #online)
import { MultiplayerManager, Network } from './net';
import { registerHitVolumes, getHitVolume } from './systems/HitVolume';
import { RaceRoundSystem } from './systems/RaceRoundSystem';
import { ScoreHUD } from './hud/ScoreHUD';
import { RoundStartUI } from './hud/RoundStartUI';
import { RoundEndUI } from './hud/RoundEndUI';

// Camera effects imports
import { CameraEffects } from './effects/CameraEffectsManager';
import { SpeedFovEffect } from './effects/SpeedFovEffect';
import { WindStreakEffect } from './effects/WindStreakEffect';
import { BlinkZoomEffect } from './effects/BlinkZoomEffect';
import { BoostShakeEffect } from './effects/BoostShakeEffect';
import { HitShakeEffect } from './effects/HitShakeEffect';
import { BlastShakeEffect } from './effects/BlastShakeEffect';
import { CheckpointHitEffect } from './effects/CheckpointHitEffect';

// Scene Backdrop System
import { SceneBackdrop } from './visual/SceneBackdrop';
import { LavaKillzone } from './visual/LavaKillzone';

// Ability visual effects
import { BlinkScreenFlash } from './effects/BlinkScreenFlash';
import { BlastExplosionRing } from './effects/BlastExplosionRing';
import { BlinkRingEffect } from './effects/BlinkRingEffect';
import { GrappleLatchRing } from './effects/GrappleLatchRing';

// Trail System
import { TrailSystem } from './visual/TrailSystem';

// Boost Overlay System
import { BoostOverlay } from './visual/BoostOverlay';



// HUD Toggle System
import { HUDToggleSystem } from './hud/HUDToggleSystem';

// Day 6 Sprint: Game State Management
import { gameStateManager } from './state/GameStateManager';
import { HomeScreen } from './ui/HomeScreen';
import { ClassSelection } from './ui/ClassSelection';
import { LobbyScreen } from './ui/LobbyScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { GameMenu } from './menu';

// Audio System
import { AudioManager } from './audio/AudioManager';

import { DummyPhysicsManager } from './combat/DummyPhysicsManager';

// Minimal crash prevention - keep animation loops synchronized

// Character Animation System
import { AutoCharacterLoader } from './player/AutoCharacterLoader';

console.info("🗄️ Legacy swing archived:", ["grappleLegacy_v2.ts"]);

// Scene setup
const scene = new THREE.Scene();
// Background and fog now handled by SceneBackdrop system



// Initialize scene backdrop
const sceneBackdrop = new SceneBackdrop(scene);
sceneBackdrop.initialize();

// Initialize lava killzone
const lavaKillzone = new LavaKillzone(scene);
lavaKillzone.initialize();

// Make lava killzone globally accessible for settings
(window as any).lavaKillzone = lavaKillzone;

// Camera setup (increased far plane to prevent sky clipping)
const camera = new THREE.PerspectiveCamera(
  90, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  5000  // Increased from 1000 to prevent sky sphere clipping
);
camera.position.set(0, 2, 5);



// Initialize camera effects system
CameraEffects.setCamera(camera);
const speedFovEffect = new SpeedFovEffect();
const boostShakeEffect = new BoostShakeEffect();
const hitShakeEffect = new HitShakeEffect();
const blastShakeEffect = new BlastShakeEffect();
const blinkZoomEffect = new BlinkZoomEffect();
const windStreakEffect = new WindStreakEffect();
const checkpointHitEffect = new CheckpointHitEffect();

// Register all camera effects
CameraEffects.register(speedFovEffect);
CameraEffects.register(boostShakeEffect);
CameraEffects.register(hitShakeEffect);
CameraEffects.register(blastShakeEffect);
CameraEffects.register(blinkZoomEffect);
CameraEffects.register(windStreakEffect);
CameraEffects.register(checkpointHitEffect);

// Initialize ability visual effects
const blinkScreenFlash = new BlinkScreenFlash();
blinkScreenFlash.initialize();

const blastExplosionRing = new BlastExplosionRing();
blastExplosionRing.setScene(scene);
blastExplosionRing.initialize();

const blinkRingEffect = new BlinkRingEffect();
blinkRingEffect.setScene(scene);
blinkRingEffect.initialize();

const grappleLatchRing = new GrappleLatchRing();
grappleLatchRing.setScene(scene);
grappleLatchRing.initialize();

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

// Initialize multiplayer manager (only active if online)
let multiplayerManager: MultiplayerManager | null = null;

/**
 * Add invisible sky plane for grapple targeting (performance-optimized)
 */
function addInvisibleSkyPlane(_scene: THREE.Scene, world?: RAPIER.World): void {
  const skyY = 30; // Lower for easier access, still above all track geometry  
  const skySize = 600; // Optimized size - still covers full track area
  
  // Create physics collider only (no visual mesh)
  if (world) {
    const skyBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, skyY, 0)
    );
    const skyCollider = RAPIER.ColliderDesc.cuboid(skySize / 2, 0.1, skySize / 2);
    world.createCollider(skyCollider, skyBody);

  }
}



// Old MovementTrail class removed - now using TrailSystem

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

// Initialize HUD toggle system
const hudToggle = new HUDToggleSystem();

// Register debug UI elements
hudToggle.registerDebugElement(debugUI.getContainer());

// Initialize boost overlay system
const boostOverlay = new BoostOverlay();
// Mark as intentionally used (self-managing UI component)
void boostOverlay;

// Initialize PvP Player Health System
new PlayerHealth();

// Note: Player health UI is now handled by HealthHUD.ts
// (Removed duplicate event listener that was conflicting with HealthHUD)

// Initialize ability system
const abilityManager = new AbilityManager();
// AbilityHUD is self-initializing, no variable needed

// Initialize movement trail
let movementTrail: TrailSystem | null = null;



// Initialize screen flash system
const screenFlash = new ScreenFlash();

// Initialize pause menu system
new GameMenu(); // Self-initializing menu system

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

// Listen for dummy hit events to trigger green flash
window.addEventListener('meleeHit', () => {
  screenFlash.flash('green', 200);
});

window.addEventListener('passthroughHit', () => {
  screenFlash.flash('green', 200);
});

// Listen for round reset to reset lap controller and checkpoint system
window.addEventListener('roundReset', () => {
  if (lapController) {
    lapController.reset();
    console.log('🔄 Lap controller reset');
  }
  if (checkpointSystem) {
    checkpointSystem.reset();
    console.log('🔄 Checkpoint system reset');
  }
});

// Listen for player position reset
window.addEventListener('resetPlayerPosition', () => {
  if (physicsWorld) {
    physicsWorld.fpsController.reset();
    
    // Reset trail system to prevent jarring lines across the map
    if (movementTrail) {
      const newPosition = physicsWorld.devTools.getCurrentPosition();
      movementTrail.resetToPosition(newPosition);
    }
    
    console.log('🔄 Player position reset to spawn');
  }
});

// Listen for spawn position reset (always spawn, not checkpoint)
window.addEventListener('resetToSpawn', () => {
  if (physicsWorld) {
    physicsWorld.fpsController.resetToSpawn();
    
    // Reset trail system to prevent jarring lines across the map
    if (movementTrail) {
      const newPosition = physicsWorld.devTools.getCurrentPosition();
      movementTrail.resetToPosition(newPosition);
    }
    
    console.log('🏠 Player reset to spawn position');
  }
});

// Listen for combat log clear
window.addEventListener('clearCombatLog', () => {
  window.dispatchEvent(new CustomEvent('combatLogClear'));
  console.log('🔄 Combat log cleared');
});

// Listen for dummy reset
window.addEventListener('resetAllDummies', () => {
  // Reset all target dummies
  targetDummies.forEach(dummy => {
    if (dummy.resetHealth) {
      dummy.resetHealth();
    }
  });
  
  // Reset placement manager dummies too
  if (dummyPlacementManager) {
    dummyPlacementManager.getPlacedDummies().forEach(dummy => {
      if (dummy.resetHealth) {
        dummy.resetHealth();
      }
    });
  }
  
  // All dummies reset
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
let roundSystem: RaceRoundSystem | null = null;
// Round UI components (self-managing, no direct references needed)
let _scoreHUD: ScoreHUD | null = null;
let _roundStartUI: RoundStartUI | null = null;
let _roundEndUI: RoundEndUI | null = null;

// Day 6 Sprint: UI State Management
let homeScreen: HomeScreen | null = null;
let classSelection: ClassSelection | null = null;
let lobbyScreen: LobbyScreen | null = null;
let settingsScreen: SettingsScreen | null = null;

// Audio System
let audioManager: AudioManager | null = null;


// Character Animation System
let autoCharacterLoader: AutoCharacterLoader | null = null;

initPhysics(scene, camera, loadingScreen).then((world) => {
  physicsWorld = world;
  
  // Set up player respawn event handler (now that physicsWorld is available)
  window.addEventListener('playerRespawn', (event: Event) => {
    const customEvent = event as CustomEvent;
    const reason = customEvent.detail?.reason || 'unknown';
    
    // Actually respawn the player
    if (physicsWorld) {
      physicsWorld.fpsController.reset();
      
      // Reset trail system to prevent jarring lines across the map
      if (movementTrail) {
        const newPosition = physicsWorld.devTools.getCurrentPosition();
        movementTrail.resetToPosition(newPosition);
      }
      
      if (import.meta.env.DEV) {
        console.log(`✅ Player reset completed for reason: ${reason}`);
      }
    } else {
      console.error('❌ Cannot respawn: physicsWorld not available');
    }
  });
  
  // Initialize ability system with game context
  abilityManager.initialize({
    playerBody: world.playerBody,
    world: world.world,
    camera: camera,
    scene: scene
  });
  
  // Initialize ability HUD
  new AbilityHUD(abilityManager); // Self-initializing UI component
  
  // Initialize AutoCharacterLoader system for character portraits and animations
  loadingScreen.updateStatus('Initializing character system...');
  autoCharacterLoader = new AutoCharacterLoader();
  
  // Track animation loading progress from startup preload
  window.addEventListener('animationLoadingProgress', (event: Event) => {
    const customEvent = event as CustomEvent<{ loaded: number, total: number, isComplete: boolean }>;
    const { loaded, total, isComplete } = customEvent.detail;
    
    if (isComplete) {
      loadingScreen.setStepComplete('character-animations', 'Character animations ready');
    } else {
      loadingScreen.updateStatus(`Loading character animations... (${loaded}/${total})`);
    }
  });
  
  // Preload all character animations ONCE during startup
  console.log('🎭 Starting one-time animation preload...');
  autoCharacterLoader.preloadAllCharacterAnimations();
  
  // Legacy systems DISABLED to prevent conflicts
  // characterSystem = new CharacterSystem(scene, camera as THREE.PerspectiveCamera);
  // simpleTest = new SimpleCharacterTest(scene, camera as THREE.PerspectiveCamera);
  console.log('🚫 Legacy character systems disabled - only auto-loader active');
  
  // Connect auto-loader to class selection events (no duplicate loading)
  window.addEventListener('characterClassSelected', async (event: Event) => {
    const customEvent = event as CustomEvent<{ playerClass: string }>;
    const { playerClass } = customEvent.detail;
    
    if (autoCharacterLoader) {
      console.log(`🎭 Using cached animations for: ${playerClass}`);
      
      // Use cached animations - no duplicate loading!
      await autoCharacterLoader.loadCharacterForClass(playerClass as PlayerClass);
    }
  });

  // Track animation loading state for race start coordination
  let animationsLoaded = false;
  let pendingRaceStart: (() => void) | null = null;

  // Listen for animation loading completion (from startup preload)
  window.addEventListener('animationLoadingProgress', (event: Event) => {
    const customEvent = event as CustomEvent<{ loaded: number, total: number, isComplete: boolean }>;
    const { isComplete } = customEvent.detail;
    
    animationsLoaded = isComplete;
    
    if (isComplete && pendingRaceStart) {
      console.log('🎭 Cached animations ready! Starting race...');
      pendingRaceStart();
      pendingRaceStart = null;
    }
  });

  // Race start coordination (using cached animations)
  window.addEventListener('raceStartRequest', (event: Event) => {
    const customEvent = event as CustomEvent<{ callback: () => void }>;
    const { callback } = customEvent.detail;
    
    // Check if character animations are disabled - if so, start immediately
    const animationsEnabled = autoCharacterLoader?.isCharacterSystemActive() ?? true;
    
    if (animationsLoaded || !animationsEnabled) {
      console.log(animationsEnabled ? 
        '🎭 Cached animations ready - starting race immediately' : 
        '🚫 Animations disabled - starting race immediately');
      callback();
    } else {
      console.log('🎭 Waiting for animation cache to complete...');
      pendingRaceStart = callback;
    }
  });
  
  // Load racing dummies from saved positions
  loadingScreen.updateStatus('Loading track elements...');
  if (dummyLoader) {
    dummyLoader.loadDummies().then((loadedDummies) => {
      targetDummies = loadedDummies;
      console.log('✅ Track elements loaded');
      // Note: Dummies are lightweight, no need for separate loading step
    }).catch(error => {
      console.error('Failed to load dummies:', error);
    });
  }

  // Initialize other systems (all lightweight)
  AudioManager.getInstance(); // Audio is instant
  new GameMenu(); // UI is instant
  
  console.log('✅ All systems initialized');
  
  // Initialize essential game systems
  // Initialize round system first
  roundSystem = new RaceRoundSystem({
    dummyKOPoints: 10,
    checkpointPoints: 30,
    lapCompletePoints: 50,
    roundDurationMs: 120000 // 2 minutes
  });

  // Day 6 Sprint: Initialize GameStateManager and UI BEFORE round UI components
  gameStateManager.initialize({
    roundSystem: roundSystem,
    multiplayerManager: multiplayerManager || undefined,
    physicsWorld: world
  });
  
  // Initialize Audio System
  audioManager = AudioManager.getInstance();
  
  // CORE FIX: Consolidated animation loops prevent timing conflicts
  
  // Expose physics manager for debugging
  (window as any).dummyPhysicsManager = DummyPhysicsManager.getInstance();
  
  // Expose animation management for debugging
  (window as any).TargetDummy = TargetDummy;
  
  // Start ambient wind once audio is initialized and user has interacted
  let windStarted = false;
  const startWindOnInteraction = () => {
    if (!windStarted) {
      windStarted = true;
      setTimeout(() => {
        audioManager?.playAmbient();
      }, 500);
      // Remove listeners after first interaction
      document.removeEventListener('click', startWindOnInteraction);
      document.removeEventListener('keydown', startWindOnInteraction);
    }
  };
  
  // Listen for first user interaction to start wind (autoplay policy)
  document.addEventListener('click', startWindOnInteraction);
  document.addEventListener('keydown', startWindOnInteraction);
  
  // Immediate SFX Event System - audio plays instantly, physics operations still deferred
  
  // Play SFX immediately - audio doesn't need physics safety delays
  window.addEventListener('sfxRequest', (event: Event) => {
    const customEvent = event as CustomEvent<{ category: string, filename: string, volumeOverride?: number }>;
    const { category, filename, volumeOverride } = customEvent.detail;
    
    // Play audio immediately for responsive feedback
    if (audioManager) {
      audioManager.playSFX(category as any, filename, volumeOverride).catch(error => {
        console.warn(`🔊 Failed to play SFX immediately: ${category}/${filename}`, error);
      });
    }
  });

  // Handle SFX stop requests immediately
  window.addEventListener('sfxStop', (event: Event) => {
    const customEvent = event as CustomEvent<{ category: string, filename: string }>;
    const { category, filename } = customEvent.detail;
    
    // Stop the SFX immediately (no queue to clear since audio plays instantly)
    audioManager?.stopSFX(category as any, filename);
  });
  
  console.log('🎵 Audio system initialized - immediate SFX, deferred physics');
  
  // Create HomeScreen UI component
  homeScreen = new HomeScreen(gameStateManager);
  
  // Create ClassSelection UI component
  classSelection = new ClassSelection(gameStateManager);
  
  // Create LobbyScreen UI component (placeholder)
  lobbyScreen = new LobbyScreen(gameStateManager);
  
  // Create SettingsScreen UI component
  settingsScreen = new SettingsScreen(gameStateManager);
  
  // Register UI components with GameStateManager
  gameStateManager.registerComponents({
    homeScreen: homeScreen,
    classSelection: classSelection,
    lobbyScreen: lobbyScreen,
    settingsScreen: settingsScreen
  });
  
  console.log('🏠 Game state management initialized');
  
  // Initialize multiplayer manager for online mode
  if (window.location.hash.includes('#online')) {
    multiplayerManager = new MultiplayerManager(scene);
    console.log('🌐 Multiplayer manager initialized - other players will appear as cubes');
    
    // Set up player context provider for networking position corrections
    Network.setPlayerContextProvider(() => {
      if (!physicsWorld) return { 
        position: { x: 0, y: 0, z: 0 }, 
        velocity: { x: 0, y: 0, z: 0 },
        cameraDirection: { x: 0, y: 0, z: 1 } 
      };
      
      const position = physicsWorld.devTools.getCurrentPosition();
      const velocity = physicsWorld.fpsController.getVelocity();
      
      // Get camera direction
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      
      return {
        position: { x: position.x, y: position.y, z: position.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        cameraDirection: { x: cameraDirection.x, y: cameraDirection.y, z: cameraDirection.z }
      };
    });
    
    console.log('📍 Player context provider connected for ability position corrections');
  }

  // Initialize lap controller with callbacks (including round system integration)
  lapController = new LapController(
    (lapTime, totalLaps) => {
      if (import.meta.env.DEV) {
        console.log(`🏁 Lap ${totalLaps} completed in ${(lapTime / 1000).toFixed(2)}s`);
      }
      lapHUD?.flashLapComplete(lapTime);
      gameHUD?.onLapComplete(lapTime, totalLaps);
      // Award lap completion points
      roundSystem?.onLapComplete(lapTime, totalLaps);
    },
    (checkpoint, isValid) => {
      if (import.meta.env.DEV) {
        // Checkpoint validation (silenced to reduce spam)
      }
      lapHUD?.flashCheckpoint(checkpoint, isValid);
      gameHUD?.onCheckpointVisited(checkpoint, isValid);
      // Award checkpoint points
      roundSystem?.onCheckpointReached(checkpoint, isValid);
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
  
  // Connect checkpoint system to GameHUD for arrow functionality
  if (gameHUD && checkpointSystem) {
    gameHUD.setCheckpointSystem(checkpointSystem, scene, camera);
  }
  
  // Initialize health HUD (PvP combat)
  new HealthHUD();
  
  // Initialize testing help HUD (V key overlay)
  new TestingHelpHUD(hudToggle);
  
  // Listen for round reset to reset game HUD checkpoints
  window.addEventListener('roundReset', () => {
    if (gameHUD) {
      gameHUD.resetCheckpointProgress();
      console.log('🔄 Game HUD checkpoints reset');
    }
  });
  
  // Initialize round system UI components
  if (roundSystem) {
    _scoreHUD = new ScoreHUD(roundSystem);
    _roundStartUI = new RoundStartUI(roundSystem);
    _roundEndUI = new RoundEndUI(roundSystem);
    
    // Add callback to start both timers when round begins
    roundSystem.addCallbacks({
      onStateChange: (state) => {
        if (state === 'active') {
          // Start the lap controller timing
          if (lapController) {
            lapController.start();
          }
          // Start the GameHUD timer display
          if (gameHUD) {
            gameHUD.startTimer();
          }
          console.log('🏁 Both timers started after countdown');
        } else if (state === 'waiting' || state === 'ended') {
          // Stop timers when round ends (either waiting for next round or completely ended)
          if (lapController) {
            lapController.stop();
          }
          if (gameHUD) {
            gameHUD.stopTimer();
          }
          console.log('⏱️ Lap timer stopped - round ended');
        }
      }
    });
    
    // Mark as intentionally used (UI components are self-managing)
    void _scoreHUD;
    void _roundStartUI;
    void _roundEndUI;
    
    console.log('🏁 Round system UI initialized');
    
    // Day 6 Sprint: Register round UI components with GameStateManager for control
    gameStateManager.registerRoundUIComponents({
      roundStartUI: _roundStartUI,
      roundEndUI: _roundEndUI
    });
    
    // Day 6 Sprint: Show homescreen AFTER round UI is created to override it
    console.log('🏠 Day 6 Sprint: Transitioning from initializing to homescreen');
    // Use a small delay to ensure all UI components are fully initialized
    setTimeout(() => {
      gameStateManager.transitionTo('homescreen');
      console.log('🏠 Day 6 Sprint: Homescreen transition complete');
    }, 100);
  }
  
  // Initialize melee combat system
  meleeCombat = new MeleeCombat(world.world, camera, world.playerBody);
  
  // Initialize HitVolume system for pass-through damage
  registerHitVolumes(world, world.fpsController, meleeCombat);
  
  // Initialize dummy placement manager for level design
  dummyPlacementManager = new DummyPlacementManager(scene, world.world, camera, meleeCombat);
  
  // Initialize dummy loader for loading saved dummies
  dummyLoader = new DummyLoader(scene, world.world, meleeCombat);
  
  // Initialize visual feedback system
  setupVisualFeedback(camera, renderer);
  
  // Load racing dummies from saved positions
  loadingScreen.updateStatus('Loading combat dummies...');
  if (dummyLoader) {
    dummyLoader.loadDummies().then((loadedDummies) => {
      targetDummies = loadedDummies;
      loadingScreen.setStepComplete('dummy-models', 'Combat dummies loaded');
      
      // Pass loaded dummies to placement manager for editing
      if (dummyPlacementManager) {
        dummyPlacementManager.setLoadedDummies(loadedDummies);
      }
    }).catch(error => {
      console.error('Failed to load dummies:', error);
      loadingScreen.setStepComplete('dummy-models', 'Using default dummy positions');
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
    console.log('  ✨ Press 1 for Blink class');
    console.log('  🔥 Press 2 for Blast class');
    console.log('  🪝 Press 3 for Grapple class');
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
    
    // Handle other keys in separate listener  
    window.addEventListener('keydown', (event) => {
      // Only trigger combat log copy on C key WITHOUT any modifiers
      if (event.code === 'KeyC' && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
        // SAFETY: Defer clipboard operation to avoid physics conflicts
        setTimeout(() => {
        if (debugUI) {
          const combatLog = debugUI.getCombatLog();
          const logText = combatLog.join('\n');
          navigator.clipboard.writeText(logText).then(() => {
            console.log('📋 Combat log copied to clipboard!');
          }).catch(err => {
            console.error('Failed to copy combat log:', err);
            // Fallback: log the combat log to console
            console.log('📋 Combat Log (copy failed):');
            combatLog.forEach(entry => console.log(entry));
          });
        }
        }, 0);
      }
    });
  }
  
  // ABILITY SWITCHING - PRODUCTION ENABLED
  console.log('🔧 Setting up ability switching handlers...');
  
  // Create a more robust handler with clean logging
  const handleAbilitySwitching = (event: KeyboardEvent) => {
    // Don't interfere when typing in inputs
    if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
      return;
    }
    
    // Don't interfere during menu states - let UI components handle it
    const currentState = gameStateManager.getCurrentState();
    if (['homescreen', 'class-selection', 'lobby', 'leaderboard'].includes(currentState)) {
      return;
    }
    
    // Don't allow class switching during structured gameplay (race mode)
    // Only allow during freeplay/unstructured modes
    if (currentState === 'race') {
      // Class switching disabled during race (logging removed to reduce spam)
      return;
    }
    
    if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      // Debug logging (only in dev mode to reduce spam)
      if (import.meta.env.DEV) {
        console.log('🔍 ABILITY SWITCH: Digit key pressed:', event.code);
      }
      
      event.preventDefault();
      event.stopPropagation();
      
      if (event.code === 'Digit1') {
        setPlayerClass('blink');
        console.log('✨ Switched to Blink class');
      } else if (event.code === 'Digit2') {
        setPlayerClass('blast');
        console.log('🔥 Switched to Blast class');
      } else if (event.code === 'Digit3') {
        setPlayerClass('grapple');
        console.log('🪝 Switched to Grapple class');
      }
    }
  };
  
  // Add single optimized listener (capture phase for priority)
  document.addEventListener('keydown', handleAbilitySwitching, true);
  
  // Store for cleanup
  const abilityEventListeners = [
    { element: document, handler: handleAbilitySwitching, options: true }
  ];
  
  // Add a direct global test function
  (window as any).testAbilitySwitch = (className: string) => {
    console.log('🧪 Manual ability switch test:', className);
    setPlayerClass(className as any);
  };
  
  console.log('✅ Ability switching handlers installed (single optimized listener)');
  console.log('🧪 Test manually with: window.testAbilitySwitch("grapple")');
  
  // Add cleanup function to window for proper resource management
  (window as any).cleanupAbilityListeners = () => {
    abilityEventListeners.forEach(({ element, handler, options }) => {
      element.removeEventListener('keydown', handler, options);
    });
    console.log('🧹 Ability event listeners cleaned up');
  };
  
  // Add ceiling for grapple testing
  // Add invisible sky plane for grapple targeting (performance-friendly)
  addInvisibleSkyPlane(scene, physicsWorld?.world);
  
  // Initialize movement trail
  movementTrail = new TrailSystem(scene);
  
  animate();
});

// CRITICAL FIX: Add cleanup for abilityManager to prevent infinite animation loops
window.addEventListener('beforeunload', () => {
  console.log('🧹 Page unloading - cleaning up resources...');
  if (abilityManager) {
    abilityManager.dispose();
  }
  if (autoCharacterLoader) {
    autoCharacterLoader.dispose();
  }
  if (lavaKillzone) {
    lavaKillzone.dispose();
  }
  TargetDummy.cleanupGlobalAnimations();
});

// CRITICAL FIX: Add emergency cleanup on visibility change (tab switching, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('🧹 Page hidden - cleaning up animation resources...');
    TargetDummy.cleanupGlobalAnimations();
  }
});

console.log('🎮 Game initialized successfully');

// Fallback: Force hide loading screen after 10 seconds if still visible
setTimeout(() => {
  if (loadingScreen) {
    loadingScreen.forceHide();
  }
}, 10000);

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

// Initialize timing variables  
let lastTime = performance.now();

// Animation loop
function animate() {
  try {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05); // Cap at 50ms
    lastTime = currentTime;
    
    // Update physics world
    if (physicsWorld) {
      physicsWorld.step(deltaTime);
      
      // Get movement data from controller (same source as debug UI)
      const velocity = physicsWorld.fpsController.getVelocity();
      const grounded = physicsWorld.fpsController.getIsGrounded();
      const position = physicsWorld.devTools.getCurrentPosition();
      const playerPosition = new THREE.Vector3(position.x, position.y, position.z);
      const playerVelocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
      const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      
      // Update auto character loader (main system)
      if (autoCharacterLoader) {
        autoCharacterLoader.update(deltaTime, playerPosition, playerVelocity, camera, grounded, horizontalSpeed);
      }
      
      // Update ability manager AFTER physics step (CRITICAL FIX)
      if (abilityManager) {
        abilityManager.updateAbilities(deltaTime);
      }
      
      // Legacy systems disabled - only auto-loader active
    }
    
    // Update HitVolume system for pass-through damage
    try {
      const hitVolumeSystem = getHitVolume();
      if (hitVolumeSystem) {
        hitVolumeSystem.update(deltaTime);
      }
    } catch (error) {
      console.error('⚠️ HitVolume update error:', error);
    }
    
    // Update sky position to follow camera (prevents clipping artifacts)
    try {
      if (physicsWorld) {
        const cameraPos = camera.position.clone();
        sceneBackdrop.updateSkyPosition(cameraPos);
      }
    } catch (error) {
      console.error('⚠️ SceneBackdrop update error:', error);
    }
    
    // Update lava killzone animation
    try {
      lavaKillzone.update();
    } catch (error) {
      console.error('⚠️ LavaKillzone update error:', error);
    }
    
    // Update movement trail
    try {
      if (physicsWorld && movementTrail) {
        const position = physicsWorld.devTools.getCurrentPosition();
        const currentSpeed = physicsWorld.fpsController.getCurrentSpeed();
        const currentKit = getCurrentPlayerKit(); // Get current player class
        movementTrail.update(position, currentSpeed, currentKit.className);
      }
    } catch (error) {
      console.error('⚠️ Trail system update error:', error);
    }
    
    // Update visual feedback effects
    try {
      updateVisualFeedback(camera);
    } catch (error) {
      console.error('⚠️ Visual feedback update error:', error);
    }
    
    // Update camera effects system
    try {
      if (physicsWorld) {
        // Feed current speed to speed-based effects
        const currentSpeed = physicsWorld.fpsController.getCurrentSpeed();
        speedFovEffect.updateSpeed(currentSpeed);
        windStreakEffect.updateSpeed(currentSpeed);
        
        // Update ambient wind volume based on speed
        if (audioManager) {
          audioManager.updateSpeed(currentSpeed);
        }
      }
      CameraEffects.update(deltaTime);
    } catch (error) {
      console.error('⚠️ Camera effects update error:', error);
    }

    // Update ability visual effects
    try {
      blastExplosionRing.update(deltaTime);
      blinkRingEffect.update(deltaTime);
      grappleLatchRing.update(deltaTime);
    } catch (error) {
      console.error('⚠️ Ability effects update error:', error);
    }

    // Update dummy rotation animations with proper isolation from physics
    if (targetDummies && targetDummies.length > 0) {
      // Use single deferred update instead of complex nested fallbacks
      const updateDummies = () => {
        try {
          targetDummies.forEach((dummy, index) => {
            try {
              // Check if dummy has update method (TargetDummy or RacingTargetDummy)
              if ('update' in dummy && typeof dummy.update === 'function') {
                (dummy as any).update(deltaTime);
              }
            } catch (dummyError) {
              // Handle individual dummy errors without crashing the whole system
              if (dummyError instanceof Error && dummyError.message.includes('recursive')) {
                console.warn(`⚠️ Dummy ${index} recursive error (skipping this frame):`, dummyError.message);
              } else {
                console.warn(`⚠️ Dummy ${index} update error:`, dummyError);
              }
            }
          });
        } catch (error) {
          // Catch-all for dummy system errors
          console.warn('⚠️ Dummy animation system error:', error);
        }
      };
      
      // Simple deferred execution to avoid physics conflicts
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(updateDummies, { timeout: 100 });
      } else {
        setTimeout(updateDummies, 16); // ~1 frame delay
      }
    }

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
      
      // Combat system is active (melee combat handled by separate update cycle)
      if (meleeCombat) {
        // Melee combat updates are handled in the combat system
      }
      
      // Update checkpoint system
      if (checkpointSystem) {
        checkpointSystem.update(new THREE.Vector3(position.x, position.y, position.z), velocity);
      }
      
      // Update game HUD with player position for checkpoint arrow
      if (gameHUD) {
        const playerPosition = new THREE.Vector3(position.x, position.y, position.z);
        gameHUD.update(playerPosition);
      }
    }
    
    // Update round system
    if (roundSystem) {
      // TODO: Add update method when implemented
      // roundSystem.update();
    }
    
    // Update lap HUD (debug)
    if (lapHUD) {
      lapHUD.update();
    }
    
    // Final render
    renderer.render(scene, camera);
    
  } catch (error) {
    console.error('⚠️ Critical animation loop error:', error);
    
    // CRITICAL FIX: Emergency cleanup on animation loop errors
    if (error instanceof Error && error.message.includes('recursive')) {
      console.error('🚨 RECURSIVE ERROR DETECTED - Emergency cleanup!');
      
      // Minimal cleanup to prevent infinite recursion
      if (abilityManager) {
        try {
          abilityManager.dispose();
        } catch (cleanupError) {
          console.error('Error disposing abilityManager:', cleanupError);
        }
      }
      
      // Clean up dummy animations
      TargetDummy.cleanupGlobalAnimations();
      
      console.log('🛑 Animation loop STOPPED due to recursive error');
      console.log('🛠️ Refresh the page to restart the game');
      
      return; // Exit without restarting
    }
    
    // Only restart animation loop for non-recursive errors
    console.log('🔄 Restarting animation loop after error...');
    requestAnimationFrame(animate);
  }
}
