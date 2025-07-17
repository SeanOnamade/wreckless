import type { RaceRoundSystem } from '../systems/RaceRoundSystem';

export class RoundStartUI {
  private roundSystem: RaceRoundSystem;
  private overlay!: HTMLDivElement;
  private startButton!: HTMLButtonElement;
  private isVisible = false;
  private isDestroyed = false;
  private isCountdownActive = false;
  private countdownTimeouts: number[] = []; // Track timeouts for cleanup
  private activeCountdownOverlay: HTMLDivElement | null = null;
  private boundKeyHandler: (event: KeyboardEvent) => void;
  private boundClickHandler: () => void;
  
  constructor(roundSystem: RaceRoundSystem) {
    this.roundSystem = roundSystem;
    
    // Bind event handlers
    this.boundKeyHandler = this.handleKeyPress.bind(this);
    this.boundClickHandler = this.startRound.bind(this);
    
    this.createOverlay();
    this.setupEventListeners();
    this.show(); // Show immediately on creation
  }
  
  private createOverlay(): void {
    // Create full-screen overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 20% 30%, rgba(0, 100, 200, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(200, 0, 200, 0.1) 0%, transparent 50%),
        linear-gradient(135deg, rgba(0, 0, 20, 0.95) 0%, rgba(0, 20, 40, 0.95) 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-family: 'Courier New', monospace;
      color: white;
      transition: opacity 0.5s ease-out, transform 0.5s ease-out;
      backdrop-filter: blur(8px);
    `;
    
    // Create main content container
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      text-align: center;
      background: linear-gradient(135deg, rgba(0, 20, 40, 0.9), rgba(0, 40, 80, 0.8));
      padding: 40px 60px;
      border-radius: 20px;
      border: 2px solid rgba(0, 255, 255, 0.4);
      box-shadow: 
        0 0 40px rgba(0, 255, 255, 0.2),
        0 0 80px rgba(0, 200, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      max-width: 500px;
      backdrop-filter: blur(15px);
    `;
    
    // Create title
    const title = document.createElement('h1');
    title.style.cssText = `
      font-size: 48px;
      font-weight: bold;
      margin: 0 0 20px 0;
      color: #00ffff;
      text-shadow: 
        0 0 20px rgba(0, 255, 255, 0.8),
        0 0 40px rgba(0, 255, 255, 0.4),
        0 0 60px rgba(0, 255, 255, 0.2);
      animation: titlePulse 3s ease-in-out infinite alternate;
    `;
    title.textContent = 'WRECKLESS';
    
    // Create subtitle
    const subtitle = document.createElement('h2');
    subtitle.style.cssText = `
      font-size: 24px;
      margin: 0 0 30px 0;
      color: #ff00ff;
      font-weight: normal;
      text-shadow: 0 0 15px rgba(255, 0, 255, 0.6);
    `;
    subtitle.textContent = 'Passing Time When You\'re Trapped In It';
    
    // Create instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      font-size: 18px;
      margin-bottom: 30px;
      line-height: 1.8;
      color: #cccccc;
    `;
    instructions.innerHTML = `
      <div style="margin-bottom: 15px;">Hit dummies: <span style="color: #00ff88; text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);">+10 pts</span></div>
      <div style="margin-bottom: 15px;">Pass checkpoints: <span style="color: #00ff88; text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);">+30 pts</span></div>
      <div style="margin-bottom: 15px;">Complete laps: <span style="color: #00ff88; text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);">+50 pts</span></div>
      <div style="color: #ffaa00; font-size: 16px; text-shadow: 0 0 8px rgba(255, 170, 0, 0.5);">2 minutes to score as many points as possible!</div>
    `;
    
    // Create start button
    this.startButton = document.createElement('button');
    this.startButton.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 24px;
      font-weight: bold;
      padding: 15px 40px;
      background: linear-gradient(45deg, #00ffff, #0088ff);
      color: black;
      border: 2px solid rgba(0, 255, 255, 0.5);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 
        0 0 20px rgba(0, 255, 255, 0.4),
        0 4px 15px rgba(0, 0, 0, 0.3);
      margin-bottom: 20px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    `;
    this.startButton.textContent = 'START RACE';
    this.startButton.addEventListener('click', this.boundClickHandler);
    
    // Add hover effect
    this.startButton.addEventListener('mouseenter', () => {
      this.startButton.style.transform = 'scale(1.05)';
      this.startButton.style.boxShadow = `
        0 0 30px rgba(0, 255, 255, 0.6),
        0 6px 20px rgba(0, 0, 0, 0.4)`;
      this.startButton.style.background = 'linear-gradient(45deg, #00ffff, #00aaff)';
    });
    this.startButton.addEventListener('mouseleave', () => {
      this.startButton.style.transform = 'scale(1)';
      this.startButton.style.boxShadow = `
        0 0 20px rgba(0, 255, 255, 0.4),
        0 4px 15px rgba(0, 0, 0, 0.3)`;
      this.startButton.style.background = 'linear-gradient(45deg, #00ffff, #0088ff)';
    });
    
    // Create keyboard hint - REMOVED per user request
    // const keyboardHint = document.createElement('div');
    // keyboardHint.style.cssText = `
    //   font-size: 16px;
    //   color: #888888;
    //   margin-top: 10px;
    // `;
    // keyboardHint.textContent = 'or press SPACE to start';
    
    // Assemble the overlay
    contentContainer.appendChild(title);
    contentContainer.appendChild(subtitle);
    contentContainer.appendChild(instructions);
    contentContainer.appendChild(this.startButton);
    // contentContainer.appendChild(keyboardHint); // REMOVED per user request
    this.overlay.appendChild(contentContainer);
    
    document.body.appendChild(this.overlay);
    
    // Add CSS animations
    if (!document.querySelector('#roundStartAnimations')) {
      const style = document.createElement('style');
      style.id = 'roundStartAnimations';
      style.textContent = `
        @keyframes titlePulse {
          0% { 
            text-shadow: 
              0 0 20px rgba(0, 255, 255, 0.8),
              0 0 40px rgba(0, 255, 255, 0.4),
              0 0 60px rgba(0, 255, 255, 0.2);
          }
          100% { 
            text-shadow: 
              0 0 30px rgba(0, 255, 255, 1),
              0 0 60px rgba(0, 255, 255, 0.6),
              0 0 90px rgba(0, 255, 255, 0.3);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  private setupEventListeners(): void {
    // Listen for round state changes
    this.roundSystem.setCallbacks({
      onStateChange: (state) => {
        if (state === 'active') {
          this.hide();
        } else if (state === 'waiting') {
          this.show();
        }
      }
    });
    
    // Keyboard event listener will be added when visible
  }
  
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.isVisible) {
      event.preventDefault();
      this.startRound();
    }
  }
  
  private startRound(): void {
    if (!this.isVisible || this.isDestroyed || this.isCountdownActive) return;
    
    // Prevent multiple simultaneous countdowns
    this.isCountdownActive = true;
    
    // Disable button to prevent double-clicks
    this.startButton.disabled = true;
    
    // Hide overlay immediately when countdown starts
    this.hide();
    
    // Show countdown animation in a separate overlay
    this.showCountdown(() => {
      if (!this.isDestroyed) {
        this.roundSystem.startRound();
      }
      this.isCountdownActive = false;
    });
  }
  
  private showCountdown(onComplete: () => void): void {
    // Clear any existing countdown
    this.cleanupCountdown();
    
    // Disable button during countdown
    this.startButton.disabled = true;
    this.startButton.style.opacity = '0.5';
    
    // Keep overlay visible during countdown
    const countdownElement = document.createElement('div');
    countdownElement.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 120px;
      font-weight: bold;
      color: #00ffff;
      text-shadow: 
        0 0 30px rgba(0, 255, 255, 1),
        0 0 60px rgba(0, 255, 255, 0.6),
        0 0 90px rgba(0, 255, 255, 0.3);
      z-index: 2001;
      font-family: 'Courier New', monospace;
    `;
    
    // Create a separate countdown overlay that doesn't have the game content
    const countdownOverlay = document.createElement('div');
    countdownOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 20% 30%, rgba(0, 100, 200, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(200, 0, 200, 0.1) 0%, transparent 50%),
        linear-gradient(135deg, rgba(0, 0, 20, 0.95) 0%, rgba(0, 20, 40, 0.95) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2001;
      backdrop-filter: blur(8px);
    `;
    
    countdownOverlay.appendChild(countdownElement);
    document.body.appendChild(countdownOverlay);
    this.activeCountdownOverlay = countdownOverlay;
    
    // Clean up countdown overlay after countdown completes
    const originalOnComplete = onComplete;
    onComplete = () => {
      this.cleanupCountdown();
      originalOnComplete();
    };
    
    let count = 3;
    const updateCountdown = () => {
      if (count > 0) {
        countdownElement.textContent = count.toString();
        countdownElement.style.transform = 'translate(-50%, -50%) scale(1.2)';
        
        const scaleTimeout = setTimeout(() => {
          if (!this.isDestroyed) {
            countdownElement.style.transform = 'translate(-50%, -50%) scale(1)';
          }
        }, 200);
        this.countdownTimeouts.push(scaleTimeout);
        
        count--;
        const nextTimeout = setTimeout(updateCountdown, 1000);
        this.countdownTimeouts.push(nextTimeout);
      } else {
        countdownElement.textContent = 'GO!';
        countdownElement.style.color = '#00ff88';
        countdownElement.style.textShadow = `
          0 0 40px rgba(0, 255, 136, 1),
          0 0 80px rgba(0, 255, 136, 0.6),
          0 0 120px rgba(0, 255, 136, 0.3)`;
        countdownElement.style.transform = 'translate(-50%, -50%) scale(1.5)';
        
        const completeTimeout = setTimeout(() => {
          if (!this.isDestroyed && countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
          }
          onComplete();
        }, 500);
        this.countdownTimeouts.push(completeTimeout);
      }
    };
    
    updateCountdown();
  }
  
  private show(): void {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.overlay.style.display = 'flex';
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'scale(0.9)';
    
    // Re-enable button
    this.startButton.disabled = false;
    this.startButton.style.opacity = '1';
    
    // Animate in
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.overlay.style.transform = 'scale(1)';
    });
    
    // Add keyboard listener
    document.addEventListener('keydown', this.boundKeyHandler);
    
    // Focus the button for better accessibility
    setTimeout(() => {
      this.startButton.focus();
    }, 100);
  }
  
  private hide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    
    // Animate out
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, 500);
    
    // Remove keyboard listener
    document.removeEventListener('keydown', this.boundKeyHandler);
  }
  
  /**
   * Force show the start screen (for reset)
   */
  forceShow(): void {
    this.show();
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.isVisible = false;
    this.isCountdownActive = false;
    
    try {
      // Remove event listeners
      document.removeEventListener('keydown', this.boundKeyHandler);
      
      // Remove DOM elements
      if (this.overlay?.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      
      // Clean up CSS animations
      const animationStyle = document.querySelector('#roundStartAnimations');
      if (animationStyle?.parentNode) {
        animationStyle.parentNode.removeChild(animationStyle);
      }
      
      // Clean up countdown
      this.cleanupCountdown();
    } catch (error) {
      console.error('Error cleaning up RoundStartUI:', error);
    }
    
    console.log('🧹 RoundStartUI destroyed and cleaned up');
  }
  
  /**
   * Clean up countdown timers and overlays
   */
  private cleanupCountdown(): void {
    // Clear all timeouts
    this.countdownTimeouts.forEach(timeout => clearTimeout(timeout));
    this.countdownTimeouts = [];
    
    // Remove countdown overlay
    if (this.activeCountdownOverlay?.parentNode) {
      this.activeCountdownOverlay.parentNode.removeChild(this.activeCountdownOverlay);
    }
    this.activeCountdownOverlay = null;
  }
} 