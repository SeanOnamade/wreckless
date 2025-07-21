import * as THREE from 'three';
import { isSwinging } from '../kits/grapple.js';

/**
 * Automatic character loader that integrates seamlessly with gameplay
 * No manual cube loading - just works automatically
 */
export class AutoCharacterLoader {
  private character: {
    model: THREE.Group;
    mixer: THREE.AnimationMixer;
    animations: Map<string, THREE.AnimationAction>;
    currentAnimation: THREE.AnimationAction | null;
  } | null = null;
  
  // Character Portrait UI
  private portraitScene!: THREE.Scene;
  private portraitCamera!: THREE.PerspectiveCamera;
  private portraitRenderer!: THREE.WebGLRenderer;
  private portraitContainer: HTMLDivElement | null = null;
  private hoverEnterHandler?: () => void;
  private hoverLeaveHandler?: () => void;
  
  // Static image support for when animations are disabled
  private staticImageElement: HTMLImageElement | null = null;

  private currentClass: string | null = null;
  private isLoading = false;
  private debugMode = false; // Disable debug logging by default (use __autoChar.toggleDebug() to enable)
  private loadingProgress = { loaded: 0, total: 0, isComplete: false };
  private loadingUI: HTMLDivElement | null = null;

  constructor(_scene: THREE.Scene, _camera: THREE.Camera) {
    // Parameters kept for API compatibility but not stored since we use portrait system
    
    // Always initialize portrait system (supports both animated and static modes)
    this.setupCharacterPortrait();
    console.log(`🎭 AutoCharacterLoader initialized with ${AutoCharacterLoader.isCharacterAnimationsEnabled() ? 'animated' : 'static'} portrait`);
    
    // Listen for settings changes
    this.setupSettingsListener();
  }

  /**
   * Check if character animations are enabled (static utility)
   */
  public static isCharacterAnimationsEnabled(): boolean {
    const stored = localStorage.getItem('wreckless-character-animations');
    return stored !== null ? JSON.parse(stored) : true; // Default to enabled
  }

