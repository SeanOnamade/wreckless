/**
 * Health HUD - Beautiful health bar for PvP combat
 * Displays in bottom-left with smooth animations and damage effects
 */

import { gameStateManager } from '../state/GameStateManager.js';
import { type PlayerClass } from '../kits/classKit.js';

export class HealthHUD {
  private container!: HTMLDivElement;
  private healthBar!: HTMLDivElement;
  private healthFill!: HTMLDivElement;
  private healthText!: HTMLSpanElement;
  private damageFlash!: HTMLDivElement;
  private healthLabel!: HTMLDivElement;
  
  private currentHealth = 100;
  private maxHealth = 100;
  private isRegenerating = false;
  private tf2Style = false;
  
  // MEMORY LEAK FIX: Track event listeners for cleanup
  private eventListeners: Array<{ target: EventTarget, type: string, handler: EventListener }> = [];
  private isDestroyed = false;
  
  constructor() {
    // Initialize TF2 style from localStorage
    this.tf2Style = localStorage.getItem('tf2-hud-enabled') === 'true';
    
    this.createHUD();
    this.setupEventListeners();
    console.log('💚 Health HUD initialized');
  }

  /**
   * Get class-specific heart emoji for health display
   */
  private getClassHeartEmoji(): string {
    const currentClass = gameStateManager.getContext().selectedClass;
    
    switch (currentClass) {
      case 'blast':
        return '❤️'; // Red heart for blast
      case 'blink':
        return '💙'; // Blue heart for blink  
      case 'grapple':
      default:
        return '💚'; // Green heart for grapple (default)
    }
  }

  /**
   * Update the health label to reflect current class
   */
  public updateClassStyling(): void {
    if (this.healthLabel) {
      if (this.tf2Style) {
        // Hide HP label in TF2 style
        this.healthLabel.style.display = 'none';
      } else {
        this.healthLabel.style.display = 'block';
        this.healthLabel.textContent = `${this.getClassHeartEmoji()} HEALTH`;
      }
    }
    
    // Update TF2 portrait if in TF2 mode
    if (this.tf2Style) {
      const currentClass = gameStateManager.getContext().selectedClass;
      if (currentClass) {
        this.updateTF2Portrait(currentClass);
        this.updateTF2ClassColors();
      }
    }
  }

  /**
   * Recreate HUD when style changes
   */
  private recreateHUD(): void {
    // Remove existing HUD
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Recreate with new style
    this.createHUD();
    
    // Restore current health values
    this.updateHealth(this.currentHealth, this.maxHealth);
  }

  private createHUD(): void {
    if (this.tf2Style) {
      this.createTF2StyleHUD();
    } else {
      this.createStylizedHUD();
    }
  }

