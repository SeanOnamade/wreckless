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
  
  // Combat UI elements
  private combatContainer: HTMLDivElement | null = null;
  private classElement: HTMLSpanElement | null = null;
  private meleeCooldownElement: HTMLSpanElement | null = null;
  private lastHitElement: HTMLSpanElement | null = null;
  private targetHealthElement: HTMLSpanElement | null = null;
  private combatLogElement: HTMLDivElement | null = null;
  
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;
  private isDevelopment: boolean;
  
  // Combat state tracking
  private combatLog: string[] = [];
  private maxLogEntries = 5;
  
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
    
    // Create combat info section (development mode)
    if (this.isDevelopment) {
      this.combatContainer = document.createElement('div');
      this.combatContainer.style.cssText = `
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.3);
        font-size: 13px;
      `;
      
      // Combat header
      const combatHeader = document.createElement('div');
      combatHeader.style.cssText = `
        color: #ff6666;
        font-weight: bold;
        margin-bottom: 5px;
      `;
      combatHeader.textContent = '⚔️ COMBAT';
      
      // Current class and damage
      const classDiv = document.createElement('div');
      classDiv.innerHTML = 'Class: <span id="combat-class">blast</span>';
      this.classElement = classDiv.querySelector('#combat-class')!;
      
      // Melee cooldown
      const cooldownDiv = document.createElement('div');
      cooldownDiv.innerHTML = 'Melee: <span id="melee-cooldown">Ready</span>';
      this.meleeCooldownElement = cooldownDiv.querySelector('#melee-cooldown')!;
      
      // Last hit info
      const lastHitDiv = document.createElement('div');
      lastHitDiv.innerHTML = 'Last Hit: <span id="last-hit">None</span>';
      this.lastHitElement = lastHitDiv.querySelector('#last-hit')!;
      
      // Target health (will show closest dummy)
      const targetHealthDiv = document.createElement('div');
      targetHealthDiv.innerHTML = 'Target: <span id="target-health">No target</span>';
      this.targetHealthElement = targetHealthDiv.querySelector('#target-health')!;
      
      // Combat log
      const logHeader = document.createElement('div');
      logHeader.style.cssText = `
        margin-top: 8px;
        margin-bottom: 3px;
        color: #ffaa66;
        font-size: 12px;
      `;
      logHeader.textContent = '📜 Combat Log:';
      
      this.combatLogElement = document.createElement('div');
      this.combatLogElement.style.cssText = `
        font-size: 11px;
        max-height: 60px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.3);
        padding: 3px;
        border-radius: 3px;
      `;
      
      // Assemble combat section
      this.combatContainer.appendChild(combatHeader);
      this.combatContainer.appendChild(classDiv);
      this.combatContainer.appendChild(cooldownDiv);
      this.combatContainer.appendChild(lastHitDiv);
      this.combatContainer.appendChild(targetHealthDiv);
      this.combatContainer.appendChild(logHeader);
      this.combatContainer.appendChild(this.combatLogElement);
    }
    
    // Create controls info
    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginTop = '10px';
    controlsDiv.style.fontSize = '12px';
    controlsDiv.style.opacity = '0.8';
    controlsDiv.innerHTML = this.isDevelopment ? `
      <div>ESC - Menu</div>
      <div>R - Reset</div>
      <div>LMB - Melee Attack</div>
      <div style="margin-top: 5px; color: #ff0;">P - Log Position</div>
      <div style="color: #ff0;">C - Copy to Clipboard</div>
    ` : `
      <div>ESC - Menu</div>
      <div>R - Reset</div>
      <div>LMB - Melee Attack</div>
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
    if (this.combatContainer) {
      this.container.appendChild(this.combatContainer);
    }
    this.container.appendChild(controlsDiv);
    document.body.appendChild(this.container);
    
    // Set up combat event listeners
    this.setupCombatEventListeners();
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
  
  /**
   * Set up event listeners for combat events
   */
  private setupCombatEventListeners(): void {
    if (!this.isDevelopment) return;
    
    // Listen for class changes
    window.addEventListener('playerClassChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.updateClass(customEvent.detail.className);
    });
    
    // Listen for melee hits
    window.addEventListener('meleeHit', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { targetId, damage, className, isCrit, isBonus } = customEvent.detail;
      this.updateLastHit(targetId, damage, className);
      
      // Generate special combat log messages
      let logMessage = `Hit ${targetId} for ${damage} HP (${className})`;
      if (isCrit) {
        logMessage = `🪝 GRAPPLE CRIT! ${targetId} for ${damage} HP`;
      } else if (isBonus) {
        logMessage = `⚡ BONUS HIT! ${targetId} for ${damage} HP`;
      }
      
      this.addCombatLog(logMessage);
    });
    
    // Listen for ability activations to track blink timing
    window.addEventListener('abilityActivated', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.className === 'blink') {
        this.addCombatLog('⚡ Blink activated (bonus damage ready)');
      }
    });
    
    // Listen for combat log messages (like grapple velocity logs)
    window.addEventListener('combatLogMessage', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.addCombatLog(customEvent.detail.message);
    });
  }
  
  /**
   * Update combat information in the UI
   */
  updateCombat(combatData: {
    currentClass?: string;
    meleeCooldown?: number;
    canMelee?: boolean;
    nearestTargetHealth?: { id: string; health: number; maxHealth: number };
  }): void {
    if (!this.isDevelopment) return;
    
    // Update class
    if (combatData.currentClass && this.classElement) {
      this.updateClass(combatData.currentClass);
    }
    
    // Update melee cooldown
    if (this.meleeCooldownElement) {
      if (combatData.canMelee === false && combatData.meleeCooldown !== undefined) {
        const remaining = Math.ceil(combatData.meleeCooldown / 100) / 10; // Convert to seconds
        this.meleeCooldownElement.textContent = `${remaining.toFixed(1)}s`;
        this.meleeCooldownElement.style.color = '#ff6666';
      } else {
        this.meleeCooldownElement.textContent = 'Ready';
        this.meleeCooldownElement.style.color = '#66ff66';
      }
    }
    
    // Update nearest target health
    if (this.targetHealthElement) {
      if (combatData.nearestTargetHealth) {
        const { id, health, maxHealth } = combatData.nearestTargetHealth;
        const percentage = (health / maxHealth) * 100;
        this.targetHealthElement.textContent = `${id} (${health}/${maxHealth} HP)`;
        
        // Color code based on health percentage
        if (percentage > 75) {
          this.targetHealthElement.style.color = '#66ff66'; // Green
        } else if (percentage > 25) {
          this.targetHealthElement.style.color = '#ffff66'; // Yellow
        } else if (percentage > 0) {
          this.targetHealthElement.style.color = '#ff6666'; // Red
        } else {
          this.targetHealthElement.style.color = '#888888'; // Gray (KO'd)
        }
      } else {
        this.targetHealthElement.textContent = 'No target in range';
        this.targetHealthElement.style.color = '#888888';
      }
    }
  }
  
  /**
   * Update the current class display
   */
  private updateClass(className: string): void {
    if (!this.classElement) return;
    
    this.classElement.textContent = className;
    
    // Color code by class
    switch (className) {
      case 'blast':
        this.classElement.style.color = '#ff6666'; // Red
        break;
      case 'grapple':
        this.classElement.style.color = '#66ff66'; // Green
        break;
      case 'blink':
        this.classElement.style.color = '#6666ff'; // Blue
        break;
      default:
        this.classElement.style.color = '#ffffff'; // White
    }
  }
  
  /**
   * Update the last hit information
   */
  private updateLastHit(targetId: string, damage: number, _className: string): void {
    if (!this.lastHitElement) return;
    
    this.lastHitElement.textContent = `${targetId} (${damage} dmg)`;
    this.lastHitElement.style.color = '#ffaa66'; // Orange
    
    // Flash effect
    setTimeout(() => {
      if (this.lastHitElement) {
        this.lastHitElement.style.color = '#ffffff';
      }
    }, 1000);
  }
  
  /**
   * Add an entry to the combat log
   */
  private addCombatLog(message: string): void {
    if (!this.combatLogElement) return;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString().split(':').slice(1, 3).join(':'); // MM:SS
    const logEntry = `${timestamp} ${message}`;
    
    // Add to log array
    this.combatLog.unshift(logEntry);
    if (this.combatLog.length > this.maxLogEntries) {
      this.combatLog.pop();
    }
    
    // Update UI
    this.combatLogElement.innerHTML = this.combatLog
      .map(entry => `<div style="margin-bottom: 1px;">${entry}</div>`)
      .join('');
    
    // Scroll to top (newest entry)
    this.combatLogElement.scrollTop = 0;
  }
  
  destroy() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 