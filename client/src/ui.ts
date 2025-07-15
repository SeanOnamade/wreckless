export class DebugUI {
  private container: HTMLDivElement;
  private fpsElement: HTMLSpanElement;
  private velocityElement: HTMLSpanElement;
  private vVelocityElement: HTMLSpanElement;
  private groundedElement: HTMLSpanElement;
  private slidingElement: HTMLSpanElement;
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
    
    // Create vertical velocity display
    const vVelocityDiv = document.createElement('div');
    vVelocityDiv.innerHTML = 'V-Speed: <span id="vvelocity">0.0</span> m/s';
    this.vVelocityElement = vVelocityDiv.querySelector('#vvelocity')!;
    
    // Create grounded state display
    const groundedDiv = document.createElement('div');
    groundedDiv.innerHTML = 'Grounded: <span id="grounded">No</span>';
    this.groundedElement = groundedDiv.querySelector('#grounded')!;
    
    // Create sliding state display
    const slidingDiv = document.createElement('div');
    slidingDiv.innerHTML = 'Sliding: <span id="sliding">No</span>';
    this.slidingElement = slidingDiv.querySelector('#sliding')!;
    
    // Create controls info
    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginTop = '10px';
    controlsDiv.style.fontSize = '12px';
    controlsDiv.style.opacity = '0.8';
    controlsDiv.innerHTML = `
      <div>ESC - Menu</div>
      <div>R - Reset</div>
    `;
    
    // Append elements
    this.container.appendChild(fpsDiv);
    this.container.appendChild(velocityDiv);
    this.container.appendChild(vVelocityDiv);
    this.container.appendChild(groundedDiv);
    this.container.appendChild(slidingDiv);
    this.container.appendChild(controlsDiv);
    document.body.appendChild(this.container);
  }
  
  update(velocity: { x: number; y: number; z: number }, grounded: boolean, sliding: boolean = false) {
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
    
    // Update velocity
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    this.velocityElement.textContent = horizontalSpeed.toFixed(1);
    
    // Update vertical velocity (show + for up, - for down)
    const verticalSpeed = velocity.y;
    this.vVelocityElement.textContent = verticalSpeed.toFixed(1);
    
    // Color code vertical velocity
    if (verticalSpeed > 0.1) {
      this.vVelocityElement.style.color = '#0f0'; // Green for up
    } else if (verticalSpeed < -0.1) {
      this.vVelocityElement.style.color = '#f00'; // Red for down
    } else {
      this.vVelocityElement.style.color = '#fff'; // White for neutral
    }
    
    // Update grounded state
    this.groundedElement.textContent = grounded ? 'Yes' : 'No';
    this.groundedElement.style.color = grounded ? '#0f0' : '#f00';
    
    // Update sliding state
    this.slidingElement.textContent = sliding ? 'Yes' : 'No';
    this.slidingElement.style.color = sliding ? '#0ff' : '#888'; // Cyan for sliding, gray for not
  }
  
  destroy() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 