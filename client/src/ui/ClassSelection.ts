import type { PlayerClass } from '../kits/classKit';
import { ABILITY_CONFIGS } from '../kits/classKit';
import type { GameStateManager } from '../state/GameStateManager';

// Character descriptions for the modal
const CHARACTER_DESCRIPTIONS = {
  blink: {
    title: 'Blink',
    description: `Blink is a high-efficiency cyborg operative from the 4100s, built for precision time-travel enforcement. Formerly a commander in a temporal regulation agency, he entered the time stream to investigate anomalies and never returned. Cold, calculated, and driven by duty, Blink is starting to suspect the truth: a version of himself may have designed the very prison he's now trapped in. His blink-dash allows him to phase through space in short bursts, bypassing obstacles with unshakable focus.`
  },
  blast: {
    title: 'Blast',
    description: `Blast is a chaotic genius from the modern era — a one-man fireworks factory who duct-taped together a functioning time machine in a Texas garage using explosives, pressure valves, and vibes. He time-traveled for the hell of it and landed himself in the cellblock of infinity. He has no intention of escaping. Every blast-jump he makes is another chance to laugh in the face of physics. Loud, reckless, and borderline unhinged, Blast sees the time prison as just another playground.`
  },
  grapple: {
    title: 'Swing',
    description: `Swing is a steampunk runaway from the 1800s, a curious inventor who built a grappling timepiece out of brass and leather to explore the ages. Idealistic and full of wonder, he entered the timestream to see a better future — and got stuck in its worst nightmare. He swings through the prison using arc-powered hookshots and whirring winches, hoping to find a way out… or at least chronicle the madness before it collapses. He's the hopeful heart of the trio.`
  }
};

export class ClassSelection {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private stateManager: GameStateManager;
  private subtitleElement!: HTMLParagraphElement;
  private boundKeydownHandler: (e: KeyboardEvent) => void;
  private characterModal?: HTMLDivElement;
  
  constructor(stateManager: GameStateManager) {
    this.stateManager = stateManager;
    
    // Bind event handler for proper cleanup
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    
    this.container = this.createUI();
    this.setupEventListeners();
    this.createCharacterModal();
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
    
    // Info bubble (question mark)
    const infoBubble = document.createElement('div');
    infoBubble.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.9);
      color: #000;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 10;
    `;
    infoBubble.textContent = '?';
    
    // Info bubble hover effects
    infoBubble.addEventListener('mouseenter', () => {
      infoBubble.style.background = '#00E6FF';
      infoBubble.style.color = '#000';
      infoBubble.style.transform = 'scale(1.1)';
    });
    
    infoBubble.addEventListener('mouseleave', () => {
      infoBubble.style.background = 'rgba(255, 255, 255, 0.9)';
      infoBubble.style.color = '#000';
      infoBubble.style.transform = 'scale(1)';
    });
    
    // Info bubble click handler
    infoBubble.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click
      this.showCharacterModal(className);
    });
    
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
    card.appendChild(infoBubble);
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
   * Create the character modal
   */
  private createCharacterModal(): void {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2200;
      backdrop-filter: blur(10px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(0, 17, 34, 0.95);
      padding: 40px;
      border-radius: 15px;
      border: 3px solid #00E6FF;
      max-width: 800px;
      min-width: 700px;
      box-shadow: 0 0 30px rgba(0, 230, 255, 0.3);
      position: relative;
    `;
    
    // Close button (X in top right)
    const closeButton = document.createElement('button');
    closeButton.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      background: #FF0080;
      color: white;
      border: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.hideCharacterModal());
    
    // Content container with flex layout
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      display: flex;
      gap: 30px;
      align-items: center;
      min-height: 300px;
    `;
    
    // Character portrait image on the left
    const imageContainer = document.createElement('div');
    imageContainer.style.cssText = `
      width: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;
    
    const portraitImage = document.createElement('img');
    portraitImage.style.cssText = `
      max-width: 100%;
      height: auto;
      object-fit: contain;
      display: block;
      border-radius: 12px;
    `;
    portraitImage.alt = 'Character Portrait';
    
    // Fallback div for loading/error states
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.cssText = `
      color: #888;
      font-size: 14px;
      text-align: center;
      display: none;
      padding: 20px;
    `;
    fallbackDiv.innerHTML = '<div>Portrait<br>Loading...</div>';
    
    imageContainer.appendChild(portraitImage);
    imageContainer.appendChild(fallbackDiv);
    
    // Text content on the right
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    `;
    
    const title = document.createElement('h2');
    title.style.cssText = `
      color: #FF0080;
      font-size: 28px;
      margin: 0 0 20px 0;
      text-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
      letter-spacing: 1px;
    `;
    
    const description = document.createElement('p');
    description.style.cssText = `
      color: #cccccc;
      font-size: 16px;
      line-height: 1.6;
      margin: 0;
      text-align: left;
    `;
    
    // Assemble the modal
    textContainer.appendChild(title);
    textContainer.appendChild(description);
    contentContainer.appendChild(imageContainer);
    contentContainer.appendChild(textContainer);
    modalContent.appendChild(closeButton);
    modalContent.appendChild(contentContainer);
    modal.appendChild(modalContent);
    
    // Store references for easy updates
    modal.setAttribute('data-title', '');
    modal.setAttribute('data-description', '');
    
    document.body.appendChild(modal);
    this.characterModal = modal;
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideCharacterModal();
      }
    });
  }

  /**
   * Show the character modal
   */
  public showCharacterModal(className: PlayerClass): void {
    if (!this.characterModal) {
      console.error('Character modal not initialized.');
      return;
    }
    const characterData = CHARACTER_DESCRIPTIONS[className];
    if (characterData) {
      const title = this.characterModal.querySelector('h2')!;
      const description = this.characterModal.querySelector('p')!;
      const portraitImage = this.characterModal.querySelector('img')!;
      const fallbackDiv = this.characterModal.querySelector('div[style*="display: none"]')! as HTMLDivElement;
      
      // Map class names to portrait file names
      const portraitMap = {
        blast: 'blast_portrait.png',
        grapple: 'swing_portrait.png', // grapple class uses swing portrait
        blink: 'blink_portrait.png'
      };
      
      // Update text content
      title.textContent = characterData.title;
      description.textContent = characterData.description;
      
      // Load character portrait
      const portraitPath = `/assets/${portraitMap[className]}`;
      portraitImage.style.display = 'block';
      fallbackDiv.style.display = 'none';
      
      // Handle image loading
      portraitImage.onload = () => {
        portraitImage.style.display = 'block';
        fallbackDiv.style.display = 'none';
      };
      
      portraitImage.onerror = () => {
        console.warn(`Failed to load portrait: ${portraitPath}`);
        portraitImage.style.display = 'none';
        fallbackDiv.style.display = 'block';
        fallbackDiv.innerHTML = '<div>Portrait<br>Unavailable</div>';
      };
      
      portraitImage.src = portraitPath;
      this.characterModal.style.display = 'flex';
    } else {
      console.warn(`No description found for class: ${className}`);
    }
  }

  /**
   * Hide the character modal
   */
  public hideCharacterModal(): void {
    if (this.characterModal) {
      this.characterModal.style.display = 'none';
    }
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
    if (this.characterModal && this.characterModal.parentNode) {
      this.characterModal.parentNode.removeChild(this.characterModal);
    }
    console.log('🧹 ClassSelection destroyed');
  }
} 