import type { PlayerClass } from '../kits/classKit';
import { ABILITY_CONFIGS } from '../kits/classKit';
import type { GameStateManager } from '../state/GameStateManager';

export class ClassSelection {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private stateManager: GameStateManager;
  private subtitleElement!: HTMLParagraphElement;
  private boundKeydownHandler: (e: KeyboardEvent) => void;
  
  constructor(stateManager: GameStateManager) {
    this.stateManager = stateManager;
    
    // Bind event handler for proper cleanup
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    
    this.container = this.createUI();
    this.setupEventListeners();
    console.log('🎯 ClassSelection component created');
  }
  
  /**
   * Show the class selection screen
   */
  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
    
    // Update subtitle with current mode from context
    const currentMode = this.stateManager.getContext().gameMode;
    this.subtitleElement.textContent = `${currentMode === 'singleplayer' ? 'Singleplayer' : 'Multiplayer'} Mode`;
    
    console.log('🎯 ClassSelection shown');
    
    // Exit pointer lock when menu shows
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  
  /**
   * Hide the class selection screen
   */
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    console.log('🎯 ClassSelection hidden');
  }
  
  /**
   * Check if class selection is visible
   */
  public isOpen(): boolean {
    return this.isVisible;
  }
  
  /**
   * Create the class selection UI
   */
  private createUI(): HTMLDivElement {
    // Main container (fullscreen overlay)
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, 
        rgba(0, 17, 34, 0.95) 0%, 
        rgba(0, 34, 68, 0.92) 50%, 
        rgba(0, 17, 34, 0.95) 100%);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2100;
      font-family: monospace;
      color: white;
      backdrop-filter: blur(10px);
    `;
    
    // Main content area
    const content = document.createElement('div');
    content.style.cssText = `
      background: rgba(0, 17, 34, 0.95);
      padding: 50px 60px;
      border-radius: 15px;
      border: 3px solid #00E6FF;
      text-align: center;
      max-width: 700px;
      min-width: 600px;
      box-shadow: 0 0 30px rgba(0, 230, 255, 0.3);
      position: relative;
    `;
    
    // Title
    const title = document.createElement('h1');
    title.style.cssText = `
      margin: 0 0 15px 0;
      color: #FF0080;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
      letter-spacing: 2px;
    `;
    title.textContent = 'CHOOSE YOUR CLASS';
    
    // Subtitle
    this.subtitleElement = document.createElement('p');
    this.subtitleElement.style.cssText = `
      margin: 0 0 40px 0;
      color: #00E6FF;
      font-size: 16px;
      font-weight: normal;
      text-shadow: 0 0 10px rgba(0, 230, 255, 0.5);
    `;
    // Will be updated in show() method with current context
    
    // Class container
    const classContainer = document.createElement('div');
    classContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 25px;
      margin: 30px 0;
    `;
    
    // Create class cards
    const blastCard = this.createClassCard('blast', '🚀', '#ff6666', '1');
    const grappleCard = this.createClassCard('grapple', '🪝', '#66ff66', '2');
    const blinkCard = this.createClassCard('blink', '⚡', '#6666ff', '3');
    
    classContainer.appendChild(blastCard);
    classContainer.appendChild(grappleCard);
    classContainer.appendChild(blinkCard);
    
    // Back button
    const backButton = this.createButton('🏠 BACK TO MENU', '#666666', 'white');
    backButton.addEventListener('click', () => {
      this.handleBackClick();
    });
    
    // Instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 14px;
      color: #cccccc;
    `;
    instructions.innerHTML = `
      <div style="margin-bottom: 10px; color: #00E6FF;">Click a class or press 1/2/3 keys</div>
      <div style="font-size: 12px; color: #888;">You can change classes during gameplay with number keys</div>
    `;
    
    // Assemble the UI
    content.appendChild(title);
    content.appendChild(this.subtitleElement);
    content.appendChild(classContainer);
    content.appendChild(instructions);
    content.appendChild(backButton);
    
    container.appendChild(content);
    document.body.appendChild(container);
    
    return container;
  }
  
  /**
   * Create a class selection card
   */
  private createClassCard(className: PlayerClass, emoji: string, color: string, hotkey: string): HTMLDivElement {
    const config = ABILITY_CONFIGS[className];
    
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(0, 17, 34, 0.8);
      border: 2px solid ${color};
      border-radius: 12px;
      padding: 25px 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      min-height: 180px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    
    // Hotkey indicator
    const hotkeyBadge = document.createElement('div');
    hotkeyBadge.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: ${color};
      color: #000;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    `;
    hotkeyBadge.textContent = hotkey;
    
    // Emoji icon
    const icon = document.createElement('div');
    icon.style.cssText = `
      font-size: 48px;
      margin-bottom: 15px;
      text-align: center;
    `;
    icon.textContent = emoji;
    
    // Class name
    const name = document.createElement('div');
    name.style.cssText = `
      color: ${color};
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
      text-align: center;
    `;
    name.textContent = className;
    
    // Ability name
    const abilityName = document.createElement('div');
    abilityName.style.cssText = `
      color: #cccccc;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      text-align: center;
    `;
    abilityName.textContent = config.name;
    
    // Description
    const description = document.createElement('div');
    description.style.cssText = `
      color: #999;
      font-size: 12px;
      line-height: 1.4;
      text-align: center;
      margin-bottom: 10px;
    `;
    description.textContent = config.description;
    
    // Cooldown
    const cooldown = document.createElement('div');
    cooldown.style.cssText = `
      color: #666;
      font-size: 11px;
      text-align: center;
    `;
    cooldown.textContent = `Cooldown: ${config.cooldownDuration / 1000}s`;
    
    // Hover effects
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = color;
      card.style.boxShadow = `0 6px 25px rgba(0, 0, 0, 0.4), 0 0 20px ${color}40`;
      card.style.transform = 'translateY(-5px)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = color;
      card.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
      card.style.transform = 'translateY(0)';
    });
    
    // Click handler
    card.addEventListener('click', () => {
      this.handleClassSelect(className);
    });
    
    // Assemble card
    card.appendChild(hotkeyBadge);
    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(abilityName);
    card.appendChild(description);
    card.appendChild(cooldown);
    
    return card;
  }
  
  /**
   * Create a styled button
   */
  private createButton(text: string, bgColor: string, textColor: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.style.cssText = `
      background: ${bgColor};
      color: ${textColor};
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
      font-size: 14px;
      letter-spacing: 1px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      margin-top: 20px;
    `;
    button.textContent = text;
    
    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    });
    
    return button;
  }
  
  /**
   * Handle class selection
   */
  private handleClassSelect(className: PlayerClass): void {
    console.log(`🎯 Class selected: ${className}`);
    this.stateManager.selectClass(className);
  }
  
  /**
   * Handle back button click
   */
  private handleBackClick(): void {
    console.log('🏠 Returning to homescreen from class selection');
    this.stateManager.transitionTo('homescreen');
  }
  
  /**
   * Handle keydown events
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.isVisible) return;
    
    // Class selection hotkeys
    if (e.key === '1') {
      e.preventDefault();
      this.handleClassSelect('blast');
    } else if (e.key === '2') {
      e.preventDefault();
      this.handleClassSelect('grapple');
    } else if (e.key === '3') {
      e.preventDefault();
      this.handleClassSelect('blink');
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Handle keyboard shortcuts with bound handler for proper cleanup
    document.addEventListener('keydown', this.boundKeydownHandler);
  }
  
  /**
   * Cleanup
   */
  public destroy(): void {
    // Remove event listener to prevent memory leak
    document.removeEventListener('keydown', this.boundKeydownHandler);
    
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    console.log('🧹 ClassSelection destroyed');
  }
} 