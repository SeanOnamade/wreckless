import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Boost shake effect
 * Triggers wind-like shake + FOV burst when hitting speed boost dummies
 * Creates sensation of wind soaring past during speed boosts
 */
export class BoostShakeEffect implements CameraEffect {
  readonly name = 'BoostShake';
  enabled = true;

  // Effect parameters
  private windShakeIntensity = 0.01; // Small rapid vibrations (±1°)
  private windShakeDuration = 300; // 0.3 seconds of wind shake
  private fovBurstAmount = 8; // +8° FOV burst
  private fovBurstDuration = 300; // 0.3 seconds FOV burst
  
  // Current effect state
  private isWindShaking = false;
  private windShakeEndTime = 0;
  private windShakeTime = 0;
  
  private isFovBursting = false;
  private fovBurstEndTime = 0;
  private fovBurstStartValue = 90;
  private fovBurstTime = 0;
  private fovCaptured = false;

  // Event listener reference for cleanup
  private eventListener: ((event: Event) => void) | null = null;

  constructor(config?: {
    windShakeIntensity?: number;
    windShakeDuration?: number;
    fovBurstAmount?: number;
    fovBurstDuration?: number;
  }) {
    if (config) {
      this.windShakeIntensity = config.windShakeIntensity ?? this.windShakeIntensity;
      this.windShakeDuration = config.windShakeDuration ?? this.windShakeDuration;
      this.fovBurstAmount = config.fovBurstAmount ?? this.fovBurstAmount;
      this.fovBurstDuration = config.fovBurstDuration ?? this.fovBurstDuration;
    }
  }

  initialize(): void {
    // Listen for speed boost events from racing dummies
    this.eventListener = (event: Event) => {
      if (!this.enabled) return;
      
      const customEvent = event as CustomEvent;
      this.triggerBoostEffect(customEvent.detail);
    };
    
    window.addEventListener('speedBoostGranted', this.eventListener);
    console.log('📹 BoostShakeEffect: Listening for speedBoostGranted events');
  }

  /**
   * Trigger the boost effect (wind shake + FOV burst)
   */
  private triggerBoostEffect(boostData: any): void {
    const now = Date.now();
    
    // Start wind shake effect
    this.isWindShaking = true;
    this.windShakeEndTime = now + this.windShakeDuration;
    this.windShakeTime = 0;
    
    // Start FOV burst effect
    this.isFovBursting = true;
    this.fovBurstEndTime = now + this.fovBurstDuration;
    this.fovBurstTime = 0;
    this.fovCaptured = false; // Reset FOV capture flag
    
    console.log(`📹 BoostShake: Wind effect triggered! Speed ${boostData.fromVelocity}→${boostData.toVelocity} m/s`);
  }

  update(camera: THREE.Camera, deltaTime: number): void {
    const now = Date.now();

    // Store the starting FOV when burst begins (before any modifications)
    if (this.isFovBursting && !this.fovCaptured && camera instanceof THREE.PerspectiveCamera) {
      this.fovBurstStartValue = camera.fov;
      this.fovCaptured = true;
    }

    // Update wind shake effect
    if (this.isWindShaking) {
      if (now >= this.windShakeEndTime) {
        this.isWindShaking = false;
      } else {
        this.windShakeTime += deltaTime;
        
        // Create rapid small vibrations to simulate wind
        const frequency = 15; // 15 Hz vibrations
        const shakeX = Math.sin(this.windShakeTime * frequency * Math.PI * 2) * this.windShakeIntensity;
        const shakeY = Math.cos(this.windShakeTime * frequency * Math.PI * 2 * 1.3) * this.windShakeIntensity * 0.7;
        const shakeZ = Math.sin(this.windShakeTime * frequency * Math.PI * 2 * 0.8) * this.windShakeIntensity * 0.5;
        
        // Apply wind shake to camera rotation
        camera.rotation.x += shakeX;
        camera.rotation.y += shakeY;
        camera.rotation.z += shakeZ;
      }
    }

    // Update FOV burst effect
    if (this.isFovBursting && camera instanceof THREE.PerspectiveCamera) {
      if (now >= this.fovBurstEndTime) {
        this.isFovBursting = false;
      } else {
        this.fovBurstTime += deltaTime;
        const progress = this.fovBurstTime / (this.fovBurstDuration / 1000);
        
        // Ease-out curve for natural feel
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        // Start with burst FOV, ease back to normal
        const currentFovBoost = this.fovBurstAmount * (1 - easedProgress);
        const targetFov = this.fovBurstStartValue + currentFovBoost;
        
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }
    }
  }

  cleanup(): void {
    // Remove event listener
    if (this.eventListener) {
      window.removeEventListener('speedBoostGranted', this.eventListener);
      this.eventListener = null;
    }
    
    // Reset effect states
    this.isWindShaking = false;
    this.isFovBursting = false;
    this.fovCaptured = false;
    this.windShakeTime = 0;
    this.fovBurstTime = 0;
    
    console.log('📹 BoostShakeEffect: Cleaned up');
  }

  /**
   * Manually trigger effect (for testing)
   */
  triggerTestEffect(): void {
    this.triggerBoostEffect({
      fromVelocity: 18,
      toVelocity: 24,
      duration: 2000,
      damage: 50,
      source: 'test_dummy'
    });
  }

  /**
   * Get current effect status
   */
  getEffectStatus(): { windShaking: boolean; fovBursting: boolean } {
    return {
      windShaking: this.isWindShaking,
      fovBursting: this.isFovBursting
    };
  }
} 