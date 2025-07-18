import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Speed-based FOV effect
 * Increases FOV from 90° to 105° as speed increases above walking speed
 * Provides immediate momentum feedback and enhanced sense of speed
 */
export class SpeedFovEffect implements CameraEffect {
  readonly name = 'SpeedFov';
  enabled = true;

  private baseFov = 90; // Default camera FOV
  private maxFov = 105; // Maximum FOV at high speeds
  private walkSpeed = 18; // Base walking speed (no FOV change below this)
  private maxSpeedThreshold = 60; // Speed at which max FOV is reached
  private currentSpeed = 0;
  private targetFov = this.baseFov;
  private currentFov = this.baseFov;
  private lerpSpeed = 8.0; // How fast FOV changes (higher = snappier)

  constructor(config?: {
    baseFov?: number;
    maxFov?: number;
    walkSpeed?: number;
    maxSpeedThreshold?: number;
    lerpSpeed?: number;
  }) {
    if (config) {
      this.baseFov = config.baseFov ?? this.baseFov;
      this.maxFov = config.maxFov ?? this.maxFov;
      this.walkSpeed = config.walkSpeed ?? this.walkSpeed;
      this.maxSpeedThreshold = config.maxSpeedThreshold ?? this.maxSpeedThreshold;
      this.lerpSpeed = config.lerpSpeed ?? this.lerpSpeed;
    }
  }

  initialize(): void {
    // Listen for speed updates from the controller
    // We'll set up the speed access in the integration step
    console.log('📹 SpeedFovEffect: Initialized with FOV range', this.baseFov, '→', this.maxFov);
  }

  /**
   * Update speed from external source (called by integration code)
   */
  updateSpeed(speed: number): void {
    this.currentSpeed = speed;
  }

  update(camera: THREE.Camera, deltaTime: number): void {
    // Calculate target FOV based on current speed
    const speedAboveWalk = Math.max(0, this.currentSpeed - this.walkSpeed);
    const speedRange = this.maxSpeedThreshold - this.walkSpeed;
    const speedRatio = Math.min(speedAboveWalk / speedRange, 1.0);
    
    // Smooth curve for more natural feel (ease-out)
    const smoothRatio = 1 - Math.pow(1 - speedRatio, 2);
    
    this.targetFov = this.baseFov + (this.maxFov - this.baseFov) * smoothRatio;
    
    // Smooth lerp to target FOV
    const fovDelta = this.targetFov - this.currentFov;
    this.currentFov += fovDelta * this.lerpSpeed * deltaTime;
    
    // Apply to camera (ensure it's a PerspectiveCamera)
    if (camera instanceof THREE.PerspectiveCamera) {
      // Safety check: ensure FOV is within reasonable bounds
      const safeFov = Math.max(60, Math.min(120, this.currentFov));
      if (safeFov !== this.currentFov) {
        console.warn(`📹 SpeedFOV: Clamped FOV from ${this.currentFov.toFixed(1)}° to ${safeFov.toFixed(1)}°`);
        this.currentFov = safeFov;
      }
      
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }

    // Debug logging (throttled)
    if (import.meta.env.DEV && Math.random() < 0.01) { // 1% chance each frame
      // SpeedFOV updated silently
    }
  }

  cleanup(): void {
    // Reset internal state (camera FOV should be reset separately via resetFov if needed)
    this.currentFov = this.baseFov;
    this.targetFov = this.baseFov;
    this.currentSpeed = 0;
    console.log('📹 SpeedFovEffect: Cleaned up, internal state reset');
  }

  /**
   * Reset FOV to base value (useful for competition mode)
   */
  resetFov(camera: THREE.Camera): void {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = this.baseFov;
      camera.updateProjectionMatrix();
      this.currentFov = this.baseFov;
      this.targetFov = this.baseFov;
    }
  }

  /**
   * Get current FOV info for debugging
   */
  getFovInfo(): { current: number; target: number; speed: number } {
    return {
      current: this.currentFov,
      target: this.targetFov,
      speed: this.currentSpeed
    };
  }
} 