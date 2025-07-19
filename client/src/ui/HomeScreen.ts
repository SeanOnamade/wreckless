import type { GameStateManager } from '../state/GameStateManager';

export class HomeScreen {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private stateManager: GameStateManager;
  private boundKeydownHandler: (e: KeyboardEvent) => void;
  private boundContainerClickHandler: (e: MouseEvent) => void;
  
  constructor(stateManager: GameStateManager) {
    this.stateManager = stateManager;
    
    // Bind event handlers for proper cleanup
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.boundContainerClickHandler = this.handleContainerClick.bind(this);
    
    this.container = this.createUI();
    this.setupEventListeners();
    console.log('🏠 HomeScreen component created');
  }
  
  /**
   * Show the homescreen
   */
  public show(): void {
    this.isVisible = true;
    
    // Force-set critical styles to ensure visibility
    this.container.style.display = 'flex';
    this.container.style.visibility = 'visible';
    this.container.style.opacity = '1';
    this.container.style.zIndex = '2200';
    
    console.log('🏠 HomeScreen shown - setting display to flex, z-index:', this.container.style.zIndex);
    console.log('🏠 HomeScreen container in DOM:', this.container.parentNode !== null);
    console.log('🏠 HomeScreen computed style:', window.getComputedStyle(this.container).display);
    
    // Check if we should auto-continue to multiplayer after reload
    this.checkAutoMultiplayer();
    
    // Exit pointer lock when menu shows
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  
  /**
   * Hide the homescreen
   */
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    console.log('🏠 HomeScreen hidden');
  }
  
  /**
   * Check if homescreen is visible
   */
  public isOpen(): boolean {
    return this.isVisible;
  }
  
  /**
   * Create the homescreen UI
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
      z-index: 2200;
      font-family: monospace;
      color: white;
      backdrop-filter: blur(10px);
    `;
    
    // Main content area
    const content = document.createElement('div');
    content.style.cssText = `
      background: rgba(0, 17, 34, 0.95);
      padding: 60px 80px;
      border-radius: 15px;
      border: 3px solid #00E6FF;
      text-align: center;
      max-width: 500px;
      min-width: 400px;
      box-shadow: 0 0 30px rgba(0, 230, 255, 0.3);
      position: relative;
    `;
    
    // Title
    const title = document.createElement('h1');
    title.style.cssText = `
      margin: 0 0 15px 0;
      color: #FF0080;
      font-size: 48px;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
      letter-spacing: 2px;
    `;
    title.textContent = 'WRECKLESS';
    
    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      margin: 0 0 40px 0;
      color: #00E6FF;
      font-size: 18px;
      font-weight: normal;
      text-shadow: 0 0 10px rgba(0, 230, 255, 0.5);
    `;
    subtitle.textContent = 'High-Speed Combat Racing';
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin: 30px 0;
    `;
    
    // Singleplayer button
    const singleplayerBtn = this.createButton('🎮 SINGLEPLAYER', '#00E6FF', '#001122');
    singleplayerBtn.addEventListener('click', () => {
      this.handleSingleplayerClick();
    });
    
    // Multiplayer button
    const multiplayerBtn = this.createButton('🌐 MULTIPLAYER', '#FF0080', 'white');
    multiplayerBtn.addEventListener('click', () => {
      this.handleMultiplayerClick();
    });
    
    // Controls info
    const controlsInfo = document.createElement('div');
    controlsInfo.style.cssText = `
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 14px;
      line-height: 1.6;
      color: #cccccc;
    `;
    
    controlsInfo.innerHTML = `
      <div style="margin-bottom: 15px; color: #00E6FF; font-weight: bold;">CONTROLS</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left;">
        <div>WASD - Move</div>
        <div>E - Use Ability</div>
        <div>Space - Jump</div>
        <div>Shift - Slide</div>
        <div>Mouse - Look</div>
        <div>LMB - Melee Attack</div>
        <div>R - Reset Position</div>
        <div>ESC - Menu</div>
      </div>
      <div style="margin-top: 15px; font-size: 12px; color: #888;">
        Classes: 1-Blast 2-Grapple 3-Blink
      </div>
    `;
    
    // Version info (small)
    const versionInfo = document.createElement('div');
    versionInfo.style.cssText = `
      position: absolute;
      bottom: 15px;
      right: 20px;
      font-size: 12px;
      color: #666;
    `;
    versionInfo.textContent = 'Day 6 Sprint';
    
    // Assemble the UI
    buttonContainer.appendChild(singleplayerBtn);
    buttonContainer.appendChild(multiplayerBtn);
    
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(buttonContainer);
    content.appendChild(controlsInfo);
    content.appendChild(versionInfo);
    
    container.appendChild(content);
    document.body.appendChild(container);
    
    return container;
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
      padding: 18px 30px;
      border-radius: 8px;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
      font-size: 16px;
      letter-spacing: 1px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
    `;
    button.textContent = text;
    
    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = `0 6px 20px rgba(0, 0, 0, 0.4)`;
      
      if (bgColor === '#00E6FF') {
        button.style.boxShadow += ', 0 0 20px rgba(0, 230, 255, 0.4)';
      } else if (bgColor === '#FF0080') {
        button.style.boxShadow += ', 0 0 20px rgba(255, 0, 128, 0.4)';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    });
    
    // Click effects
    button.addEventListener('mousedown', () => {
      button.style.transform = 'translateY(1px)';
    });
    
    button.addEventListener('mouseup', () => {
      button.style.transform = 'translateY(-2px)';
    });
    
    return button;
  }
  
  /**
   * Handle singleplayer button click
   */
  private handleSingleplayerClick(): void {
    console.log('🎮 Singleplayer mode selected');
    this.stateManager.selectMode('singleplayer');
  }
  
