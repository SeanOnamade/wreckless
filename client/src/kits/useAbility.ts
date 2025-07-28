import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { 
  type PlayerClass, 
  getCurrentPlayerKit, 
  updateCurrentPlayerKit, 
  useAbility as useAbilityFromKit,
  getRemainingCooldown,
  getCooldownProgress
} from './classKit';
import { executeBlast, updateBlast, type BlastAbilityContext } from './blast';
import { legacyBlast, type BlastAbilityContext as LegacyBlastContext } from './blastLegacy';
import { executeGrapple, updateGrapple, onKeyDown as grappleKeyDown, onKeyUp as grappleKeyUp, isSwinging, type GrappleAbilityContext } from './grapple';
import { executeBlink, updateBlink, type BlinkAbilityContext } from './blink';

export interface AbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

/**
 * Type guard to validate AbilityContext
 */
export function isValidAbilityContext(context: any): context is AbilityContext {
  return context &&
    typeof context === 'object' &&
    context.playerBody &&
    context.world &&
    context.camera &&
    context.scene;
}

export interface AbilityCooldownState {
  isReady: boolean;
  remainingTime: number;
  progress: number; // 0-1, where 1 = ready
  className: PlayerClass;
}

/**
 * Ability Manager class for handling player abilities
 * Listens for 'E' key press and triggers class-specific abilities
 */
export class AbilityManager {
  private context: AbilityContext | null = null;
  private cooldownState: AbilityCooldownState = {
    isReady: true,
    remainingTime: 0,
    progress: 1,
    className: 'grapple'
  };
  
  // Event handlers and state management
  private keyDownHandler: (event: KeyboardEvent) => void;
  private keyUpHandler: (event: KeyboardEvent) => void;
  private classChangeHandler: (event: CustomEvent) => void;
  private pressedKeys: Set<string> = new Set();
  private useLegacyBlast: boolean = false;
  
  // Animation loop management
  private updateInterval: number | null = null;
  // REMOVED: animationFrame (no longer using separate animation loop)
  private isDisposed = false; // CRITICAL FIX: Prevent use after disposal
  
  constructor() {
    // Bind event handlers
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    this.classChangeHandler = this.handleClassChange.bind(this);
    this.setupEventListeners();
    // Debug.system('🎯 AbilityManager initialized'); // Commented - too verbose
  }
  
  // CRITICAL FIX: Add proper cleanup method
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    
    console.log('🧹 Disposing AbilityManager...');
    
    // REMOVED: Animation frame cleanup (no longer using separate loop)
    // Ability updates now handled by main loop instead of separate animation frame
    
    // Clear interval timer
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('playerClassChanged', this.classChangeHandler as EventListener);
    
    // Clear pressed keys
    this.pressedKeys.clear();
    
    // Clear context
    this.context = null;
    
