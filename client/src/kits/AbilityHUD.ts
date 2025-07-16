import { AbilityManager } from './useAbility';
import { ABILITY_CONFIGS } from './classKit';

/**
 * Enhanced HUD component for displaying ability cooldown state with visual feedback
 */
export class AbilityHUD {
  private container: HTMLDivElement;
  private abilityButton!: HTMLDivElement;
  private cooldownBar!: HTMLDivElement;
  private abilityName!: HTMLSpanElement;
  private cooldownText!: HTMLSpanElement;
  private abilityManager: AbilityManager;
  private wasOnCooldown: boolean = false;
  // Removed _lastAbilityUsedTime - unused timing variable
  private flashOverlay!: HTMLDivElement;
  private instructions!: HTMLDivElement;

  constructor(abilityManager: AbilityManager) {
    this.abilityManager = abilityManager;
    this.container = this.createHUD();
    this.startUpdateLoop();
  }

  private getAbilityColors(className: string) {
    const colorConfigs = {
      grapple: {
        ready: { bg: 'linear-gradient(145deg, #00aa55, #005533)', border: '#00ff88', shadow: 'rgba(0, 255, 136, 0.4)' },
        cooldown: { bg: 'linear-gradient(145deg, #444, #222)', border: '#555', shadow: 'rgba(0, 0, 0, 0.3)' },
        bar: { ready: 'linear-gradient(90deg, #00ff88, #00aa55)', cooldown: 'linear-gradient(90deg, #666, #333)' },
        text: '#00ff88',
        flashBg: 'rgba(0, 255, 136, 0.3)'
      },
      blink: {
        ready: { bg: 'linear-gradient(145deg, #0066cc, #003366)', border: '#0088ff', shadow: 'rgba(0, 136, 255, 0.4)' },
        cooldown: { bg: 'linear-gradient(145deg, #444, #222)', border: '#555', shadow: 'rgba(0, 0, 0, 0.3)' },
        bar: { ready: 'linear-gradient(90deg, #00aaff, #0066cc)', cooldown: 'linear-gradient(90deg, #666, #333)' },
        text: '#00aaff',
        flashBg: 'rgba(0, 170, 255, 0.3)'
      },
      blast: {
        ready: { bg: 'linear-gradient(145deg, #cc3300, #663300)', border: '#ff4400', shadow: 'rgba(255, 68, 0, 0.4)' },
        cooldown: { bg: 'linear-gradient(145deg, #444, #222)', border: '#555', shadow: 'rgba(0, 0, 0, 0.3)' },
        bar: { ready: 'linear-gradient(90deg, #ff6600, #cc3300)', cooldown: 'linear-gradient(90deg, #666, #333)' },
        text: '#ff6600',
        flashBg: 'rgba(255, 102, 0, 0.3)'
      }
    };
    
    return colorConfigs[className as keyof typeof colorConfigs] || colorConfigs.grapple;
  }

  private updateInstructions(currentAbilityColor: string): void {
    this.instructions.innerHTML = `
      Press <strong style="color: ${currentAbilityColor};">E</strong> to use ability<br>
      <strong style="color: #ff6600;">1</strong>/<strong style="color: #00ff88;">2</strong>/<strong style="color: #00aaff;">3</strong> to switch class
    `;
  }

  private createHUD(): HTMLDivElement {
    // Create main container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 16px;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      min-width: 220px;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(5px);
      transition: all 0.3s ease;
    `;

    // Flash overlay for the container (will be updated dynamically)
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle, rgba(0, 255, 136, 0.3), transparent);
      border-radius: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    `;
    container.appendChild(this.flashOverlay);

    // Content container
    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.zIndex = '2';

    // Ability name
    this.abilityName = document.createElement('span');
    this.abilityName.style.cssText = `
      display: block;
      font-weight: bold;
      margin-bottom: 8px;
      text-align: center;
      font-size: 16px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    `;

    // Ability button (visual representation)
    this.abilityButton = document.createElement('div');
    this.abilityButton.style.cssText = `
      width: 50px;
      height: 50px;
      background: linear-gradient(145deg, #444, #222);
      border: 3px solid #555;
      border-radius: 10px;
      margin: 12px auto;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 20px;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 5px rgba(255, 255, 255, 0.1), 0 4px 10px rgba(0, 0, 0, 0.3);
    `;
    this.abilityButton.textContent = 'E';

    // Cooldown bar container
    const cooldownContainer = document.createElement('div');
    cooldownContainer.style.cssText = `
      margin: 12px 0;
      position: relative;
    `;

    // Cooldown bar background
    this.cooldownBar = document.createElement('div');
    this.cooldownBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      border: 1px solid #555;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
    `;

    // Cooldown fill
    const cooldownFill = document.createElement('div');
    cooldownFill.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #00ff88, #00aa55);
      width: 100%;
      transition: width 0.1s ease, background 0.3s ease;
      border-radius: 4px;
      box-shadow: 0 0 8px rgba(0, 255, 136, 0.4);
    `;
    this.cooldownBar.appendChild(cooldownFill);

    // Animated shine effect for the cooldown bar
    const shine = document.createElement('div');
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
      animation: shine 2s infinite;
    `;
    this.cooldownBar.appendChild(shine);

    cooldownContainer.appendChild(this.cooldownBar);

    // Cooldown text
    this.cooldownText = document.createElement('span');
    this.cooldownText.style.cssText = `
      display: block;
      text-align: center;
      font-size: 13px;
      opacity: 0.9;
      margin-top: 8px;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    `;

    // Instructions
    this.instructions = document.createElement('div');
    this.instructions.style.cssText = `
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 11px;
      opacity: 0.7;
      text-align: center;
      line-height: 1.4;
    `;
    // Initial instructions - will be updated in the update loop
    this.updateInstructions('#00ff88');

    // Add CSS animation for shine effect
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shine {
        0% { left: -100%; }
        100% { left: 100%; }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      .ability-ready-pulse {
        animation: pulse 1s infinite;
      }
    `;
    document.head.appendChild(style);

    // Assemble the HUD
    content.appendChild(this.abilityName);
    content.appendChild(this.abilityButton);
    content.appendChild(cooldownContainer);
    content.appendChild(this.cooldownText);
    content.appendChild(this.instructions);
    
    container.appendChild(content);
    document.body.appendChild(container);
    return container;
  }