  /**
   * Handle multiplayer button click
   */
  private handleMultiplayerClick(): void {
    console.log('🌐 Multiplayer mode selected');
    
    // Auto-redirect to #online if not already there
    if (!window.location.hash.includes('online')) {
      console.log('🔄 Redirecting to #online for multiplayer...');
      // Add a query parameter to indicate we want multiplayer after reload
      const newUrl = `${window.location.origin}${window.location.pathname}#online&autoMultiplayer=true`;
      console.log('🔄 New URL will be:', newUrl);
      // Force a complete page reload to enable networking
      window.location.replace(newUrl);
      return;
    }
    
    this.stateManager.selectMode('multiplayer');
  }
  
  /**
   * Handle container click events
   */
  private handleContainerClick(e: MouseEvent): void {
    if (e.target === this.container) {
      // Don't auto-close on outside click for homescreen
      // User should make an explicit choice
    }
  }

  /**
   * Handle keydown events
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.isVisible) return;
    
    // Quick access keys when homescreen is open
    if (e.key === '1') {
      e.preventDefault();
      this.handleSingleplayerClick();
    } else if (e.key === '2') {
      e.preventDefault();
      this.handleMultiplayerClick();
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Use bound handlers for proper cleanup
    this.container.addEventListener('click', this.boundContainerClickHandler);
    document.addEventListener('keydown', this.boundKeydownHandler);
  }
  
  /**
   * Check if we should automatically continue to multiplayer (after #online redirect)
   */
  private checkAutoMultiplayer(): void {
    if (window.location.hash.includes('autoMultiplayer=true')) {
      console.log('🔄 Auto-continuing to multiplayer after #online redirect...');
      
      // Clean up the URL by removing the autoMultiplayer parameter
      const cleanUrl = window.location.href.replace('&autoMultiplayer=true', '');
      window.history.replaceState({}, '', cleanUrl);
      
      // Wait a moment for the UI to settle, then proceed directly to multiplayer lobby
      setTimeout(() => {
        if (this.isVisible) {
          console.log('🌐 Auto-selecting multiplayer mode');
          this.stateManager.selectMode('multiplayer');
        }
      }, 100);
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    // Remove event listeners to prevent memory leaks
    this.container.removeEventListener('click', this.boundContainerClickHandler);
    document.removeEventListener('keydown', this.boundKeydownHandler);
    
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    console.log('🧹 HomeScreen destroyed');
  }
} 