    console.log('✅ AbilityManager disposed');
  }

  /**
   * Initialize the ability manager with game context
   */
  initialize(context: AbilityContext): void {
    this.context = context;
    this.startUpdateLoop();
  }

  /**
   * Clean up event listeners and intervals - with error handling
   */
  destroy(): void {
    try {
      window.removeEventListener('keydown', this.keyDownHandler);
      window.removeEventListener('keyup', this.keyUpHandler); // Use stored reference
      window.removeEventListener('playerClassChanged', this.classChangeHandler as EventListener); // Use stored reference
      
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      // REMOVED: animationFrame cleanup (no longer using separate animation loop)
      
      console.log('✅ AbilityManager destroyed successfully');
    } catch (error) {
      console.error('⚠️ Error during AbilityManager cleanup:', error);
    }
  }

  /**
   * Get ability handler based on current class
   */
  private getAbilityHandler(className: PlayerClass): (ctx: AbilityContext) => void {
    switch (className) {
      case 'blast':
        if (this.useLegacyBlast && import.meta.env.DEV) {
          return (ctx: AbilityContext) => legacyBlast({
            playerBody: ctx.playerBody,
            world: ctx.world,
            camera: ctx.camera
          } as LegacyBlastContext);
        } else {
          return (ctx: AbilityContext) => executeBlast({
            playerBody: ctx.playerBody,
            world: ctx.world,
            camera: ctx.camera,
            scene: ctx.scene
          } as BlastAbilityContext);
        }
      
      case 'grapple':
        return (ctx: AbilityContext) => executeGrapple({
          playerBody: ctx.playerBody,
          world: ctx.world,
          camera: ctx.camera,
          scene: ctx.scene
        } as GrappleAbilityContext);
      
      case 'blink':
        return (ctx: AbilityContext) => executeBlink({
          playerBody: ctx.playerBody,
          world: ctx.world,
          camera: ctx.camera,
          isSpacePressed: this.pressedKeys.has('Space')
        } as BlinkAbilityContext);
      
      default:
        return () => {};
    }
  }

  /**
   * Handle ability activation
   */
  activateAbility(): boolean {
    if (!this.context) {
      console.warn('Cannot use ability: no context provided');
      return false;
    }

    const kit = getCurrentPlayerKit();
    
    // SPECIAL HANDLING FOR GRAPPLE: No cooldown until swing is released
    if (kit.className === 'grapple') {
      // Check if already swinging (for release)
      if (isSwinging()) {
        // Don't set any cooldown here - will be set on release
      } else {
        // Firing new grapple - check if ready but don't set cooldown yet
        if (!kit.ability.isReady) {
          // SFX: Play ability blocked sound for grapple too
          window.dispatchEvent(new CustomEvent('sfxRequest', {
            detail: { category: 'abilities', filename: 'ability_blocked.wav' }
          }));
          return false;
        }
        // Don't call useAbilityFromKit - we'll set cooldown only on successful swing release
      }
    } else {
      // For other abilities: normal cooldown behavior
    if (!useAbilityFromKit(kit)) {
        // SFX: Play ability blocked sound when on cooldown
        window.dispatchEvent(new CustomEvent('sfxRequest', {
          detail: { category: 'abilities', filename: 'ability_blocked.wav' }
        }));
      return false;
      }
    }

    // Get and execute the ability handler
    const handler = this.getAbilityHandler(kit.className);
    
    try {
      handler(this.context);
      
      // Dispatch success events for compatibility
      window.dispatchEvent(new CustomEvent('abilityActivated', {
        detail: {
          className: kit.className,
          timestamp: Date.now()
        }
      }));
      
      // Also dispatch abilityUsed for systems expecting this event
      window.dispatchEvent(new CustomEvent('abilityUsed', {
        detail: {
          ability: kit.className,
          className: kit.className,
          timestamp: Date.now()
        }
      }));
      
      // Debug: Ability activated (silent for performance)
      return true;
      
    } catch (error) {
      console.error(`Failed to execute ${kit.className} ability:`, error);
      return false;
    }
  }

  /**
   * Handle keyboard input
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Track pressed keys
    this.pressedKeys.add(event.code);
    
    // Forward air control keys to grapple system
    if (['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(event.code)) {
      grappleKeyDown(event);
    }
    
    // Only listen for 'E' key
    if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault();
      this.activateAbility();
    }
    
    // Dev mode: Toggle blast type with 'L' key
    if (event.code === 'KeyL' && !event.repeat && import.meta.env.DEV) {
      this.useLegacyBlast = !this.useLegacyBlast;
    }
  }

  /**
   * Handle keyboard release
   */
  private handleKeyUp(event: KeyboardEvent): void {
    // Remove released keys
    this.pressedKeys.delete(event.code);
    
    // Forward air control keys to grapple system
    if (['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(event.code)) {
      grappleKeyUp(event);
    }
  }

  /**
   * Handle class change events
   */
  private handleClassChange(event: CustomEvent): void {
    console.log(`🔄 Player class changed to: ${event.detail.className}`);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    window.addEventListener('playerClassChanged', this.classChangeHandler as EventListener);
  }

  /**
   * Start the update loop for cooldowns ONLY (ability states moved to main loop)
   */
  private startUpdateLoop(): void {
    // Update cooldown state regularly
    this.updateInterval = setInterval(() => {
      if (this.isDisposed) return; // CRITICAL FIX: Stop if disposed
      this.updateCooldownState();
    }, 50); // 20fps updates

    // REMOVED: Separate ability states animation loop - now handled by main loop
    // This was causing recursive Rapier errors when running parallel to physics step
  }

  /**
   * Update ability states - called from main animation loop AFTER physics step
   */
  public updateAbilities(_deltaTime: number): void {
    if (this.isDisposed || !this.context) return;
    
    // Update blast state - PERFORMANCE FIX: Only run active system, not both
    updateBlast();
    
    // Update grapple physics and visuals
    updateGrapple({
      playerBody: this.context.playerBody,
      world: this.context.world,
      camera: this.context.camera,
      scene: this.context.scene
    } as GrappleAbilityContext);
    
    // Update blink state
    updateBlink();
  }

  /**
   * Update cooldown state
   */
  private updateCooldownState(): void {
    updateCurrentPlayerKit();
    
    const kit = getCurrentPlayerKit();
    const remaining = getRemainingCooldown(kit);
    const progress = getCooldownProgress(kit);
    
    this.cooldownState = {
      isReady: kit.ability.isReady,
      remainingTime: remaining,
      progress: progress,
      className: kit.className
    };
  }

  /**
   * Get current cooldown state
   */
  getCooldownState(): AbilityCooldownState {
    return { ...this.cooldownState };
  }

  /**
   * Check if ability is ready
   */
  isReady(): boolean {
    return this.cooldownState.isReady;
  }
}

/**
 * Standalone function to get ability handler for external use
 */
export function getAbilityHandler(className: PlayerClass): (context: AbilityContext) => void {
  switch (className) {
    case 'blast':
      return (ctx: AbilityContext) => executeBlast({
        playerBody: ctx.playerBody,
        world: ctx.world,
        camera: ctx.camera,
        scene: ctx.scene
      } as BlastAbilityContext);
    
    case 'grapple':
      return (ctx: AbilityContext) => executeGrapple({
        playerBody: ctx.playerBody,
        world: ctx.world,
        camera: ctx.camera,
        scene: ctx.scene
      } as GrappleAbilityContext);
    
    case 'blink':
      return (ctx: AbilityContext) => executeBlink({
        playerBody: ctx.playerBody,
        world: ctx.world,
        camera: ctx.camera,
        isSpacePressed: false // Standalone function can't detect key state
      } as BlinkAbilityContext);
    
    default:
      return () => console.warn(`Unknown ability class: ${className}`);
  }
} 