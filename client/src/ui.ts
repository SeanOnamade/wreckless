export class DebugUI {
  private container: HTMLDivElement;
  private fpsElement: HTMLSpanElement;
  private velocityElement: HTMLSpanElement;
  private vVelocityElement: HTMLSpanElement;
  private groundedElement: HTMLSpanElement;
  private slidingElement: HTMLSpanElement;
  private positionElement: HTMLSpanElement | null = null;
  private currentSpeedElement: HTMLSpanElement;
  private rocketJumpElement: HTMLSpanElement;
  private blinkMomentumElement: HTMLSpanElement;
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;
  private isDevelopment: boolean;
  
  /**
   * Get the container element for adding additional UI components
   */
  getContainer(): HTMLDivElement {
    return this.container;
  }
  
  constructor() {
    this.isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
    
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

    // Create current speed display
    const currentSpeedDiv = document.createElement('div');
    currentSpeedDiv.innerHTML = 'Speed: <span id="current-speed">0.0</span> m/s';
    this.currentSpeedElement = currentSpeedDiv.querySelector('#current-speed')!;

    // Create rocket jump state display
    const rocketJumpDiv = document.createElement('div');
    rocketJumpDiv.innerHTML = 'Rocket Jump: <span id="rocket-jump">No</span>';
    this.rocketJumpElement = rocketJumpDiv.querySelector('#rocket-jump')!;

    // Create blink momentum state display
    const blinkMomentumDiv = document.createElement('div');
    blinkMomentumDiv.innerHTML = 'Blink Momentum: <span id="blink-momentum">No</span>';
    this.blinkMomentumElement = blinkMomentumDiv.querySelector('#blink-momentum')!;
    
    // Create position display for development
    let positionDiv: HTMLDivElement | null = null;
    if (this.isDevelopment) {
      positionDiv = document.createElement('div');
      positionDiv.innerHTML = 'Position: <span id="position">(0.00, 0.00, 0.00)</span>';
      positionDiv.style.marginTop = '5px';
      positionDiv.style.fontSize = '12px';
      positionDiv.style.fontFamily = 'Courier New, monospace';
      this.positionElement = positionDiv.querySelector('#position')!;
    }
    
    // Create controls info
    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginTop = '10px';
    controlsDiv.style.fontSize = '12px';
    controlsDiv.style.opacity = '0.8';
    controlsDiv.innerHTML = this.isDevelopment ? `
      <div>ESC - Menu</div>
      <div>R - Reset</div>
      <div style="margin-top: 5px; color: #ff0;">P - Log Position</div>
      <div style="color: #ff0;">C - Copy to Clipboard</div>
    ` : `
      <div>ESC - Menu</div>
      <div>R - Reset</div>
    `;
    
    // Append elements
    this.container.appendChild(fpsDiv);
    this.container.appendChild(velocityDiv);
    this.container.appendChild(vVelocityDiv);
    this.container.appendChild(groundedDiv);
    this.container.appendChild(slidingDiv);
    this.container.appendChild(currentSpeedDiv);
    this.container.appendChild(rocketJumpDiv);
    this.container.appendChild(blinkMomentumDiv);
    if (positionDiv) {
      this.container.appendChild(positionDiv);
    }
    this.container.appendChild(controlsDiv);
    document.body.appendChild(this.container);
  }
  
  update(
    velocity: { x: number; y: number; z: number }, 
    grounded: boolean, 
    sliding: boolean = false, 
    position?: { x: number; y: number; z: number },
    currentSpeed?: number,
    isRocketJumping?: boolean,
    rocketJumpSpeed?: number,
    isBlinkMomentum?: boolean,
    blinkMomentumSpeed?: number
  ) {
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

    // Update current speed (controller's internal speed)
    if (currentSpeed !== undefined) {
      this.currentSpeedElement.textContent = currentSpeed.toFixed(1);
      // Color code speed: normal (white), fast (yellow), very fast (orange)
      if (currentSpeed > 25) {
        this.currentSpeedElement.style.color = '#ff8800'; // Orange for very fast
      } else if (currentSpeed > 15) {
        this.currentSpeedElement.style.color = '#ffff00'; // Yellow for fast
      } else {
        this.currentSpeedElement.style.color = '#ffffff'; // White for normal
      }
    }

    // Update rocket jump state
    if (isRocketJumping !== undefined && rocketJumpSpeed !== undefined) {
      if (isRocketJumping) {
        this.rocketJumpElement.textContent = `Yes (${rocketJumpSpeed.toFixed(1)} m/s)`;
        this.rocketJumpElement.style.color = '#ff4400'; // Orange-red for rocket jumping
      } else {
        this.rocketJumpElement.textContent = 'No';
        this.rocketJumpElement.style.color = '#888'; // Gray when not rocket jumping
      }
    }

    // Update blink momentum state
    if (isBlinkMomentum !== undefined && blinkMomentumSpeed !== undefined) {
      if (isBlinkMomentum) {
        this.blinkMomentumElement.textContent = `Yes (${blinkMomentumSpeed.toFixed(1)} m/s)`;
        this.blinkMomentumElement.style.color = '#00ffff'; // Cyan for blink momentum
      } else {
        this.blinkMomentumElement.textContent = 'No';
        this.blinkMomentumElement.style.color = '#888'; // Gray when not in blink momentum
      }
    }
    
    // Update position if provided (development mode)
    if (position && this.positionElement) {
      this.positionElement.textContent = `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`;
    }
  }
  
  destroy() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 