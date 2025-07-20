/**
 * HUD Toggle System
 * Provides Tab key toggle to hide debug/dev panels while keeping race essentials visible
 * Implements clean mode for capturing footage and reducing visual clutter
 */
export class HUDToggleSystem {
  private isCleanMode = true; // Start with debug UI hidden by default
  private debugElements: HTMLElement[] = [];
  private hintElement: HTMLDivElement | null = null;
  private isInGameplay = false; // Track if we're in actual gameplay
  private mutationObserver: MutationObserver | null = null; // Replace interval with observer
  private menuCheckInterval: number | null = null; // Keep for fallback support
  private keydownListener: ((event: KeyboardEvent) => void) | null = null; // Store for cleanup
  
  constructor() {
    this.setupToggleListener();
    this.setupCSSClasses();
    this.createHintElement();
    this.setupGameStateListener();
    console.log('🎛️ HUD Toggle System initialized (Tab to toggle clean mode)');
  }

  private setupCSSClasses(): void {
    // Add CSS for clean mode transitions
    const style = document.createElement('style');
    style.textContent = `
      .debug-ui-element {
        transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
      }
      
      .debug-ui-element.hidden-clean-mode {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      
      body.clean-mode .debug-ui-element {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      
      .debug-hint {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(30, 30, 40, 0.9);
        color: #e0e0e0;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        transition: opacity 0.3s ease-in-out;
        pointer-events: none;
        border: 1px solid rgba(120, 120, 140, 0.3);
        backdrop-filter: blur(4px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(style);
  }

  private createHintElement(): void {
    try {
      this.hintElement = document.createElement('div');
      this.hintElement.className = 'debug-hint';
      this.hintElement.textContent = 'Press Tab to see debug UI';
      this.updateHintVisibility();
      document.body.appendChild(this.hintElement);
      
      console.log('🎛️ Debug hint element created');
    } catch (error) {
      console.error('🚨 Failed to create debug hint element:', error);
      this.hintElement = null;
    }
  }

  private setupToggleListener(): void {
    this.keydownListener = (event: KeyboardEvent) => {
      if (event.code === 'Tab') {
        event.preventDefault(); // Prevent default tab behavior
        this.toggleCleanMode();
      }
    };
    
    try {
      document.addEventListener('keydown', this.keydownListener);
    } catch (error) {
      console.error('🚨 Failed to setup HUD toggle listener:', error);
    }
  }

  /**
   * Register a DOM element as a debug UI element that should be hidden in clean mode
   */
  registerDebugElement(element: HTMLElement): void {
    if (this.debugElements.includes(element)) return;
    
    this.debugElements.push(element);
    element.classList.add('debug-ui-element');
    
    // Apply current clean mode state
    if (this.isCleanMode) {
      element.classList.add('hidden-clean-mode');
    }
  }

  /**
   * Unregister a debug UI element
   */
  unregisterDebugElement(element: HTMLElement): void {
    const index = this.debugElements.indexOf(element);
    if (index !== -1) {
      this.debugElements.splice(index, 1);
      element.classList.remove('debug-ui-element', 'hidden-clean-mode');
    }
  }

  /**
   * Toggle between normal and clean mode
   */
  toggleCleanMode(): void {
    this.isCleanMode = !this.isCleanMode;
    
    if (this.isCleanMode) {
      document.body.classList.add('clean-mode');
      console.log('🎥 Clean mode ON - Debug UI hidden');
    } else {
      document.body.classList.remove('clean-mode');
      console.log('🎥 Clean mode OFF - Debug UI visible');
    }
    
    // Update individual debug elements
    this.debugElements.forEach(element => {
      if (this.isCleanMode) {
        element.classList.add('hidden-clean-mode');
      } else {
        element.classList.remove('hidden-clean-mode');
      }
    });
    
    // Update hint visibility based on new state
    this.updateHintVisibility();
  }

  /**
   * Check if we're currently in clean mode
   */
  isInCleanMode(): boolean {
    return this.isCleanMode;
  }

  /**
   * Clean up resources when the system is destroyed
   */
  destroy(): void {
    try {
      // Remove keydown event listener
      if (this.keydownListener) {
        document.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      
      // Remove hint element
      if (this.hintElement && this.hintElement.parentNode) {
        this.hintElement.parentNode.removeChild(this.hintElement);
        this.hintElement = null;
      }
      
      // Disconnect MutationObserver
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
      
      // Clear fallback interval if it exists
      if (this.menuCheckInterval) {
        clearInterval(this.menuCheckInterval);
        this.menuCheckInterval = null;
      }
      
      // Clean up any registered debug elements
      this.debugElements.forEach(element => {
        element.classList.remove('debug-ui-element', 'hidden-clean-mode');
      });
      this.debugElements = [];
      
      // Remove body class if still applied
      document.body.classList.remove('clean-mode');
      
      console.log('🧹 HUD Toggle System cleaned up');
    } catch (error) {
      console.error('🚨 Error during HUD Toggle System cleanup:', error);
    }
  }

  /**
   * Set clean mode state programmatically
   */
  setCleanMode(enabled: boolean): void {
    if (this.isCleanMode !== enabled) {
      this.toggleCleanMode();
    }
  }

  private setupGameStateListener(): void {
    // Use MutationObserver instead of polling for better performance
    const checkMenuState = () => {
      try {
        // Check if we're in a menu by looking for visible menu elements
        const homeScreen = document.querySelector('.home-screen');
        const classSelection = document.querySelector('.class-selection');
        const isInMenu = (homeScreen && getComputedStyle(homeScreen).display !== 'none') ||
                        (classSelection && getComputedStyle(classSelection).display !== 'none');
        
        const wasInGameplay = this.isInGameplay;
        this.isInGameplay = !isInMenu;
        
        // Only update hint if gameplay state changed
        if (wasInGameplay !== this.isInGameplay) {
          this.updateHintVisibility();
        }
      } catch (error) {
        console.error('🚨 Error checking menu state:', error);
      }
    };
    
    // Set up MutationObserver to watch for DOM changes
    try {
      this.mutationObserver = new MutationObserver(() => {
        // Debounce rapid changes
        setTimeout(checkMenuState, 50);
      });
      
      // Observe changes to the entire document body
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
      
      // Also listen for custom events that might indicate state changes
      const gameStateChangeHandler = () => checkMenuState();
      document.addEventListener('gameStateChange', gameStateChangeHandler);
      document.addEventListener('menuVisibilityChange', gameStateChangeHandler);
      
      // Check immediately
      setTimeout(checkMenuState, 100);
      
      console.log('🎛️ Game state observer initialized');
    } catch (error) {
      console.error('🚨 Failed to setup game state observer, falling back to interval:', error);
      // Fallback to interval if MutationObserver fails
      this.menuCheckInterval = setInterval(checkMenuState, 1000); // Increased interval as fallback
    }
  }

  private updateHintVisibility(): void {
    if (!this.hintElement) return;
    
    // Show hint only when: in gameplay AND clean mode is on AND debug UI is hidden
    const shouldShow = this.isInGameplay && this.isCleanMode;
    this.hintElement.style.opacity = shouldShow ? '1' : '0';
  }
} 