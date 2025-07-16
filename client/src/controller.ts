import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SPAWN_POS } from './track/ExternalTrack';
import { CheckpointSystem } from './systems/CheckpointSystem';

export class FirstPersonController {
  private camera: THREE.Camera;
  private playerBody: RAPIER.RigidBody;
  private controller: RAPIER.KinematicCharacterController;
  private world: RAPIER.World; // Used for physics queries
  private checkpointSystem: CheckpointSystem | null = null;
  
  // Killzone detection
  private timeInVoid = 0;
  
  // Movement state
  private keys: { [key: string]: boolean } = {};
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
  private currentMoveSpeed = 18.0;
  
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
  
  // Momentum preservation for airborne movement
  private preservedMomentum = new THREE.Vector3(); // World-space momentum vector
  
  constructor(
    camera: THREE.Camera,
    playerBody: RAPIER.RigidBody,
    controller: RAPIER.KinematicCharacterController,
    world: RAPIER.World
  ) {
    this.camera = camera;
    this.playerBody = playerBody;
    this.controller = controller;
    this.world = world; // May be used for future physics queries
    
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
    
    console.log('FirstPersonController initialized with pointer lock');
  }
  
  private setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Special keys
      if (e.code === 'KeyR') {
        this.reset();
      }
    });
    
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    
    // Mouse button events for melee combat
    document.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;
      
      if (e.button === 0) { // Left mouse button (LMB)
        // Dispatch melee attack event
        window.dispatchEvent(new CustomEvent('meleeAttack', {
          detail: { timestamp: Date.now() }
        }));
      } else if (e.button === 2) { // Right mouse button (RMB)
        // Future: blocking functionality
        console.log('🛡️ RMB pressed (blocking not yet implemented)');
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
    const _reason = data.reason;
    
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
    const _blinkDirection = data.blinkDirection;
    const _distance = data.distance;
    
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
    const _explosionPos = data.explosionPosition;
    const _distance = data.distance;
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
    
    // Apply speed boost
    this.currentMoveSpeed = toVelocity;
    this.moveSpeed = toVelocity; // Update actual moveSpeed used in movement calculations
    this.isSpeedBoosted = true;
    this.speedBoostEndTime = Date.now() + duration;
    
    console.log(`🏎️ SPEED BOOST ACTIVE! ${fromVelocity}→${toVelocity} m/s for ${(duration/1000).toFixed(1)}s (${damage} damage from ${source})`);
    
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
   * Update speed boost state (call this in update loop)
   */
  private updateSpeedBoost(): void {
    if (this.isSpeedBoosted && Date.now() >= this.speedBoostEndTime) {
      // Speed boost expired
      this.isSpeedBoosted = false;
      this.currentMoveSpeed = this.baseMoveSpeed;
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
    
    // Update speed boost state
    this.updateSpeedBoost();
    
    // Check for killzone conditions (multiple fallbacks for robustness)
    const shouldRespawn = this.checkKillzoneConditions(translation);
    if (shouldRespawn) {
      if (import.meta.env.DEV) {
        console.log(`⚠️ Killzone triggered - Y: ${translation.y.toFixed(2)}, Time in void: ${this.timeInVoid.toFixed(1)}s`);
      }
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

    // Dispatch respawn event for screen flash effect
    window.dispatchEvent(new CustomEvent('playerRespawn', {
      detail: { reason: 'out-of-bounds', position: respawnPosition }
    }));

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
    this.currentMoveSpeed = this.baseMoveSpeed;
    this.moveSpeed = this.baseMoveSpeed;
    this.speedBoostEndTime = 0;
  }
} 