  /**
   * Setup listener for character animation settings changes
   */
  private setupSettingsListener(): void {
    window.addEventListener('characterAnimationsSettingChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      const enabled = customEvent.detail?.enabled ?? true;
      
      if (!this.portraitContainer) {
        // No portrait system exists - create it
        this.setupCharacterPortrait();
        console.log(`🎭 Portrait system initialized (${enabled ? 'animated' : 'static'} mode)`);
      } else {
        // Portrait system exists - switch modes
        this.switchPortraitMode(enabled);
        console.log(`🔄 Switched to ${enabled ? 'animated' : 'static'} portrait mode`);
      }
    });
  }

  /**
   * Switch between animated and static portrait modes
   */
  private switchPortraitMode(enableAnimations: boolean): void {
    if (!this.portraitContainer) return;
    
    // Clear all content except title bar
    Array.from(this.portraitContainer.children).forEach(child => {
      if (child.id !== 'character-portrait-title') {
        this.portraitContainer!.removeChild(child);
      }
    });
    
    // Clean up current mode resources
    if (enableAnimations) {
      // Switching to animations - dispose static image
      this.staticImageElement = null;
      // Clean up any existing character and setup animated mode
      this.cleanup();
      this.setupAnimatedPortrait();
      // If we have a current class, reload the character
      if (this.currentClass) {
        this.loadCharacterForClass(this.currentClass);
      }
    } else {
      // Switching to static - dispose 3D renderer
      if (this.portraitRenderer) {
        this.portraitRenderer.dispose();
      }
      this.cleanup();
      this.setupStaticPortrait();
             // If we have a current class, load the static image
       if (this.currentClass) {
         this.loadStaticPortrait(this.currentClass);
       }
    }
  }



  /**
   * Get class-specific colors and styling
   */
  private getClassStyling(characterClass: string) {
    const classStyles = {
      'grapple': {
        borderColor: '#4CAF50',
        titleGradient: 'linear-gradient(90deg, #4CAF50, #45a049)',
        boxShadowColor: '#4CAF5040',
        emoji: '🪝'
      },
      'blink': {
        borderColor: '#2196F3',
        titleGradient: 'linear-gradient(90deg, #2196F3, #1976D2)',
        boxShadowColor: '#2196F340',
        emoji: '⚡'
      },
      'blast': {
        borderColor: '#F44336',
        titleGradient: 'linear-gradient(90deg, #F44336, #D32F2F)',
        boxShadowColor: '#F4433640',
        emoji: '💥'
      }
    };
    
    return classStyles[characterClass as keyof typeof classStyles] || classStyles['grapple'];
  }

  /**
   * Setup character portrait UI box (supports both animated and static modes)
   */
  private setupCharacterPortrait(): void {
    // Start with default class styling (grapple)
    const defaultClass = 'grapple';
    const styling = this.getClassStyling(defaultClass);
    
    // Create UI container (same for both modes)
    this.portraitContainer = document.createElement('div');
    this.portraitContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 20px;
      width: 200px;
      height: 280px;
      border: 2px solid ${styling.borderColor};
      border-radius: 12px;
      background: rgba(26, 26, 26, 0.95);
      backdrop-filter: blur(8px);
      z-index: 1000;
      overflow: hidden;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5), 0 0 15px ${styling.boxShadowColor};
      transition: transform 0.2s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    `;
    
    // Store hover handlers for cleanup
    this.hoverEnterHandler = () => {
      this.portraitContainer!.style.transform = 'scale(1.02)';
    };
    this.hoverLeaveHandler = () => {
      this.portraitContainer!.style.transform = 'scale(1.0)';
    };
    
    // Add hover effect
    this.portraitContainer.addEventListener('mouseenter', this.hoverEnterHandler);
    this.portraitContainer.addEventListener('mouseleave', this.hoverLeaveHandler);
    
    // Add title bar with consistent game UI font styling (matches HEALTH, SCORE, etc.)
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      background: ${styling.titleGradient};
      color: white;
      padding: 8px 12px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    `;
    titleBar.textContent = `${styling.emoji} ${defaultClass.toUpperCase()}`;
    titleBar.id = 'character-portrait-title'; // For updating animation status
    this.portraitContainer.appendChild(titleBar);
    
    // Setup content based on animation setting
    if (AutoCharacterLoader.isCharacterAnimationsEnabled()) {
      this.setupAnimatedPortrait();
    } else {
      this.setupStaticPortrait();
    }
    
    // Add to page
    document.body.appendChild(this.portraitContainer);
    
    console.log(`🖼️ Character portrait UI created (${AutoCharacterLoader.isCharacterAnimationsEnabled() ? 'animated' : 'static'} mode)`);
  }

  /**
   * Setup animated 3D portrait
   */
  private setupAnimatedPortrait(): void {
    // Create separate scene for character portrait
    this.portraitScene = new THREE.Scene();
    this.portraitScene.background = new THREE.Color(0x1a1a1a); // Dark background
    
    // Create camera for portrait (adjusted for new aspect ratio)
    this.portraitCamera = new THREE.PerspectiveCamera(35, 200/248, 0.1, 100); // Updated aspect ratio
    this.portraitCamera.position.set(0.2, 2.2, 4.2); // Much further back and higher for full body view
    this.portraitCamera.lookAt(0, 0.3, 0); // Look slightly lower to center full character
    
    // Create dedicated renderer for portrait
    this.portraitRenderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.portraitRenderer.setSize(200, 248); // Updated to match container size
    this.portraitRenderer.setClearColor(0x1a1a1a, 1.0);
    this.portraitRenderer.shadowMap.enabled = true;
    this.portraitRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add canvas to container
    this.portraitContainer!.appendChild(this.portraitRenderer.domElement);
    
    // Add portrait lighting
    this.setupPortraitLighting();
  }

  /**
   * Setup static image portrait
   */
  private setupStaticPortrait(): void {
    // Create image element for static portraits
    this.staticImageElement = document.createElement('img');
    this.staticImageElement.style.cssText = `
      width: 200px;
      height: 248px;
      object-fit: contain;
      object-position: center;
      display: block;
      background: linear-gradient(180deg, rgba(26, 26, 26, 0.1) 0%, rgba(26, 26, 26, 0.3) 100%);
    `;
    
    // Add image to container
    this.portraitContainer!.appendChild(this.staticImageElement);
    
    // Load default image (grapple since that's the default class)
    this.loadStaticPortrait('grapple');
  }

  /**
   * Load static portrait image for given class
   */
  private loadStaticPortrait(characterClass: string): void {
    if (!this.staticImageElement) return;
    
    // Map character classes to image files
    const portraitMap: Record<string, string> = {
      'grapple': '/assets/swing_portrait.png',  // Note: swing = grapple
      'blink': '/assets/blink_portrait.png',
      'blast': '/assets/blast_portrait.png'
    };
    
    const imagePath = portraitMap[characterClass];
    if (imagePath) {
      this.staticImageElement.src = imagePath;
      this.staticImageElement.alt = `${characterClass} portrait`;
      
      // Update portrait styling to match character class
      this.updatePortraitStyling(characterClass);
      
      console.log(`🖼️ Loaded static portrait: ${characterClass}`);
    } else {
      console.warn(`❌ No portrait image found for class: ${characterClass}`);
    }
  }

  /**
   * Setup lighting for full-body character portrait
   */
  private setupPortraitLighting(): void {
    // Key light (main illumination) - positioned to light full character
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(2, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    this.portraitScene.add(keyLight);
    
    // Fill light (soften shadows) - positioned to light feet area
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
    fillLight.position.set(-2, 1, 3);
    this.portraitScene.add(fillLight);
    
    // Ambient light (overall illumination) - ensure no dark areas
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.portraitScene.add(ambientLight);
    
    // Back light (rim lighting) - full body coverage
    const backLight = new THREE.DirectionalLight(0xffffff, 0.7);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(0, 4, -2);
    rimLight.position.set(1, 4, -1);
    this.portraitScene.add(backLight);
    this.portraitScene.add(rimLight);
  }

  /**
   * Create loading progress UI
   */
  private createLoadingUI(): void {
    this.loadingUI = document.createElement('div');
    this.loadingUI.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 30px 40px;
      border-radius: 15px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 18px;
      text-align: center;
      z-index: 10000;
      border: 2px solid #4CAF50;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      min-width: 350px;
    `;

    this.loadingUI.innerHTML = `
      <div style="margin-bottom: 20px; font-size: 24px; font-weight: bold; color: #4CAF50;">
        🎭 Loading Character Animations
      </div>
      <div style="margin-bottom: 15px; color: #ccc;">
        Preparing your character for action...
      </div>
      <div style="background: #333; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden;">
        <div id="progress-bar" style="background: linear-gradient(90deg, #4CAF50, #45a049); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px;"></div>
      </div>
      <div id="progress-text" style="color: #aaa; font-size: 16px;">0%</div>
      <div id="progress-detail" style="color: #888; font-size: 14px; margin-top: 10px;">Starting...</div>
    `;

    document.body.appendChild(this.loadingUI);
  }

  /**
   * Update loading progress UI
   */
  private updateLoadingProgress(loaded: number, total: number, currentItem?: string): void {
    this.loadingProgress = { loaded, total, isComplete: loaded >= total };
    
    if (this.loadingUI) {
      const progressBar = this.loadingUI.querySelector('#progress-bar') as HTMLElement;
      const progressText = this.loadingUI.querySelector('#progress-text') as HTMLElement;
      const progressDetail = this.loadingUI.querySelector('#progress-detail') as HTMLElement;
      
      const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
      
      if (progressBar) progressBar.style.width = `${percentage}%`;
      if (progressText) progressText.textContent = `${percentage}%`;
      if (progressDetail) {
        if (currentItem) {
          progressDetail.textContent = `Loading: ${currentItem}...`;
        } else if (loaded >= total) {
          progressDetail.textContent = 'Complete! Ready to race!';
        } else {
          progressDetail.textContent = `${loaded}/${total} animations loaded`;
        }
      }
    }

    // Dispatch event to notify game state manager
    window.dispatchEvent(new CustomEvent('animationLoadingProgress', {
      detail: { 
        loaded, 
        total, 
        isComplete: this.loadingProgress.isComplete,
        percentage: total > 0 ? Math.round((loaded / total) * 100) : 0
      }
    }));

    // Send loading progress to other players in multiplayer
    if (this.loadingProgress.isComplete) {
      window.dispatchEvent(new CustomEvent('playerAnimationsReady', {
        detail: { playerId: 'local', isReady: true }
      }));
      
      // Send animation ready status to server for multiplayer coordination
      if ((window as any).Network && (window as any).Network.isNetworkingEnabled()) {
        (window as any).Network.sendAnimationStatus(true);
      }
    }
  }

  /**
   * Hide loading UI
   */
  private hideLoadingUI(): void {
    if (this.loadingUI) {
      this.loadingUI.style.transition = 'opacity 0.5s ease-out';
      this.loadingUI.style.opacity = '0';
      setTimeout(() => {
        if (this.loadingUI && this.loadingUI.parentNode) {
          this.loadingUI.parentNode.removeChild(this.loadingUI);
        }
        this.loadingUI = null;
      }, 500);
    }
  }

  /**
   * Check if animations are fully loaded
   */
  public isLoadingComplete(): boolean {
    return this.loadingProgress.isComplete;
  }

  /**
   * Get loading progress status
   */
  public getLoadingProgress(): { loaded: number, total: number, isComplete: boolean } {
    return { ...this.loadingProgress };
  }

  /**
   * Preload ALL character animations on game startup
   */
  public async preloadAllCharacterAnimations(): Promise<void> {
    if (!AutoCharacterLoader.isCharacterAnimationsEnabled()) {
      console.log('🚫 Character animations disabled - skipping preload');
      return;
    }
    
    console.log('🎭 Preloading all character animations for instant access...');
    
    // For now, all classes use swing animations (swing animation removed due to being broken)
    const allAnimationFiles = [
      { name: 'swing_idle', file: `/models/characters/swing/swing_idle.fbx` },
      { name: 'swing_running', file: `/models/characters/swing/swing_running.fbx` },
      { name: 'swing_jumping', file: `/models/characters/swing/swing_running_jump.fbx` },
      { name: 'swing_falling', file: `/models/characters/swing/swing_falling.fbx` }
      // Note: swing_swing.fbx removed - animation was broken, now using falling for grapple
      // TODO: Add blink and blast animations when available:
      // { name: 'blink_idle', file: `/models/characters/blink/blink_idle.fbx` },
      // { name: 'blast_idle', file: `/models/characters/blast/blast_idle.fbx` },
      // etc.
    ];

    console.log(`📦 Preloading ${allAnimationFiles.length} animations in background...`);
    
    // Preload all animations in background with delays (non-blocking)
    this.preloadAnimationsWithDelay(allAnimationFiles, 0);
  }

  /**
   * Preload animations for a class before race starts (legacy method)
   */
  public async preloadAnimationsForClass(characterClass: string): Promise<void> {
    if (!AutoCharacterLoader.isCharacterAnimationsEnabled()) {
      console.log(`🚫 Character animations disabled - skipping preload for ${characterClass}`);
      
      // Dispatch completion event immediately so game doesn't get stuck waiting
      window.dispatchEvent(new CustomEvent('animationLoadingProgress', {
        detail: { 
          loaded: 4, 
          total: 4, 
          isComplete: true,
          percentage: 100
        }
      }));
      return;
    }
    
    console.log(`🎭 Preloading animations for ${characterClass}...`);
    
    const animationFiles = [
      { name: 'idle', file: `/models/characters/swing/swing_idle.fbx` },
      { name: 'running', file: `/models/characters/swing/swing_running.fbx` },
      { name: 'jumping', file: `/models/characters/swing/swing_running_jump.fbx` },
      { name: 'falling', file: `/models/characters/swing/swing_falling.fbx` }
      // Note: swing animation removed - was broken, now using falling for grapple state
    ];

    // Preload in background with delays
    this.preloadAnimationsWithDelay(animationFiles, 0);
  }

  /**
   * Preload animations sequentially to avoid blocking
   */
  private async preloadAnimationsWithDelay(animationFiles: Array<{name: string, file: string}>, index: number): Promise<void> {
    if (index >= animationFiles.length) {
      console.log(`🎭 Preloading complete - animations cached in browser`);
      
      // Dispatch completion event for game start coordination
      window.dispatchEvent(new CustomEvent('animationLoadingProgress', {
        detail: { 
          loaded: animationFiles.length, 
          total: animationFiles.length, 
          isComplete: true,
          percentage: 100
        }
      }));
      return;
    }

    const anim = animationFiles[index];
    
    requestAnimationFrame(async () => {
      try {
        // Just load the FBX to cache it - don't create actions yet
        await this.loadFBX(anim.file);
        console.log(`📦 Preloaded: ${anim.name}`);
      } catch (error) {
        console.warn(`⚠️ Preload failed for ${anim.name}:`, error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Preload next with delay
      setTimeout(() => {
        this.preloadAnimationsWithDelay(animationFiles, index + 1);
      }, 300); // 300ms delay for preloading
    });
  }

  /**
   * Auto-load character when class is selected
   */
  public async loadCharacterForClass(characterClass: string): Promise<void> {
    // Store current class for mode switching
    this.currentClass = characterClass;
    
    if (!AutoCharacterLoader.isCharacterAnimationsEnabled()) {
      // Use static portrait instead
      this.loadStaticPortrait(characterClass);
      this.updatePortraitTitle(characterClass);
      console.log(`🖼️ Loaded static portrait for: ${characterClass}`);
      return;
    }
    
    if (this.isLoading) {
      console.log('⏳ Character already loading...');
      return;
    }

    // Clean up existing character
    this.cleanup();
    
    this.isLoading = true;
    this.currentClass = characterClass;
    
    // Show loading UI
    this.createLoadingUI();
    this.updateLoadingProgress(0, 4, 'idle animation'); // 4 total animations (removed broken swing)
    
    console.log(`🔄 Auto-loading character for: ${characterClass}`);

    try {
      // Load base character model (idle animation)
      const model = await this.loadFBX('/models/characters/swing/swing_idle.fbx');
      
      // Setup character
      this.setupCharacterModel(model);
      
      // Setup animation mixer
      const mixer = new THREE.AnimationMixer(model);
      const animations = new Map<string, THREE.AnimationAction>();
      
      // Extract idle animation from base model
      if (model.animations && model.animations.length > 0) {
        const idleAction = mixer.clipAction(model.animations[0]);
        idleAction.loop = THREE.LoopRepeat;
        animations.set('idle', idleAction);
        this.updateLoadingProgress(1, 4, 'idle animation complete');
        console.log(`✅ Loaded idle animation`);
      }

      this.character = {
        model,
        mixer,
        animations,
        currentAnimation: null
      };

      // Add character to portrait scene instead of main scene
      this.portraitScene.add(model);
      
      // Load additional animations with progress tracking
      await this.loadAdditionalAnimationsWithProgress();
      
      // Start with idle animation
      this.setAnimation('idle');
      console.log(`🎭 Started with idle animation`);
      
      // Mark loading complete
      this.updateLoadingProgress(4, 4);
      setTimeout(() => this.hideLoadingUI(), 1000); // Show "Complete" for 1 second
      
      // Update portrait title with class name
      this.updatePortraitTitle(characterClass);
      
      console.log(`✅ Character auto-loaded: ${characterClass}`);
      
    } catch (error) {
      console.error('❌ Failed to auto-load character:', error);
      this.hideLoadingUI();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Update portrait styling for the given character class
   */
  private updatePortraitStyling(className: string): void {
    if (!this.portraitContainer) return;
    
    const styling = this.getClassStyling(className);
    
    // Update container styling
    this.portraitContainer.style.borderColor = styling.borderColor;
    this.portraitContainer.style.boxShadow = `0 8px 20px rgba(0, 0, 0, 0.5), 0 0 15px ${styling.boxShadowColor}`;
    
    // Update title bar
    const titleElement = document.getElementById('character-portrait-title');
    if (titleElement) {
      titleElement.style.background = styling.titleGradient;
      titleElement.textContent = `${styling.emoji} ${className.toUpperCase()}`;
    }
  }

  /**
   * Update portrait title with current class using consistent styling
   * @deprecated Use updatePortraitStyling instead for full visual update
   */
  private updatePortraitTitle(className: string): void {
    this.updatePortraitStyling(className);
  }

  /**
   * Load additional animations with progress tracking
   */
  private async loadAdditionalAnimationsWithProgress(): Promise<void> {
    if (!this.character) return;

    const animationFiles = [
      { name: 'running', file: '/models/characters/swing/swing_running.fbx' },
      { name: 'jumping', file: '/models/characters/swing/swing_running_jump.fbx' },
      { name: 'falling', file: '/models/characters/swing/swing_falling.fbx' }
      // Note: swing animation removed - was broken, now using falling for grapple state
    ];

    console.log(`🎭 Loading additional animations for ${this.currentClass}...`);

    // Load animations sequentially with progress updates
    for (let i = 0; i < animationFiles.length; i++) {
      const anim = animationFiles[i];
      this.updateLoadingProgress(1 + i, 4, anim.name);
      
      try {
        const animModel = await this.loadFBX(anim.file);
        if (animModel.animations && animModel.animations.length > 0 && this.character) {
          const action = this.character.mixer.clipAction(animModel.animations[0]);
          action.loop = THREE.LoopRepeat;
          this.character.animations.set(anim.name, action);
          console.log(`✅ Loaded: ${anim.name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ${anim.name}:`, error instanceof Error ? error.message : 'Unknown error');
      }
      
              this.updateLoadingProgress(2 + i, 4, `${anim.name} complete`);
    }

    const loadedAnimNames = Array.from(this.character.animations.keys());
    console.log(`🎭 All animations loaded for ${this.currentClass}: [${loadedAnimNames.join(', ')}]`);
  }



  /**
   * Load animations sequentially with delays to prevent blocking
   */
  private async loadAnimationsWithDelay(animationFiles: Array<{name: string, file: string}>, index: number): Promise<void> {
    if (index >= animationFiles.length || !this.character) {
      if (this.character) {
        const loadedAnimNames = Array.from(this.character.animations.keys());
        console.log(`🎭 Background loading complete for ${this.currentClass}: [${loadedAnimNames.join(', ')}]`);
      }
      return;
    }

    const anim = animationFiles[index];
    
    // Use requestAnimationFrame to defer loading
    requestAnimationFrame(async () => {
      try {
        const animModel = await this.loadFBX(anim.file);
        if (animModel.animations && animModel.animations.length > 0 && this.character) {
          const action = this.character.mixer.clipAction(animModel.animations[0]);
          action.loop = THREE.LoopRepeat;
          this.character.animations.set(anim.name, action);
          console.log(`✅ Background loaded: ${anim.name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Background load failed for ${anim.name}:`, error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Load next animation with delay
      setTimeout(() => {
        this.loadAnimationsWithDelay(animationFiles, index + 1);
      }, 200); // 200ms delay between animations
    });
  }

  /**
   * Load FBX file
   */
  private async loadFBX(path: string): Promise<THREE.Group> {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const loader = new FBXLoader();
    
    // Suppress FBX loader warnings about vertex weights (normal for Mixamo)
    const originalWarn = console.warn;
    const originalLog = console.log;
    
    return new Promise((resolve, reject) => {
      // Temporarily suppress FBX warnings
      console.warn = (message, ...args) => {
        if (typeof message === 'string' && message.includes('Vertex has more than 4 skinning weights')) {
          return; // Suppress this specific warning
        }
        originalWarn(message, ...args);
      };
      
      console.log = (message, ...args) => {
        if (typeof message === 'string' && message.includes('FBXLoader')) {
          return; // Suppress FBX loading logs
        }
        originalLog(message, ...args);
      };
      
      loader.load(
        path, 
        (model) => {
          // Restore console functions
          console.warn = originalWarn;
          console.log = originalLog;
          resolve(model);
        }, 
        undefined, 
        (error) => {
          // Restore console functions on error
          console.warn = originalWarn;
          console.log = originalLog;
          reject(error);
        }
      );
    });
  }

  /**
   * Setup character model properties for full-body portrait view
   */
  private setupCharacterModel(model: THREE.Group): void {
    // Position character in portrait scene (centered with more space above and below)
    model.position.set(0, -1.0, 0); // Lower to ensure feet are visible with headroom above
    model.scale.setScalar(1.4); // Slightly smaller scale to fit full body in frame
    model.rotation.y = 0; // Face towards camera (default)
    
    // Setup materials and shadows for portrait lighting
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.color.multiplyScalar(1.4); // Brighter for larger portrait
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    console.log(`🎭 Character setup for full-body portrait: scale=1.4, positioned to show head to toe`);
  }

  /**
   * Switch animation
   */
  private setAnimation(animName: string): void {
    if (!this.character) {
      console.warn(`🎭 Cannot set animation ${animName}: no character loaded`);
      return;
    }

    const newAction = this.character.animations.get(animName);
    if (!newAction) {
      console.warn(`🎭 Animation ${animName} not found. Available: [${Array.from(this.character.animations.keys()).join(', ')}]`);
      return;
    }

    if (this.character.currentAnimation && this.character.currentAnimation !== newAction) {
      this.character.currentAnimation.fadeOut(0.2);
    }

    this.character.currentAnimation = newAction;
    newAction.reset().fadeIn(0.2).play();
  }



  /**
   * Update character animations and render portrait
   */
  public update(deltaTime: number, _playerPosition: THREE.Vector3, playerVelocity?: THREE.Vector3, _camera?: THREE.Camera, grounded?: boolean, horizontalSpeed?: number): void {
    if (!AutoCharacterLoader.isCharacterAnimationsEnabled() || !this.character) return;

    // Update animations based on movement using proper data
    if (playerVelocity && grounded !== undefined && horizontalSpeed !== undefined) {
      this.updateAnimationBasedOnMovement(playerVelocity, grounded, horizontalSpeed);
    }

    // Update animation mixer
    this.character.mixer.update(deltaTime);
    
    // Render character portrait
    this.renderPortrait();
  }

  /**
   * Render the character portrait
   */
  private renderPortrait(): void {
    if (!this.character || !this.portraitRenderer) return;
    
    // Render the portrait scene
    this.portraitRenderer.render(this.portraitScene, this.portraitCamera);
  }

  /**
   * Update animation based on player movement
   */
  private updateAnimationBasedOnMovement(velocity: THREE.Vector3, grounded: boolean, horizontalSpeed: number): void {
    if (!this.character) return;
    
    // User's specific animation logic:
    let targetAnim = 'idle';
    
    // HIGHEST PRIORITY: if character is swinging (grapple), use falling animation instead
    // (swing animation is broken, so we use falling as a substitute)
    if (isSwinging()) {
      targetAnim = 'falling';
    }
    // if v speed is negative, use falling
    else if (velocity.y < -0.5) {
      targetAnim = 'falling';
    }
    // if v speed is positive, use jump
    else if (velocity.y > 0.5) {
      targetAnim = this.character.animations.has('jumping') ? 'jumping' : 'running_jump';
    }
    // if 2d speed > 0 and grounded, use running
    else if (horizontalSpeed > 0.5 && grounded) {
      targetAnim = 'running';
    }
    // if 2d speed = 0 and v speed is 0, use idle (default)
    
    // Only change if different and animation exists
    const currentName = this.getCurrentAnimationName();
    
    // Minimal debug logging (only on changes)
    if (this.debugMode && currentName !== targetAnim) {
      console.log(`🎬 Animation: 2D=${horizontalSpeed.toFixed(1)}, Y=${velocity.y.toFixed(1)}, grounded=${grounded} → ${targetAnim}`);
    }
    
    if (currentName !== targetAnim && this.character.animations.has(targetAnim)) {
      this.setAnimation(targetAnim);
      if (this.debugMode) console.log(`🎭 Animation changed: ${currentName} → ${targetAnim}`);
    }
  }

  /**
   * Get current animation name
   */
  private getCurrentAnimationName(): string | null {
    if (!this.character?.currentAnimation) return null;
    
    for (const [name, action] of this.character.animations) {
      if (action === this.character.currentAnimation) return name;
    }
    return null;
  }

  /**
   * Cleanup character and portrait resources
   */
  private cleanup(): void {
    if (this.character) {
      // Remove from portrait scene instead of main scene
      this.portraitScene.remove(this.character.model);
      this.character.mixer.stopAllAction();
      this.character = null;
    }
  }

  /**
   * Dispose of all resources including portrait UI
   */
  public dispose(): void {
    this.cleanup();
    
    // Dispose of portrait renderer
    if (this.portraitRenderer) {
      this.portraitRenderer.dispose();
    }
    
    // Clean up static image
    this.staticImageElement = null;
    
    // Remove portrait UI from DOM
    if (this.portraitContainer && this.portraitContainer.parentNode) {
      // Clean up event listeners
      if (this.hoverEnterHandler) {
        this.portraitContainer.removeEventListener('mouseenter', this.hoverEnterHandler);
      }
      if (this.hoverLeaveHandler) {
        this.portraitContainer.removeEventListener('mouseleave', this.hoverLeaveHandler);
      }
      
      this.portraitContainer.parentNode.removeChild(this.portraitContainer);
      this.portraitContainer = null;
      this.hoverEnterHandler = undefined;
      this.hoverLeaveHandler = undefined;
    }
    
    console.log('🧹 AutoCharacterLoader disposed');
  }

  /**
   * Get character status
   */
  public getStatus() {
    return {
      hasCharacter: !!this.character,
      currentClass: this.currentClass,
      isLoading: this.isLoading,
      animations: this.character ? Array.from(this.character.animations.keys()) : [],
      currentAnimation: this.getCurrentAnimationName()
    };
  }

  /**
   * Toggle portrait visibility (for debugging)
   */
  public togglePortraitVisibility(): void {
    if (this.portraitContainer) {
      const isVisible = this.portraitContainer.style.display !== 'none';
      this.portraitContainer.style.display = isVisible ? 'none' : 'block';
      console.log(`🖼️ Character portrait ${isVisible ? 'HIDDEN' : 'SHOWN'}`);
    }
  }

  /**
   * Check if character system is active
   */
  public isCharacterSystemActive(): boolean {
    return AutoCharacterLoader.isCharacterAnimationsEnabled() && !!this.portraitContainer;
  }

  /**
   * Test specific animation (for debugging)
   */
  public testAnimation(animationName: string): void {
    if (this.character && this.character.animations.has(animationName)) {
      this.setAnimation(animationName);
      console.log(`🎬 Testing animation: ${animationName}`);
    } else {
      console.warn(`❌ Animation '${animationName}' not available. Available: [${this.character ? Array.from(this.character.animations.keys()).join(', ') : 'none'}]`);
    }
  }
} 