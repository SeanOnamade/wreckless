import type { GameStateManager } from '../state/GameStateManager';
import { AudioManager, OPTIMIZED_SFX_VOLUMES } from '../audio/AudioManager';

export class SettingsScreen {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private stateManager: GameStateManager;
  private audioManager: AudioManager;
  private boundKeydownHandler: (e: KeyboardEvent) => void;
  
  constructor(stateManager: GameStateManager) {
    this.stateManager = stateManager;
    this.audioManager = AudioManager.getInstance();
    
    // Bind event handlers for proper cleanup
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    
    this.container = this.createUI();
    this.setupEventListeners();
    console.log('⚙️ SettingsScreen component created');
  }
  
  /**
   * Show the settings screen
   */
  public show(): void {
    this.isVisible = true;
    
    // Force-set critical styles to ensure visibility
    this.container.style.display = 'flex';
    this.container.style.visibility = 'visible';
    this.container.style.opacity = '1';
    this.container.style.zIndex = '2200';
    
    // Update UI with current settings
    this.updateSettingsDisplay();
    
    console.log('⚙️ SettingsScreen shown');
    
    // Exit pointer lock when menu shows
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  
  /**
   * Hide the settings screen
   */
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    console.log('⚙️ SettingsScreen hidden');
  }
  
  /**
   * Destroy the settings screen and clean up resources
   */
  public destroy(): void {
    this.hide();
    
    // Remove event listeners
    document.removeEventListener('keydown', this.boundKeydownHandler);
    
    // Remove DOM element
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    console.log('🧹 SettingsScreen destroyed and cleaned up');
  }
  
