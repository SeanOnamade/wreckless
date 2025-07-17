import type { RaceRoundSystem, ScoreEvent } from '../systems/RaceRoundSystem';

export class RoundEndUI {
  private roundSystem: RaceRoundSystem;
  private overlay!: HTMLDivElement;
  private restartButton!: HTMLButtonElement;
  private isVisible = false;
  private isDestroyed = false;
  private isRestarting = false;
  private restartTimeouts: number[] = []; // Track timeouts for cleanup
  private boundKeyHandler: (event: KeyboardEvent) => void;
  private boundRestartHandler: () => void;
  
  constructor(roundSystem: RaceRoundSystem) {
    this.roundSystem = roundSystem;
    
    // Bind event handlers
    this.boundKeyHandler = this.handleKeyPress.bind(this);
    this.boundRestartHandler = this.restartRound.bind(this);
    
    this.createOverlay();
    this.setupEventListeners();
  }
  
  private createOverlay(finalScore?: number, events?: ScoreEvent[]): void {
    // Create full-screen overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 30% 20%, rgba(255, 215, 0, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 70% 80%, rgba(0, 255, 136, 0.1) 0%, transparent 50%),
        linear-gradient(135deg, rgba(0, 0, 20, 0.95) 0%, rgba(20, 10, 0, 0.95) 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-family: 'Courier New', monospace;
      color: white;
      transition: opacity 0.5s ease-out, transform 0.5s ease-out;
      backdrop-filter: blur(10px);
    `;
    
    // Create main content container
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      text-align: center;
      background: linear-gradient(135deg, rgba(20, 15, 0, 0.95), rgba(40, 20, 0, 0.9));
      padding: 50px 70px;
      border-radius: 20px;
      border: 3px solid rgba(255, 215, 0, 0.6);
      box-shadow: 
        0 0 50px rgba(255, 215, 0, 0.3),
        0 0 100px rgba(255, 215, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      max-width: 600px;
      min-width: 500px;
      backdrop-filter: blur(20px);
    `;
    
    // Create "Round Complete" title
    const title = document.createElement('h1');
    title.style.cssText = `
      font-size: 42px;
      font-weight: bold;
      margin: 0 0 15px 0;
      color: #ffd700;
      text-shadow: 
        0 0 30px rgba(255, 215, 0, 0.8),
        0 0 60px rgba(255, 215, 0, 0.4),
        0 0 90px rgba(255, 215, 0, 0.2);
      animation: endTitleGlow 2s ease-in-out infinite alternate;
    `;
    title.textContent = 'ROUND COMPLETE!';
    
    // Create final score display
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      font-size: 36px;
      font-weight: bold;
      margin: 20px 0 30px 0;
      color: #00ff88;
      text-shadow: 
        0 0 20px rgba(0, 255, 136, 0.8),
        0 0 40px rgba(0, 255, 136, 0.4);
    `;
    scoreContainer.innerHTML = `Final Score: <span id="finalScore">${finalScore || 0}</span> pts`;
    
    // Create score breakdown container
    const breakdownContainer = document.createElement('div');
    breakdownContainer.id = 'scoreBreakdown';
    breakdownContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0 30px 0;
      font-size: 16px;
      line-height: 1.5;
    `;
    
    // Populate breakdown if events provided
    if (events) {
      this.populateScoreBreakdown(breakdownContainer, events);
    }
    
    // Create restart button
    this.restartButton = document.createElement('button');
    this.restartButton.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 22px;
      font-weight: bold;
      padding: 15px 35px;
      background: linear-gradient(45deg, #ff6600, #ff8800);
      color: white;
      border: 2px solid rgba(255, 136, 0, 0.5);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 
        0 0 25px rgba(255, 136, 0, 0.4),
        0 4px 15px rgba(0, 0, 0, 0.3);
      margin-bottom: 15px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    `;
    this.restartButton.textContent = '🔄 PLAY AGAIN';
    this.restartButton.addEventListener('click', this.boundRestartHandler);
    
    // Add hover effect
    this.restartButton.addEventListener('mouseenter', () => {
      this.restartButton.style.transform = 'scale(1.05)';
      this.restartButton.style.boxShadow = `
        0 0 35px rgba(255, 136, 0, 0.6),
        0 6px 20px rgba(0, 0, 0, 0.4)`;
      this.restartButton.style.background = 'linear-gradient(45deg, #ff7700, #ff9900)';
    });
    this.restartButton.addEventListener('mouseleave', () => {
      this.restartButton.style.transform = 'scale(1)';
      this.restartButton.style.boxShadow = `
        0 0 25px rgba(255, 136, 0, 0.4),
        0 4px 15px rgba(0, 0, 0, 0.3)`;
      this.restartButton.style.background = 'linear-gradient(45deg, #ff6600, #ff8800)';
    });
    
    // Create keyboard hint - REMOVED per user request
    // const keyboardHint = document.createElement('div');
    // keyboardHint.style.cssText = `
    //   font-size: 14px;
    //   color: #888888;
    //   margin-top: 10px;
    // `;
    // keyboardHint.textContent = 'or press R to restart';
    
    // Assemble the overlay
    contentContainer.appendChild(title);
    contentContainer.appendChild(scoreContainer);
    contentContainer.appendChild(breakdownContainer);
    contentContainer.appendChild(this.restartButton);
    // contentContainer.appendChild(keyboardHint); // REMOVED per user request
    this.overlay.appendChild(contentContainer);
    
    document.body.appendChild(this.overlay);
    
    // Add CSS animations
    if (!document.querySelector('#roundEndAnimations')) {
      const style = document.createElement('style');
      style.id = 'roundEndAnimations';
      style.textContent = `
        @keyframes endTitleGlow {
          0% { 
            text-shadow: 
              0 0 30px rgba(255, 215, 0, 0.8),
              0 0 60px rgba(255, 215, 0, 0.4),
              0 0 90px rgba(255, 215, 0, 0.2);
          }
          100% { 
            text-shadow: 
              0 0 40px rgba(255, 215, 0, 1),
              0 0 80px rgba(255, 215, 0, 0.6),
              0 0 120px rgba(255, 215, 0, 0.3);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  private setupEventListeners(): void {
    // Listen for round end
    this.roundSystem.setCallbacks({
      onRoundEnd: (finalScore, events) => {
        this.show(finalScore, events);
      }
    });
  }
  
  private handleKeyPress(event: KeyboardEvent): void {
    if ((event.code === 'KeyR' || event.code === 'Space') && this.isVisible) {
      event.preventDefault();
      this.restartRound();
    }
  }
  
  private restartRound(): void {
    if (!this.isVisible || this.isDestroyed || this.isRestarting) return;
    
    // Prevent multiple simultaneous restarts
    this.isRestarting = true;
    
    // Disable button to prevent double-clicks
    this.restartButton.disabled = true;
    this.restartButton.style.opacity = '0.5';
    
    this.hide();
    
    // Small delay before resetting to allow UI to hide
    const resetTimeout = setTimeout(() => {
      if (!this.isDestroyed) {
        try {
          this.roundSystem.resetRound();
        } catch (error) {
          console.error('Error resetting round:', error);
        }
      }
      this.isRestarting = false;
    }, 300);
    
    // Store timeout for cleanup if component is destroyed
    if (!this.restartTimeouts) {
      this.restartTimeouts = [];
    }
    this.restartTimeouts.push(resetTimeout);
  }
  
  private show(finalScore: number, events: ScoreEvent[]): void {
    if (this.isVisible || this.isDestroyed) return;
    
    this.isVisible = true;
    
    // Create fresh overlay content each time to ensure event listeners work
    this.createOverlay(finalScore, events);
    
    // Set ARIA attributes for accessibility
    this.overlay.setAttribute('aria-hidden', 'false');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'round-end-title');
    
    // Show overlay with animation
    this.overlay.style.display = 'flex';
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'scale(0.9)';
    
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.overlay.style.transform = 'scale(1)';
    });
    
    // Add keyboard listener
    document.addEventListener('keydown', this.boundKeyHandler);
    
    // Focus the restart button after a short delay
    setTimeout(() => {
      if (!this.isDestroyed && this.restartButton) {
        this.restartButton.focus();
      }
    }, 100);
    
    // Play celebration animation
    this.playResultAnimation(finalScore);
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
  
  private populateScoreBreakdown(container: HTMLDivElement, events: ScoreEvent[]): void {
    if (!container) return;
    
    // Count events by type
    const breakdown = {
      dummyKO: { count: 0, points: 0 },
      checkpoint: { count: 0, points: 0 },
      lap: { count: 0, points: 0 }
    };
    
    events.forEach(event => {
      breakdown[event.type].count++;
      breakdown[event.type].points += event.points;
    });
    
    // Generate breakdown HTML
    const breakdownHTML = `
      <div style="font-size: 18px; color: #ffff00; margin-bottom: 15px; font-weight: bold;">Score Breakdown:</div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Dummy Hits:</span>
        <span>${breakdown.dummyKO.count}x = <strong style="color: #00ff00;">${breakdown.dummyKO.points} pts</strong></span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Checkpoints:</span>
        <span>${breakdown.checkpoint.count}x = <strong style="color: #00ff00;">${breakdown.checkpoint.points} pts</strong></span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
        <span>Laps:</span>
        <span>${breakdown.lap.count}x = <strong style="color: #00ff00;">${breakdown.lap.points} pts</strong></span>
      </div>
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.3); padding-top: 10px; font-size: 16px; color: #cccccc;">
        Total Events: ${events.length}
      </div>
    `;
    
    container.innerHTML = breakdownHTML;
  }
  
  private playResultAnimation(finalScore: number): void {
    // Create floating score particles
    const particleCount = Math.min(10, Math.floor(finalScore / 10) + 3);
    
    for (let i = 0; i < particleCount; i++) {
      setTimeout(() => {
        this.createScoreParticle();
      }, i * 100);
    }
    
    // Rank message based on score
    let rankMessage = '';
    let rankColor = '#cccccc';
    
    if (finalScore >= 200) {
      rankMessage = '🏆 LEGENDARY RACER!';
      rankColor = '#ffd700';
    } else if (finalScore >= 150) {
      rankMessage = '🥇 CHAMPION!';
      rankColor = '#00ff00';
    } else if (finalScore >= 100) {
      rankMessage = '🥈 SKILLED DRIVER!';
      rankColor = '#c0c0c0';
    } else if (finalScore >= 50) {
      rankMessage = '🥉 ROOKIE RACER!';
      rankColor = '#cd7f32';
    } else {
      rankMessage = '🚗 KEEP PRACTICING!';
      rankColor = '#ffffff';
    }
    
    // Show rank message
    setTimeout(() => {
      const rankElement = document.createElement('div');
      rankElement.style.cssText = `
        font-size: 24px;
        font-weight: bold;
        color: ${rankColor};
        text-shadow: 0 0 10px ${rankColor}50;
        margin: 15px 0;
        animation: glow 2s ease-in-out infinite alternate;
      `;
      rankElement.textContent = rankMessage;
      
      // Add glow animation
      if (!document.querySelector('#glowAnimation')) {
        const style = document.createElement('style');
        style.id = 'glowAnimation';
        style.textContent = `
          @keyframes glow {
            from { text-shadow: 0 0 10px ${rankColor}50; }
            to { text-shadow: 0 0 20px ${rankColor}80, 0 0 30px ${rankColor}40; }
          }
        `;
        document.head.appendChild(style);
      }
      
      const contentContainer = this.overlay.querySelector('div > div');
      if (contentContainer) {
        contentContainer.insertBefore(rankElement, this.restartButton);
      }
    }, 800);
  }
  
  private createScoreParticle(): void {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      font-size: 20px;
      font-weight: bold;
      color: #ffd700;
      pointer-events: none;
      z-index: 2001;
      animation: floatUp 3s ease-out forwards;
    `;
    
    // Random starting position around the score
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
    const startY = window.innerHeight / 2 + (Math.random() - 0.5) * 100;
    
    particle.style.left = startX + 'px';
    particle.style.top = startY + 'px';
    
    // Random particle content
    const particles = ['✨', '⭐', '🌟', '💫', '🏆', '🎯'];
    particle.textContent = particles[Math.floor(Math.random() * particles.length)];
    
    // Add float animation if not already added
    if (!document.querySelector('#floatUpAnimation')) {
      const style = document.createElement('style');
      style.id = 'floatUpAnimation';
      style.textContent = `
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(0.5);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(particle);
    
    // Remove particle after animation
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 3000);
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.isVisible = false;
    this.isRestarting = false;
    
    try {
      // Remove event listeners
      document.removeEventListener('keydown', this.boundKeyHandler);
      
      // Remove DOM elements
      if (this.overlay?.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      
      // Clean up CSS animations
      const animationStyle = document.querySelector('#roundEndAnimations');
      if (animationStyle?.parentNode) {
        animationStyle.parentNode.removeChild(animationStyle);
      }
      
      // Clean up any floating particles that might still exist
      const particles = document.querySelectorAll('[style*="z-index: 2001"]');
      particles.forEach(particle => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
      
      // Clear any pending restart timeouts
      this.restartTimeouts.forEach(timeout => clearTimeout(timeout));
      this.restartTimeouts = [];
    } catch (error) {
      console.error('Error cleaning up RoundEndUI:', error);
    }
    
    console.log('🧹 RoundEndUI destroyed and cleaned up');
  }
} 