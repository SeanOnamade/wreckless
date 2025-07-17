import type { RaceRoundSystem, ScoreEvent } from '../systems/RaceRoundSystem';

export class ScoreHUD {
  private roundSystem: RaceRoundSystem;
  private container!: HTMLDivElement;
  private scoreElement!: HTMLSpanElement;
  private timeElement!: HTMLSpanElement;
  private pointsPopupContainer!: HTMLDivElement;
  private updateInterval: number | null = null;
  private isDestroyed = false;
  
  constructor(roundSystem: RaceRoundSystem) {
    this.roundSystem = roundSystem;
    this.createHUD();
    this.setupEventListeners();
    this.startUpdateLoop();
  }
  
  private createHUD(): void {
    // Create main container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 60, 0.95));
      color: white;
      padding: 15px 20px;
      border-radius: 12px;
      font-family: 'Courier New', monospace;
      font-size: 20px;
      font-weight: bold;
      z-index: 1000;
      pointer-events: none;
      border: 2px solid rgba(0, 255, 255, 0.5);
      box-shadow: 
        0 0 20px rgba(0, 255, 255, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      min-width: 220px;
      backdrop-filter: blur(10px);
    `;
    
    // Create score display
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      color: #00ff88;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
    `;
    scoreContainer.innerHTML = '<span>📊 Score:</span> <span id="currentScore">0</span>';
    this.scoreElement = scoreContainer.querySelector('#currentScore')!;
    
    // Create time remaining display
    const timeContainer = document.createElement('div');
    timeContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #00ffff;
      font-size: 16px;
      text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
    `;
    timeContainer.innerHTML = '<span>⏱️ Time:</span> <span id="timeRemaining">2:00</span>';
    this.timeElement = timeContainer.querySelector('#timeRemaining')!;
    
    // Create points popup container
    this.pointsPopupContainer = document.createElement('div');
    this.pointsPopupContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      pointer-events: none;
    `;
    
    // Assemble HUD
    this.container.appendChild(scoreContainer);
    this.container.appendChild(timeContainer);
    this.container.appendChild(this.pointsPopupContainer);
    document.body.appendChild(this.container);
    
    // Start hidden (will show when round starts)
    this.container.style.opacity = '0';
  }
  
  private setupEventListeners(): void {
    // Listen for round state changes
    this.roundSystem.setCallbacks({
      onStateChange: (state) => {
        this.onStateChange(state);
      },
      onScoreChange: (score, event) => {
        this.onScoreChange(score, event);
      },
      onRoundEnd: (finalScore, events) => {
        this.onRoundEnd(finalScore, events);
      }
    });
  }
  
  private onStateChange(state: string): void {
    if (state === 'active') {
      // Show HUD when round starts
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    } else if (state === 'waiting') {
      // Hide HUD when waiting and reset score display
      this.container.style.opacity = '0';
      this.scoreElement.textContent = '0';
    } else if (state === 'ended') {
      // Keep HUD visible but muted when round ends
      this.container.style.opacity = '0.7';
    }
  }
  
  private onScoreChange(score: number, event: ScoreEvent): void {
    // Update score display
    this.scoreElement.textContent = score.toString();
    
    // Flash score element
    this.scoreElement.style.transform = 'scale(1.2)';
    this.scoreElement.style.color = '#00ff00';
    setTimeout(() => {
      this.scoreElement.style.transform = 'scale(1)';
    }, 150);
    
    // Show points popup
    this.showPointsPopup(event);
  }
  
  private onRoundEnd(_finalScore: number, _events: ScoreEvent[]): void {
    // Final score flash
    this.scoreElement.style.color = '#ffff00';
    this.scoreElement.style.transform = 'scale(1.3)';
    
    setTimeout(() => {
      this.scoreElement.style.transform = 'scale(1)';
    }, 300);
  }
  
  private showPointsPopup(event: ScoreEvent): void {
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 255, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      white-space: nowrap;
      z-index: 1001;
      animation: pointsPopup 2s ease-out forwards;
    `;
    
    // Create animation keyframes if not already added
    if (!document.querySelector('#pointsPopupAnimation')) {
      const style = document.createElement('style');
      style.id = 'pointsPopupAnimation';
      style.textContent = `
        @keyframes pointsPopup {
          0% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          20% {
            transform: translateX(-50%) translateY(-5px) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-30px) scale(0.9);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set popup content based on event type
    let emoji = '📊';
    let color = 'rgba(0, 255, 0, 0.9)';
    
    if (event.type === 'dummyKO') {
      emoji = '🎯';
      color = 'rgba(255, 100, 0, 0.9)';
    } else if (event.type === 'checkpoint') {
      emoji = '✅';
      color = 'rgba(0, 150, 255, 0.9)';
    } else if (event.type === 'lap') {
      emoji = '🏁';
      color = 'rgba(255, 215, 0, 0.9)';
    }
    
    popup.style.background = color;
    popup.textContent = `${emoji} +${event.points}`;
    
    this.pointsPopupContainer.appendChild(popup);
    
    // Remove popup after animation
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 2000);
  }
  
  private startUpdateLoop(): void {
    if (this.isDestroyed) return;
    
    this.updateInterval = window.setInterval(() => {
      if (this.isDestroyed) return;
      this.updateTimeDisplay();
    }, 100); // Update 10 times per second for smooth countdown
  }
  
  private updateTimeDisplay(): void {
    const roundInfo = this.roundSystem.getRoundInfo();
    
    if (roundInfo.state === 'active') {
      const minutes = Math.floor(roundInfo.timeRemaining / 60000);
      const seconds = Math.floor((roundInfo.timeRemaining % 60000) / 1000);
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      this.timeElement.textContent = timeString;
      
      // Color code based on remaining time
      if (roundInfo.timeRemaining < 30000) { // Last 30 seconds
        this.timeElement.style.color = '#ff3366'; // Neon red-pink
        this.timeElement.style.textShadow = '0 0 15px rgba(255, 51, 102, 0.8)';
        if (roundInfo.timeRemaining < 10000) { // Last 10 seconds
          this.timeElement.style.color = '#ff0066'; // Bright neon red
          this.timeElement.style.textShadow = '0 0 20px rgba(255, 0, 102, 1)';
          // Pulse effect for urgency
          const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
          this.timeElement.style.opacity = (0.7 + pulse * 0.3).toString();
        }
      } else if (roundInfo.timeRemaining < 60000) { // Last minute
        this.timeElement.style.color = '#ff8800'; // Neon orange
        this.timeElement.style.textShadow = '0 0 12px rgba(255, 136, 0, 0.6)';
      } else {
        this.timeElement.style.color = '#00ffff'; // Neon cyan
        this.timeElement.style.textShadow = '0 0 8px rgba(0, 255, 255, 0.6)';
        this.timeElement.style.opacity = '1';
      }
    } else {
      this.timeElement.style.color = '#00ffff';
      this.timeElement.style.textShadow = '0 0 8px rgba(0, 255, 255, 0.6)';
      this.timeElement.style.opacity = '1';
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Remove DOM elements safely
    try {
      if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      
      // Clean up any remaining popup elements
      if (this.pointsPopupContainer) {
        const popups = this.pointsPopupContainer.children;
        while (popups.length > 0) {
          this.pointsPopupContainer.removeChild(popups[0]);
        }
      }
      
      // Remove CSS animations we added
      const animationStyle = document.querySelector('#pointsPopupAnimation');
      if (animationStyle?.parentNode) {
        animationStyle.parentNode.removeChild(animationStyle);
      }
    } catch (error) {
      console.error('Error cleaning up ScoreHUD:', error);
    }
    
    console.log('🧹 ScoreHUD destroyed and cleaned up');
  }
} 