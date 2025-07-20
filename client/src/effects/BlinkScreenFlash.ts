/**
 * Blink Screen Flash Effect
 * Creates a brief blue flash overlay when player blinks
 * Uses CSS overlay for maximum performance
 */
export class BlinkScreenFlash {
  private flashOverlay: HTMLDivElement | null = null;
  private eventListener: ((event: Event) => void) | null = null;
  private isFlashing = false;

  constructor() {
    this.createFlashOverlay();
  }

  /**
   * Create the flash overlay element
   */
  private createFlashOverlay(): void {
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.id = 'blink-flash-overlay';
    this.flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle, rgba(0,255,255,0.6) 0%, rgba(0,150,255,0.3) 50%, rgba(0,100,255,0.1) 100%);
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.05s ease-out;
    `;
    document.body.appendChild(this.flashOverlay);
  }

  /**
   * Initialize the effect - start listening for blink events
   */
  initialize(): void {
    this.eventListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      this.triggerFlash(customEvent.detail);
    };
    
    window.addEventListener('blinkEffect', this.eventListener);
  }

  /**
   * Trigger the screen flash effect
   */
  private triggerFlash(_blinkData: any): void {
    if (this.isFlashing || !this.flashOverlay) return;
    
    this.isFlashing = true;
    
    // Flash in
    this.flashOverlay.style.opacity = '1';
    
    // Flash out after brief delay
    setTimeout(() => {
      if (this.flashOverlay) {
        this.flashOverlay.style.opacity = '0';
      }
      
      // Reset flag after animation completes
      setTimeout(() => {
        this.isFlashing = false;
      }, 50);
    }, 50);
    

  }

  /**
   * Cleanup - remove overlay and listeners
   */
  cleanup(): void {
    // Remove event listener
    if (this.eventListener) {
      window.removeEventListener('blinkEffect', this.eventListener);
      this.eventListener = null;
    }
    
    // Remove overlay element
    if (this.flashOverlay && this.flashOverlay.parentNode) {
      this.flashOverlay.parentNode.removeChild(this.flashOverlay);
      this.flashOverlay = null;
    }
  }

  /**
   * Manually trigger flash (for testing)
   */
  triggerTestFlash(): void {
    this.triggerFlash({
      fromPosition: { x: 0, y: 0, z: 0 },
      toPosition: { x: 10, y: 0, z: 0 },
      timestamp: Date.now()
    });
  }
} 