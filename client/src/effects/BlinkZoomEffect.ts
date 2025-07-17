import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Blink zoom effect
 * Creates dramatic zoom out → zoom in effect during blink teleportation
 * FOV: 90° → 70° (zoom out) → 90° (zoom back in) for "warping through space" feel
 */
export class BlinkZoomEffect implements CameraEffect {
  readonly name = 'BlinkZoom';
  enabled = true;

  // Effect parameters
  private baseFov = 90; // Normal FOV
  private zoomOutFov = 70; // Zoomed out FOV during teleport
  private zoomOutDuration = 100; // 0.1s to zoom out
  private zoomInDuration = 200; // 0.2s to zoom back in
  
  // Current effect state
  private isZooming = false;
  private zoomPhase: 'out' | 'in' = 'out';
  private zoomPhaseStartTime = 0;
  private startFov = 90;
  private fovCaptured = false;

  // Event listener reference for cleanup
  private eventListener: ((event: Event) => void) | null = null;

  constructor(config?: {
    baseFov?: number;
    zoomOutFov?: number;
    zoomOutDuration?: number;
    zoomInDuration?: number;
  }) {
    if (config) {
      this.baseFov = config.baseFov ?? this.baseFov;
      this.zoomOutFov = config.zoomOutFov ?? this.zoomOutFov;
      this.zoomOutDuration = config.zoomOutDuration ?? this.zoomOutDuration;
      this.zoomInDuration = config.zoomInDuration ?? this.zoomInDuration;
    }
  }

  initialize(): void {
    // Listen for blink ability usage
    this.eventListener = (event: Event) => {
      if (!this.enabled) return;
      
      const customEvent = event as CustomEvent;
      const { ability, success } = customEvent.detail;
      
      // Only trigger on successful blink teleports
      if (ability === 'blink' && success) {
        this.triggerBlinkZoom();
      }
    };
    
    window.addEventListener('abilityUsed', this.eventListener);
    console.log('📹 BlinkZoomEffect: Listening for blink ability events');
  }

  /**
   * Trigger the blink zoom effect
   */
  private triggerBlinkZoom(): void {
    const now = Date.now();
    
    // Start zoom effect
    this.isZooming = true;
    this.zoomPhase = 'out';
    this.zoomPhaseStartTime = now;
    this.fovCaptured = false; // Reset FOV capture flag
    
    console.log('📹 BlinkZoom: Teleport zoom effect triggered!');
  }

  update(camera: THREE.Camera, _deltaTime: number): void {
    if (!this.isZooming || !(camera instanceof THREE.PerspectiveCamera)) return;
    
    const now = Date.now();
    const phaseElapsed = now - this.zoomPhaseStartTime;

    // Store starting FOV when effect begins (before any modifications)
    if (!this.fovCaptured) {
      this.startFov = camera.fov;
      this.fovCaptured = true;
    }
    
    if (this.zoomPhase === 'out') {
      // Zoom out phase (90° → 70°)
      if (phaseElapsed >= this.zoomOutDuration) {
        // Switch to zoom in phase
        this.zoomPhase = 'in';
        this.zoomPhaseStartTime = now;
        camera.fov = this.zoomOutFov;
        camera.updateProjectionMatrix();
      } else {
        // Animate zoom out
        const progress = phaseElapsed / this.zoomOutDuration;
        const easedProgress = Math.pow(progress, 2); // Ease-in for dramatic effect
        
        const currentFov = this.startFov + (this.zoomOutFov - this.startFov) * easedProgress;
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }
    } else if (this.zoomPhase === 'in') {
      // Zoom in phase (70° → 90°)
      if (phaseElapsed >= this.zoomInDuration) {
        // Effect complete
        this.isZooming = false;
        camera.fov = this.baseFov;
        camera.updateProjectionMatrix();
      } else {
        // Animate zoom in
        const progress = phaseElapsed / this.zoomInDuration;
        const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out for smooth landing
        
        const currentFov = this.zoomOutFov + (this.baseFov - this.zoomOutFov) * easedProgress;
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }
    }
  }

  cleanup(): void {
    // Remove event listener
    if (this.eventListener) {
      window.removeEventListener('abilityUsed', this.eventListener);
      this.eventListener = null;
    }
    
    // Reset effect state
    this.isZooming = false;
    this.fovCaptured = false;
    this.zoomPhaseStartTime = 0;
    
    console.log('📹 BlinkZoomEffect: Cleaned up');
  }

  /**
   * Manually trigger effect (for testing)
   */
  triggerTestBlink(): void {
    this.triggerBlinkZoom();
  }

  /**
   * Get current zoom status
   */
  getZoomStatus(): { zooming: boolean; phase: string; progress: number } {
    if (!this.isZooming) {
      return { zooming: false, phase: 'none', progress: 0 };
    }
    
    const phaseElapsed = Date.now() - this.zoomPhaseStartTime;
    const phaseDuration = this.zoomPhase === 'out' ? this.zoomOutDuration : this.zoomInDuration;
    const progress = Math.min(phaseElapsed / phaseDuration, 1.0);
    
    return {
      zooming: this.isZooming,
      phase: this.zoomPhase,
      progress: progress
    };
  }

  /**
   * Force reset FOV (useful for competition mode)
   */
  resetFov(camera: THREE.Camera): void {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = this.baseFov;
      camera.updateProjectionMatrix();
      this.isZooming = false;
    }
  }
} 