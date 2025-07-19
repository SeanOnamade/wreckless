export class GameMenu {
  private menuContainer!: HTMLDivElement;
  private isMenuOpen = false;
  private boundKeydownHandler: (e: KeyboardEvent) => void;
  private boundContainerClickHandler: (e: MouseEvent) => void;
  
  constructor() {
    // Bind event handlers for proper cleanup
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.boundContainerClickHandler = this.handleContainerClick.bind(this);
    
    this.createMenuElements();
    this.setupEventListeners();
  }
  
  private createMenuElements() {
    // Create menu container
    this.menuContainer = document.createElement('div');
    this.menuContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      font-family: monospace;
      color: white;
    `;
    
    // Create menu content
    const menuContent = document.createElement('div');
    menuContent.style.cssText = `
      background: rgba(0, 17, 34, 0.95);
      padding: 40px;
      border-radius: 10px;
      border: 2px solid #00E6FF;
      text-align: center;
      max-width: 400px;
    `;
    
    menuContent.innerHTML = `
      <h2 style="margin: 0 0 20px 0; color: #FF0080;">Game Paused</h2>
      <p style="margin: 0 0 20px 0; color: #00E6FF;">What would you like to do?</p>
      <div style="margin: 20px 0; line-height: 1.6;">
        <div><strong>Controls:</strong></div>
        <div>WASD - Move</div>
        <div>Space - Jump</div>
        <div>E - Use Ability</div>
        <div>Shift - Slide</div>
        <div>Mouse - Look</div>
        <div>R - Reset Position</div>
        <div>ESC - Toggle Menu</div>
      </div>
      <button id="resume-btn" style="
        background: #00E6FF;
        color: #001122;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-family: monospace;
        font-weight: bold;
        margin-right: 10px;
      ">Resume</button>
      <button id="reset-btn" style="
        background: #FF8800;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-family: monospace;
        font-weight: bold;
        margin-right: 10px;
      ">Reset</button>
      <button id="menu-btn" style="
        background: #666666;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-family: monospace;
        font-weight: bold;
      ">Main Menu</button>
    `;
    
    this.menuContainer.appendChild(menuContent);
    document.body.appendChild(this.menuContainer);
    
    // Setup button handlers
    const resumeBtn = menuContent.querySelector('#resume-btn') as HTMLButtonElement;
    const resetBtn = menuContent.querySelector('#reset-btn') as HTMLButtonElement;
    const menuBtn = menuContent.querySelector('#menu-btn') as HTMLButtonElement;
    
    resumeBtn.addEventListener('click', () => this.closeMenu());
    resetBtn.addEventListener('click', () => {
      this.closeMenu();
      // Dispatch player position reset (same as R key)
      window.dispatchEvent(new CustomEvent('resetPlayerPosition'));
    });
    menuBtn.addEventListener('click', () => {
      this.closeMenu();
      // Dispatch main menu event (clean transition to homescreen)
      window.dispatchEvent(new CustomEvent('main-menu-requested'));
    });
  }
  
  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.toggleMenu();
    }
  }
  
  private handleContainerClick(e: MouseEvent): void {
    if (e.target === this.menuContainer) {
      this.closeMenu();
    }
  }
  
  private setupEventListeners() {
    document.addEventListener('keydown', this.boundKeydownHandler);
    // Close menu when clicking outside
    this.menuContainer.addEventListener('click', this.boundContainerClickHandler);
  }
  
  private toggleMenu() {
    if (this.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }
  
  private openMenu() {
    this.isMenuOpen = true;
    this.menuContainer.style.display = 'flex';
    
    // Exit pointer lock when menu opens
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  
  private closeMenu() {
    this.isMenuOpen = false;
    this.menuContainer.style.display = 'none';
  }
  
  public isOpen(): boolean {
    return this.isMenuOpen;
  }
  
  public close() {
    this.closeMenu();
  }
  
  public destroy() {
    // Remove event listeners to prevent memory leaks
    document.removeEventListener('keydown', this.boundKeydownHandler);
    this.menuContainer.removeEventListener('click', this.boundContainerClickHandler);
    
    if (this.menuContainer.parentNode) {
      this.menuContainer.parentNode.removeChild(this.menuContainer);
    }
  }
} 