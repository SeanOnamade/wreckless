/**
 * Boost Overlay System
 * Provides visual feedback during speed boosts with countdown bar and subtle vignette effect
 * Integrates with existing speedBoostActive/speedBoostEnded events
 */
export class BoostOverlay {
  private container: HTMLDivElement | null = null;
  private progressFill: HTMLDivElement | null = null;
  private vignette: HTMLDivElement | null = null;
  
  // Boost state
  private isActive = false;
  private boostStartTime = 0;
  private boostDuration = 0;
  private animationFrameId: number | null = null;
  
  constructor() {
    this.createOverlay();
    this.setupEventListeners();
    console.log('🚀 Boost Overlay initialized');
  }

  private createOverlay(): void {
    // Create vignette overlay (full screen)
    this.vignette = document.createElement('div');
    this.vignette.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 500;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      background: radial-gradient(circle at center, 
        transparent 40%, 
        rgba(255, 232, 77, 0.15) 70%, 
        rgba(255, 165, 0, 0.25) 100%);
    `;
    document.body.appendChild(this.vignette);

    // Create boost bar container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      height: 8px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 4px;
      border: 1px solid rgba(255, 232, 77, 0.5);
      opacity: 0;
      pointer-events: none;
      z-index: 1500;
      transition: opacity 0.3s ease-in-out;
      box-shadow: 0 0 20px rgba(255, 232, 77, 0.3);
    `;
    
    // Create progress fill
    this.progressFill = document.createElement('div');
    this.progressFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, 
        #FFE84D 0%, 
        #FFA500 50%, 
        #FF6B35 100%);
      border-radius: 3px;
      transition: width 0.1s linear;
      box-shadow: 
        0 0 10px rgba(255, 232, 77, 0.8),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    `;
    
    this.container.appendChild(this.progressFill);
    document.body.appendChild(this.container);

    // Create boost label
    const label = document.createElement('div');
    label.style.cssText = `
      position: fixed;
      bottom: 115px;
      left: 50%;
      transform: translateX(-50%);
      color: #FFE84D;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 232, 77, 0.8);
      pointer-events: none;
      z-index: 1500;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      text-align: center;
    `;
    label.textContent = '🚀 SPEED BOOST';
    label.id = 'boost-label';
    document.body.appendChild(label);
  }

  private setupEventListeners(): void {
    // Listen for boost activation
    window.addEventListener('speedBoostActive', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.startBoost(customEvent.detail);
    });

    // Listen for boost end
    window.addEventListener('speedBoostEnded', () => {
      this.endBoost();
    });
  }

  private startBoost(boostData: any): void {
    this.isActive = true;
    this.boostStartTime = Date.now();
    this.boostDuration = boostData.duration || 3000; // Default 3 seconds
    
    // Show overlay elements
    if (this.container) {
      this.container.style.opacity = '1';
    }
    
    if (this.vignette) {
      this.vignette.style.opacity = '1';
    }

    const label = document.getElementById('boost-label');
    if (label) {
      label.style.opacity = '1';
    }
    
    // Start countdown animation
    this.startCountdown();
    
    console.log(`🚀 Boost UI: ${boostData.fromSpeed}→${boostData.toSpeed} m/s for ${this.boostDuration/1000}s`);
  }

  private endBoost(): void {
    this.isActive = false;
    
    // Hide overlay elements
    if (this.container) {
      this.container.style.opacity = '0';
    }
    
    if (this.vignette) {
      this.vignette.style.opacity = '0';
    }

    const label = document.getElementById('boost-label');
    if (label) {
      label.style.opacity = '0';
    }
    
    // Stop countdown animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    console.log('🚀 Boost UI: Ended');
  }

  private startCountdown(): void {
    const updateProgress = () => {
      if (!this.isActive) return;
      
      const elapsed = Date.now() - this.boostStartTime;
      const progress = Math.max(0, 1 - (elapsed / this.boostDuration));
      
      // Update progress bar
      if (this.progressFill) {
        this.progressFill.style.width = `${progress * 100}%`;
      }
      
      // Update vignette intensity based on remaining time
      if (this.vignette) {
        const intensity = Math.max(0.3, progress); // Min 30% opacity, max based on time left
        this.vignette.style.opacity = intensity.toString();
      }
      
      // Continue animation if boost is still active
      if (progress > 0 && this.isActive) {
        this.animationFrameId = requestAnimationFrame(updateProgress);
      } else if (this.isActive) {
        // Boost should have ended but event might not have fired
        this.endBoost();
      }
    };
    
    this.animationFrameId = requestAnimationFrame(updateProgress);
  }

  /**
   * Manual activation for testing
   */
  testBoost(duration: number = 3000): void {
    this.startBoost({
      fromSpeed: 18,
      toSpeed: 35,
      duration: duration
    });
    
    // Auto-end after duration for testing
    setTimeout(() => {
      this.endBoost();
    }, duration);
  }

  /**
   * Cleanup when destroying
   */
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.vignette && this.vignette.parentNode) {
      this.vignette.parentNode.removeChild(this.vignette);
    }

    const label = document.getElementById('boost-label');
    if (label && label.parentNode) {
      label.parentNode.removeChild(label);
    }
  }
} 