  /**
   * Create TF2-style compact HUD
   */
  private createTF2StyleHUD(): void {
    // Main container - TF2 style positioned in bottom left corner
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 1000;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      display: flex;
      align-items: flex-end;
      gap: 24px;
    `;

    // Character portrait container (TF2 style with angle)
    const portraitContainer = this.createTF2Portrait();
    
    // Health number (large, like TF2) - will be colored by class
    const healthNumber = document.createElement('div');
    healthNumber.style.cssText = `
      color: white;
      font-size: 96px;
      font-weight: bold;
      text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.8);
      line-height: 1;
      margin-bottom: 16px;
      transition: color 0.3s ease;
    `;
    healthNumber.textContent = '100';
    healthNumber.id = 'tf2-health-number';

    // Create health bar but hide it (for compatibility with existing update methods)
    this.healthBar = document.createElement('div');
    this.healthBar.style.display = 'none';
    this.healthFill = document.createElement('div');
    this.healthText = document.createElement('span');
    this.damageFlash = document.createElement('div');
    this.healthBar.appendChild(this.healthFill);
    this.healthBar.appendChild(this.healthText);
    this.healthBar.appendChild(this.damageFlash);

    // Create health label but hide it for TF2 style
    this.healthLabel = document.createElement('div');
    this.healthLabel.style.display = 'none';

    // Assemble main container
    this.container.appendChild(portraitContainer);
    this.container.appendChild(healthNumber);
    this.container.appendChild(this.healthBar); // Hidden but present for compatibility
    
    document.body.appendChild(this.container);

    // Set initial health display and apply class colors
    this.updateHealth(100, 100);
    this.updateTF2ClassColors();
  }

  /**
   * Create TF2-style character portrait with angled frame
   */
  private createTF2Portrait(): HTMLDivElement {
    const portraitContainer = document.createElement('div');
    portraitContainer.style.cssText = `
      position: relative;
      width: 160px;
      height: 128px;
      transform: rotate(8deg);
      transform-origin: bottom center;
    `;

    // Colored background behind the portrait (aligned with diagonal line)
    const coloredBackground = document.createElement('div');
    coloredBackground.style.cssText = `
      position: absolute;
      width: 160px;
      height: 110px;
      top: -30px;
      left: 0px;
      background: rgba(100, 100, 100, 0.3);
      clip-path: polygon(0% 0%, 100% 0%, 100% 88%, 0% 100%);
      border-radius: 8px;
      transition: background 0.3s ease;
      z-index: 0;
    `;
    coloredBackground.id = 'tf2-portrait-background';

    // Portrait image (will be clipped by diagonal line)
    const portraitImage = document.createElement('img');
    portraitImage.style.cssText = `
      position: absolute;
      width: 180px;
      height: 180px;
      top: -50px;
      left: -10px;
      object-fit: contain;
      filter: drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.8));
      clip-path: polygon(0% 0%, 100% 0%, 100% 60%, 0% 80%);
      z-index: 1;
    `;
    portraitImage.id = 'tf2-portrait-image';
    
    // Set initial portrait
    this.updateTF2Portrait(gameStateManager.getContext().selectedClass || 'grapple');
    
    // Diagonal line (stylistic cutoff) - will be colored by class
    const diagonalLine = document.createElement('div');
    diagonalLine.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 0px;
      width: 160px;
      height: 6px;
      background: linear-gradient(90deg, 
        rgba(255, 255, 255, 0.8) 0%,
        rgba(200, 200, 200, 0.6) 50%,
        rgba(255, 255, 255, 0.8) 100%
      );
      box-shadow: 
        0 2px 4px rgba(0, 0, 0, 0.6),
        0 -2px 2px rgba(255, 255, 255, 0.3);
      transition: background 0.3s ease;
      z-index: 2;
    `;
    diagonalLine.id = 'tf2-diagonal-line';

    portraitContainer.appendChild(coloredBackground);
    portraitContainer.appendChild(portraitImage);
    portraitContainer.appendChild(diagonalLine);
    
    return portraitContainer;
  }

  /**
   * Update TF2 HUD colors based on current class
   */
  private updateTF2ClassColors(): void {
    const currentClass = gameStateManager.getContext().selectedClass;
    if (!currentClass) return;

    // Get class colors
    const classColors = {
      'blink': { main: '#2196F3', light: '#64B5F6', dark: '#1565C0' },
      'blast': { main: '#F44336', light: '#EF5350', dark: '#C62828' },
      'grapple': { main: '#4CAF50', light: '#66BB6A', dark: '#2E7D32' }
    };

    const colors = classColors[currentClass] || classColors['grapple'];

    // Update health number color
    const healthNumber = document.getElementById('tf2-health-number');
    if (healthNumber) {
      healthNumber.style.color = colors.light;
      healthNumber.style.textShadow = `
        2px 2px 4px rgba(0, 0, 0, 0.8),
        0 0 8px ${colors.main}40
      `;
    }

    // Update diagonal line color
    const diagonalLine = document.getElementById('tf2-diagonal-line');
    if (diagonalLine) {
      diagonalLine.style.background = `linear-gradient(90deg, 
        ${colors.light}E0 0%,
        ${colors.main}C0 50%,
        ${colors.light}E0 100%
      )`;
      diagonalLine.style.boxShadow = `
        0 1px 2px rgba(0, 0, 0, 0.6),
        0 -1px 1px rgba(255, 255, 255, 0.3),
        0 0 4px ${colors.main}60
      `;
    }

    // Update background color with transparency gradient
    const background = document.getElementById('tf2-portrait-background');
    if (background) {
      background.style.background = `linear-gradient(180deg, 
        ${colors.main}60 0%,
        ${colors.main}50 30%,
        ${colors.main}30 60%,
        ${colors.main}10 80%,
        transparent 100%
      )`;
    }
  }

  /**
   * Update TF2 portrait image based on class
   */
  private updateTF2Portrait(className: PlayerClass): void {
    const portraitImage = document.getElementById('tf2-portrait-image') as HTMLImageElement;
    if (portraitImage) {
      portraitImage.src = `/assets/portraits/tf2-style/${className}.png`;
      portraitImage.onerror = () => {
        // Fallback to a default if PNG not found
        console.warn(`TF2 portrait not found for ${className}, using fallback`);
        portraitImage.style.display = 'none';
      };
      portraitImage.onload = () => {
        portraitImage.style.display = 'block';
        console.log(`🖼️ TF2 portrait loaded for ${className}`);
      };
    }
  }

  /**
   * Create stylized HUD (original design)
   */
  private createStylizedHUD(): void {
    // Main container - positioned under the left-aligned portrait
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
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
    this.healthLabel = document.createElement('div');
    this.healthLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
      text-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
      letter-spacing: 1px;
    `;
    this.healthLabel.textContent = `${this.getClassHeartEmoji()} HEALTH`;

    // Assemble components
    this.healthFill.appendChild(shine);
    this.healthBar.appendChild(this.healthFill);
    this.healthBar.appendChild(this.healthText);
    this.healthBar.appendChild(this.damageFlash);
    this.healthBar.appendChild(regenPulse);
    
    this.container.appendChild(this.healthLabel);
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

  /**
   * Setup event listeners for health and class changes
   */
  private setupEventListeners(): void {
    // Listen for health changes
    this.addEventListenerSafe(window, 'playerHealthChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { current, max } = customEvent.detail;
      this.updateHealth(current, max);
    });

    // Listen for damage events for flash effect
    this.addEventListenerSafe(window, 'playerTakeDamage', () => {
      this.flashDamage();
    });

    // Listen for regeneration state changes
    this.addEventListenerSafe(window, 'playerRegenStateChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.setRegenerating(customEvent.detail.isRegenerating);
    });

    // Listen for player class changes to update heart emoji
    this.addEventListenerSafe(window, 'playerClassChanged', () => {
      this.updateClassStyling();
    });

    // Listen for HUD style changes
    this.addEventListenerSafe(window, 'hudStyleChanged', (event: any) => {
      this.tf2Style = event.detail.tf2Style;
      this.recreateHUD();
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
    
    // Update TF2 health number if in TF2 mode
    if (this.tf2Style) {
      const healthNumber = document.getElementById('tf2-health-number');
      if (healthNumber) {
        healthNumber.textContent = current.toString();
      }
    }
    
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
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Remove all event listeners
    this.eventListeners.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler);
    });
    this.eventListeners = [];

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  // MEMORY LEAK FIX: Safe event listener management
  private addEventListenerSafe(target: EventTarget, type: string, handler: EventListener): void {
    if (this.isDestroyed) return;
    target.addEventListener(type, handler);
    this.eventListeners.push({ target, type, handler });
  }
} 