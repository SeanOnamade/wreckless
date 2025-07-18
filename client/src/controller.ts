import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SPAWN_POS } from './track/ExternalTrack';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { toggleCombatMode } from './config/combat';
import { Network } from './net';
import { getCurrentPlayerKit } from './kits/classKit';

export class FirstPersonController {
  private camera: THREE.Camera;
  private playerBody: RAPIER.RigidBody;
  private controller: RAPIER.KinematicCharacterController;
  private checkpointSystem: CheckpointSystem | null = null;
  
  // Killzone detection
  private timeInVoid = 0;
  
  // Movement state
  private keys: { [key: string]: boolean } = {};
  
  // Mouse button state for networking
  private mouseButtons = { left: false, right: false };
  
  private moveSpeed = 18.0; // 18 m/s base speed (increased for movement shooter feel)
  private slideSpeed = 24.0; // 24 m/s slide speed (increased for faster gameplay)
  private jumpVelocity = 12.0; // Increased for better jump height with reduced gravity
  private maxSpeed = 150.0; // Maximum speed for rocket jumping (increased for fast gameplay)
  private isGrounded = false;
  private canJump = true;
  private isSliding = false;
  private isRocketJumping = false; // Track if we're in rocket jump state
  private rocketJumpSpeed = 0; // Store the rocket jump speed
  private isSwinging = false; // Track if we're in swing state
  private swingMaxSpeed = 120.0; // Higher speed limit while swinging (increased)
  private isBlinkMomentum = false; // Track if current speed boost is from blink
  private blinkMomentumSpeed = 0; // Store the blink momentum speed
  
  // Speed boost system
  private baseMoveSpeed = 18.0; // Original move speed
  private isSpeedBoosted = false;
  private speedBoostEndTime = 0;
  
  // Mouse look
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private pitch = 0;
  private yaw = 0;
  private mouseSensitivity = 0.002;
  private isPointerLocked = false;
  
  // Movement vector
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveVector = new THREE.Vector3();
  private currentSpeed = 0;
  private acceleration = 25.0; // How fast we accelerate (increased for snappier feel)
  private deceleration = 8.0; // How fast we stop (reduced for less sluggishness)
  
  // PvP Combat state
  private combatState = {
    isAttacking: false,
    isBlocking: false,
    attackStartTime: 0,
    blockStartTime: 0
  };
  private combatTimerInterval: number | null = null;
  
  // Momentum preservation for airborne movement
  private preservedMomentum = new THREE.Vector3(); // World-space momentum vector
  
  constructor(
    camera: THREE.Camera,
    playerBody: RAPIER.RigidBody,
    controller: RAPIER.KinematicCharacterController,
    _world: RAPIER.World
  ) {
    this.camera = camera;
    this.playerBody = playerBody;
    this.controller = controller;
    
    this.setupEventListeners();
    this.setupSwingStateListener();

    // Listen for blast impulse events
    window.addEventListener('blastImpulse', (event: Event) => {
      this.handleBlastImpulse((event as CustomEvent).detail);
    });
    
    // Listen for speed boost events from racing dummies
    window.addEventListener('speedBoostGranted', (event: Event) => {
      this.handleSpeedBoost((event as CustomEvent).detail);
    });
    
    // Listen for combat state requests from testing HUD
    window.addEventListener('requestCombatState', () => {
      this.broadcastCombatState();
    });
    
    console.log('FirstPersonController initialized with pointer lock');
  }
  
