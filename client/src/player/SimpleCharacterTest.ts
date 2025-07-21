import * as THREE from 'three';

/**
 * Simple character visibility test
 * Step 1: Show red cube in front of camera
 * Step 2: Replace with actual character
 */
export class SimpleCharacterTest {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private testCube: THREE.Mesh | null = null;
  private character: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimation: THREE.AnimationAction | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.setupDebugCommands();
  }

  /**
   * Step 1: Create a bright red cube in front of camera
   */
  public showTestCube(): void {
    // Remove existing test cube
    if (this.testCube) {
      this.scene.remove(this.testCube);
    }

    // Create bright red cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: false
    });
    
    this.testCube = new THREE.Mesh(geometry, material);
    
    // Position directly in front of camera
    const cameraPos = this.camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    // Put cube 5 units in front of camera
    this.testCube.position.copy(cameraPos);
    this.testCube.position.add(cameraDirection.multiplyScalar(5));
    
    this.scene.add(this.testCube);
    
    console.log(`🔴 RED CUBE added at: (${this.testCube.position.x.toFixed(1)}, ${this.testCube.position.y.toFixed(1)}, ${this.testCube.position.z.toFixed(1)})`);
    console.log(`📹 Camera at: (${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)})`);
  }

  /**
   * Step 2: Remove cube and load character at exact same position
   */
  public async loadCharacterAtCubePosition(): Promise<void> {
    if (!this.testCube) {
      console.warn('⚠️ No test cube found! Run showTestCube() first');
      return;
    }

    const cubePosition = this.testCube.position.clone();
    
    // Remove test cube
    this.scene.remove(this.testCube);
    console.log('🗑️ Test cube removed');

    try {
      // Load character FBX
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      
      const model = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load('/models/characters/swing/swing_idle.fbx', resolve, undefined, reject);
      });

      // Position character at exact cube location
      model.position.copy(cubePosition);
      model.scale.setScalar(2); // Make it big
      
      // Restore normal character appearance
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Keep original materials but make them brighter for visibility
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.multiplyScalar(1.5); // Brighter but natural colors
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.character = model;
      this.scene.add(model);
      
      // Setup animation mixer
      this.mixer = new THREE.AnimationMixer(model);
      
      // Extract idle animation from the base model
      if (model.animations && model.animations.length > 0) {
        const idleAction = this.mixer.clipAction(model.animations[0]);
        idleAction.loop = THREE.LoopRepeat;
        this.animations.set('idle', idleAction);
        console.log(`✅ Loaded idle animation from base model`);
      }
      
      // Load additional animations
      await this.loadAnimations();
      
      // Start with idle animation
      this.setAnimation('idle');
      
      console.log(`✅ Character loaded at cube position: (${cubePosition.x.toFixed(1)}, ${cubePosition.y.toFixed(1)}, ${cubePosition.z.toFixed(1)})`);
      console.log(`🎭 Animations available: ${Array.from(this.animations.keys()).join(', ')}`);
      
    } catch (error) {
      console.error('❌ Failed to load character:', error);
    }
  }

  /**
   * Load additional animations (running, jumping, etc.)
   */
  private async loadAnimations(): Promise<void> {
    if (!this.mixer) return;

    const animationFiles = [
      { name: 'running', file: '/models/characters/swing/swing_running.fbx' },
      { name: 'jumping', file: '/models/characters/swing/swing_running_jump.fbx' },
      { name: 'falling', file: '/models/characters/swing/swing_falling.fbx' },
      { name: 'swing', file: '/models/characters/swing/swing_swing.fbx' }
    ];

    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const loader = new FBXLoader();

    for (const anim of animationFiles) {
      try {
        const animModel = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(anim.file, resolve, undefined, reject);
        });

        if (animModel.animations && animModel.animations.length > 0) {
          const action = this.mixer.clipAction(animModel.animations[0]);
          action.loop = THREE.LoopRepeat;
          this.animations.set(anim.name, action);
          console.log(`✅ Loaded ${anim.name} animation`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ${anim.name} animation:`, error);
      }
    }

    // Idle animation already started after base model load
  }

  /**
   * Switch animation
   */
  private setAnimation(animName: string): void {
    if (!this.mixer) return;

    const newAction = this.animations.get(animName);
    if (!newAction) {
      console.warn(`Animation ${animName} not found`);
      return;
    }

    if (this.currentAnimation && this.currentAnimation !== newAction) {
      this.currentAnimation.fadeOut(0.3);
    }

    this.currentAnimation = newAction;
    newAction.reset().fadeIn(0.3).play();
  }

  /**
   * Update character to follow player position and respond to movement
   */
  public update(playerPosition: THREE.Vector3, playerVelocity?: THREE.Vector3): void {
    if (this.character) {
      // Keep character floating in front of player (relative to player's movement)
      const offset = new THREE.Vector3(3, 1, -5); // Closer to player: right, slightly up, forward
      this.character.position.copy(playerPosition).add(offset);

      // Update animations and rotation based on movement
      if (playerVelocity && this.mixer) {
        this.updateAnimationBasedOnMovement(playerVelocity);
        
        // Rotate character to face movement direction
        if (playerVelocity.length() > 1) {
          const direction = playerVelocity.clone().normalize();
          this.character.lookAt(this.character.position.clone().add(direction));
        }
        
        this.mixer.update(0.016); // 60fps
      } else if (this.mixer) {
        // Still update mixer even without velocity
        this.mixer.update(0.016);
      }
    }
  }

  /**
   * Update animation based on player movement
   */
  private updateAnimationBasedOnMovement(velocity: THREE.Vector3): void {
    const speed = velocity.length();
    const isFalling = velocity.y < -3;
    const isJumping = velocity.y > 3;
    const isRunning = speed > 3;

    let targetAnim = 'idle';
    if (isFalling) targetAnim = 'falling';
    else if (isJumping) targetAnim = 'jumping';
    else if (isRunning) targetAnim = 'running';

    // Only change if different
    const currentName = this.getCurrentAnimationName();
    if (currentName !== targetAnim) {
      this.setAnimation(targetAnim);
      console.log(`🎬 Animation: ${currentName} → ${targetAnim} (speed: ${speed.toFixed(1)}, vel.y: ${velocity.y.toFixed(1)})`);
    }
  }

  /**
   * Get current animation name
   */
  private getCurrentAnimationName(): string | null {
    if (!this.currentAnimation) return null;
    for (const [name, action] of this.animations) {
      if (action === this.currentAnimation) return name;
    }
    return null;
  }

  private setupDebugCommands(): void {
    (window as any).__simpleTest = {
      showCube: () => this.showTestCube(),
      loadCharacter: () => this.loadCharacterAtCubePosition(),
      animate: (animName: string) => this.setAnimation(animName),
      status: () => ({
        hasCube: !!this.testCube,
        hasCharacter: !!this.character,
        animations: Array.from(this.animations.keys()),
        currentAnimation: this.getCurrentAnimationName(),
        cameraPos: this.camera.position,
        cubePos: this.testCube?.position,
        characterPos: this.character?.position,
        hasMixer: !!this.mixer
      }),
      testMovement: () => {
        console.log('🧪 Testing movement animations:');
        setTimeout(() => this.setAnimation('running'), 1000);
        setTimeout(() => this.setAnimation('jumping'), 3000);
        setTimeout(() => this.setAnimation('falling'), 5000);
        setTimeout(() => this.setAnimation('idle'), 7000);
        console.log('🎬 Animation sequence: idle → running → jumping → falling → idle');
      }
    };

    console.log('🧪 Simple test commands:');
    console.log('  window.__simpleTest.showCube() - Show red cube');
    console.log('  window.__simpleTest.loadCharacter() - Replace cube with character');
    console.log('  window.__simpleTest.animate("running") - Change animation');
    console.log('  window.__simpleTest.testMovement() - Test all animations');
    console.log('  window.__simpleTest.status() - Check positions & animations');
    console.log('🎮 Character should respond to your movement automatically!');
  }
} 