  /**
   * Create the settings screen UI
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
      padding: 40px 60px;
      border-radius: 15px;
      border: 3px solid #00E6FF;
      text-align: center;
      max-width: 700px;
      min-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 0 30px rgba(0, 230, 255, 0.3);
      position: relative;
      scrollbar-width: thin;
      scrollbar-color: #00E6FF #333;
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
    title.textContent = 'SETTINGS';
    
    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      margin: 0 0 40px 0;
      color: #00E6FF;
      font-size: 16px;
      font-weight: normal;
      text-shadow: 0 0 10px rgba(0, 230, 255, 0.5);
    `;
    subtitle.textContent = 'Audio & Game Settings';
    
    // Back button (moved to top)
    const backButton = this.createButton('🏠 BACK TO MENU', '#666666', 'white');
    backButton.style.marginBottom = '20px'; // Add spacing below the button
    backButton.addEventListener('click', () => {
      this.handleBackClick();
    });
    
    // Settings container
    const settingsContainer = document.createElement('div');
    settingsContainer.style.cssText = `
      margin: 30px 0;
      text-align: left;
    `;
    
    // Audio section
    const audioSection = this.createAudioSection();
    settingsContainer.appendChild(audioSection);
    
    // Assemble the UI
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(backButton);
    content.appendChild(settingsContainer);
    
    container.appendChild(content);
    document.body.appendChild(container);
    
    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
      .settings-content::-webkit-scrollbar {
        width: 8px;
      }
      .settings-content::-webkit-scrollbar-track {
        background: #333;
        border-radius: 4px;
      }
      .settings-content::-webkit-scrollbar-thumb {
        background: #00E6FF;
        border-radius: 4px;
      }
      .settings-content::-webkit-scrollbar-thumb:hover {
        background: #0099CC;
      }
    `;
    document.head.appendChild(style);
    content.classList.add('settings-content');
    
    return container;
  }
  
  /**
   * Create the audio settings section
   */
  private createAudioSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 30px;
      padding: 25px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(0, 230, 255, 0.3);
      border-radius: 8px;
    `;
    
    // Section title
    const sectionTitle = document.createElement('h3');
    sectionTitle.style.cssText = `
      margin: 0 0 20px 0;
      color: #00E6FF;
      font-size: 18px;
      font-weight: bold;
    `;
    sectionTitle.textContent = '🎵 AUDIO SETTINGS';
    
    // Music volume control
    const musicVolumeControl = this.createVolumeControl(
      'Music Volume',
      'music-volume',
      (value) => this.audioManager.setMusicVolume(value)
    );
    
    // SFX volume control
    const sfxVolumeControl = this.createVolumeControl(
      'SFX Volume',
      'sfx-volume',
      (value) => this.audioManager.setSFXVolume(value)
    );
    
    // Music toggle
    const musicToggle = this.createToggleControl(
      'Enable Music',
      'music-enabled',
      (enabled) => this.audioManager.setMusicEnabled(enabled)
    );
    
    // SFX toggle
    const sfxToggle = this.createToggleControl(
      'Enable SFX',
      'sfx-enabled',
      (enabled) => this.audioManager.setSFXEnabled(enabled)
    );
    
    section.appendChild(sectionTitle);
    section.appendChild(musicToggle);
    section.appendChild(musicVolumeControl);
    section.appendChild(sfxToggle);
    section.appendChild(sfxVolumeControl);
    
    // Add ambient wind controls
    const windTitle = document.createElement('h3');
    windTitle.style.cssText = `
      color: #00E6FF;
      font-size: 16px;
      font-weight: bold;
      margin: 20px 0 10px 0;
      border-bottom: 1px solid #333;
      padding-bottom: 3px;
    `;
    windTitle.textContent = '🌬️ Ambient Wind';
    section.appendChild(windTitle);
    
    // Wind base volume
    const windBaseVolumeControl = this.createWindControl(
      'Volume at Min Speed',
      'wind-base-volume',
      () => this.audioManager.baseAmbientVolume || 5.0,
      (value) => {
        (this.audioManager as any).baseAmbientVolume = value;
        this.audioManager.updateSpeed(this.audioManager.currentSpeed || 0);
      },
      { min: 0, max: 10, step: 0.1 }
    );
    
    // Wind max volume
    const windMaxVolumeControl = this.createWindControl(
      'Volume at Max Speed',
      'wind-max-volume',
      () => this.audioManager.maxAmbientVolume || 8.0,
      (value) => {
        (this.audioManager as any).maxAmbientVolume = value;
        this.audioManager.updateSpeed(this.audioManager.currentSpeed || 0);
      },
      { min: 0, max: 10, step: 0.1 }
    );
    
    // Wind speed range controls
    const windMinSpeedControl = this.createWindControl(
      'Min Speed',
      'wind-min-speed',
      () => this.audioManager.minSpeed || 20,
      (value) => {
        (this.audioManager as any).minSpeed = value;
        this.audioManager.updateSpeed(this.audioManager.currentSpeed || 0);
      },
      { min: 0, max: 50, step: 1 }
    );
    
    const windMaxSpeedControl = this.createWindControl(
      'Max Speed',
      'wind-max-speed',
      () => this.audioManager.maxSpeed || 30,
      (value) => {
        (this.audioManager as any).maxSpeed = value;
        this.audioManager.updateSpeed(this.audioManager.currentSpeed || 0);
      },
      { min: 10, max: 100, step: 1 }
    );
    
    section.appendChild(windBaseVolumeControl);
    section.appendChild(windMaxVolumeControl);
    section.appendChild(windMinSpeedControl);
    section.appendChild(windMaxSpeedControl);
    
    // Add individual SFX volume controls
    const sfxDetailTitle = document.createElement('h3');
    sfxDetailTitle.style.cssText = `
      color: #FFA500;
      font-size: 16px;
      font-weight: bold;
      margin: 20px 0 10px 0;
      border-bottom: 1px solid #333;
      padding-bottom: 3px;
    `;
    sfxDetailTitle.textContent = '🎛️ Individual SFX Volumes';
    section.appendChild(sfxDetailTitle);
    
    // Create volume controls for each optimized SFX
    const sfxCategories = [
      { title: '🚶 Movement', sfx: [
        { key: 'movement/footstep_concrete.wav', label: 'Footsteps' },
        { key: 'movement/jump.wav', label: 'Jump' },
        { key: 'movement/land_hard.wav', label: 'Landing' }
      ]},
      { title: '⚡ Abilities', sfx: [
        { key: 'abilities/blast_launch.wav', label: 'Blast Launch' },
        { key: 'abilities/blink_teleport.wav', label: 'Blink Teleport' },
        { key: 'abilities/grapple_shoot.wav', label: 'Grapple Shoot' },
        { key: 'abilities/grapple_latch.wav', label: 'Grapple Latch' },
        { key: 'abilities/ability_blocked.wav', label: 'Ability Blocked' },
        { key: 'abilities/ability_ready.wav', label: 'Ability Ready' }
      ]},
      { title: '⚔️ Combat', sfx: [
        { key: 'combat/dummy_hit.wav', label: 'Dummy Hit' },
        { key: 'combat/speed_boost_gained.wav', label: 'Speed Boost' }
      ]},
      { title: '🖱️ UI', sfx: [
        { key: 'ui/button_click.wav', label: 'Button Click' },
        { key: 'ui/checkpoint_hit.wav', label: 'Checkpoint Hit' }
      ]},
      { title: '🌍 Environment', sfx: [
        { key: 'environment/killzone_hit.wav', label: 'Killzone Hit' }
      ]}
    ];
    
    sfxCategories.forEach(category => {
      // Category header
      const categoryHeader = document.createElement('div');
      categoryHeader.style.cssText = `
        color: #888;
        font-size: 12px;
        font-weight: bold;
        margin: 12px 0 6px 0;
      `;
      categoryHeader.textContent = category.title;
      section.appendChild(categoryHeader);
      
      // SFX controls for this category
      category.sfx.forEach(sfx => {
        const sfxControl = this.createSFXVolumeControl(sfx.label, sfx.key);
        section.appendChild(sfxControl);
      });
    });
    
    return section;
  }
  
  /**
   * Create a volume control slider
   */
  private createVolumeControl(label: string, id: string, onChange: (value: number) => void): HTMLDivElement {
    const control = document.createElement('div');
    control.style.cssText = `
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
    `;
    
    // Label
    const labelElement = document.createElement('label');
    labelElement.style.cssText = `
      color: #cccccc;
      font-size: 14px;
      min-width: 100px;
      font-weight: bold;
    `;
    labelElement.textContent = label;
    labelElement.htmlFor = id;
    
    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.style.cssText = `
      flex: 1;
      height: 8px;
      background: #444;
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      accent-color: #00E6FF;
    `;
    
    // Value display
    const valueDisplay = document.createElement('span');
    valueDisplay.style.cssText = `
      color: #00E6FF;
      font-size: 14px;
      min-width: 40px;
      text-align: right;
      font-weight: bold;
    `;
    
    // Event listener
    slider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value) / 100;
      onChange(value);
      valueDisplay.textContent = `${Math.round(value * 100)}%`;
    });
    
    control.appendChild(labelElement);
    control.appendChild(slider);
    control.appendChild(valueDisplay);
    
    return control;
  }
  
  /**
   * Create a specific SFX volume control with test button
   */
  private createSFXVolumeControl(label: string, sfxKey: string): HTMLDivElement {
    const control = document.createElement('div');
    control.style.cssText = `
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 15px;
    `;
    
    // Label
    const labelElement = document.createElement('label');
    labelElement.style.cssText = `
      color: #ccc;
      font-size: 12px;
      min-width: 80px;
    `;
    labelElement.textContent = label;
    
    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '200'; // Allow up to 2x volume
    slider.step = '5';
    slider.style.cssText = `
      flex: 1;
      height: 6px;
      background: #333;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
      accent-color: #FFA500;
    `;
    
    // Value display
    const valueDisplay = document.createElement('span');
    valueDisplay.style.cssText = `
      color: #FFA500;
      font-size: 11px;
      min-width: 35px;
      text-align: right;
    `;
    
    // Test button
    const testButton = document.createElement('button');
    testButton.style.cssText = `
      background: #444;
      border: 1px solid #666;
      color: #ccc;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      cursor: pointer;
      min-width: 40px;
    `;
    testButton.textContent = 'Test';
    
    // Set initial value from OPTIMIZED_SFX_VOLUMES
    const optimizedVolume = OPTIMIZED_SFX_VOLUMES[sfxKey] || 1.0;
    slider.value = Math.round(optimizedVolume * 100).toString();
    valueDisplay.textContent = `${Math.round(optimizedVolume * 100)}%`;
    
    // Event listeners
    slider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value) / 100;
      valueDisplay.textContent = `${Math.round(value * 100)}%`;
      
      // Apply volume override immediately
      const [category, filename] = sfxKey.split('/');
      window.dispatchEvent(new CustomEvent('sfxRequest', {
        detail: { category, filename, volumeOverride: value }
      }));
    });
    
    testButton.addEventListener('click', () => {
      const value = parseInt(slider.value) / 100;
      const [category, filename] = sfxKey.split('/');
      
      // Highlight button briefly
      testButton.style.background = '#FFA500';
      setTimeout(() => {
        testButton.style.background = '#444';
      }, 200);
      
      // Play test sound
      window.dispatchEvent(new CustomEvent('sfxRequest', {
        detail: { category, filename, volumeOverride: value }
      }));
    });
    
    control.appendChild(labelElement);
    control.appendChild(slider);
    control.appendChild(valueDisplay);
    control.appendChild(testButton);
    
    return control;
  }
  
  /**
   * Create a wind control slider
   */
  private createWindControl(
    label: string, 
    id: string, 
    getValue: () => number, 
    onChange: (value: number) => void,
    options: { min?: number, max?: number, step?: number } = {}
  ): HTMLDivElement {
    const control = document.createElement('div');
    control.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    
    // Label
    const labelElement = document.createElement('label');
    labelElement.style.cssText = `
      color: #cccccc;
      font-size: 14px;
      min-width: 100px;
      font-weight: bold;
    `;
    labelElement.textContent = label;
    labelElement.htmlFor = id;
    
    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.min = (options.min || 0).toString();
    slider.max = (options.max || 100).toString();
    slider.step = (options.step || 1).toString();
    slider.style.cssText = `
      flex: 1;
      height: 8px;
      background: #444;
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      accent-color: #00E6FF;
    `;
    
    // Value display
    const valueDisplay = document.createElement('span');
    valueDisplay.style.cssText = `
      color: #00E6FF;
      font-size: 14px;
      min-width: 50px;
      text-align: right;
      font-weight: bold;
    `;
    
    // Set initial value
    const currentValue = getValue();
    slider.value = currentValue.toString();
    valueDisplay.textContent = currentValue.toFixed(options.step === 1 ? 0 : 2);
    
    // Event listener
    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      onChange(value);
      valueDisplay.textContent = value.toFixed(options.step === 1 ? 0 : 2);
    });
    
    control.appendChild(labelElement);
    control.appendChild(slider);
    control.appendChild(valueDisplay);
    
    return control;
  }
  
  /**
   * Create a toggle control (checkbox)
   */
  private createToggleControl(label: string, id: string, onChange: (enabled: boolean) => void): HTMLDivElement {
    const control = document.createElement('div');
    control.style.cssText = `
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
    `;
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.style.cssText = `
      width: 18px;
      height: 18px;
      accent-color: #00E6FF;
      cursor: pointer;
    `;
    
    // Label
    const labelElement = document.createElement('label');
    labelElement.style.cssText = `
      color: #cccccc;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      user-select: none;
    `;
    labelElement.textContent = label;
    labelElement.htmlFor = id;
    
    // Event listener
    checkbox.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      onChange(enabled);
    });
    
    control.appendChild(checkbox);
    control.appendChild(labelElement);
    
    return control;
  }
  
  /**
   * Update the settings display with current values
   */
  private updateSettingsDisplay(): void {
    const settings = this.audioManager.getSettings();
    
    // Update music volume slider
    const musicVolumeSlider = this.container.querySelector('#music-volume') as HTMLInputElement;
    if (musicVolumeSlider) {
      musicVolumeSlider.value = Math.round(settings.musicVolume * 100).toString();
      const valueDisplay = musicVolumeSlider.parentElement?.querySelector('span');
      if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(settings.musicVolume * 100)}%`;
      }
    }
    
    // Update SFX volume slider
    const sfxVolumeSlider = this.container.querySelector('#sfx-volume') as HTMLInputElement;
    if (sfxVolumeSlider) {
      sfxVolumeSlider.value = Math.round(settings.sfxVolume * 100).toString();
      const valueDisplay = sfxVolumeSlider.parentElement?.querySelector('span');
      if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(settings.sfxVolume * 100)}%`;
      }
    }
    
    // Update music enabled checkbox
    const musicEnabledCheckbox = this.container.querySelector('#music-enabled') as HTMLInputElement;
    if (musicEnabledCheckbox) {
      musicEnabledCheckbox.checked = settings.musicEnabled;
    }
    
    // Update SFX enabled checkbox
    const sfxEnabledCheckbox = this.container.querySelector('#sfx-enabled') as HTMLInputElement;
    if (sfxEnabledCheckbox) {
      sfxEnabledCheckbox.checked = settings.sfxEnabled;
    }
  }
  
  /**
   * Create a styled button
   */
  private createButton(text: string, bgColor: string, textColor: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.style.cssText = `
      background: linear-gradient(45deg, ${bgColor}, ${this.adjustColor(bgColor, 20)});
      color: ${textColor};
      border: 2px solid ${this.adjustColor(bgColor, -20)};
      border-radius: 8px;
      padding: 15px 30px;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 10px 0;
      min-width: 200px;
    `;
    button.textContent = text;
    
    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = `0 4px 15px ${this.adjustColor(bgColor, 30)}40`;
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    });
    
    // Click SFX
    button.addEventListener('mousedown', () => {
      // SFX: Play button click sound
      window.dispatchEvent(new CustomEvent('sfxRequest', {
        detail: { category: 'ui', filename: 'button_click.wav' }
      }));
    });
    
    return button;
  }
  
  /**
   * Utility function to adjust color brightness
   */
  private adjustColor(color: string, amount: number): string {
    // Simple color adjustment for hover effects
    if (color.startsWith('#')) {
      const num = parseInt(color.slice(1), 16);
      const r = Math.max(0, Math.min(255, (num >> 16) + amount));
      const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
      const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    return color;
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener('keydown', this.boundKeydownHandler);
  }
  
  /**
   * Handle keydown events
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.isVisible) return;
    
    switch (e.key) {
      case 'Escape':
        this.handleBackClick();
        break;
    }
  }
  
  /**
   * Handle back button click
   */
  private handleBackClick(): void {
    console.log('🏠 Returning to homescreen from settings');
    this.stateManager.transitionTo('homescreen');
  }
} 