  private setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Debug: Log digit keys in controller to check for conflicts
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        console.log('🎮 Controller captured digit key:', e.code);
      }
      
      // Special keys
      if (e.code === 'KeyR') {
        this.reset();
      } else if (e.code === 'KeyM') {
        // Toggle combat mode for testing
        const newMode = toggleCombatMode();
        console.log(`🔄 Combat mode toggled to: ${newMode.toUpperCase()}`);
        console.log(`   • MANUAL mode: Click to hit dummies (original system)`);
        console.log(`   • PASSTHROUGH mode: Move through dummies to damage (new system)`);
      } else if (e.code === 'KeyV') {
        e.preventDefault(); // Prevent any default browser behavior
        console.log('🧪 V key detected, calling handleVKeybinds...');
        this.handleVKeybinds(e);
      }
      
      // Send current movement state to network (real-time)
      this.updateNetworkInput();
    });
    
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      
      // Send current movement state to network (real-time)
      this.updateNetworkInput();
    });
    
    // Mouse button events for melee combat
    document.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;
      
      // Update network mouse button state FIRST (regardless of combat state)
      if (e.button === 0) {
        this.mouseButtons.left = true;
      } else if (e.button === 2) {
        this.mouseButtons.right = true;
      }
      this.updateNetworkInput();
      
      if (e.button === 0) { // Left mouse button (LMB) - Attack
        // Can't attack while blocking
        if (this.combatState.isBlocking) {
          console.log('❌ Cannot attack while blocking');
          return;
        }
        
        this.combatState.isAttacking = true;
        this.combatState.attackStartTime = Date.now();
        console.log('⚔️ Attack started (1s limit)');
        
        // Start timer for live updates
        this.startCombatTimer();
        
        // Keep existing meleeAttack event for dummy targeting (manual mode)
        window.dispatchEvent(new CustomEvent('meleeAttack', {
          detail: { timestamp: Date.now() }
        }));
        
        // Broadcast state change
        this.broadcastCombatState();
        
      } else if (e.button === 2) { // Right mouse button (RMB) - Block
        // Can't block while attacking
        if (this.combatState.isAttacking) {
          console.log('❌ Cannot block while attacking');
          return;
        }
        
        this.combatState.isBlocking = true;
        this.combatState.blockStartTime = Date.now();
        console.log('🛡️ Blocking started (1s limit)');
        
        // Start timer for live updates
        this.startCombatTimer();
        
        // Broadcast state change
        this.broadcastCombatState();
      }
    });
    
    // Mouse button release events for PvP combat
    document.addEventListener('mouseup', (e) => {
      // Update network mouse button state FIRST (regardless of combat state)
      if (e.button === 0) {
        this.mouseButtons.left = false;
      } else if (e.button === 2) {
        this.mouseButtons.right = false;
      }
      this.updateNetworkInput();
      
      if (e.button === 0) { // LMB release
        if (this.combatState.isAttacking) {
          this.combatState.isAttacking = false;
          this.combatState.attackStartTime = 0;
          console.log('⚔️ Attack ended (manual release)');
          // Broadcast state change
          this.broadcastCombatState();
        }
      } else if (e.button === 2) { // RMB release
        if (this.combatState.isBlocking) {
          this.combatState.isBlocking = false;
          this.combatState.blockStartTime = 0;
          console.log('🛡️ Blocking ended (manual release)');
          // Broadcast state change
          this.broadcastCombatState();
        }
      }
    });
    
    // Prevent context menu on right click
    document.addEventListener('contextmenu', (e) => {
      if (this.isPointerLocked) {
        e.preventDefault();
      }
    });
    
    // Simple, responsive mouse events with safety bounds
    document.addEventListener('mousemove', (e) => {
      // Pointer lock check (reduced logging for performance)
      if (!this.isPointerLocked && Math.abs(e.movementX) > 0) {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) console.log('🔒 Mouse not locked - click to enable FPS controls');
      }
      
      if (this.isPointerLocked) {
        // Add bounds checking to prevent extreme values that could cause glitches
        const deltaX = Math.max(-0.5, Math.min(0.5, e.movementX * this.mouseSensitivity));
        const deltaY = Math.max(-0.5, Math.min(0.5, e.movementY * this.mouseSensitivity));
        
        this.yaw -= deltaX;
        this.pitch -= deltaY;
        
        // Clamp pitch to prevent camera flipping
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        
        // Normalize yaw to prevent accumulation issues
        this.yaw = this.yaw % (2 * Math.PI);
        
        // Send mouse movement to network (preserve current button states)
        Network.updateMouseInput(this.mouseButtons.left, this.mouseButtons.right, { x: deltaX, y: deltaY });
        
        // Send updated camera rotation to network immediately
        Network.updateCameraInput(this.yaw, this.pitch);
        
        // Update debug overlay with current movement state during mouse movement
        if (Network.isNetworkingEnabled()) {
          const movementState = {
            forward: this.keys['KeyW'] || false,
            backward: this.keys['KeyS'] || false,
            left: this.keys['KeyA'] || false,
            right: this.keys['KeyD'] || false
          };
          this.updateInputDebugOverlay(movementState);
        }
        
        // Debug: Log when mouse movement updates camera (very rarely to avoid spam)
        if ((Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) && Math.random() < 0.001) {
          console.log(`🖱️ Mouse moved: yaw=${(this.yaw * 180 / Math.PI).toFixed(1)}° (deltaX=${deltaX.toFixed(3)}) - Camera data sent to network`);
          
          // Extra debug: Check what's actually in the network input
          const debugInfo = Network.getDebugInfo() as any;
          const cameraData = debugInfo.lastInput?.camera;
          console.log(`   📡 Current network input camera: yaw=${cameraData?.yaw?.toFixed(3)} pitch=${cameraData?.pitch?.toFixed(3)}`);
        }
      }
    });
    
    // Pointer lock
    document.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        document.body.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === document.body;
    });
    
    // Ability events
    window.addEventListener('blastSelfImpulse', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleBlastImpulse(customEvent.detail);
    });
    
    window.addEventListener('blinkMomentumImpulse', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleBlinkMomentumImpulse(customEvent.detail);
    });
  }
  

  
  private setupSwingStateListener() {
    // Listen for swing state changes from grapple ability
    window.addEventListener('swingStateChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.isSwinging = customEvent.detail.isSwinging;
      console.log(`🎯 CONTROLLER: Swing state changed - isSwinging: ${this.isSwinging}`);
    });
    
    // Listen for swing release momentum preservation
    window.addEventListener('swingReleaseImpulse', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleSwingReleaseMomentum(customEvent.detail);
    });
  }
  
  /**
   * Handle swing release momentum preservation - similar to blast momentum
   */
  private handleSwingReleaseMomentum(data: any): void {
    // Safety check: ignore swing momentum if we're not actually swinging
    // This prevents race conditions after respawn
    if (!this.isSwinging) {
      console.log('🚫 Swing momentum ignored - player not in swing state (likely after respawn)');
      return;
    }
    
    const velocity = data.velocity; // THREE.Vector3 of current swing velocity
    
    // Apply swing momentum to controller velocity system (like blast impulse)
    
    // 1. Apply Y-component to vertical velocity with upward boost on release
    const SWING_RELEASE_BOOST = 18.0; // Upward boost when releasing swing
    this.velocity.y = velocity.y + SWING_RELEASE_BOOST;
    
    // 2. Apply horizontal components to movement system
    const horizontalVelocity = new THREE.Vector3(velocity.x, 0, velocity.z);
    const horizontalSpeed = horizontalVelocity.length();
    
    if (horizontalSpeed > 0.1) {
      // Set movement direction to swing direction
      horizontalVelocity.normalize();
      this.direction.copy(horizontalVelocity);
      
      // Preserve swing speed without clamping (like TF2-style rocket jump)
      this.currentSpeed = horizontalSpeed;
      this.isRocketJumping = true; // Use rocket jump flag to preserve momentum
      this.rocketJumpSpeed = horizontalSpeed;
    }
  }

  /**
   * Handle blink momentum impulse for smooth post-teleport movement
   */
  private handleBlinkMomentumImpulse(data: any): void {
    const impulse = data.impulse; // THREE.Vector3 forward momentum
    
    // Apply forward momentum to make blink feel more fluid
    // Use rocket jump system to prevent speed capping
    
    // Set movement direction to blink direction
    const horizontalImpulse = new THREE.Vector3(impulse.x, 0, impulse.z);
    const horizontalSpeed = horizontalImpulse.length();
    
    if (horizontalSpeed > 0.1) {
      horizontalImpulse.normalize();
      this.direction.copy(horizontalImpulse);
      
      // Apply moderate forward momentum (not as aggressive as rocket jump)
      const blinkMomentumSpeed = Math.max(horizontalSpeed * 8.0, this.moveSpeed * 1.3); // 8x multiplier for forward feel
      this.currentSpeed = Math.min(blinkMomentumSpeed, 35.0); // Cap at reasonable speed
      
      // CRITICAL: Set rocket jump state to prevent speed capping back to 18 m/s
      this.isRocketJumping = true;
      this.rocketJumpSpeed = this.currentSpeed;
      this.isBlinkMomentum = true; // Track that this is blink momentum, not blast
      this.blinkMomentumSpeed = this.currentSpeed;
      
      // Short momentum preservation
      this.preservedMomentum.copy(this.direction.clone().multiplyScalar(this.currentSpeed * 0.016));
      
      console.log(`⚡ BLINK momentum applied: ${this.currentSpeed.toFixed(1)} m/s forward (rocket jump state SET)`);
    }
    
    // Small upward component if any
    if (impulse.y > 0.1) {
      this.velocity.y += impulse.y * 2.0; // Moderate upward boost
    }
  }
  
  /**
   * Handle blast impulse from blast ability - 3D Directional Rocket Jumping
   */
  private handleBlastImpulse(data: any): void {
    const impulse = data.impulse;
    const isDirectional3D = data.isDirectional3D;
    const isTF2Style = data.isTF2Style;
    
    if (!isDirectional3D) {
      console.log(`🎯 CONTROLLER: Legacy blast impulse (non-3D) - ignoring`);
      return;
    }
    
    // Apply the 3D blast impulse to the player's velocity system
    // The controller uses separate systems for Y (this.velocity.y) and horizontal (currentSpeed + direction)
    
    // 1. Apply Y-component to vertical velocity
    this.velocity.y += impulse.y;
    
    // 2. Apply horizontal components to the movement system
    const horizontalImpulse = new THREE.Vector3(impulse.x, 0, impulse.z);
    const horizontalSpeed = horizontalImpulse.length();
    
    if (isTF2Style) {
      // TF2-style blasts: ALWAYS set rocket jump state for consistent powerful movement
      this.isRocketJumping = true; // Always flag as rocket jumping for blasts
      
      const minPowerfulBlast = 25.0; // Threshold for what feels like a "powerful" blast
      
      if (horizontalSpeed >= minPowerfulBlast) {
        // Truly powerful blast - use full blast direction and speed
        horizontalImpulse.normalize();
        this.direction.copy(horizontalImpulse);
        this.currentSpeed = horizontalSpeed; // Pure horizontal freedom
        this.rocketJumpSpeed = horizontalSpeed;
        console.log(`🚀 BLAST: Powerful (${horizontalSpeed.toFixed(1)} m/s) - rocket jump state SET`);
      } else {
        // Weak/medium blast - boost to minimum powerful speed
        const minBlastSpeed = Math.max(minPowerfulBlast, this.moveSpeed * 1.4); // Ensure 25+ m/s minimum
        
        if (horizontalSpeed > 1.0) {
          // Has some direction - use blast direction but boost speed
          horizontalImpulse.normalize();
          this.direction.copy(horizontalImpulse);
        }
        // If horizontalSpeed <= 1.0, maintain current direction
        
        this.currentSpeed = minBlastSpeed; // Ensure blast always feels powerful
        this.rocketJumpSpeed = minBlastSpeed;
        console.log(`🚀 BLAST: Boosted weak (${horizontalSpeed.toFixed(1)} m/s → ${minBlastSpeed.toFixed(1)} m/s) - rocket jump state SET`);
      }
    } else {
      // Legacy behavior for backwards compatibility
      if (horizontalSpeed > 0.1) {
        horizontalImpulse.normalize();
        this.direction.copy(horizontalImpulse);
        this.currentSpeed = Math.min(horizontalSpeed, this.maxSpeed);
        this.isRocketJumping = horizontalSpeed > this.moveSpeed;
        this.rocketJumpSpeed = this.currentSpeed;
      }
    }
    
    // 3. Only apply total speed cap if NOT TF2-style (for horizontal freedom)
    if (!isTF2Style) {
      const totalSpeed = Math.sqrt(impulse.x * impulse.x + impulse.y * impulse.y + impulse.z * impulse.z);
      if (totalSpeed > this.maxSpeed) {
        const ratio = this.maxSpeed / totalSpeed;
        this.velocity.y *= ratio;
        this.currentSpeed *= ratio;
      }
    }
    
    // Force player to be considered not grounded to allow the launch
    this.isGrounded = false;
    
    // Reset jump ability after rocket jump
    this.canJump = true;
  }
  
  /**
   * Handle speed boost from racing dummies
   */
  private handleSpeedBoost(data: any): void {
    const { fromVelocity, toVelocity, duration, damage, source } = data;
    
    // Apply speed boost to controller
    
    // Apply speed boost
    this.moveSpeed = toVelocity; // Update actual moveSpeed used in movement calculations
    this.isSpeedBoosted = true;
    this.speedBoostEndTime = Date.now() + duration;
    
    console.log(`🏎️ SPEED BOOST ACTIVE! ${fromVelocity}→${toVelocity} m/s for ${(duration/1000).toFixed(1)}s (${damage} damage from ${source})`);
    
    // Speed boost applied successfully
    
    // Visual feedback - dispatch event for UI
    window.dispatchEvent(new CustomEvent('speedBoostActive', {
      detail: { 
        fromSpeed: fromVelocity, 
        toSpeed: toVelocity, 
        duration: duration,
        damage: damage 
      }
    }));
  }

  /**
   * Send current input state to network (if online)
   */
  private updateNetworkInput(): void {
    const movementState = {
      forward: this.keys['KeyW'] || false,
      backward: this.keys['KeyS'] || false,
      left: this.keys['KeyA'] || false,
      right: this.keys['KeyD'] || false
    };
    
    // Send movement input to network
    Network.updateMovementInput(
      movementState.forward,
      movementState.backward,
      movementState.left,
      movementState.right
    );
    
    // Send action input (jump, slide, ability)
    Network.updateActionInput(
      this.keys['Space'] || false,
      this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false,
      this.keys['KeyE'] || false
    );
    
    // Get current ability type
    const currentKit = getCurrentPlayerKit() || { className: 'blast' };
    
    // Send state input (movement enhancement states)
    Network.updateStateInput(
      this.isRocketJumping,
      this.isSwinging,
      this.isBlinkMomentum,
      this.isSliding,
      currentKit.className
    );
    
    // Debug: Log when any interesting states are true (or actions)
    const hasActions = this.keys['Space'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyE'];
    const hasStates = this.isRocketJumping || this.isSwinging || this.isBlinkMomentum || this.isSliding;
    
    if (hasStates || (hasActions && Math.random() < 0.1)) { // Log states always, actions occasionally
      console.log(`🎮 CLIENT input:`, {
        // Movement
        movement: {
          W: this.keys['KeyW'] || false,
          S: this.keys['KeyS'] || false,
          A: this.keys['KeyA'] || false,
          D: this.keys['KeyD'] || false
        },
        // Actions
        actions: {
          Space: this.keys['Space'] || false,
          Shift: this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false,
          E: this.keys['KeyE'] || false
        },
        // States
        states: {
          rocket: this.isRocketJumping,
          swing: this.isSwinging, 
          blink: this.isBlinkMomentum,
          slide: this.isSliding,
          ability: currentKit.className
        }
      });
    }
    
    // Send mouse input to network
    Network.updateMouseInput(this.mouseButtons.left, this.mouseButtons.right, { x: 0, y: 0 });
    
    // Note: Camera rotation is updated in mousemove event, not here
    
    // Update debug overlay if online
    if (Network.isNetworkingEnabled()) {
      this.updateInputDebugOverlay(movementState);
    }
  }

  /**
   * Update on-screen debug overlay showing input state
   */
  private updateInputDebugOverlay(movement: any): void {
    let overlay = document.getElementById('input-debug-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'input-debug-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 120px;
        left: 20px;
        background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95));
        color: #00ff00;
        padding: 12px 16px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        border-radius: 8px;
        z-index: 999;
        pointer-events: none;
        border: 1px solid rgba(0, 255, 0, 0.3);
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
        backdrop-filter: blur(5px);
        min-width: 220px;
      `;
      document.body.appendChild(overlay);
    }
    
    const mouseState = `LMB:${this.mouseButtons.left} RMB:${this.mouseButtons.right}`;
    const moveState = `W:${movement.forward} A:${movement.left} S:${movement.backward} D:${movement.right}`;
    const yawDegrees = (this.yaw * 180 / Math.PI).toFixed(1);
    
    overlay.innerHTML = `
      <div>🌐 NETWORK INPUT DEBUG</div>
      <div>Movement: ${moveState}</div>
      <div>Mouse: ${mouseState}</div>
      <div>Camera Yaw: ${yawDegrees}°</div>
      <div>Status: ${Network.isNetworkingEnabled() ? '✅ Online' : '❌ Offline'}</div>
    `;
  }

  /**
   * Update speed boost state (call this in update loop)
   */
  private updateSpeedBoost(): void {
    if (this.isSpeedBoosted && Date.now() >= this.speedBoostEndTime) {
      // Speed boost expired
      this.isSpeedBoosted = false;
      this.moveSpeed = this.baseMoveSpeed;
      
      console.log(`⏰ Speed boost expired - back to ${this.baseMoveSpeed} m/s`);
      
      // Dispatch speed boost end event
      window.dispatchEvent(new CustomEvent('speedBoostEnded', {
        detail: { normalSpeed: this.baseMoveSpeed }
      }));
    }
  }
  
  update(deltaTime: number) {
    // Get current position
    const translation = this.playerBody.translation();
    
    // Update combat state (check attack time limit)
    this.updateCombatState();
    
    // Update speed boost state
    this.updateSpeedBoost();
    
    // Check for killzone conditions (multiple fallbacks for robustness)
    const shouldRespawn = this.checkKillzoneConditions(translation);
    if (shouldRespawn) {
      // Dispatch respawn event BEFORE reset to avoid circular dependency
      const respawnPosition = this.checkpointSystem 
        ? this.checkpointSystem.getLastCheckpointPosition()
        : SPAWN_POS;
      
      window.dispatchEvent(new CustomEvent('playerRespawn', {
        detail: { reason: 'out-of-bounds', position: respawnPosition }
      }));
      
      this.reset();
      return; // Skip rest of update to avoid processing movement
    }
    
    // Check slide state
    this.isSliding = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    
    // Calculate movement direction based on camera rotation
    const inputDirection = new THREE.Vector3(0, 0, 0);
    
    if (this.keys['KeyW']) inputDirection.z -= 1;
    if (this.keys['KeyS']) inputDirection.z += 1;
    if (this.keys['KeyA']) inputDirection.x -= 1;
    if (this.keys['KeyD']) inputDirection.x += 1;
    
        // Handle direction and input
    const hasInput = inputDirection.length() > 0;
    if (hasInput) {
      this.direction.copy(inputDirection).normalize();
    } else {
      // No input - will handle momentum preservation after camera rotation
      this.direction.set(0, 0, 0);
    }
    
    // Determine target speed based on current state
    const normalTargetSpeed = this.isSliding ? this.slideSpeed : this.moveSpeed;
    
    // Reset rocket jump state when grounded (return to normal speeds)
    if (this.isGrounded && this.isRocketJumping) {
      this.isRocketJumping = false;
      this.rocketJumpSpeed = 0;
      this.isBlinkMomentum = false; // Reset blink momentum state
      this.blinkMomentumSpeed = 0;
      this.preservedMomentum.set(0, 0, 0); // Clear preserved momentum when landing
    }
    
    // Determine effective max speed based on current state
    const effectiveMaxSpeed = this.isSwinging ? this.swingMaxSpeed : this.maxSpeed;
    
    // Determine target speed: preserve rocket jump speed while airborne
    let targetSpeed;
    if (this.isRocketJumping && !this.isGrounded) {
      // Airborne rocket jumping - preserve high speed
      targetSpeed = Math.min(this.rocketJumpSpeed, effectiveMaxSpeed);
    } else if (this.isSwinging) {
      // Swinging - allow higher speeds
      targetSpeed = effectiveMaxSpeed;
    } else {
      // Normal ground movement
      targetSpeed = normalTargetSpeed;
    }
    
    // Handle speed changes
    if (hasInput) {
      const accel = this.isSliding ? this.acceleration * 1.5 : this.acceleration;
      
      if (this.isRocketJumping && !this.isGrounded) {
        // Rocket jumping: LIMITED air control
        const airControlFactor = 0.2;
        const speedChange = accel * deltaTime * airControlFactor;
        this.currentSpeed = Math.min(this.currentSpeed + speedChange, effectiveMaxSpeed);
        
        // Blend direction for air steering
        const steerAmount = 0.3 * deltaTime;
        this.direction.lerp(inputDirection.normalize(), steerAmount);
      } else {
        // Normal movement: accelerate to target speed
        this.currentSpeed = Math.min(this.currentSpeed + accel * deltaTime, targetSpeed);
      }
    } else {
      // No input - handle deceleration (except for airborne rocket jumping)
      if (!(this.isRocketJumping && !this.isGrounded)) {
      const baseDecel = this.isSliding ? this.deceleration * 0.5 : this.deceleration;
        this.currentSpeed = Math.max(this.currentSpeed - baseDecel * deltaTime, 0);
      }
    }
    
    // Apply camera rotation to movement direction
    this.euler.set(0, this.yaw, 0);
    this.direction.applyEuler(this.euler);
    
    // Handle momentum preservation for airborne rocket jumping
    if (this.isRocketJumping && !this.isGrounded && !hasInput) {
      // Use preserved world-space momentum instead of current direction
      this.moveVector.copy(this.preservedMomentum);
    } else {
      // Normal movement or with input - calculate movement from current direction/speed
    this.moveVector.copy(this.direction).multiplyScalar(this.currentSpeed * deltaTime);
      
      // Update preserved momentum when we have input or are grounded
      if (hasInput || this.isGrounded) {
        this.preservedMomentum.copy(this.moveVector);
      }
    }
    
    // Debug: Log movement state for rocket jumping (disabled to reduce console spam)
    // if (this.currentSpeed > 20.0) { // Only log when moving fast (likely rocket jump)
    //   console.log(`🎯 MOVEMENT: speed=${this.currentSpeed.toFixed(1)}, direction=(${this.direction.x.toFixed(2)}, 0, ${this.direction.z.toFixed(2)}), hasInput=${hasInput}`);
    // }
    
    // Check grounded state BEFORE applying gravity/movement
    // First, do a small downward test to see if we're grounded
    const testMovement = new THREE.Vector3(0, -0.01, 0);
    this.controller.computeColliderMovement(
      this.playerBody.collider(0)!,
      testMovement,
      RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
    );
    this.isGrounded = this.controller.computedGrounded();
    
    // Additional safety check: if we're very close to ground, consider grounded
    if (!this.isGrounded && this.velocity.y <= 0.1) {
      const groundTestMovement = new THREE.Vector3(0, -0.05, 0);
      this.controller.computeColliderMovement(
        this.playerBody.collider(0)!,
        groundTestMovement,
        RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
      );
      this.isGrounded = this.controller.computedGrounded();
    }
    
    // If we're grounded and falling, stop downward velocity
    if (this.isGrounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }
    
    // Update killzone tracking
    this.updateKillzoneTracking(deltaTime);
    
    // Apply context-sensitive gravity when not grounded
    if (!this.isGrounded) {
      let gravityForce = 20; // Base gravity for swinging
      
      if (this.isRocketJumping) {
        // Stronger gravity for blast jumps to prevent excessive flying
        gravityForce = 28; 
      } else if (this.isSwinging) {
        // Lighter gravity for swinging to maintain momentum
        gravityForce = 18;
      }
      
      this.velocity.y -= gravityForce * deltaTime;
    }
    
    // Clamp velocity (increased terminal velocity for momentum preservation)
    this.velocity.y = Math.max(this.velocity.y, -50); // Higher terminal velocity
    
    // Handle jumping - only when grounded and not sliding
    if (this.keys['Space'] && this.isGrounded && this.canJump && !this.isSliding) {
      this.velocity.y = this.jumpVelocity;
      this.canJump = false;
    }
    
    // Reset jump ability when space is released
    if (!this.keys['Space']) {
      this.canJump = true;
    }
    
    // IMPORTANT: Add vertical velocity to movement
    this.moveVector.y = this.velocity.y * deltaTime;
    
    // Compute collider movement with gravity (excluding sensors for checkpoint pass-through)
    this.controller.computeColliderMovement(
      this.playerBody.collider(0)!,
      this.moveVector,
      RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
    );
    
    const movement = this.controller.computedMovement();
    

    
    const newPos = {
      x: translation.x + movement.x,
      y: translation.y + movement.y,
      z: translation.z + movement.z
    };
    

    
    // Update rigid body position
    this.playerBody.setTranslation(newPos, true);
    
    // Update camera position and rotation with safety checks
    const cameraHeight = this.isSliding ? 0.4 : 0.8; // Lower camera when sliding
    
    // Safety check: ensure position values are finite to prevent camera glitches
    if (isFinite(newPos.x) && isFinite(newPos.y) && isFinite(newPos.z)) {
      this.camera.position.set(newPos.x, newPos.y + cameraHeight, newPos.z);
    } else {
      console.warn('⚠️ Invalid camera position detected, skipping update');
    }
    
    // Safety check: ensure rotation values are finite
    if (isFinite(this.pitch) && isFinite(this.yaw)) {
      this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this.euler);
    } else {
      console.warn('⚠️ Invalid camera rotation detected, resetting');
      this.pitch = 0;
      this.yaw = 0;
      this.euler.set(0, 0, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this.euler);
    }
  }
  
  /**
   * Check multiple killzone conditions for robust detection
   */
  private checkKillzoneConditions(translation: RAPIER.Vector3): boolean {
    // Condition 1: Immediate respawn if fallen very far
    if (translation.y < -5) {
      return true;
    }
    
    // Condition 2: FIXED - Direct void detection (below reasonable track level)
    // If Y is below 1.5 and we've been there for more than 1 second, respawn
    if (translation.y < 1.5 && this.timeInVoid > 1.0) {
      return true;
    }
    
    // Condition 3: Emergency respawn if very low regardless of time
    if (translation.y < 0.8) {
      return true;
    }
    
    // Condition 4: Distance-based check (far from track center)
    const distanceFromCenter = Math.sqrt(translation.x * translation.x + translation.z * translation.z);
    if (distanceFromCenter > 200 && translation.y < 2.0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Update killzone tracking timers
   */
  private updateKillzoneTracking(deltaTime: number): void {
    const translation = this.playerBody.translation();
    
    // FIXED: Accumulate void time if Y is suspiciously low, regardless of grounded state
    // This handles cases where physics detects "grounded" in the void
    if (translation.y < 1.8 || !this.isGrounded) {
      this.timeInVoid += deltaTime;
    } else {
      this.timeInVoid = 0;
    }
    
    // Debug logging (very occasional)
    if (import.meta.env.DEV && this.timeInVoid > 0.5 && Math.random() < 0.02) {
      console.log(`🕳️ Void tracking - Y: ${translation.y.toFixed(2)}, Time: ${this.timeInVoid.toFixed(1)}s, Grounded: ${this.isGrounded}`);
    }
  }
  
  getPosition(): THREE.Vector3 {
    const translation = this.playerBody.translation();
    return new THREE.Vector3(translation.x, translation.y, translation.z);
  }
  
  getRotation(): THREE.Euler {
    return new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
  }
  
  getVelocity(): THREE.Vector3 {
    // Calculate true velocity: horizontal movement + vertical velocity
    const horizontalVelocity = this.direction.clone().multiplyScalar(this.currentSpeed);
    return new THREE.Vector3(horizontalVelocity.x, this.velocity.y, horizontalVelocity.z);
  }
  
  getIsGrounded(): boolean {
    return this.isGrounded;
  }
  
  getIsSliding(): boolean {
    return this.isSliding;
  }

  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  getIsRocketJumping(): boolean {
    return this.isRocketJumping;
  }

  getRocketJumpSpeed(): number {
    return this.rocketJumpSpeed;
  }

  getIsBlinkMomentum(): boolean {
    return this.isBlinkMomentum;
  }

  getBlinkMomentumSpeed(): number {
    return this.blinkMomentumSpeed;
  }
  
  // Debug method
  getDebugInfo() {
    const translation = this.playerBody.translation();
    return {
      position: { x: translation.x, y: translation.y, z: translation.z },
      velocity: this.velocity.clone(),
      isGrounded: this.isGrounded,
      canJump: this.canJump,
      isSliding: this.isSliding,
      currentSpeed: this.currentSpeed,
      isRocketJumping: this.isRocketJumping,
      rocketJumpSpeed: this.rocketJumpSpeed
    };
  }
  
  /**
   * Set the checkpoint system for respawning
   */
  setCheckpointSystem(checkpointSystem: CheckpointSystem): void {
    this.checkpointSystem = checkpointSystem;
  }
  
    reset() {
    // Reset position to last checkpoint or spawn point
    const respawnPosition = this.checkpointSystem 
      ? this.checkpointSystem.getLastCheckpointPosition()
      : SPAWN_POS;



    // Clean up any active grapple state that might interfere with respawn
    if (this.isSwinging) {
      window.dispatchEvent(new CustomEvent('forceReleaseGrapple', {
        detail: { reason: 'respawn' }
      }));
    }

    // Note: playerRespawn event now dispatched by caller to avoid circular dependency

    this.playerBody.setTranslation({ x: respawnPosition.x, y: respawnPosition.y, z: respawnPosition.z }, true);

    // Reset all velocities
    this.playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.playerBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;

    // Reset rotation
    this.pitch = 0;
    this.yaw = 0;

    // Reset movement state
    this.isGrounded = false;
    this.canJump = true;
    this.isSliding = false;
    this.isRocketJumping = false;
    this.rocketJumpSpeed = 0;
    this.isBlinkMomentum = false;
    this.blinkMomentumSpeed = 0;
    this.isSwinging = false; // CRITICAL: Reset swing state to prevent high-speed walking bug

    // Reset killzone tracking
    this.timeInVoid = 0;
    
    // Reset preserved momentum
    this.preservedMomentum.set(0, 0, 0);
    
    // Reset speed boost state
    this.isSpeedBoosted = false;
    this.moveSpeed = this.baseMoveSpeed;
    this.speedBoostEndTime = 0;
    
    // Reset combat state on respawn
    this.combatState.isAttacking = false;
    this.combatState.isBlocking = false;
    this.combatState.attackStartTime = 0;
    this.combatState.blockStartTime = 0;
    
    // Stop combat timer
    this.stopCombatTimer();
  }
  
  /**
   * Update combat state (check time limits for both attack and block)
   */
  private updateCombatState(): void {
    const now = Date.now();
    let stateChanged = false;
    
    // Check attack time limit (1 second maximum)
    if (this.combatState.isAttacking && this.combatState.attackStartTime > 0) {
      const attackDuration = now - this.combatState.attackStartTime;
      if (attackDuration > 1000) { // 1 second limit
        this.combatState.isAttacking = false;
        this.combatState.attackStartTime = 0;
        console.log('⏰ Attack time limit reached (1s) - stopped attacking');
        stateChanged = true;
      }
    }
    
    // Check block time limit (1 second maximum)
    if (this.combatState.isBlocking && this.combatState.blockStartTime > 0) {
      const blockDuration = now - this.combatState.blockStartTime;
      if (blockDuration > 1000) { // 1 second limit
        this.combatState.isBlocking = false;
        this.combatState.blockStartTime = 0;
        console.log('⏰ Block time limit reached (1s) - stopped blocking');
        stateChanged = true;
      }
    }
    
    // Broadcast if any state changed
    if (stateChanged) {
      this.broadcastCombatState();
    }
  }

  /**
   * Broadcast current combat state to HUD components
   */
  private broadcastCombatState(): void {
    const now = Date.now();
    const attackTimeLeft = this.combatState.isAttacking && this.combatState.attackStartTime > 0 ? 
      Math.max(0, 1000 - (now - this.combatState.attackStartTime)) : 0;
    const blockTimeLeft = this.combatState.isBlocking && this.combatState.blockStartTime > 0 ? 
      Math.max(0, 1000 - (now - this.combatState.blockStartTime)) : 0;
    
    window.dispatchEvent(new CustomEvent('updateCombatState', {
      detail: {
        isAttacking: this.combatState.isAttacking,
        isBlocking: this.combatState.isBlocking,
        attackStartTime: this.combatState.attackStartTime,
        blockStartTime: this.combatState.blockStartTime,
        attackTimeLeft: attackTimeLeft,
        blockTimeLeft: blockTimeLeft
      }
    }));
  }

  /**
   * Start timer for live combat state updates (50ms intervals = 20fps)
   */
  private startCombatTimer(): void {
    if (this.combatTimerInterval !== null) return; // Already running
    
    this.combatTimerInterval = window.setInterval(() => {
      // Only broadcast if there's an active action
      if (this.combatState.isAttacking || this.combatState.isBlocking) {
        this.broadcastCombatState();
      } else {
        // Stop timer if no active actions
        this.stopCombatTimer();
      }
    }, 50); // 50ms = 20fps for smooth countdown
  }

  /**
   * Stop the combat timer
   */
  private stopCombatTimer(): void {
    if (this.combatTimerInterval !== null) {
      clearInterval(this.combatTimerInterval);
      this.combatTimerInterval = null;
    }
  }

  /**
   * Handle V key testing commands
   */
  private handleVKeybinds(e: KeyboardEvent): void {
    const shift = e.shiftKey;
    const ctrl = e.ctrlKey;
    const alt = e.altKey;
    
    console.log(`🧪 V keybind - Shift: ${shift}, Ctrl: ${ctrl}, Alt: ${alt}`);
    
    if (shift && ctrl) {
      // Shift+Ctrl+V: Test KO
      console.log('🧪 [Shift+Ctrl+V] Testing KO...');
      window.dispatchEvent(new CustomEvent('playerTakeDamage', {
        detail: { damage: 100, isBlocking: false }
      }));
    } else if (shift && alt) {
      // Shift+Alt+V: Show PvP mode instructions
      console.log('🧪 [Shift+Alt+V] PvP Mode Instructions (check console):');
      console.log('📝 To enable PvP combat:');
      console.log('   1. Open (in code): client/src/config/combat.ts');
      console.log('   2. Change (in code): PVP_ENABLED: false → PVP_ENABLED: true');
      console.log('   3. Create test enemy player using browser console');
      console.log('   4. Hold LMB + walk into enemy to test PvP damage');
      console.log('💡 These instructions are displayed in console.');
    } else if (shift) {
      // Shift+V: Test damage
      console.log('🧪 [Shift+V] Testing 30 damage...');
      window.dispatchEvent(new CustomEvent('playerTakeDamage', {
        detail: { damage: 30, isBlocking: this.combatState.isBlocking }
      }));
    } else if (alt) {
      // Alt+V: Reset health to full
      console.log('🧪 [Alt+V] Resetting health to full...');
      window.dispatchEvent(new CustomEvent('playerHealthChanged', {
        detail: { current: 100, max: 100 }
      }));
    } else {
      // V alone: Toggle on-screen help overlay
      console.log('🧪 [V] Toggling on-screen help overlay...');
      window.dispatchEvent(new CustomEvent('toggleTestingHelp'));
      
      // Update combat state for the overlay
      window.dispatchEvent(new CustomEvent('updateCombatState', {
        detail: {
          isAttacking: this.combatState.isAttacking,
          isBlocking: this.combatState.isBlocking,
          attackStartTime: this.combatState.attackStartTime,
          blockStartTime: this.combatState.blockStartTime
        }
      }));
    }
  }

  /**
   * Get current combat state for PvP system
   */
  getCombatState() {
    return this.combatState;
  }
} 