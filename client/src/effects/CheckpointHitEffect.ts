import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Checkpoint hit effect
 * Triggers white flash and screen shake when passing through checkpoints
 * Provides satisfying feedback for checkpoint progression
 */
export class CheckpointHitEffect implements CameraEffect {
  readonly name = 'CheckpointHit';
  enabled = true;

  // Effect parameters
  private shakeIntensity = 0.08; // Medium shake for checkpoint hits
  private shakeDuration = 150; // 0.15 seconds duration
  private flashDuration = 250; // 0.25 seconds white flash
  
  // Current effect state
  private isShaking = false;
  private shakeEndTime = 0;
  private shakeTime = 0;
  
  private isFlashing = false;
  private flashEndTime = 0;
  private flashOverlay: HTMLElement | null = null;

  // Event listener reference for cleanup
  private eventListener: ((event: Event) => void) | null = null;

  constructor(config?: {
    shakeIntensity?: number;
    shakeDuration?: number;
    flashDuration?: number;
  }) {
    if (config) {
      this.shakeIntensity = config.shakeIntensity ?? this.shakeIntensity;
      this.shakeDuration = config.shakeDuration ?? this.shakeDuration;
      this.flashDuration = config.flashDuration ?? this.flashDuration;
    }
  }

  initialize(): void {
    // Listen for checkpoint hit events
    this.eventListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      this.triggerCheckpointHit(customEvent.detail);
    };
    
    window.addEventListener('checkpointHit', this.eventListener);
    
    // Create white flash overlay
    this.createFlashOverlay();
    
    console.log('📹 CheckpointHitEffect initialized');
  }

  /**
   * Create white flash overlay element
   */
  private createFlashOverlay(): void {
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.id = 'checkpoint-flash-overlay';
    this.flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 998;
      opacity: 0;
      background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 100%);
      transition: opacity 0.1s ease-out;
    `;
    document.body.appendChild(this.flashOverlay);
  }

  /**
   * Trigger the checkpoint hit effect
   */
  private triggerCheckpointHit(checkpointData: any): void {
    const { checkpointId, playerSpeed } = checkpointData;
    const now = Date.now();
    
    // Calculate effect intensity based on player speed (faster = more intense)
    const speedRatio = Math.min(playerSpeed / 30, 1.5); // Cap at 1.5x intensity
    const finalShakeIntensity = this.shakeIntensity * speedRatio;
    
    // Start shake effect
    this.isShaking = true;
    this.shakeEndTime = now + this.shakeDuration;
    this.shakeTime = 0;
    
    // Start flash effect
    this.isFlashing = true;
    this.flashEndTime = now + this.flashDuration;
    
    if (this.flashOverlay) {
      this.flashOverlay.style.opacity = '0.8';
    }
    
    console.log(`📹 CheckpointHit: ${checkpointId} triggered (speed=${playerSpeed.toFixed(1)} m/s, intensity=${finalShakeIntensity.toFixed(3)})`);
  }

  update(camera: THREE.Camera, deltaTime: number): void {
    const now = Date.now();
    
    // Update shake effect
    if (this.isShaking) {
      if (now >= this.shakeEndTime) {
        this.isShaking = false;
      } else {
        this.shakeTime += deltaTime;
        const progress = this.shakeTime / (this.shakeDuration / 1000);
        
        // Fade out shake intensity over time (ease-out)
        const fadeMultiplier = 1 - Math.pow(progress, 2);
        const currentShakeIntensity = this.shakeIntensity * fadeMultiplier;
        
        // Generate random shake in all directions
        const shakeX = (Math.random() - 0.5) * currentShakeIntensity;
        const shakeY = (Math.random() - 0.5) * currentShakeIntensity;
        const shakeZ = (Math.random() - 0.5) * currentShakeIntensity * 0.3; // Less Z rotation
        
        // Apply shake to camera rotation
        camera.rotation.x += shakeX;
        camera.rotation.y += shakeY;
        camera.rotation.z += shakeZ;
      }
    }
    
    // Update flash effect
    if (this.isFlashing) {
      if (now >= this.flashEndTime) {
        this.isFlashing = false;
        if (this.flashOverlay) {
          this.flashOverlay.style.opacity = '0';
        }
      } else {
        // Fade out flash over time
        const flashProgress = (now - (this.flashEndTime - this.flashDuration)) / this.flashDuration;
        const flashOpacity = 0.8 * (1 - Math.pow(flashProgress, 1.5)); // Ease out
        
        if (this.flashOverlay) {
          this.flashOverlay.style.opacity = flashOpacity.toString();
        }
      }
    }
  }

  cleanup(): void {
    if (this.eventListener) {
      window.removeEventListener('checkpointHit', this.eventListener);
      this.eventListener = null;
    }
    
    if (this.flashOverlay && this.flashOverlay.parentNode) {
      this.flashOverlay.parentNode.removeChild(this.flashOverlay);
      this.flashOverlay = null;
    }
    
    console.log('📹 CheckpointHitEffect cleaned up');
  }

  /**
   * Manually trigger effect (for testing)
   */
  triggerTestHit(checkpointId: string = 'TEST', playerSpeed: number = 25): void {
    this.triggerCheckpointHit({
      checkpointId,
      playerSpeed,
      timestamp: Date.now()
    });
  }
} 