import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Hit shake effect
 * Triggers micro-shake when hitting dummies during pass-through combat
 * Provides immediate tactile feedback for successful hits
 */
export class HitShakeEffect implements CameraEffect {
  readonly name = 'HitShake';
  enabled = true;

  // Effect parameters
  private baseShakeIntensity = 0.05; // Base shake magnitude (rad)
  private shakeDuration = 100; // 0.1 seconds duration
  private maxShakeIntensity = 0.15; // Maximum shake for high damage hits
  
  // Current effect state
  private isShaking = false;
  private shakeEndTime = 0;
  private shakeTime = 0;
  private currentIntensity = 0;

  // Event listener reference for cleanup
  private eventListener: ((event: Event) => void) | null = null;

  constructor(config?: {
    baseShakeIntensity?: number;
    shakeDuration?: number;
    maxShakeIntensity?: number;
  }) {
    if (config) {
      this.baseShakeIntensity = config.baseShakeIntensity ?? this.baseShakeIntensity;
      this.shakeDuration = config.shakeDuration ?? this.shakeDuration;
      this.maxShakeIntensity = config.maxShakeIntensity ?? this.maxShakeIntensity;
    }
  }

  initialize(): void {
    // Listen for pass-through hit events
    this.eventListener = (event: Event) => {
      if (!this.enabled) return;
      
      const customEvent = event as CustomEvent;
      this.triggerHitShake(customEvent.detail);
    };
    
    window.addEventListener('passthroughHit', this.eventListener);
    console.log('📹 HitShakeEffect: Listening for passthroughHit events');
  }

  /**
   * Trigger the hit shake effect
   */
  private triggerHitShake(hitData: any): void {
    const { damage, targetId, speed } = hitData;
    const now = Date.now();
    
    // Calculate shake intensity based on damage (higher damage = stronger shake)
    const damageRatio = Math.min(damage / 100, 1.0); // Normalize to 100 damage max
    const speedRatio = Math.min(speed / 50, 1.0); // Factor in speed for more dynamic feedback
    
    // Combine damage and speed for final intensity
    const intensityMultiplier = Math.max(damageRatio, speedRatio * 0.5);
    this.currentIntensity = this.baseShakeIntensity + 
      (this.maxShakeIntensity - this.baseShakeIntensity) * intensityMultiplier;
    
    // Start shake effect
    this.isShaking = true;
    this.shakeEndTime = now + this.shakeDuration;
    this.shakeTime = 0;
    
    console.log(`📹 HitShake: Triggered for ${targetId} (${damage} dmg, intensity=${this.currentIntensity.toFixed(3)})`);
  }

  update(camera: THREE.Camera, deltaTime: number): void {
    if (!this.isShaking) return;
    
    const now = Date.now();
    
    if (now >= this.shakeEndTime) {
      this.isShaking = false;
      return;
    }
    
    this.shakeTime += deltaTime;
    const progress = this.shakeTime / (this.shakeDuration / 1000);
    
    // Fade out shake intensity over time (ease-out)
    const fadeMultiplier = 1 - Math.pow(progress, 2);
    const currentShakeIntensity = this.currentIntensity * fadeMultiplier;
    
    // Generate random shake in all directions
    const shakeX = (Math.random() - 0.5) * currentShakeIntensity;
    const shakeY = (Math.random() - 0.5) * currentShakeIntensity;
    const shakeZ = (Math.random() - 0.5) * currentShakeIntensity * 0.5; // Less Z rotation
    
    // Apply shake to camera rotation
    camera.rotation.x += shakeX;
    camera.rotation.y += shakeY;
    camera.rotation.z += shakeZ;
  }

  cleanup(): void {
    // Remove event listener
    if (this.eventListener) {
      window.removeEventListener('passthroughHit', this.eventListener);
      this.eventListener = null;
    }
    
    // Reset effect state
    this.isShaking = false;
    
    console.log('📹 HitShakeEffect: Cleaned up');
  }

  /**
   * Manually trigger effect (for testing)
   */
  triggerTestHit(damage: number = 50): void {
    this.triggerHitShake({
      targetId: 'test_dummy',
      damage: damage,
      speed: 25,
      hitType: 'test',
      sweepDistance: 1.0,
      timestamp: Date.now()
    });
  }

  /**
   * Get current shake status
   */
  getShakeStatus(): { shaking: boolean; intensity: number; timeRemaining: number } {
    const timeRemaining = this.isShaking ? Math.max(0, this.shakeEndTime - Date.now()) : 0;
    
    return {
      shaking: this.isShaking,
      intensity: this.currentIntensity,
      timeRemaining: timeRemaining
    };
  }
} 