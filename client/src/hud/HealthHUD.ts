/**
 * Health HUD - Beautiful health bar for PvP combat
 * Displays in bottom-left with smooth animations and damage effects
 */

export class HealthHUD {
  private container!: HTMLDivElement;
  private healthBar!: HTMLDivElement;
  private healthFill!: HTMLDivElement;
  private healthText!: HTMLSpanElement;
  private damageFlash!: HTMLDivElement;
  
  private currentHealth = 100;
  private maxHealth = 100;
  private isRegenerating = false;
  
  constructor() {
    this.createHUD();
    this.setupEventListeners();
    console.log('💚 Health HUD initialized');
  }

  private createHUD(): void {
    // Main container - bottom left positioning
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 30px;
      z-index: 1000;
      pointer-events: none;
      font-family: 'Courier New', monospace;
    `;

    // Health bar background
    this.healthBar = document.createElement('div');
    this.healthBar.style.cssText = `
      width: 300px;
      height: 20px;
      background: linear-gradient(145deg, rgba(20, 20, 20, 0.9), rgba(40, 40, 40, 0.9));
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      box-shadow: 
        0 0 20px rgba(0, 0, 0, 0.8),
        inset 0 2px 4px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(5px);
    `;

    // Health fill (the red/green part)
    this.healthFill = document.createElement('div');
    this.healthFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, 
        #ff4444 0%, 
        #ff6666 50%, 
        #ff8888 100%
      );
      transition: width 0.3s ease-out, background 0.5s ease-out;
      border-radius: 10px;
      position: relative;
      overflow: hidden;
    `;

    // Shine effect on health bar
    const shine = document.createElement('div');
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, 
        transparent 0%, 
        rgba(255, 255, 255, 0.4) 50%, 
        transparent 100%
      );
      animation: shine 3s ease-in-out infinite;
    `;

    // Health text overlay
    this.healthText = document.createElement('span');
    this.healthText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 
        0 0 10px rgba(0, 0, 0, 0.8),
        0 1px 2px rgba(0, 0, 0, 1);
      z-index: 10;
      pointer-events: none;
    `;
    this.healthText.textContent = '100 / 100';

    // Damage flash overlay
    this.damageFlash = document.createElement('div');
    this.damageFlash.style.cssText = `
      position: absolute;
      top: -5px;
      left: -5px;
      right: -5px;
      bottom: -5px;
      background: radial-gradient(circle, rgba(255, 0, 0, 0.8) 0%, transparent 70%);
      border-radius: 15px;
      opacity: 0;
      pointer-events: none;
      z-index: 5;
    `;

    // Regeneration pulse effect
    const regenPulse = document.createElement('div');
    regenPulse.style.cssText = `
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border: 2px solid #66ff66;
      border-radius: 14px;
      opacity: 0;
      animation: regenPulse 2s ease-in-out infinite;
    `;

    // Label above health bar
    const label = document.createElement('div');
    label.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
      text-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
      letter-spacing: 1px;
    `;
    label.textContent = '💚 HEALTH';

    // Assemble components
    this.healthFill.appendChild(shine);
    this.healthBar.appendChild(this.healthFill);
    this.healthBar.appendChild(this.healthText);
    this.healthBar.appendChild(this.damageFlash);
    this.healthBar.appendChild(regenPulse);
    
    this.container.appendChild(label);
    this.container.appendChild(this.healthBar);
    document.body.appendChild(this.container);

    // Add CSS animations
    this.addAnimations();
    
    // Set initial health display (green for 100/100)
    this.updateHealth(100, 100);
  }

  private addAnimations(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shine {
        0% { left: -100%; }
        50% { left: 100%; }
        100% { left: 100%; }
      }
      
      @keyframes regenPulse {
        0%, 100% { 
          opacity: 0; 
          transform: scale(1); 
        }
        50% { 
          opacity: 0.6; 
          transform: scale(1.05); 
        }
      }
      
      @keyframes damageShake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
        20%, 40%, 60%, 80% { transform: translateX(2px); }
      }
      
      @keyframes lowHealthPulse {
        0%, 100% { 
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
        }
        50% { 
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    // Listen for health changes
    window.addEventListener('playerHealthChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { current, max } = customEvent.detail;
      this.updateHealth(current, max);
    });

    // Listen for damage events for flash effect
    window.addEventListener('playerTakeDamage', () => {
      this.flashDamage();
    });

    // Listen for regeneration state changes
    window.addEventListener('playerRegenStateChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.setRegenerating(customEvent.detail.isRegenerating);
    });
  }

  private updateHealth(current: number, max: number): void {
    this.currentHealth = current;
    this.maxHealth = max;
    
    const percentage = (current / max) * 100;
    
    // Update health bar width
    this.healthFill.style.width = `${percentage}%`;
    
    // Update text
    this.healthText.textContent = `${current} / ${max}`;
    
    // Update colors based on health percentage
    if (percentage > 75) {
      // Healthy - green gradient
      this.healthFill.style.background = `linear-gradient(90deg, 
        #44ff44 0%, 
        #66ff66 50%, 
        #88ff88 100%
      )`;
      this.healthBar.style.animation = '';
    } else if (percentage > 50) {
      // Moderate - yellow gradient  
      this.healthFill.style.background = `linear-gradient(90deg, 
        #ffff44 0%, 
        #ffff66 50%, 
        #ffff88 100%
      )`;
      this.healthBar.style.animation = '';
    } else if (percentage > 25) {
      // Low - orange gradient
      this.healthFill.style.background = `linear-gradient(90deg, 
        #ff8844 0%, 
        #ffaa66 50%, 
        #ffcc88 100%
      )`;
      this.healthBar.style.animation = '';
    } else if (percentage > 0) {
      // Critical - red gradient with pulse
      this.healthFill.style.background = `linear-gradient(90deg, 
        #ff4444 0%, 
        #ff6666 50%, 
        #ff8888 100%
      )`;
      this.healthBar.style.animation = 'lowHealthPulse 1s ease-in-out infinite';
    } else {
      // Dead - dark red
      this.healthFill.style.background = '#662222';
      this.healthBar.style.animation = '';
    }

    // Show regeneration effect
    const regenPulse = this.healthBar.querySelector('div:last-child') as HTMLDivElement;
    if (this.isRegenerating && percentage < 100) {
      regenPulse.style.display = 'block';
    } else {
      regenPulse.style.display = 'none';
    }
  }

  private flashDamage(): void {
    // Damage flash effect
    this.damageFlash.style.opacity = '1';
    this.damageFlash.style.transition = 'opacity 0.1s ease-out';
    
    setTimeout(() => {
      this.damageFlash.style.opacity = '0';
      this.damageFlash.style.transition = 'opacity 0.3s ease-out';
    }, 100);

    // Shake effect
    this.healthBar.style.animation = 'damageShake 0.5s ease-out';
    setTimeout(() => {
      this.healthBar.style.animation = '';
    }, 500);
  }

  /**
   * Set regeneration state for visual effects
   */
  setRegenerating(isRegen: boolean): void {
    this.isRegenerating = isRegen;
    this.updateHealth(this.currentHealth, this.maxHealth);
  }

  /**
   * Cleanup when destroying
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 