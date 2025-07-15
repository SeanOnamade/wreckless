import { AbilityManager } from './useAbility';
import { ABILITY_CONFIGS } from './classKit';

/**
 * Simple HUD component for displaying ability cooldown state
 * This demonstrates how the ability system can integrate with UI
 */
export class AbilityHUD {
  private container: HTMLDivElement;
  private abilityButton!: HTMLDivElement;
  private cooldownBar!: HTMLDivElement;
  private abilityName!: HTMLSpanElement;
  private cooldownText!: HTMLSpanElement;
  private abilityManager: AbilityManager;

  constructor(abilityManager: AbilityManager) {
    this.abilityManager = abilityManager;
    this.container = this.createHUD();
    this.startUpdateLoop();
  }

  private createHUD(): HTMLDivElement {
    // Create main container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 12px;
      color: white;
      font-family: monospace;
      font-size: 14px;
      min-width: 200px;
      z-index: 1000;
    `;

    // Ability name
    this.abilityName = document.createElement('span');
    this.abilityName.style.cssText = `
      display: block;
      font-weight: bold;
      margin-bottom: 4px;
      text-align: center;
    `;

    // Ability button (visual representation)
    this.abilityButton = document.createElement('div');
    this.abilityButton.style.cssText = `
      width: 40px;
      height: 40px;
      background: #333;
      border: 2px solid #555;
      border-radius: 6px;
      margin: 8px auto;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      transition: all 0.2s ease;
    `;
    this.abilityButton.textContent = 'E';

    // Cooldown bar
    this.cooldownBar = document.createElement('div');
    this.cooldownBar.style.cssText = `
      width: 100%;
      height: 6px;
      background: #333;
      border-radius: 3px;
      overflow: hidden;
      margin: 8px 0;
      position: relative;
    `;

    const cooldownFill = document.createElement('div');
    cooldownFill.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #00ff00, #00aa00);
      width: 100%;
      transition: width 0.1s ease;
      border-radius: 3px;
    `;
    this.cooldownBar.appendChild(cooldownFill);

    // Cooldown text
    this.cooldownText = document.createElement('span');
    this.cooldownText.style.cssText = `
      display: block;
      text-align: center;
      font-size: 12px;
      opacity: 0.8;
    `;

    // Instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 11px;
      opacity: 0.7;
      text-align: center;
    `;
    instructions.innerHTML = `
      Press <strong>E</strong> to use ability<br>
      <strong>1/2/3</strong> to switch class
    `;

    // Assemble the HUD
    container.appendChild(this.abilityName);
    container.appendChild(this.abilityButton);
    container.appendChild(this.cooldownBar);
    container.appendChild(this.cooldownText);
    container.appendChild(instructions);

    document.body.appendChild(container);
    return container;
  }

  private startUpdateLoop(): void {
    // PERFORMANCE FIX: Update UI at 15fps instead of 60fps for better efficiency
    const update = () => {
      const cooldownState = this.abilityManager.getCooldownState();
      const config = ABILITY_CONFIGS[cooldownState.className];

      // Update ability name
      this.abilityName.textContent = config.name;

      // Update button appearance
      if (cooldownState.isReady) {
        this.abilityButton.style.background = '#0066cc';
        this.abilityButton.style.borderColor = '#0088ff';
        this.abilityButton.style.boxShadow = '0 0 10px rgba(0, 136, 255, 0.5)';
      } else {
        this.abilityButton.style.background = '#333';
        this.abilityButton.style.borderColor = '#555';
        this.abilityButton.style.boxShadow = 'none';
      }

      // Update cooldown bar
      const fillElement = this.cooldownBar.firstElementChild as HTMLDivElement;
      if (fillElement) {
        fillElement.style.width = `${cooldownState.progress * 100}%`;
        
        if (cooldownState.isReady) {
          fillElement.style.background = 'linear-gradient(90deg, #00ff00, #00aa00)';
        } else {
          fillElement.style.background = 'linear-gradient(90deg, #ff6600, #cc4400)';
        }
      }

      // Update cooldown text
      if (cooldownState.isReady) {
        this.cooldownText.textContent = 'READY';
      } else {
        const remainingSeconds = (cooldownState.remainingTime / 1000).toFixed(1);
        this.cooldownText.textContent = `${remainingSeconds}s`;
      }
    };

    // Update every ~67ms (15fps) instead of every frame for better performance
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