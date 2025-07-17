import * as THREE from 'three';
import type { CameraEffect } from './CameraEffectsManager';

/**
 * Wind Streak Effect
 * Shows a subtle wind streak visual overlay when player reaches high speeds
 * Uses HTML overlay with background image for performance and easy styling
 */
export class WindStreakEffect implements CameraEffect {
  readonly name = 'WindStreak';
  enabled = true;

  // Effect parameters
  private minSpeed = 18; // Speed at which wind streaks start appearing (m/s)
  private maxSpeed = 60; // Speed at which wind streaks reach full opacity (m/s)
  private currentSpeed = 0;
  private targetOpacity = 0;
  private currentOpacity = 0;
  private fadeSpeed = 4.0; // How fast opacity changes (higher = faster transitions)
  
  // Shake effect parameters
  private shakeTime = 0;
  private shakeIntensity = 2.0; // How much the streaks shake (pixels)
  private shakeFrequency = 8.0; // How fast the shake oscillates (Hz)

  // HTML elements
  private overlayElement: HTMLDivElement | null = null;
  private isInitialized = false;

  constructor(config?: {
    minSpeed?: number;
    maxSpeed?: number;
    fadeSpeed?: number;
    shakeIntensity?: number;
    shakeFrequency?: number;
  }) {
    if (config) {
      this.minSpeed = config.minSpeed ?? this.minSpeed;
      this.maxSpeed = config.maxSpeed ?? this.maxSpeed;
      this.fadeSpeed = config.fadeSpeed ?? this.fadeSpeed;
      this.shakeIntensity = config.shakeIntensity ?? this.shakeIntensity;
      this.shakeFrequency = config.shakeFrequency ?? this.shakeFrequency;
    }
  }

  initialize(): void {
    this.createOverlayElement();
    this.isInitialized = true;
    console.log(`📹 WindStreakEffect: Initialized with speed range ${this.minSpeed}-${this.maxSpeed} m/s`);
  }

  /**
   * Update speed from external source (called by main.ts integration)
   */
  updateSpeed(speed: number): void {
    this.currentSpeed = speed;
  }

  /**
   * Create the HTML overlay element for wind streaks
   */
  private createOverlayElement(): void {
    // Remove existing element if it exists
    if (this.overlayElement) {
      this.overlayElement.remove();
    }

    // Check for and remove any existing overlay with same ID (safety)
    const existingOverlay = document.getElementById('wind-streak-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
      console.warn('📹 WindStreakEffect: Removed existing overlay element');
    }

    // Create wind streak overlay
    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'wind-streak-overlay';
    
    // Inline CSS for self-contained effect
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      opacity: 0;
      background-image: url('/assets/windstreaks2.gif');
      background-size: cover;
      background-repeat: no-repeat;
      mix-blend-mode: screen;
      transition: none;
    `;

    // Set initial background position
    this.overlayElement.style.backgroundPosition = 'center';
    
    // Add to page
    document.body.appendChild(this.overlayElement);
    console.log('📹 WindStreakEffect: HTML overlay created');
  }

  update(_camera: THREE.Camera, deltaTime: number): void {
    if (!this.isInitialized || !this.overlayElement) return;

    // Calculate target opacity based on current speed
    const speedAboveMin = Math.max(0, this.currentSpeed - this.minSpeed);
    const speedRange = this.maxSpeed - this.minSpeed;
    const speedRatio = Math.min(speedAboveMin / speedRange, 1.0);
    
    // Smooth curve for natural appearance
    this.targetOpacity = speedRatio * speedRatio; // Quadratic ease-in for dramatic effect
    
    // Smooth lerp to target opacity
    const opacityDelta = this.targetOpacity - this.currentOpacity;
    this.currentOpacity += opacityDelta * this.fadeSpeed * deltaTime;
    
    // Apply opacity to overlay
    this.overlayElement.style.opacity = this.currentOpacity.toString();
    
    // Apply shake effect when visible
    if (this.currentOpacity > 0.01) {
      this.shakeTime += deltaTime;
      
      // Calculate shake offset using sine waves for smooth motion
      const shakeX = Math.sin(this.shakeTime * this.shakeFrequency * Math.PI * 2) * this.shakeIntensity;
      const shakeY = Math.cos(this.shakeTime * this.shakeFrequency * Math.PI * 2 * 1.3) * this.shakeIntensity * 0.5;
      
      // Apply shake as background position offset
      this.overlayElement.style.backgroundPosition = `calc(50% + ${shakeX}px) calc(50% + ${shakeY}px)`;
    } else {
      // Reset position when not visible
      this.overlayElement.style.backgroundPosition = 'center';
      this.shakeTime = 0;
    }

    // Debug logging (throttled)
    if (import.meta.env.DEV && Math.random() < 0.005) { // 0.5% chance each frame
      console.log(`📹 WindStreak: speed=${this.currentSpeed.toFixed(1)} m/s, opacity=${this.currentOpacity.toFixed(3)}`);
    }
  }

  cleanup(): void {
    // Remove HTML overlay
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
    
    // Reset state
    this.currentSpeed = 0;
    this.currentOpacity = 0;
    this.targetOpacity = 0;
    this.shakeTime = 0;
    this.isInitialized = false;
    
    console.log('📹 WindStreakEffect: Cleaned up, overlay removed');
  }

  /**
   * Reset effect (useful for competition mode)
   */
  resetEffect(): void {
    if (this.overlayElement) {
      this.overlayElement.style.opacity = '0';
      this.overlayElement.style.backgroundPosition = 'center';
      this.currentOpacity = 0;
      this.targetOpacity = 0;
      this.shakeTime = 0;
    }
  }

  /**
   * Get current effect info for debugging
   */
  getEffectInfo(): { speed: number; opacity: number; target: number; active: boolean; shaking: boolean } {
    return {
      speed: this.currentSpeed,
      opacity: this.currentOpacity,
      target: this.targetOpacity,
      active: this.currentOpacity > 0.01,
      shaking: this.currentOpacity > 0.01
    };
  }

  /**
   * Manually set opacity (for testing)
   */
  setTestOpacity(opacity: number): void {
    if (this.overlayElement) {
      this.currentOpacity = Math.max(0, Math.min(1, opacity));
      this.overlayElement.style.opacity = this.currentOpacity.toString();
    }
  }

  /**
   * Switch to Three.js implementation (future enhancement)
   * This method provides a clean interface for later upgrading to 3D wind effects
   */
  switchToThreeJS(_scene: THREE.Scene, _camera: THREE.Camera): void {
    console.warn('📹 WindStreakEffect: Three.js implementation not yet available');
    // TODO: Implement Three.js plane-based wind streaks
    // - Create semi-transparent plane with wind streak texture
    // - Position in front of camera but behind UI
    // - Animate texture offset for motion effect
    // - Maintain same opacity logic
  }
} 