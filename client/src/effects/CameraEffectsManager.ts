import * as THREE from 'three';

/**
 * Base interface for all camera effects
 */
export interface CameraEffect {
  readonly name: string;
  enabled: boolean;
  
  /**
   * Initialize the effect (called once when registered)
   */
  initialize?(): void;
  
  /**
   * Update the effect each frame
   */
  update(camera: THREE.Camera, deltaTime: number): void;
  
  /**
   * Cleanup when effect is removed
   */
  cleanup?(): void;
}

/**
 * Central manager for all camera effects
 * Extends the existing visual feedback system rather than replacing it
 */
export class CameraEffectsManager {
  private static instance: CameraEffectsManager | null = null;
  private camera: THREE.Camera | null = null;
  private effects: Map<string, CameraEffect> = new Map();
  private enabled = true;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): CameraEffectsManager {
    if (!CameraEffectsManager.instance) {
      CameraEffectsManager.instance = new CameraEffectsManager();
    }
    return CameraEffectsManager.instance;
  }

  /**
   * Set the camera reference (called from main.ts after camera creation)
   */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
    console.log('📹 CameraEffectsManager: Camera reference set');
  }

  /**
   * Register a new camera effect
   */
  register(effect: CameraEffect): void {
    if (this.effects.has(effect.name)) {
      console.warn(`CameraEffect '${effect.name}' already registered, replacing...`);
    }
    
    this.effects.set(effect.name, effect);
    
    // Initialize the effect if it has an initialize method
    if (effect.initialize) {
      effect.initialize();
    }
    
    console.log(`📹 CameraEffect registered: ${effect.name}`);
  }

  /**
   * Unregister a camera effect
   */
  unregister(effectName: string): void {
    const effect = this.effects.get(effectName);
    if (effect) {
      // Cleanup the effect if it has a cleanup method
      if (effect.cleanup) {
        effect.cleanup();
      }
      this.effects.delete(effectName);
      console.log(`📹 CameraEffect unregistered: ${effectName}`);
    }
  }

  /**
   * Enable/disable a specific effect
   */
  setEffectEnabled(effectName: string, enabled: boolean): void {
    const effect = this.effects.get(effectName);
    if (effect) {
      effect.enabled = enabled;
      console.log(`📹 CameraEffect '${effectName}': ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Enable/disable the entire system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`📹 CameraEffectsManager: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update all registered effects
   * Called from the main render loop alongside existing updateVisualFeedback
   */
  update(deltaTime: number): void {
    if (!this.enabled || !this.camera) {
      return;
    }

    // Update all enabled effects
    for (const effect of this.effects.values()) {
      if (effect.enabled) {
        try {
          effect.update(this.camera, deltaTime);
        } catch (error) {
          console.error(`Error updating camera effect '${effect.name}':`, error);
        }
      }
    }
  }

  /**
   * Get info about registered effects (for debugging)
   */
  getEffectsInfo(): { name: string; enabled: boolean }[] {
    return Array.from(this.effects.values()).map(effect => ({
      name: effect.name,
      enabled: effect.enabled
    }));
  }

  /**
   * Emergency disable all effects (for competition mode)
   */
  disableAllEffects(): void {
    for (const effect of this.effects.values()) {
      effect.enabled = false;
    }
    console.log('📹 All camera effects disabled (competition mode)');
  }

  /**
   * Re-enable all effects
   */
  enableAllEffects(): void {
    for (const effect of this.effects.values()) {
      effect.enabled = true;
    }
    console.log('📹 All camera effects enabled');
  }
}

// Export singleton instance for easy access
export const CameraEffects = CameraEffectsManager.getInstance(); 