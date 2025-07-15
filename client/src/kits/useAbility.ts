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
import { legacyBlast, updateLegacyBlast, type BlastAbilityContext as LegacyBlastContext } from './blastLegacy';
import { executeGrapple, updateGrapple, onKeyDown as grappleKeyDown, onKeyUp as grappleKeyUp, isSwinging, type GrappleAbilityContext } from './grapple';
import { executeBlink, updateBlink, type BlinkAbilityContext } from './blink';

export interface AbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  scene: THREE.Scene;
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
  private cooldownState: AbilityCooldownState;
  private keyDownHandler: (event: KeyboardEvent) => void;
  private updateInterval: number | null = null;
  private animationFrame: number | null = null;
  private pressedKeys: Set<string> = new Set(); // Track currently pressed keys
  private useLegacyBlast: boolean = false; // Dev toggle for blast type

  constructor() {
    this.cooldownState = {
      isReady: true,
      remainingTime: 0,
      progress: 1,
      className: 'blast'
    };

    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.setupEventListeners();
  }

  /**
   * Initialize the ability manager with game context
   */
  initialize(context: AbilityContext): void {
    this.context = context;
    this.startUpdateLoop();
  }

  /**
   * Clean up event listeners and intervals
   */
  destroy(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('playerClassChanged', this.handleClassChange as EventListener);
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
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
        return () => console.warn(`Unknown ability class: ${className}`);
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
        console.log(`🪝 Allowing grapple release`);
        // Don't set any cooldown here - will be set on release
      } else {
        // Firing new grapple - check if ready but don't set cooldown yet
        if (!kit.ability.isReady) {
          console.log(`⏳ Grapple on cooldown`);
          return false;
        }
        // Don't call useAbilityFromKit - we'll set cooldown only on successful swing release
        console.log(`🪝 Firing grapple (no cooldown until hit)`);
      }
    } else {
      // For other abilities: normal cooldown behavior
      if (!useAbilityFromKit(kit)) {
        console.log(`⏳ Ability on cooldown (${kit.className})`);
        return false;
      }
    }

    // Get and execute the ability handler
    const handler = this.getAbilityHandler(kit.className);
    
    try {
      handler(this.context);
      
      // Dispatch success event
      window.dispatchEvent(new CustomEvent('abilityActivated', {
        detail: {
          className: kit.className,
          timestamp: Date.now()
        }
      }));
      
      console.log(`✨ ${kit.className.toUpperCase()} ability activated`);
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
      const blastType = this.useLegacyBlast ? 'LEGACY BLAST' : 'ROCKET JUMP';
      console.log(`🔄 Switched to ${blastType} (press L to toggle)`);
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
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('playerClassChanged', this.handleClassChange as EventListener);
  }

  /**
   * Start the update loop for cooldowns and ability states
   */
  private startUpdateLoop(): void {
    // Update cooldown state regularly
    this.updateInterval = setInterval(() => {
      this.updateCooldownState();
    }, 50); // 20fps updates

    // Update ability-specific states in animation frame
    const updateAbilityStates = () => {
      if (this.context) {
        // Update blast state (both rocket jump and legacy)
        updateBlast();
        if (import.meta.env.DEV) {
          updateLegacyBlast();
        }
        
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
      
      this.animationFrame = requestAnimationFrame(updateAbilityStates);
    };
    
    updateAbilityStates();
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