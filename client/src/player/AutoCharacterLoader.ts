import * as THREE from 'three';
import { type PlayerClass } from '../kits/classKit.js';
import { isSwinging } from '../kits/grapple.js';

// Blast animation state tracking
let blastAnimationState = {
  isBlasting: false,
  blastEndTime: 0
};

// Blink animation state tracking
let blinkAnimationState = {
  isBlinking: false,
  blinkEndTime: 0
};

// Swing animation state tracking for ping-pong loop
let swingAnimationState = {
  isSwingAnimating: false,
  lastSwingTime: 0,
  originalPosition: null as THREE.Vector3 | null,
  originalRotation: null as number | null,
  originalScale: null as number | null
};

/**
 * Automatic character loader that integrates seamlessly with gameplay
 * No manual cube loading - just works automatically
 * 
 * SAFETY FEATURES - Essential protections only:
 * - Disposal prevention: Prevent operations after cleanup
 * - Resource tracking: Track animation frames and event listeners for cleanup
 * - WebGL recovery: Handle WebGL context loss gracefully
 * - Async coordination: Prevent race conditions in async operations
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
  private boundSettingsHandler?: (event: Event) => void;
  
  // Static image support for when animations are disabled
  private staticImageElement: HTMLImageElement | null = null;

  private currentClass: PlayerClass | null = null;

  private isLoading = false;
  private debugMode = false; // Disable debug logging by default (use __autoChar.toggleDebug() to enable)
  private loadingProgress = { loaded: 0, total: 0, isComplete: false };
  private loadingUI: HTMLDivElement | null = null;
  
  // ESSENTIAL SAFETY: Core protection systems only
  private isDisposed = false; // Prevent use after disposal
  private activeAnimationFrames: Set<number> = new Set(); // Track animation frames
  private eventListeners: Array<{ target: EventTarget, type: string, handler: EventListener }> = []; // Track event listeners
  private webglContextLostHandler?: (event: Event) => void; // WebGL context loss handling
  private lastRenderTime = 0; // Prevent excessive rendering
  private readonly RENDER_THROTTLE_MS = 16; // ~60fps max
  
  // ASYNC OPERATION LOCKS: Prevent concurrent operations that could corrupt state
  private characterLoadingLock = false;
  private preloadingLock = false;
  private currentLoadingClass: PlayerClass | null = null;

  constructor() {
    // Initialize portraitScene to prevent crash in cleanup
    this.portraitScene = new THREE.Scene();
    this.portraitScene.background = new THREE.Color(0x0a0a0f); // Dark background
    
    // Safely initialize portrait UI without triggering any scene modifications
    this.setupCharacterPortrait();
    
    // Safe event listener management with tracking
    this.addEventListenerSafe(window, 'hudStyleChanged', (_event: any) => {
      this.updatePortraitVisibility();
    });
    
    this.addEventListenerSafe(window, 'portraitStyleChanged', (event: any) => {
      this.handlePortraitStyleChange(event.detail.style);
    });

    // Set up ability animation event listeners
    this.setupAbilityAnimationListeners();
    
    // Handle WebGL context loss
    this.setupWebGLContextHandling();
    
    console.log('🖼️ AutoCharacterLoader initialized safely with portrait scene');
  }
  
  // FIX #3: Safe event listener management
  private addEventListenerSafe(target: EventTarget, type: string, handler: EventListener): void {
    if (this.isDisposed) return;
    target.addEventListener(type, handler);
    this.eventListeners.push({ target, type, handler });
  }
  
  // FIX #4: WebGL context loss handling
  private setupWebGLContextHandling(): void {
    this.webglContextLostHandler = (event: Event) => {
      event.preventDefault();
      console.warn('⚠️ WebGL context lost - portrait will fallback to static mode');
      // Automatically switch to TF2 mode if WebGL is lost
      localStorage.setItem('wreckless-portrait-style', 'tf2');
      this.hidePortrait();
    };
  }

  /**
   * Set up event listeners for ability animation triggers (blast, blink, etc.)
   */
  private setupAbilityAnimationListeners(): void {
    // Listen for ability usage events
    this.addEventListenerSafe(window, 'abilityUsed', (event: any) => {
      if (event.detail?.ability === 'blast') {
        // Trigger blast animation for 300ms
        blastAnimationState.isBlasting = true;
        blastAnimationState.blastEndTime = Date.now() + 300;
      } else if (event.detail?.ability === 'blink') {
        // Trigger blink animation for 200ms (shorter than blast)
        blinkAnimationState.isBlinking = true;
        blinkAnimationState.blinkEndTime = Date.now() + 200;
      }
    });

    // Also listen for the more specific ability events
    this.addEventListenerSafe(window, 'abilityActivated', (event: any) => {
      if (event.detail?.className === 'blast') {
        blastAnimationState.isBlasting = true;
        blastAnimationState.blastEndTime = Date.now() + 300;
      } else if (event.detail?.className === 'blink') {
        blinkAnimationState.isBlinking = true;
        blinkAnimationState.blinkEndTime = Date.now() + 200;
      }
    });

    // Listen for swing state changes to control swing animation
    this.addEventListenerSafe(window, 'swingStateChanged', (event: any) => {
      if (event.detail?.isSwinging) {
        // Start swing animation loop
        swingAnimationState.isSwingAnimating = true;
        swingAnimationState.lastSwingTime = Date.now();
      } else {
        // Stop swing animation loop
        swingAnimationState.isSwingAnimating = false;
        
        // Restore original transforms when swing ends (if we have a character)
        if (swingAnimationState.originalPosition && this.character) {
          this.character.model.position.copy(swingAnimationState.originalPosition);
          this.character.model.rotation.y = swingAnimationState.originalRotation!;
          this.character.model.scale.setScalar(swingAnimationState.originalScale!);
          
          // Clear stored values
          swingAnimationState.originalPosition = null;
          swingAnimationState.originalRotation = null;
          swingAnimationState.originalScale = null;
          

        }
      }
    });
  }

  /**
   * Check if blast animation should be playing
   */
  private isBlasting(): boolean {
    if (blastAnimationState.isBlasting && Date.now() > blastAnimationState.blastEndTime) {
      blastAnimationState.isBlasting = false;
    }
    return blastAnimationState.isBlasting;
  }

  /**
   * Check if blink animation should be playing
   */
  private isBlinking(): boolean {
    if (blinkAnimationState.isBlinking && Date.now() > blinkAnimationState.blinkEndTime) {
      blinkAnimationState.isBlinking = false;
    }
    return blinkAnimationState.isBlinking;
  }

  /**
   * Check if swing animation should be playing (simple approach)
   */
  private isSwingAnimating(): boolean {
    return swingAnimationState.isSwingAnimating;
  }

  /**
   * Check if character animations are enabled
   */
  public static isCharacterAnimationsEnabled(): boolean {
    // Check the new portrait style system first
    const portraitStyle = localStorage.getItem('wreckless-portrait-style');
    if (portraitStyle === '3d') {
      return true;
    } else if (portraitStyle === 'default' || portraitStyle === 'tf2') {
      return false;
    }
    
    // Fallback to old system for backwards compatibility
    const stored = localStorage.getItem('wreckless-character-animations');
    return stored !== null ? JSON.parse(stored) : false; // Default to disabled for safety
  }

  /**
   * Safely set up 3D infrastructure for mode switching
   */
  private ensureAnimatedPortraitSetup(): boolean {
    if (!this.portraitContainer) {
      console.warn('⚠️ Cannot set up 3D portrait: no container');
      return false;
    }
    
    // Check if 3D infrastructure is already set up and DOM-integrated
    if (this.portraitRenderer && this.portraitCamera) {
      const hasCanvas = this.portraitContainer.querySelector('canvas');
      if (hasCanvas) {
        console.log('🖼️ 3D infrastructure already set up and integrated');
        return true;
      } else {
        console.warn('⚠️ 3D infrastructure exists but not DOM-integrated, re-setting up');
        // Clean up incomplete setup
        if (this.portraitRenderer) {
          this.portraitRenderer.dispose();
          this.portraitRenderer = undefined!;
        }
        this.portraitCamera = undefined!;
      }
    }
    
    // Find content area
    const contentArea = this.portraitContainer.querySelector('div:last-child') as HTMLElement;
    if (!contentArea) {
      console.warn('⚠️ Cannot set up 3D portrait: no content area');
      return false;
    }
    
    // Clear any existing content to avoid conflicts
    while (contentArea.firstChild) {
      contentArea.removeChild(contentArea.firstChild);
    }
    
    // Set up 3D infrastructure
    try {
      this.setupAnimatedPortrait(contentArea);
      
      // Verify setup was successful
      const hasCanvas = contentArea.querySelector('canvas');
      if (!hasCanvas || !this.portraitRenderer) {
        throw new Error('3D setup incomplete - missing canvas or renderer');
      }
      
      console.log('✅ 3D portrait infrastructure set up and verified');
      return true;
    } catch (error) {
      console.error('❌ Failed to set up 3D portrait infrastructure:', error);
      
      // Clean up failed attempt
      if (this.portraitRenderer) {
        this.portraitRenderer.dispose();
        this.portraitRenderer = undefined!;
      }
      this.portraitCamera = undefined!;
      
      // Set up static fallback
      this.setupStaticPortrait(contentArea);
      return false;
    }
  }

  /**
   * Handle portrait style changes from the new unified system
   */
  private handlePortraitStyleChange(style: string): void {
    // FIX #1: Prevent operations after disposal
    if (this.isDisposed) return;
    
    // Prevent operations during disposal
    if (this.isDisposed) {
      return;
    }
    console.log(`🖼️ Portrait style changed to: ${style}`);
    
    try {
      // FIX #10: Clean up previous mode safely before switching
      this.safeCleanupBeforeModeSwitch();
      
      switch (style) {
        case 'default':
          // Default: Hide all portraits and clean up
          this.hidePortrait();
          this.cleanup();
          break;
          
        case 'tf2':
          // TF2: Hide 3D portrait, cleanup 3D resources
          this.hidePortrait();
          this.cleanup();
          break;
          
        case '3d':
          // 3D: Show 3D portrait, ensure proper setup
          console.log('🖼️ Enabling 3D portraits, positioned to avoid HUD conflicts');
          
          // Ensure 3D infrastructure is set up
          if (this.ensureAnimatedPortraitSetup()) {
            this.showPortrait();
            
            // If we have a current class but no 3D character loaded, load it
            if (this.currentClass && !this.character) {
              this.loadCharacterForClass(this.currentClass);
            }
          } else {
            console.warn('⚠️ Failed to set up 3D portrait, falling back to TF2 mode');
            // Fallback was already set up in ensureAnimatedPortraitSetup
            localStorage.setItem('wreckless-portrait-style', 'tf2');
            localStorage.setItem('tf2-hud-enabled', 'true');
            localStorage.setItem('wreckless-character-animations', 'false');
            
            // Dispatch events to update other systems
            window.dispatchEvent(new CustomEvent('hudStyleChanged', {
              detail: { tf2Style: true }
            }));
            window.dispatchEvent(new CustomEvent('portraitStyleChanged', {
              detail: { style: 'tf2' }
            }));
            
            this.hidePortrait(); // Hide 3D portrait since TF2 uses its own static portrait system
          }
          break;
      }
      
      this.updatePortraitVisibility();
    } catch (error) {
      console.error('❌ Error during portrait style change:', error);
      // FIX #11: Recovery from mode switch failures
      this.recoverFromModeSwitch();
    } finally {
      // Cleanup completed
    }
  }
  
  // FIX #10: Safe cleanup before mode switching
  private safeCleanupBeforeModeSwitch(): void {
    // Cancel any active animation frames
    this.activeAnimationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    this.activeAnimationFrames.clear();
    
    // Stop any ongoing loading
    this.isLoading = false;
  }
  
  // FIX #11: Recovery mechanism for failed mode switches
  private recoverFromModeSwitch(): void {
    console.warn('⚠️ Recovering from failed mode switch - defaulting to TF2 mode');
    localStorage.setItem('wreckless-portrait-style', 'tf2');
    this.hidePortrait();
    this.cleanup();
  }

  /**
   * Hide the character portrait (safely)
   */
  private hidePortrait(): void {
    if (this.portraitContainer) {
      this.portraitContainer.style.display = 'none';
    }
  }

  /**
   * Show the character portrait (safely)
   */
  private showPortrait(): void {
    if (this.portraitContainer) {
      this.portraitContainer.style.display = 'block';
    }
  }

  /**
   * Update portrait visibility based on current settings
   */
  private updatePortraitVisibility(): void {
    const portraitStyle = localStorage.getItem('wreckless-portrait-style') || 'tf2'; // Default to tf2
    
    if (this.portraitContainer) {
      switch (portraitStyle) {
        case 'default':
          // Default: No portraits at all
          this.portraitContainer.style.display = 'none';
          console.log('🖼️ All portraits hidden (default mode)');
          break;
          
        case 'tf2':
          // TF2: Hide 3D portrait (TF2 HUD has its own static portrait system)
          this.portraitContainer.style.display = 'none';
          console.log('🖼️ 3D portrait hidden for TF2-style HUD (TF2 HUD uses its own portrait system)');
          break;
          
        case '3d':
          // 3D: Show 3D portrait positioned to avoid conflicts
          this.portraitContainer.style.display = 'block';
          console.log('🖼️ 3D portrait visible, positioned to avoid HUD conflicts');
          break;
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
    
    // Create UI container - properly tucked into bottom left corner
    this.portraitContainer = document.createElement('div');
    this.portraitContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 20px;
      width: 160px;
      height: 280px;
      z-index: 950;
      overflow: hidden;
      transform: scale(1.0);
      transform-origin: bottom left;
      transition: transform 0.3s ease;
      opacity: 1.0;
      display: none;
      background: linear-gradient(145deg, rgba(10, 10, 15, 0.95), rgba(20, 20, 30, 0.98));
      border: 3px solid ${styling.borderColor};
      border-radius: 15px;
      box-shadow: 
        0 0 25px ${styling.boxShadowColor}80,
        0 8px 32px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      padding: 10px;
    `;
    
    // Create content area for portrait (ensures image isn't covered by border)
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.3);
    `;
    
    // Create decorative frame overlay
    const frameOverlay = document.createElement('div');
    frameOverlay.style.cssText = `
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 15px;
      pointer-events: none;
      z-index: 5;
    `;
    
    // Create inner frame accent
    const innerFrame = document.createElement('div');
    innerFrame.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border: 1px solid ${styling.borderColor}40;
      border-radius: 8px;
      pointer-events: none;
      z-index: 5;
    `;
    
    // Store hover handlers for cleanup
    this.hoverEnterHandler = () => {
      this.portraitContainer!.style.transform = 'scale(1.05)';
      this.portraitContainer!.style.boxShadow = `
        0 0 35px ${styling.boxShadowColor},
        0 12px 40px rgba(0, 0, 0, 0.7),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.4)`;
    };
    this.hoverLeaveHandler = () => {
      this.portraitContainer!.style.transform = 'scale(1.0)';
      this.portraitContainer!.style.boxShadow = `
        0 0 25px ${styling.boxShadowColor}80,
        0 8px 32px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3)`;
    };
    
    // Add hover effect
    this.portraitContainer.addEventListener('mouseenter', this.hoverEnterHandler);
    this.portraitContainer.addEventListener('mouseleave', this.hoverLeaveHandler);
    
    // Add class indicator (bottom center, outside the portrait frame)
    const classIndicator = document.createElement('div');
    classIndicator.style.cssText = `
      position: absolute;
      bottom: -35px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(45deg, ${styling.borderColor}, ${styling.boxShadowColor});
      color: white;
      padding: 6px 10px;
      border-radius: 10px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: bold;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      z-index: 10;
      backdrop-filter: blur(4px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.5);
      white-space: nowrap;
    `;
    classIndicator.textContent = `${styling.emoji} ${defaultClass}`;
    classIndicator.id = 'character-portrait-indicator';
    
    // Add frame elements and class indicator
    this.portraitContainer.appendChild(frameOverlay);
    this.portraitContainer.appendChild(innerFrame);
    this.portraitContainer.appendChild(classIndicator);
    this.portraitContainer.appendChild(contentArea);
    
    // Add to page
    document.body.appendChild(this.portraitContainer);
    
    // FIXED: Conditional setup based on current mode instead of always doing both
    if (AutoCharacterLoader.isCharacterAnimationsEnabled()) {
      // Set up 3D infrastructure for animated portraits
      this.setupAnimatedPortrait(contentArea);
    } else {
      // Set up static portrait infrastructure for static/tf2 mode
      this.setupStaticPortrait(contentArea);
    }
    
    // Set initial visibility based on HUD style
    this.updatePortraitVisibility();
    
    console.log(`🖼️ Character portrait UI created (${AutoCharacterLoader.isCharacterAnimationsEnabled() ? 'animated' : 'static'} mode) - positioned to avoid HUD conflicts`);
  }

  /**
   * Setup animated 3D portrait
   */
  private setupAnimatedPortrait(contentArea?: HTMLElement): void {
    // Portrait scene already initialized in constructor
    
    // Find or use provided content area
    let targetContainer = contentArea;
    if (!targetContainer && this.portraitContainer) {
      // Look for the content area in the existing container
      targetContainer = this.portraitContainer.querySelector('div:last-child') as HTMLElement;
    }
    if (!targetContainer) {
      targetContainer = this.portraitContainer!;
    }
    
    // Create camera for portrait (adjusted for content area size)
    const contentWidth = 140; // 160 - 20px padding
    const contentHeight = 260; // 280 - 20px padding
    this.portraitCamera = new THREE.PerspectiveCamera(35, contentWidth/contentHeight, 0.1, 100);
    this.portraitCamera.position.set(0.2, 1.5, 4.5); // Adjusted for better full-body framing
    this.portraitCamera.lookAt(0, 0.0, 0); // Look at center to ensure full character is visible
    
    // Create dedicated renderer for portrait with safety measures
    try {
      this.portraitRenderer = new THREE.WebGLRenderer({ 
        antialias: false, // Reduced for performance
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "low-power", // Use low-power mode to avoid conflicts
        failIfMajorPerformanceCaveat: false // Don't fail on performance issues
      });
      this.portraitRenderer.setSize(contentWidth, contentHeight);
      this.portraitRenderer.setClearColor(0x0a0a0f, 1.0); // Solid background to match frame
      this.portraitRenderer.shadowMap.enabled = true;
      this.portraitRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // FIX #4: Add WebGL context loss handling
      if (this.webglContextLostHandler) {
        this.portraitRenderer.domElement.addEventListener('webglcontextlost', this.webglContextLostHandler);
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to create WebGL renderer for 3D portrait, falling back to static mode:', error);
      // Fallback to static portrait if WebGL fails
      this.setupStaticPortrait(contentArea);
      return;
    }
    
    // Style the canvas to fill content area properly
    this.portraitRenderer.domElement.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 8px;
    `;
    
    // Add canvas to target container
    targetContainer.appendChild(this.portraitRenderer.domElement);
    
    // Add portrait lighting
    this.setupPortraitLighting();
  }

  /**
   * Setup static image portrait
   */
  private setupStaticPortrait(contentArea?: HTMLElement): void {
    // Find or use provided content area
    let targetContainer = contentArea;
    if (!targetContainer && this.portraitContainer) {
      targetContainer = this.portraitContainer.querySelector('div:last-child') as HTMLElement;
    }
    if (!targetContainer) {
      targetContainer = this.portraitContainer!;
    }
    
    // Safety check: only create new static image if one doesn't exist or isn't properly attached
    if (this.staticImageElement && this.staticImageElement.parentNode === targetContainer) {
      console.log('🖼️ Static portrait already properly set up');
      return;
    }
    
    // Clean up any existing static image that's in wrong location
    if (this.staticImageElement && this.staticImageElement.parentNode) {
      this.staticImageElement.parentNode.removeChild(this.staticImageElement);
    }
    
    // Create static image element
    this.staticImageElement = document.createElement('img');
    this.staticImageElement.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      border-radius: 8px;
      filter: brightness(1.0) contrast(1.1) saturate(1.1);
    `;
    
    // Add image to target container
    targetContainer.appendChild(this.staticImageElement);
    
    // Load default image (grapple since that's the default class)
    this.loadStaticPortrait('grapple');
    
    console.log('🖼️ Static portrait infrastructure set up');
  }

  /**
   * Load static image portrait for a class
   */
  private loadStaticPortrait(characterClass: PlayerClass): void {
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
              this.updatePortraitTitle(characterClass);
      
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
    // RACE CONDITION FIX: Acquire preload lock
    const gotLock = await this.acquirePreloadLock();
    if (!gotLock) {
      console.log('🔒 Character preloading already handled by another operation');
      return;
    }
    
    try {
      if (!AutoCharacterLoader.isCharacterAnimationsEnabled()) {
        console.log('🚫 Character animations disabled - skipping preload');
        
        // Dispatch completion event immediately so game doesn't get stuck waiting
        window.dispatchEvent(new CustomEvent('animationLoadingProgress', {
          detail: { 
            loaded: 4, 
            total: 4, 
            isComplete: true,
            percentage: 100
          }
        }));
        
        // MULTIPLAYER FIX: Send animation ready status to server even when disabled
        if ((window as any).Network && (window as any).Network.isNetworkingEnabled()) {
          (window as any).Network.sendAnimationStatus(true);
          console.log('🎭 Sent animation ready status to server (animations disabled)');
        }
        return;
      }
      
      console.log('🎭 Preloading all character animations for instant access...');
      
      // Load character-specific animations for each class
      const allAnimationFiles = [
        // Swing/Grapple animations (working set)
        { name: 'swing_idle', file: `/models/characters/swing/swing_idle.fbx` },
        { name: 'swing_running', file: `/models/characters/swing/swing_running.fbx` },
        { name: 'swing_jumping', file: `/models/characters/swing/swing_running_jump.fbx` },
        { name: 'swing_falling', file: `/models/characters/swing/swing_falling.fbx` },
        { name: 'swing_swing', file: `/models/characters/swing/swing_swing.fbx` }, // Re-enabled for ping-pong swing animation
        
        // Blast animations (available and ready!)
        { name: 'blast_idle', file: `/models/characters/blast/blast_idle.fbx` },
        { name: 'blast_running', file: `/models/characters/blast/blast_running.fbx` },
        { name: 'blast_jumping', file: `/models/characters/blast/blast_running_jump.fbx` },
        { name: 'blast_falling', file: `/models/characters/blast/blast_falling.fbx` },
        
        // Blink animations (add when files are available)
        { name: 'blink_idle', file: `/models/characters/blink/blink_idle.fbx` },
        { name: 'blink_running', file: `/models/characters/blink/blink_running.fbx` },
        { name: 'blink_jumping', file: `/models/characters/blink/blink_running_jump.fbx` },
        { name: 'blink_falling', file: `/models/characters/blink/blink_falling.fbx` }
      ];

      // Preload in background with delays
      await this.preloadAnimationsWithDelay(allAnimationFiles, 0);
      
      // Safety check after async operation
      if (this.isDisposed) {
        console.log('🚫 Preloading cancelled - component disposed');
        return;
      }
      
      console.log('🎭 All character animations preloaded successfully');
      
    } finally {
      // Always release the lock
      this.releasePreloadLock();
    }
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
      
      // MULTIPLAYER FIX: Send animation ready status to server even when disabled
      if ((window as any).Network && (window as any).Network.isNetworkingEnabled()) {
        (window as any).Network.sendAnimationStatus(true);
        console.log('🎭 Sent animation ready status to server (animations disabled)');
      }
      return;
    }
    
    console.log(`🎭 Preloading animations for ${characterClass}...`);
    
    // Map class names to character directories (grapple class uses swing files)
    const characterDir = characterClass === 'grapple' ? 'swing' : characterClass;
    
    const animationFiles = [
      { name: 'idle', file: `/models/characters/${characterDir}/${characterDir}_idle.fbx` },
      { name: 'running', file: `/models/characters/${characterDir}/${characterDir}_running.fbx` },
      { name: 'jumping', file: `/models/characters/${characterDir}/${characterDir}_running_jump.fbx` },
      { name: 'falling', file: `/models/characters/${characterDir}/${characterDir}_falling.fbx` }
      // Note: swing animation removed - was broken, now using falling for grapple state
    ];

    // Preload in background with delays
    this.preloadAnimationsWithDelay(animationFiles, 0);
  }

  /**
   * Load character model for specific class in animated portrait
   */
  public async loadCharacterForClass(characterClass: PlayerClass): Promise<void> {
    if (!AutoCharacterLoader.isCharacterAnimationsEnabled()) {
      console.log(`🚫 Character animations disabled - skipping load for ${characterClass}`);
      return;
    }

    // RACE CONDITION FIX: Acquire lock to prevent concurrent loading
    const gotLock = await this.acquireCharacterLoadLock(characterClass);
    if (!gotLock) {
      // Another operation already loaded this class or is loading it
      console.log(`🔒 Character loading for ${characterClass} already handled by another operation`);
      return;
    }

    try {
      if (this.currentClass === characterClass) {
        console.log(`🎭 Character ${characterClass} already loaded`);
        return;
      }

      // SIMPLE FIX: Clean up previous character before loading new one
      this.cleanup();

      console.log(`🎭 Loading character: ${characterClass}`);
      this.currentClass = characterClass;

      // Track progress for loading UI
      const totalAnimations = 4; // idle, running, jumping, falling + class-specific
      this.loadingProgress = { loaded: 0, total: totalAnimations, isComplete: false };
      this.createLoadingUI();

      try {
        // Map class names to character directories (grapple class uses swing files)
        const characterDir = characterClass === 'grapple' ? 'swing' : characterClass;
        
        // Load base character model (idle animation) - no cloning for better animation compatibility
        const model = await this.loadFBX(`/models/characters/${characterDir}/${characterDir}_idle.fbx`);
        
        // Safety check after async operation
        if (this.isDisposed || this.currentLoadingClass !== characterClass) {
          console.log(`🚫 Character loading cancelled for ${characterClass} (disposed or superseded)`);
          return;
        }
        
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
          this.updateLoadingProgress(1, totalAnimations, 'idle animation complete');
          console.log(`✅ Loaded idle animation`);
        }

        this.character = {
          model,
          mixer,
          animations,
          currentAnimation: null
        };

        // Apply character-specific positioning and scaling for portrait view
        this.applyCharacterPortraitSettings(model, characterClass);

        // Add character to portrait scene instead of main scene
        this.portraitScene.add(model);
        
        // Load additional animations with progress tracking
        await this.loadAdditionalAnimationsWithProgress(characterDir, totalAnimations);
        
        // Safety check after async operation
        if (this.isDisposed || this.currentLoadingClass !== characterClass) {
          console.log(`🚫 Character loading cancelled for ${characterClass} after animations load`);
          return;
        }
        
        // Start with idle animation
        this.setAnimation('idle');
        console.log(`🎭 Started with idle animation`);
        
        // Mark loading complete
        this.updateLoadingProgress(totalAnimations, totalAnimations);
        setTimeout(() => this.hideLoadingUI(), 1000); // Show "Complete" for 1 second
        
        // Update portrait title with class name
        this.updatePortraitTitle(characterClass);
        
        console.log(`🎭 Character loading completed successfully for: ${characterClass}`);
        
      } catch (error) {
        console.error(`❌ Failed to load character ${characterClass}:`, error);
        this.hideLoadingUI();
        throw error;
      }
      
    } finally {
      // Always release the lock
      this.releaseCharacterLoadLock();
    }
  }

  /**
   * Update portrait title/indicator based on class
   */
  private updatePortraitTitle(className: PlayerClass): void {
    if (!this.portraitContainer) return;
    
    const styling = this.getClassStyling(className);
    
    // Update main container border and glow
    this.portraitContainer.style.borderColor = styling.borderColor;
    this.portraitContainer.style.boxShadow = `
      0 0 25px ${styling.boxShadowColor}80,
      0 8px 32px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3)`;
    
    // Update inner frame accent
    const innerFrame = this.portraitContainer.querySelector('div:nth-child(2)') as HTMLElement;
    if (innerFrame) {
      innerFrame.style.borderColor = `${styling.borderColor}40`;
    }
    
    // Update class indicator
    const indicatorElement = document.getElementById('character-portrait-indicator');
    if (indicatorElement) {
      indicatorElement.style.background = `linear-gradient(45deg, ${styling.borderColor}, ${styling.boxShadowColor})`;
      indicatorElement.textContent = `${styling.emoji} ${className.toUpperCase()}`;
    }
  }

  /**
   * Load additional animations with progress tracking
   */
  private async loadAdditionalAnimationsWithProgress(characterDir: string, totalAnimations: number): Promise<void> {
    if (!this.character) return;

    const animationFiles = [
      { name: 'running', file: `/models/characters/${characterDir}/${characterDir}_running.fbx` },
      { name: 'jumping', file: `/models/characters/${characterDir}/${characterDir}_running_jump.fbx` },
      { name: 'falling', file: `/models/characters/${characterDir}/${characterDir}_falling.fbx` }
      // Note: swing animation re-enabled with ping-pong loop system
    ];

    // Add special ability animations for specific classes
    if (this.currentClass === 'grapple') {
      animationFiles.push({ name: 'swing', file: `/models/characters/${characterDir}/${characterDir}_swing.fbx` });
    } else if (this.currentClass === 'blast') {
      animationFiles.push({ name: 'blast', file: `/models/characters/${characterDir}/${characterDir}_blast.fbx` });
    } else if (this.currentClass === 'blink') {
      animationFiles.push({ name: 'blink', file: `/models/characters/${characterDir}/${characterDir}_blink.fbx` });
    }

    console.log(`🎭 Loading additional animations for ${this.currentClass}...`);

    // Load animations sequentially with progress updates
    for (let i = 0; i < animationFiles.length; i++) {
      const anim = animationFiles[i];
      this.updateLoadingProgress(1 + i, totalAnimations, anim.name);
      
      try {
        // Load animation model - no cloning needed for better compatibility
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
      
              this.updateLoadingProgress(2 + i, totalAnimations, `${anim.name} complete`);
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
        // Load animation model for background loading
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
   * Preload animations sequentially to avoid blocking
   */
  private async preloadAnimationsWithDelay(animationFiles: Array<{name: string, file: string}>, index: number): Promise<void> {
    if (index >= animationFiles.length || this.isDisposed) {
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
      }
      return;
    }

    const anim = animationFiles[index];
    
    try {
      // Load FBX to cache it in browser
      await this.loadFBX(anim.file);
      
      // Safety check after async operation
      if (this.isDisposed) {
        console.log('🚫 Preloading cancelled - component disposed');
        return;
      }
      
      console.log(`📦 Preloaded: ${anim.name}`);
    } catch (error) {
      console.warn(`⚠️ Preload failed for ${anim.name}:`, error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Preload next with delay
    await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay for preloading
    
    // Safety check before recursing
    if (!this.isDisposed) {
      await this.preloadAnimationsWithDelay(animationFiles, index + 1);
    }
  }

  /**
   * Load FBX file - simplified approach without cloning
   */
  private async loadFBX(path: string, _shouldClone: boolean = true): Promise<THREE.Group> {
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
          
          // SIMPLIFIED: No cloning, just mark models used in portrait system
          model.userData = { ...model.userData, portraitSystemModel: true };
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
   * Deep clone model with complete material and geometry isolation
   * Prevents 3D portrait system from affecting main game objects
   * CRITICAL: Preserves animations properly
   */
  private deepCloneWithMaterialIsolation(model: THREE.Group): THREE.Group {
    // REMOVED: This method is no longer used since we're not cloning
    // Just return the original model for now
    console.log('🎭 Using original model without cloning for better animation compatibility');
    return model;
  }

  /**
   * Apply character-specific positioning and scaling for portrait view
   */
  private applyCharacterPortraitSettings(model: THREE.Group, characterClass: PlayerClass): void {
    // Character-specific settings for optimal portrait framing
    const characterSettings = {
      grapple: {
        scale: 0.8,
        position: { x: 0, y: -1.2, z: 0 },
        rotation: { y: 0 }
      },
      blast: {
        scale: 0.01,  // Blast character is 80x bigger than swing!
        position: { x: -0.1, y: -1.3, z: -0.3 }, // User-tested perfect positioning
        rotation: { y: 0.06 }
      },
      blink: {
        scale: 0.01,  // Blink character is also 80x bigger than swing!
        position: { x: 0, y: -1.2, z: 0 }, // User-tested perfect positioning
        rotation: { y: -0.04 }
      }
    };
    
    const settings = characterSettings[characterClass] || characterSettings.grapple;
    
    // Apply character-specific transform
    model.scale.setScalar(settings.scale);
    model.position.set(settings.position.x, settings.position.y, settings.position.z);
    model.rotation.y = settings.rotation.y;
    
    console.log(`🎭 Applied ${characterClass} portrait settings: scale=${settings.scale}, position=(${settings.position.x}, ${settings.position.y}, ${settings.position.z})`);
  }

  /**
   * Create temporary adjustment UI for testing character positioning
   */
  private createTemporaryAdjustmentUI(model: THREE.Group, characterClass: PlayerClass): void {
    // Remove any existing adjustment UI
    const existingUI = document.getElementById('character-adjustment-ui');
    if (existingUI) existingUI.remove();

    // Create adjustment panel
    const panel = document.createElement('div');
    panel.id = 'character-adjustment-ui';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
      border: 2px solid #444;
    `;

    panel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #4CAF50;">
        🎛️ ${characterClass.toUpperCase()} POSITION ADJUSTER
      </div>
      
                    <div style="margin-bottom: 8px;">
         <label>Scale: <span id="scale-value">${characterClass === 'blast' ? '0.01' : characterClass === 'blink' ? '0.01' : '0.80'}</span></label><br>
         <input type="range" id="scale-slider" min="0.01" max="1.0" step="0.01" value="${characterClass === 'blast' ? '0.01' : characterClass === 'blink' ? '0.01' : '0.80'}" style="width: 100%;">
       </div>
       
       <div style="margin-bottom: 8px;">
         <label>Position Y: <span id="pos-y-value">${characterClass === 'blast' ? '-1.3' : characterClass === 'blink' ? '-1.2' : '-1.2'}</span></label><br>
         <input type="range" id="pos-y-slider" min="-3.0" max="1.0" step="0.1" value="${characterClass === 'blast' ? '-1.3' : characterClass === 'blink' ? '-1.2' : '-1.2'}" style="width: 100%;">
       </div>
      
             <div style="margin-bottom: 8px;">
         <label>Position X: <span id="pos-x-value">${characterClass === 'blast' ? '-0.1' : '0.0'}</span></label><br>
         <input type="range" id="pos-x-slider" min="-2.0" max="2.0" step="0.1" value="${characterClass === 'blast' ? '-0.1' : '0.0'}" style="width: 100%;">
       </div>
       
       <div style="margin-bottom: 8px;">
         <label>Position Z: <span id="pos-z-value">${characterClass === 'blast' ? '-0.3' : '0.0'}</span></label><br>
         <input type="range" id="pos-z-slider" min="-2.0" max="2.0" step="0.1" value="${characterClass === 'blast' ? '-0.3' : '0.0'}" style="width: 100%;">
       </div>
       
       <div style="margin-bottom: 8px;">
         <label>Rotation Y: <span id="rot-y-value">${characterClass === 'blast' ? '0.06' : characterClass === 'blink' ? '-0.04' : '0.0'}</span></label><br>
         <input type="range" id="rot-y-slider" min="-3.14" max="3.14" step="0.1" value="${characterClass === 'blast' ? '0.06' : characterClass === 'blink' ? '-0.04' : '0.0'}" style="width: 100%;">
       </div>
      
      <div style="margin-top: 15px;">
        <button id="copy-settings" style="background: #4CAF50; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 5px;">
          📋 Copy Settings to Console
        </button>
        <button id="reset-character" style="background: #f44336; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 5px;">
          🔄 Reset to Default
        </button>
        <button id="close-adjuster" style="background: #666; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; width: 100%;">
          ✖️ Close Adjuster
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    // Wire up controls
    const scaleSlider = document.getElementById('scale-slider') as HTMLInputElement;
    const posYSlider = document.getElementById('pos-y-slider') as HTMLInputElement;
    const posXSlider = document.getElementById('pos-x-slider') as HTMLInputElement;
    const posZSlider = document.getElementById('pos-z-slider') as HTMLInputElement;
    const rotYSlider = document.getElementById('rot-y-slider') as HTMLInputElement;

    const scaleValue = document.getElementById('scale-value')!;
    const posYValue = document.getElementById('pos-y-value')!;
    const posXValue = document.getElementById('pos-x-value')!;
    const posZValue = document.getElementById('pos-z-value')!;
    const rotYValue = document.getElementById('rot-y-value')!;

    const updateCharacter = () => {
      const scale = parseFloat(scaleSlider.value);
      const posY = parseFloat(posYSlider.value);
      const posX = parseFloat(posXSlider.value);
      const posZ = parseFloat(posZSlider.value);
      const rotY = parseFloat(rotYSlider.value);

      model.scale.setScalar(scale);
      model.position.set(posX, posY, posZ);
      model.rotation.y = rotY;

      scaleValue.textContent = scale.toFixed(2);
      posYValue.textContent = posY.toFixed(1);
      posXValue.textContent = posX.toFixed(1);
      posZValue.textContent = posZ.toFixed(1);
      rotYValue.textContent = rotY.toFixed(1);
    };

    // Add event listeners
    scaleSlider.addEventListener('input', updateCharacter);
    posYSlider.addEventListener('input', updateCharacter);
    posXSlider.addEventListener('input', updateCharacter);
    posZSlider.addEventListener('input', updateCharacter);
    rotYSlider.addEventListener('input', updateCharacter);

    // Copy settings button
    document.getElementById('copy-settings')!.addEventListener('click', () => {
      const settings = `
${characterClass}: {
  scale: ${parseFloat(scaleSlider.value)},
  position: { x: ${parseFloat(posXSlider.value)}, y: ${parseFloat(posYSlider.value)}, z: ${parseFloat(posZSlider.value)} },
  rotation: { y: ${parseFloat(rotYSlider.value)} }
}`;
      console.log('📋 Copy this to your code:');
      console.log(settings);
      navigator.clipboard.writeText(settings);
    });

         // Reset button
     document.getElementById('reset-character')!.addEventListener('click', () => {
       let defaultSettings;
       if (characterClass === 'blast') {
         defaultSettings = { scale: 0.01, posX: -0.1, posY: -1.3, posZ: -0.3, rotY: 0.06 };  // Tested blast settings
       } else if (characterClass === 'blink') {
         defaultSettings = { scale: 0.01, posX: 0, posY: -1.2, posZ: 0, rotY: -0.04 };  // Tested blink settings
       } else {
         defaultSettings = { scale: 0.8, posX: 0, posY: -1.2, posZ: 0, rotY: 0 };  // Swing/grapple
       }

      scaleSlider.value = defaultSettings.scale.toString();
      posXSlider.value = defaultSettings.posX.toString();
      posYSlider.value = defaultSettings.posY.toString();
      posZSlider.value = defaultSettings.posZ.toString();
      rotYSlider.value = defaultSettings.rotY.toString();
      updateCharacter();
    });

    // Close button
    document.getElementById('close-adjuster')!.addEventListener('click', () => {
      panel.remove();
    });

    console.log('🎛️ Temporary character adjuster created! Use the sliders in the top-right to position the character perfectly.');
  }

  /**
   * Setup character model properties for full-body portrait view
   */
  private setupCharacterModel(model: THREE.Group): void {
    // SAFETY: Mark as portrait model to help track potential issues
    model.userData = { ...model.userData, portraitSystemModel: true, isMainCharacter: true };
    
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
    
    console.log(`🎭 Character setup for full-body portrait (character-specific positioning applied)`);
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
    
    // Special handling for swing animation - use ping-pong loop and optimal positioning
    if (animName === 'swing') {
      newAction.loop = THREE.LoopPingPong;
      
      // Store original transforms before applying swing-specific settings
      if (!swingAnimationState.originalPosition) {
        swingAnimationState.originalPosition = this.character.model.position.clone();
        swingAnimationState.originalRotation = this.character.model.rotation.y;
        swingAnimationState.originalScale = this.character.model.scale.x;
      }
      
      // Apply optimal swing animation positioning (user-tested values for perfect framing)
                      if (this.currentClass === 'grapple') {
          this.character.model.scale.setScalar(0.8);      // scale: 0.8
          this.character.model.position.set(0, -1.2, -1); // position: { x: 0, y: -1.2, z: -1 }
          this.character.model.rotation.y = 0.02;         // rotation: { y: 0.02 }

        }
      
      
    } else {
      newAction.loop = THREE.LoopRepeat;
      
      // Restore original transforms when switching away from swing animation
      if (swingAnimationState.originalPosition && this.character) {
        this.character.model.position.copy(swingAnimationState.originalPosition);
        this.character.model.rotation.y = swingAnimationState.originalRotation!;
        this.character.model.scale.setScalar(swingAnimationState.originalScale!);
        
        // Clear stored values
        swingAnimationState.originalPosition = null;
        swingAnimationState.originalRotation = null;
        swingAnimationState.originalScale = null;
        

      }
    }
    
    newAction.reset().fadeIn(0.2).play();
  }



  /**
   * Update character animations and render portrait
   */
  public update(deltaTime: number, _playerPosition: THREE.Vector3, playerVelocity?: THREE.Vector3, _camera?: THREE.Camera, grounded?: boolean, horizontalSpeed?: number): void {
    // FIX #1: Prevent updates after disposal
    if (this.isDisposed) return;
    
    // Skip updates if disposed
    if (this.isDisposed) return;
    
    // Validate animation system is enabled and ready
    if (!AutoCharacterLoader.isCharacterAnimationsEnabled() || !this.character) return;

    try {
      // Update animations based on movement using proper data
      if (playerVelocity && grounded !== undefined && horizontalSpeed !== undefined) {
        this.updateAnimationBasedOnMovement(playerVelocity, grounded, horizontalSpeed);
      }

      // Update animation mixer with safety check
      if (this.character && this.character.mixer) {
        this.character.mixer.update(deltaTime);
      }
      
      // Render character portrait
      this.renderPortrait();
    } catch (error) {
      console.error('❌ Error during AutoCharacterLoader update:', error);
      // Don't crash the entire game loop on portrait errors
    }
  }

  /**
   * Render the character portrait
   */
  private renderPortrait(): void {
    // FIX #1: Prevent rendering after disposal
    if (this.isDisposed) return;
    
    // FIX #5: Throttle rendering to prevent excessive GPU usage
    const now = performance.now();
    if (now - this.lastRenderTime < this.RENDER_THROTTLE_MS) return;
    this.lastRenderTime = now;
    
    // FIX #7: Validate all required components exist
    if (!this.character || !this.portraitRenderer || !this.portraitScene || !this.portraitCamera) {
      return;
    }
    
    // FIX #8: Check WebGL context is valid
    const gl = this.portraitRenderer.getContext();
    if (gl.isContextLost()) {
      console.warn('⚠️ WebGL context lost during render - skipping frame');
      return;
    }
    
    try {
      // FIX #9: Safe rendering with error recovery
      this.portraitRenderer.render(this.portraitScene, this.portraitCamera);
    } catch (error) {
      console.error('❌ Portrait rendering error:', error);
      // Fallback to static mode on repeated render errors
      this.fallbackToStaticMode();
    }
  }
  
  // FIX #9: Fallback mechanism for render failures
  private fallbackToStaticMode(): void {
    console.warn('⚠️ Falling back to static portrait mode due to render errors');
    localStorage.setItem('wreckless-portrait-style', 'tf2');
    this.hidePortrait();
    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('portraitStyleChanged', {
      detail: { style: 'tf2' }
    }));
  }

  /**
   * Update animation based on player movement
   */
  private updateAnimationBasedOnMovement(velocity: THREE.Vector3, grounded: boolean, horizontalSpeed: number): void {
    if (!this.character) return;
    
    // User's specific animation logic:
    let targetAnim = 'idle';
    
    // HIGHEST PRIORITY: if character is blasting (blast), use blast animation
    if (this.isBlasting() && this.currentClass === 'blast') {
      targetAnim = 'blast';
    }
    // NEXT PRIORITY: if character is blinking (blink), use blink animation
    else if (this.isBlinking() && this.currentClass === 'blink') {
      targetAnim = 'blink';
    }
    // NEXT PRIORITY: if character is swinging (grapple), use swing animation with ping-pong loop
    else if (this.isSwingAnimating() && this.currentClass === 'grapple') {
      targetAnim = 'swing';
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
      // Remove from portrait scene (if it exists) instead of main scene
      if (this.portraitScene) {
        this.portraitScene.remove(this.character.model);
      }
      this.character.mixer.stopAllAction();
      this.character = null;
    }
  }

  /**
   * Dispose of all resources including portrait UI
   */
  public dispose(): void {
    // FIX #1: Mark as disposed to prevent further operations
    this.isDisposed = true;
    
    // Note any pending operations during disposal
    if (this.characterLoadingLock || this.preloadingLock) {
      console.warn('⚠️ Disposing while async operations are in progress');
    }
    
    // FIX #2: Cancel all active animation frames
    this.activeAnimationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    this.activeAnimationFrames.clear();
    
    // FIX #3: Remove all tracked event listeners
    this.eventListeners.forEach(({ target, type, handler }) => {
      try {
        target.removeEventListener(type, handler);
      } catch (error) {
        console.warn('⚠️ Error removing event listener:', error);
      }
    });
    this.eventListeners = [];
    
    // Cleanup character resources
    this.cleanup();
    
    // FIX #12: Comprehensive WebGL renderer disposal
    if (this.portraitRenderer) {
      try {
        // Remove WebGL context loss handler
        if (this.webglContextLostHandler) {
          this.portraitRenderer.domElement.removeEventListener('webglcontextlost', this.webglContextLostHandler);
          this.webglContextLostHandler = undefined;
        }
        
        // Force render one last frame to clear any pending operations
        this.portraitRenderer.clear();
        
        // Dispose of renderer resources
        this.portraitRenderer.dispose();
        this.portraitRenderer = undefined!;
      } catch (error) {
        console.warn('⚠️ Error disposing WebGL renderer:', error);
      }
    }
    
    // FIX #13: Comprehensive scene cleanup
    if (this.portraitScene) {
      this.portraitScene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      this.portraitScene.clear();
      this.portraitScene = undefined!;
    }
    
    // FIX #14: Safe camera disposal
    this.portraitCamera = undefined!;
    
    // Clean up static image
    this.staticImageElement = null;
    
    // Remove settings event listener (legacy cleanup)
    if (this.boundSettingsHandler) {
      window.removeEventListener('characterAnimationsSettingChanged', this.boundSettingsHandler);
      this.boundSettingsHandler = undefined;
    }
    
    // FIX #15: Safe DOM element removal with validation
    if (this.portraitContainer && this.portraitContainer.parentNode) {
      // Clean up event listeners
      if (this.hoverEnterHandler) {
        try {
          this.portraitContainer.removeEventListener('mouseenter', this.hoverEnterHandler);
        } catch (error) {
          console.warn('⚠️ Error removing hover enter listener:', error);
        }
      }
      if (this.hoverLeaveHandler) {
        try {
          this.portraitContainer.removeEventListener('mouseleave', this.hoverLeaveHandler);
        } catch (error) {
          console.warn('⚠️ Error removing hover leave listener:', error);
        }
      }
      
      try {
        this.portraitContainer.parentNode.removeChild(this.portraitContainer);
      } catch (error) {
        console.warn('⚠️ Error removing portrait container from DOM:', error);
      }
      
      this.portraitContainer = null;
      this.hoverEnterHandler = undefined;
      this.hoverLeaveHandler = undefined;
    }
    
    // Reset all state
    this.currentClass = null;
    this.isLoading = false;
    this.loadingProgress = { loaded: 0, total: 0, isComplete: false };
    this.loadingUI = null;
    
    console.log('🧹 AutoCharacterLoader disposed with comprehensive cleanup');
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

  // ASYNC OPERATION LOCK MANAGEMENT: Prevent race conditions
  private async waitForCharacterLoadLock(): Promise<void> {
    return new Promise((resolve) => {
      const checkLock = () => {
        if (!this.characterLoadingLock || this.isDisposed) {
          resolve();
        } else {
          // Check again in 50ms
          setTimeout(checkLock, 50);
        }
      };
      checkLock();
    });
  }
  
  private async waitForPreloadLock(): Promise<void> {
    return new Promise((resolve) => {
      const checkLock = () => {
        if (!this.preloadingLock || this.isDisposed) {
          resolve();
        } else {
          // Check again in 50ms
          setTimeout(checkLock, 50);
        }
      };
      checkLock();
    });
  }
  
  private async acquireCharacterLoadLock(className: PlayerClass): Promise<boolean> {
    if (this.isDisposed) return false;
    
    // If the same class is already loading, just wait for it
    if (this.currentLoadingClass === className && this.characterLoadingLock) {
      await this.waitForCharacterLoadLock();
      return false; // Already loaded by another operation
    }
    
    // If a different class is loading, wait for it to finish first
    if (this.characterLoadingLock) {
      await this.waitForCharacterLoadLock();
    }
    
    if (this.isDisposed) return false;
    
    this.characterLoadingLock = true;
    this.currentLoadingClass = className;
    return true; // Got the lock
  }
  
  private releaseCharacterLoadLock(): void {
    this.characterLoadingLock = false;
    this.currentLoadingClass = null;
  }
  
  private async acquirePreloadLock(): Promise<boolean> {
    if (this.isDisposed) return false;
    
    if (this.preloadingLock) {
      await this.waitForPreloadLock();
      return false; // Already preloaded
    }
    
    this.preloadingLock = true;
    return true;
  }
  
  private releasePreloadLock(): void {
    this.preloadingLock = false;
  }
} 