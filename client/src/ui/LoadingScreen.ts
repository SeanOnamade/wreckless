/**
 * Loading Screen for WRECKLESS
 * Tracks and displays loading progress for all game assets
 */
export class LoadingScreen {
  private container: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private progressText: HTMLSpanElement;
  private statusText: HTMLDivElement;
  private tipText: HTMLDivElement;
  
  private loadingSteps: Map<string, { weight: number, complete: boolean }> = new Map();
  private totalWeight = 0;
  private isVisible = true;
  private fadeOutPromise: Promise<void> | null = null;
  
  private tips = [
    "💡 Hold LMB while moving to attack other players!",
    "🚀 Use abilities to gain speed and traverse the track faster",
    "🎯 Hit checkpoints to save your progress through the track",
    "⚡ Blast players can rocket jump by shooting downward",
    "✨ Blink players can teleport through walls and obstacles",
    "🔗 Grapple players can swing from any surface for momentum",
    "🏃‍♂️ Chain abilities together for maximum speed",
    "🎮 Press TAB to toggle between different HUD styles",
    "🔊 Adjust audio settings in the main menu",
    "🏁 First player to complete 3 laps wins the race!"
  ];
  private currentTipIndex = 0;
  private tipInterval: number | null = null;
  
  constructor() {
    // Initialize DOM elements
    this.progressBar = document.createElement('div');
    this.progressFill = document.createElement('div');
    this.progressText = document.createElement('span');
    this.statusText = document.createElement('div');
    this.tipText = document.createElement('div');
    
    // Create and setup the loading screen
    this.container = this.createLoadingScreen();
    document.body.appendChild(this.container);
    this.registerLoadingSteps();
    this.startTipRotation();
    
    console.log('🔄 Loading screen initialized');
  }
  
  private registerLoadingSteps(): void {
    // Only track what actually takes time to load
    this.addLoadingStep('physics-engine', 15);     // RAPIER WASM init
    this.addLoadingStep('race-track', 25);         // Track GLB loading
    this.addLoadingStep('character-animations', 60); // FBX files (BIGGEST!)
  }
  
  private addLoadingStep(stepId: string, weight: number): void {
    this.loadingSteps.set(stepId, { weight, complete: false });
    this.totalWeight += weight;
  }
  
  public setStepComplete(stepId: string, statusMessage?: string): void {
    const step = this.loadingSteps.get(stepId);
    if (step && !step.complete) {
      step.complete = true;
      console.log(`✅ Loading step complete: ${stepId}`);
      
      if (statusMessage) {
        this.updateStatus(statusMessage);
      }
      
      this.updateProgress();
      
      if (this.isLoadingComplete()) {
        this.handleLoadingComplete();
      }
    }
  }
  
  public setProgress(percentage: number, statusMessage?: string): void {
    percentage = Math.max(0, Math.min(100, percentage));
    this.progressFill.style.width = `${percentage}%`;
    this.progressText.textContent = `${Math.round(percentage)}%`;
    
    if (statusMessage) {
      this.updateStatus(statusMessage);
    }
  }
  
  public updateStatus(message: string): void {
    this.statusText.textContent = message;
    console.log(`📋 Loading: ${message}`);
  }
  
  private updateProgress(): void {
    let completedWeight = 0;
    
    for (const [_, step] of this.loadingSteps) {
      if (step.complete) {
        completedWeight += step.weight;
      }
    }
    
    const percentage = this.totalWeight > 0 ? (completedWeight / this.totalWeight) * 100 : 0;
    this.setProgress(percentage);
  }
  
  private isLoadingComplete(): boolean {
    return Array.from(this.loadingSteps.values()).every(step => step.complete);
  }
  
  private handleLoadingComplete(): void {
    this.updateStatus('🎮 Ready to play!');
    console.log('🎉 All loading complete!');
    
    // Auto-hide after a short delay
    setTimeout(() => {
      this.fadeOut();
    }, 1500);
  }
  
  private startTipRotation(): void {
    this.showNextTip();
    this.tipInterval = window.setInterval(() => {
      this.showNextTip();
    }, 4000); // Change tip every 4 seconds
  }
  
  private showNextTip(): void {
    if (this.tips.length === 0) return;
    
    this.tipText.textContent = this.tips[this.currentTipIndex];
    this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
  }
  
  private createLoadingScreen(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: white;
      transition: opacity 0.5s ease;
    `;
    
    // Title
    const title = document.createElement('h1');
    title.textContent = 'WRECKLESS';
    title.style.cssText = `
      font-size: 3.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      text-shadow: 0 0 20px rgba(100, 200, 255, 0.5);
      letter-spacing: 0.2em;
    `;
    
    // Subtitle
    const subtitle = document.createElement('h2');
    subtitle.textContent = 'High-Speed Combat Racing';
    subtitle.style.cssText = `
      font-size: 1.2rem;
      font-weight: 300;
      margin: 0 0 3rem 0;
      opacity: 0.8;
      letter-spacing: 0.1em;
    `;
    
    // Progress container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 400px;
      margin-bottom: 2rem;
    `;
    
    // Progress bar background
    this.progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    `;
    
    // Progress bar fill
    this.progressFill.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #00d4ff, #00a8cc);
      border-radius: 4px;
      width: 0%;
      transition: width 0.3s ease;
      box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    `;
    
    // Progress text
    this.progressText.style.cssText = `
      position: absolute;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      font-size: 0.9rem;
      font-weight: bold;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    `;
    
    this.progressBar.appendChild(this.progressFill);
    this.progressBar.appendChild(this.progressText);
    progressContainer.appendChild(this.progressBar);
    
    // Status text
    this.statusText.style.cssText = `
      font-size: 1rem;
      margin-bottom: 3rem;
      opacity: 0.9;
      text-align: center;
      min-height: 1.5rem;
    `;
    
    // Tips text
    this.tipText.style.cssText = `
      font-size: 0.9rem;
      opacity: 0.7;
      text-align: center;
      max-width: 500px;
      line-height: 1.4;
      min-height: 2rem;
    `;
    
    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(progressContainer);
    container.appendChild(this.statusText);
    container.appendChild(this.tipText);
    
    return container;
  }
  
  public async fadeOut(): Promise<void> {
    if (this.fadeOutPromise) {
      return this.fadeOutPromise;
    }
    
    this.fadeOutPromise = new Promise<void>((resolve) => {
      if (!this.isVisible) {
        resolve();
        return;
      }
      
      this.isVisible = false;
      
      // Stop tip rotation
      if (this.tipInterval) {
        clearInterval(this.tipInterval);
        this.tipInterval = null;
      }
      
      this.container.style.opacity = '0';
      
      setTimeout(() => {
        if (this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        console.log('🎮 Loading screen hidden');
        resolve();
      }, 500);
    });
    
    return this.fadeOutPromise;
  }
  
  public forceHide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
      this.tipInterval = null;
    }
    
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    console.log('🚫 Loading screen force hidden');
  }
} 