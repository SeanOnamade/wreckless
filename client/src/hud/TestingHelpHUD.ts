/**
 * Testing Help HUD - On-screen overlay for V key testing commands
 * Positioned on far left, center height, toggleable with V key
 */

export class TestingHelpHUD {
  private container!: HTMLDivElement;
  private isVisible = false;
  
  constructor() {
    this.createHUD();
    this.setupEventListeners();
    console.log('🧪 Testing Help HUD initialized (press V to toggle)');
  }

  private createHUD(): void {
    // Main container - far left, center height
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 320px;
      background: linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 60, 0.95));
      color: white;
      padding: 20px;
      border-radius: 12px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      z-index: 2000;
      pointer-events: none;
      border: 2px solid rgba(0, 255, 255, 0.5);
      box-shadow: 
        0 0 30px rgba(0, 255, 255, 0.3),
        inset 0 2px 4px rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease-in-out;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      color: #00ffff;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 15px;
      text-align: center;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
      letter-spacing: 1px;
    `;
    header.textContent = '🧪 TESTING COMMANDS';

    // Keybinds section
    const keybindsSection = this.createKeybindsSection();
    
    // Combat controls section
    const combatSection = this.createCombatSection();
    
    // Current state section
    const stateSection = this.createStateSection();

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: 15px;
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      font-size: 11px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 10px;
    `;
    footer.textContent = 'Press V again to hide';

    // Assemble components
    this.container.appendChild(header);
    this.container.appendChild(keybindsSection);
    this.container.appendChild(combatSection);
    this.container.appendChild(stateSection);
    this.container.appendChild(footer);
    
    document.body.appendChild(this.container);
  }

  private createKeybindsSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 15px;
    `;

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
      color: #ffaa66;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
    `;
    sectionHeader.textContent = '⌨️ Testing Keybinds';

    const keybinds = [
      { key: 'V', action: 'Toggle this help menu' },
      { key: 'Shift+V', action: 'Take 30 damage (respects block)' },
      { key: 'Alt+V', action: 'Reset health to full' },
      { key: 'Shift+Ctrl+V', action: 'Test KO (100 damage)' },
              { key: 'Shift+Alt+V', action: 'Show PvP setup instructions (in console)' }
    ];

    section.appendChild(sectionHeader);

    keybinds.forEach(({ key, action }) => {
      const keybindElement = document.createElement('div');
      keybindElement.style.cssText = `
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const keyElement = document.createElement('span');
      keyElement.style.cssText = `
        color: #66ff66;
        font-weight: bold;
        min-width: 80px;
      `;
      keyElement.textContent = key;

      const actionElement = document.createElement('span');
      actionElement.style.cssText = `
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        flex: 1;
        margin-left: 10px;
      `;
      actionElement.textContent = action;

      keybindElement.appendChild(keyElement);
      keybindElement.appendChild(actionElement);
      section.appendChild(keybindElement);
    });

    return section;
  }

  private createCombatSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 15px;
    `;

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
      color: #ff6666;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
    `;
    sectionHeader.textContent = '⚔️ Combat Controls';

    const controls = [
      { key: 'LMB (hold max 1s)', action: 'Attack mode (blocks RMB)' },
      { key: 'RMB (hold max 1s)', action: 'Block mode (blocks LMB, 75% dmg reduction)' }
    ];

    section.appendChild(sectionHeader);

    controls.forEach(({ key, action }) => {
      const controlElement = document.createElement('div');
      controlElement.style.cssText = `
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const keyElement = document.createElement('span');
      keyElement.style.cssText = `
        color: #ff8866;
        font-weight: bold;
        min-width: 120px;
        font-size: 12px;
      `;
      keyElement.textContent = key;

      const actionElement = document.createElement('span');
      actionElement.style.cssText = `
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        flex: 1;
        margin-left: 10px;
      `;
      actionElement.textContent = action;

      controlElement.appendChild(keyElement);
      controlElement.appendChild(actionElement);
      section.appendChild(controlElement);
    });

    return section;
  }

  private createStateSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      padding: 10px;
      border-radius: 6px;
      border-left: 3px solid #6666ff;
    `;

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
      color: #6666ff;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
    `;
    sectionHeader.textContent = '🔧 Current State';

    const stateContainer = document.createElement('div');
    stateContainer.id = 'combat-state-display';
    stateContainer.style.cssText = `
      font-size: 12px;
      line-height: 1.4;
    `;

    section.appendChild(sectionHeader);
    section.appendChild(stateContainer);

    return section;
  }

  private setupEventListeners(): void {
    // Listen for V key presses to toggle visibility
    window.addEventListener('toggleTestingHelp', () => {
      this.toggle();
    });

    // Listen for combat state updates
    window.addEventListener('updateCombatState', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.updateCombatState(customEvent.detail);
    });
  }

  /**
   * Toggle help overlay visibility
   */
  toggle(): void {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Show help overlay
   */
  private show(): void {
    this.container.style.opacity = '1';
    this.container.style.visibility = 'visible';
    this.updateCombatState(); // Update state when showing
  }

  /**
   * Hide help overlay
   */
  private hide(): void {
    this.container.style.opacity = '0';
    this.container.style.visibility = 'hidden';
  }

  /**
   * Update combat state display
   */
  private updateCombatState(combatState?: any): void {
    const stateDisplay = this.container.querySelector('#combat-state-display');
    if (!stateDisplay) return;

    // Get current state from global if not provided
    if (!combatState) {
      // Request current state from controller
      window.dispatchEvent(new CustomEvent('requestCombatState'));
      return;
    }

    const { isAttacking, isBlocking, attackTimeLeft, blockTimeLeft } = combatState;

    stateDisplay.innerHTML = `
      <div style="margin-bottom: 4px;">
        <span style="color: ${isAttacking ? '#66ff66' : '#888888'};">
          🗡️ Attacking: ${isAttacking ? 'YES' : 'NO'}
        </span>
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: ${isBlocking ? '#66ff66' : '#888888'};">
          🛡️ Blocking: ${isBlocking ? 'YES' : 'NO'}
        </span>
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: ${attackTimeLeft > 0 ? '#ffaa66' : '#888888'};">
          ⏱️ Attack Time Left: ${attackTimeLeft}ms
        </span>
      </div>
      <div>
        <span style="color: ${blockTimeLeft > 0 ? '#ffaa66' : '#888888'};">
          🛡️ Block Time Left: ${blockTimeLeft}ms
        </span>
      </div>
    `;
  }

  /**
   * Force update state display
   */
  forceUpdateState(combatState: any): void {
    this.updateCombatState(combatState);
  }

  /**
   * Check if help is currently visible
   */
  isHelpVisible(): boolean {
    return this.isVisible;
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