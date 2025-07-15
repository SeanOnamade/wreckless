export class DebugUI {
  private container: HTMLDivElement;
  private fpsElement: HTMLSpanElement;
  private velocityElement: HTMLSpanElement;
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;
  
  constructor() {
    // Create container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 14px;
      border-radius: 5px;
      pointer-events: none;
      z-index: 1000;
    `;
    
    // Create FPS display
    const fpsDiv = document.createElement('div');
    fpsDiv.innerHTML = 'FPS: <span id="fps">0</span>';
    this.fpsElement = fpsDiv.querySelector('#fps')!;
    
    // Create velocity display
    const velocityDiv = document.createElement('div');
    velocityDiv.innerHTML = 'Velocity: <span id="velocity">0.0</span> m/s';
    this.velocityElement = velocityDiv.querySelector('#velocity')!;
    
    // Create controls info
    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginTop = '10px';
    controlsDiv.style.fontSize = '12px';
    controlsDiv.style.opacity = '0.8';
    controlsDiv.innerHTML = `
      <div>WASD - Move</div>
      <div>Space - Jump</div>
      <div>Mouse - Look</div>
      <div>R - Reset</div>
      <div>ESC - Exit lock</div>
    `;
    
    // Append elements
    this.container.appendChild(fpsDiv);
    this.container.appendChild(velocityDiv);
    this.container.appendChild(controlsDiv);
    document.body.appendChild(this.container);
  }
  
  update(velocity: { x: number; y: number; z: number }) {
    // Update FPS
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastFpsUpdate;
    
    if (delta >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / delta);
      this.fpsElement.textContent = this.currentFps.toString();
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
    
    // Update velocity (horizontal speed only for display)
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    this.velocityElement.textContent = horizontalSpeed.toFixed(1);
  }
  
  destroy() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 