  private triggerCooldownCompleteEffect(colors: any): void {
    // Flash the HUD container with ability-specific color
    this.flashOverlay.style.background = `radial-gradient(circle, ${colors.flashBg}, transparent)`;
    this.flashOverlay.style.opacity = '1';
    setTimeout(() => {
      this.flashOverlay.style.opacity = '0';
    }, 300);

    // Flash the border with ability-specific color
    this.container.style.borderColor = colors.border;
    this.container.style.boxShadow = `0 0 20px ${colors.shadow}`;
    setTimeout(() => {
      this.container.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      this.container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.6)';
    }, 500);
  }

  private triggerAbilityUsedEffect(): void {
    // Brief button press animation
    this.abilityButton.style.transform = 'scale(0.9)';
    setTimeout(() => {
      this.abilityButton.style.transform = 'scale(1)';
    }, 150);
  }

  private startUpdateLoop(): void {
    const update = () => {
      const cooldownState = this.abilityManager.getCooldownState();
      const config = ABILITY_CONFIGS[cooldownState.className];
      const colors = this.getAbilityColors(cooldownState.className);

      // Update ability name
      this.abilityName.textContent = config.name;

      // Update instructions with current ability color
      this.updateInstructions(colors.text);

      // Update flash overlay background color for current ability
      this.flashOverlay.style.background = `radial-gradient(circle, ${colors.flashBg}, transparent)`;

            // Check if ability was just used
      if (cooldownState.remainingTime > 0 && !this.wasOnCooldown) {
        this.triggerAbilityUsedEffect();
      }

      // Check if cooldown just completed
      if (this.wasOnCooldown && cooldownState.isReady) {
        this.triggerCooldownCompleteEffect(colors.ready);
      }

      // Update button appearance with ability-specific colors
      if (cooldownState.isReady) {
        this.abilityButton.style.background = colors.ready.bg;
        this.abilityButton.style.borderColor = colors.ready.border;
        this.abilityButton.style.boxShadow = `inset 0 2px 5px rgba(255, 255, 255, 0.1), 0 0 15px ${colors.ready.shadow}`;
        this.abilityButton.style.color = '#ffffff';
        this.abilityButton.classList.add('ability-ready-pulse');
      } else {
        this.abilityButton.style.background = colors.cooldown.bg;
        this.abilityButton.style.borderColor = colors.cooldown.border;
        this.abilityButton.style.boxShadow = `inset 0 2px 5px rgba(255, 255, 255, 0.1), 0 4px 10px ${colors.cooldown.shadow}`;
        this.abilityButton.style.color = '#999';
        this.abilityButton.classList.remove('ability-ready-pulse');
      }

      // Update cooldown bar with ability-specific colors
      const fillElement = this.cooldownBar.firstElementChild as HTMLDivElement;
      if (fillElement) {
        fillElement.style.width = `${cooldownState.progress * 100}%`;
        
        if (cooldownState.isReady) {
          fillElement.style.background = colors.bar.ready;
          fillElement.style.boxShadow = `0 0 8px ${colors.ready.shadow}`;
        } else {
          fillElement.style.background = colors.bar.cooldown;
          fillElement.style.boxShadow = `0 0 8px ${colors.ready.shadow}`;
        }
      }

      // Update cooldown text with ability-specific colors
      if (cooldownState.isReady) {
        this.cooldownText.textContent = '✨ READY ✨';
        this.cooldownText.style.color = colors.text;
      } else {
        const remainingSeconds = (cooldownState.remainingTime / 1000).toFixed(1);
        this.cooldownText.textContent = `${remainingSeconds}s`;
        this.cooldownText.style.color = '#ffaa00';
      }

      // Track cooldown state for next frame
      this.wasOnCooldown = !cooldownState.isReady;
    };

    // Update every ~67ms (15fps) for better performance
    setInterval(update, 67);
  }

  /**
   * Remove the HUD from the DOM
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 