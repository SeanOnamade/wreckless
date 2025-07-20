import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Blast shake effect
 * Triggers screen shake when blast rockets explode
 * Intensity scales with explosion force and distance from player
 */
export class BlastShakeEffect implements CameraEffect {
  readonly name = 'BlastShake';
  enabled = true;

  // Effect parameters
  private baseShakeIntensity = 0.08; // Base shake magnitude (rad)
  private shakeDuration = 200; // 0.2 seconds duration
  private maxShakeIntensity = 0.25; // Maximum shake for close explosions
  private maxShakeDistance = 15; // Maximum distance for shake effect (meters)
  
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
    maxShakeDistance?: number;
  }) {
    if (config) {
      this.baseShakeIntensity = config.baseShakeIntensity ?? this.baseShakeIntensity;
      this.shakeDuration = config.shakeDuration ?? this.shakeDuration;
      this.maxShakeIntensity = config.maxShakeIntensity ?? this.maxShakeIntensity;
      this.maxShakeDistance = config.maxShakeDistance ?? this.maxShakeDistance;
    }
  }

  initialize(): void {
    // Listen for rocket explosion events
    this.eventListener = (event: Event) => {
      if (!this.enabled) return;
      
      const customEvent = event as CustomEvent;
      this.triggerBlastShake(customEvent.detail);
    };
    
    window.addEventListener('rocketExplosion', this.eventListener);
  }

  /**
   * Trigger the blast shake effect
   */
  private triggerBlastShake(explosionData: any): void {
    const { force } = explosionData;
    const now = Date.now();
    
    // For now, assume maximum shake since we can't easily get player distance
    // In a more complex implementation, we'd calculate distance from camera to explosion
    const distanceRatio = 1.0; // Assume close explosion for maximum impact
    const forceRatio = Math.min(force / 36, 1.0); // Normalize to base blast force
    
    // Combine distance and force for final intensity
    const intensityMultiplier = distanceRatio * forceRatio;
    this.currentIntensity = this.baseShakeIntensity + 
      (this.maxShakeIntensity - this.baseShakeIntensity) * intensityMultiplier;
    
    // Start shake effect
    this.isShaking = true;
    this.shakeEndTime = now + this.shakeDuration;
    this.shakeTime = 0;
    

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
    
    // Generate random shake in all directions (stronger than hit shake)
    const shakeX = (Math.random() - 0.5) * currentShakeIntensity;
    const shakeY = (Math.random() - 0.5) * currentShakeIntensity;
    const shakeZ = (Math.random() - 0.5) * currentShakeIntensity * 0.3; // Less Z rotation
    
    // Apply shake to camera rotation
    camera.rotation.x += shakeX;
    camera.rotation.y += shakeY;
    camera.rotation.z += shakeZ;
  }

  cleanup(): void {
    // Remove event listener
    if (this.eventListener) {
      window.removeEventListener('rocketExplosion', this.eventListener);
      this.eventListener = null;
    }
    
    // Reset effect state
    this.isShaking = false;
  }

  /**
   * Manually trigger effect (for testing)
   */
  triggerTestExplosion(force: number = 36): void {
    this.triggerBlastShake({
      position: { x: 0, y: 0, z: 0 },
      radius: 4,
      force: force,
      affectedCount: 1
    });
  }
} 