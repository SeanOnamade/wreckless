import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { PlayerClass } from '../kits/classKit';

export type AnimationState = 'idle' | 'running' | 'jumping' | 'falling' | 'swing' | 'blast' | 'blink';

interface Character {
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: Map<string, THREE.AnimationAction>;
  currentAnimation: THREE.AnimationAction | null;
}

export class CharacterSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private character: Character | null = null;
  private currentClass: PlayerClass | null = null;
  
  // Third person camera
  private isThirdPerson: boolean = false;
  private originalCameraPosition: THREE.Vector3 = new THREE.Vector3();
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 3, 8);
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.originalCameraPosition.copy(camera.position);
    
    // Set up keyboard listener for camera toggle
    this.setupKeyListener();
    
    // Listen for class selection events
    this.setupClassSelectionListener();
    
    console.log('🎭 CharacterSystem initialized');
    
    // Add global debug functions
    this.setupDebugFunctions();
  }

  /**
   * Load character for a specific class
   */
  public async loadCharacter(characterClass: PlayerClass): Promise<void> {
    console.log(`🔄 Loading character: ${characterClass}`);
    
    try {
      // Clean up existing character
      this.removeCharacter();
      
      // Map class names to file directories (grapple class uses swing files)
      const characterDir = characterClass === 'grapple' ? 'swing' : characterClass;
      
      // Load the idle animation as base model
      const model = await this.loadFBX(`/models/characters/${characterDir}/${characterDir}_idle.fbx`);
      
      // Validate model
      if (!this.validateModel(model)) {
        throw new Error('Invalid character model - no meshes found');
      }
      
      // Setup character
      this.setupCharacterModel(model);
      
      // Create animation mixer
      const mixer = new THREE.AnimationMixer(model);
      const animations = new Map<string, THREE.AnimationAction>();
      
      // Add idle animation
      if (model.animations.length > 0) {
        const idleAction = mixer.clipAction(model.animations[0]);
        animations.set('idle', idleAction);
        idleAction.play();
      }
      
      // Load other animations
      await this.loadAdditionalAnimations(characterClass, characterDir, mixer, animations);
      
      // Create character object
      this.character = {
        model,
        mixer,
        animations,
        currentAnimation: animations.get('idle') || null
      };
      
      this.currentClass = characterClass;
      this.scene.add(model);
      
      // Character will start with idle and respond to movement
      console.log(`✅ Character loaded: ${characterClass} with ${animations.size} animations`);
      
    } catch (error) {
      console.error(`❌ Failed to load character ${characterClass}:`, error);
      throw error;
    }
  }

  /**
   * Load additional animations for the character
   */
  private async loadAdditionalAnimations(
    characterClass: PlayerClass,
    characterDir: string,
    mixer: THREE.AnimationMixer, 
    animations: Map<string, THREE.AnimationAction>
  ): Promise<void> {
    const animationNames = ['running', 'running_jump', 'falling'];
    
    // Add swing animation for grapple class
    if (characterClass === 'grapple') {
      animationNames.push('swing');
    }
    
    // Add blast animation for blast class
    if (characterClass === 'blast') {
      animationNames.push('blast');
    }
    
    // Add blink animation for blink class
    if (characterClass === 'blink') {
      animationNames.push('blink');
    }
    
    for (const animName of animationNames) {
      try {
        const animModel = await this.loadFBX(`/models/characters/${characterDir}/${characterDir}_${animName}.fbx`);
        
        if (animModel.animations.length > 0) {
          const action = mixer.clipAction(animModel.animations[0]);
          animations.set(animName === 'running_jump' ? 'jumping' : animName, action);
          console.log(`✅ Loaded ${animName} animation`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ${animName} animation:`, error);
      }
    }
  }

  /**
   * Load FBX file with better error handling
   */
  private loadFBX(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      
      console.log(`📦 Attempting to load: ${path}`);
      
      loader.load(
        path,
        (object) => {
          console.log(`✅ Successfully loaded FBX: ${path}`);
          resolve(object);
        },
        undefined, // Remove progress logging to prevent lag
        (error) => {
          console.error(`❌ FBX loading failed for ${path}:`, error);
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if it's a version parsing error
          if (errorMessage.includes('version number')) {
            console.warn(`⚠️ FBX version issue detected. This often happens with Mixamo exports.`);
            console.warn(`💡 Try re-exporting from Mixamo with different settings or converting to glTF.`);
          }
          
          reject(new Error(`Failed to load ${path}: ${errorMessage}`));
        }
      );
    });
  }

  /**
   * Validate that the model has renderable content
   */
  private validateModel(model: THREE.Group): boolean {
    let meshCount = 0;
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++;
      }
    });
    
    console.log(`🔍 Model validation: ${meshCount} meshes found`);
    return meshCount > 0;
  }

  /**
   * Setup character model properties
   */
  private setupCharacterModel(model: THREE.Group): void {
    // Scale up for better visibility in front of camera
    model.scale.setScalar(1.2); // Bigger and closer for clear view
    
    // Setup shadows and materials
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Force materials to be visible and bright
        if (child.material) {
          child.material.visible = true;
          
          // Make materials more visible
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.setHex(0x444444); // More glow
            child.material.color.multiplyScalar(2); // Brighter
          }
        }
      }
    });
    
    // Put character right in front of camera where user can see it
    model.position.set(2, 3, -125); // Right in front of player at Z=-113
    
    console.log(`🎭 Character setup: scale=${model.scale.x}, position=(${model.position.x}, ${model.position.y}, ${model.position.z})`);
  }

  /**
   * Switch to a different animation
   */
  public setAnimation(animationName: AnimationState): void {
    if (!this.character) return;
    
    const newAnimation = this.character.animations.get(animationName);
    if (!newAnimation) {
      console.warn(`Animation "${animationName}" not found`);
      return;
    }
    
    const current = this.character.currentAnimation;
    if (current === newAnimation) return;
    
    // Smooth transition
    if (current) {
      current.fadeOut(0.2);
    }
    
    newAnimation.reset().fadeIn(0.2).play();
    this.character.currentAnimation = newAnimation;
    
    console.log(`🎬 Animation: ${animationName}`);
  }

  /**
   * Toggle between first and third person camera
   */
  public toggleCamera(): void {
    this.isThirdPerson = !this.isThirdPerson;
    
    if (this.isThirdPerson) {
      // Switch to third person
      this.originalCameraPosition.copy(this.camera.position);
      this.updateThirdPersonCamera();
      
      // Exit pointer lock
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      
      console.log('📹 Third person camera enabled');
    } else {
      // Switch back to first person
      this.camera.position.copy(this.originalCameraPosition);
      
      console.log('📹 First person camera enabled');
    }
  }

  /**
   * Update third person camera position
   */
  private updateThirdPersonCamera(): void {
    if (!this.isThirdPerson) return;
    
    // Position camera behind and above the player
    const targetPosition = this.playerPosition.clone().add(this.cameraOffset);
    this.camera.position.lerp(targetPosition, 0.1);
    
    // Look at player position
    const lookTarget = this.playerPosition.clone();
    lookTarget.y += 1; // Look slightly above player feet
    this.camera.lookAt(lookTarget);
  }

  /**
   * Update the system (call this in your render loop)
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3, playerVelocity?: THREE.Vector3): void {
    // Update player position for camera
    this.playerPosition.copy(playerPosition);
    
    // Update character animation based on actual player movement
    if (this.character) {
      // Update animation mixer
      this.character.mixer.update(deltaTime);
      
      // Check player movement and set appropriate animation
      this.updateAnimationBasedOnMovement(playerVelocity || new THREE.Vector3());
      
      // Slowly rotate for better view (slower now)
      this.character.model.rotation.y += deltaTime * 0.2;
    }
    
    // Update third person camera
    if (this.isThirdPerson) {
      this.updateThirdPersonCamera();
    }
  }

  /**
   * Update animation based on actual player movement
   */
  private updateAnimationBasedOnMovement(velocity: THREE.Vector3): void {
    if (!this.character) return;
    
    const speed = velocity.length();
    const isMovingFast = speed > 3; // Lower threshold for running
    const isFalling = velocity.y < -3; // Falling down fast
    const isJumping = velocity.y > 3; // Moving up fast
    
    // Check if grappling (for swing class only)
    const isSwinging = this.checkIfSwinging();
    
    // Determine what animation to play (priority order)
    let targetAnimation: AnimationState = 'idle';
    
    if (isSwinging && this.currentClass === 'grapple') {
      targetAnimation = 'swing';
    } else if (isFalling) {
      targetAnimation = 'falling';
    } else if (isJumping) {
      targetAnimation = 'jumping';
    } else if (isMovingFast) {
      targetAnimation = 'running';
    } else {
      targetAnimation = 'idle';
    }
    
    // Only change if different from current
    const currentAnimName = this.getCurrentAnimationName();
    if (currentAnimName !== targetAnimation) {
      this.setAnimation(targetAnimation);
      console.log(`🎬 Animation changed to: ${targetAnimation} (speed: ${speed.toFixed(1)}, vel.y: ${velocity.y.toFixed(1)})`);
    }
  }

  /**
   * Check if player is currently swinging/grappling
   */
  private checkIfSwinging(): boolean {
    // Try to detect grapple state from the global system
    try {
      // Check if grapple ability is active (this might need adjustment based on your grapple system)
      return false; // For now, return false - can be enhanced later
    } catch {
      return false;
    }
  }

  /**
   * Get current animation name for comparison
   */
  private getCurrentAnimationName(): AnimationState | null {
    if (!this.character?.currentAnimation) return null;
    
    // Find which animation is currently playing
    for (const [name, action] of this.character.animations) {
      if (action === this.character.currentAnimation) {
        return name as AnimationState;
      }
    }
    return null;
  }

  /**
   * Setup keyboard listener for camera toggle
   */
  private setupKeyListener(): void {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'F5') {
        event.preventDefault();
        this.toggleCamera();
      }
    });
  }

  /**
   * Setup listener for class selection events
   */
  private setupClassSelectionListener(): void {
    window.addEventListener('characterClassSelected', async (event: Event) => {
      // Check if this legacy system has been disabled
      if ((this as any).disabled) {
        console.log('🚫 Legacy CharacterSystem disabled - skipping character load');
        return;
      }
      
      const customEvent = event as CustomEvent<{ playerClass: PlayerClass }>;
      const { playerClass } = customEvent.detail;
      
      try {
        await this.loadCharacter(playerClass);
        console.log(`🎭 Character loaded for class: ${playerClass}`);
      } catch (error) {
        console.error(`❌ Failed to load character for class ${playerClass}:`, error);
      }
    });
  }

  /**
   * Remove current character from scene
   */
  private removeCharacter(): void {
    if (this.character) {
      this.scene.remove(this.character.model);
      this.character.mixer.stopAllAction();
      this.character = null;
      this.currentClass = null;
    }
  }

  /**
   * Get available animations for current character
   */
  public getAvailableAnimations(): string[] {
    if (!this.character) return [];
    return Array.from(this.character.animations.keys());
  }

  /**
   * Check if in third person mode
   */
  public isInThirdPerson(): boolean {
    return this.isThirdPerson;
  }

  /**
   * Setup debug functions for testing
   */
  private setupDebugFunctions(): void {
    (window as any).__character = {
      load: async (className: 'swing' | 'blink' | 'blast') => {
        const classMap = { swing: 'grapple', blink: 'blink', blast: 'blast' } as const;
        await this.loadCharacter(classMap[className]);
      },
      animate: (animName: AnimationState) => this.setAnimation(animName),
      toggleCamera: () => this.toggleCamera(),
      getAnimations: () => this.getAvailableAnimations(),
      isThirdPerson: () => this.isInThirdPerson(),
      status: () => ({
        hasCharacter: !!this.character,
        currentClass: this.currentClass,
        animations: this.getAvailableAnimations(),
        isThirdPerson: this.isInThirdPerson(),
        characterPosition: this.character?.model.position,
        characterScale: this.character?.model.scale,
        cameraPosition: this.camera.position
      }),
      // Reset character to normal position
      reset: () => {
        if (!this.character) return;
        this.character.model.scale.setScalar(1.2);
        this.character.model.position.set(2, 3, -125);
        console.log('🔄 Character reset to preview position');
      },
      // NEW: Move character around for better visibility
      moveCloser: () => {
        if (!this.character) return;
        this.character.model.position.z += 10;
        console.log(`📍 Character at: (${this.character.model.position.x.toFixed(1)}, ${this.character.model.position.y.toFixed(1)}, ${this.character.model.position.z.toFixed(1)})`);
      },
      moveFurther: () => {
        if (!this.character) return;
        this.character.model.position.z -= 10;
        console.log(`📍 Character at: (${this.character.model.position.x.toFixed(1)}, ${this.character.model.position.y.toFixed(1)}, ${this.character.model.position.z.toFixed(1)})`);
      },
      moveLeft: () => {
        if (!this.character) return;
        this.character.model.position.x -= 5;
        console.log(`📍 Character at: (${this.character.model.position.x.toFixed(1)}, ${this.character.model.position.y.toFixed(1)}, ${this.character.model.position.z.toFixed(1)})`);
      },
      moveRight: () => {
        if (!this.character) return;
        this.character.model.position.x += 5;
        console.log(`📍 Character at: (${this.character.model.position.x.toFixed(1)}, ${this.character.model.position.y.toFixed(1)}, ${this.character.model.position.z.toFixed(1)})`);
      },
      makeVisible: () => {
        if (!this.character) return;
        // Move directly in front and make bigger
        this.character.model.position.set(3, 3, -120);
        this.character.model.scale.setScalar(2.0);
        console.log(`👁️ Character positioned for maximum visibility!`);
      }
    };
    
    console.log('🛠️ Debug functions available:');
    console.log('  window.__character.load("swing") - Load swing character');
    console.log('  window.__character.animate("running") - Change animation');
    console.log('  window.__character.moveCloser() - Move character closer (Z)');
    console.log('  window.__character.moveFurther() - Move character further (Z)');
    console.log('  window.__character.moveLeft() - Move character left (X)');
    console.log('  window.__character.moveRight() - Move character right (X)');
    console.log('  window.__character.makeVisible() - Force maximum visibility');
    console.log('🎮 Character now responds to your movement automatically!');
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.removeCharacter();
    delete (window as any).__character;
    console.log('🧹 CharacterSystem disposed');
  }
} 