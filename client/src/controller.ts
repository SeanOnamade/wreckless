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
    
    // Mouse events
    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.yaw -= e.movementX * this.mouseSensitivity;
        this.pitch -= e.movementY * this.mouseSensitivity;
        
        // Clamp pitch to prevent camera flipping
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
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
    const velocity = data.velocity; // THREE.Vector3 of current swing velocity
    const reason = data.reason;
    
    console.log(`🪝 CONTROLLER: Preserving swing momentum on release (${reason})`);
    console.log(`🪝 CONTROLLER: Swing velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}, ${velocity.z.toFixed(1)})`);
    console.log(`🪝 CONTROLLER: Player velocity BEFORE: (${this.velocity.x.toFixed(1)}, ${this.velocity.y.toFixed(1)}, ${this.velocity.z.toFixed(1)})`);
    
    // Apply swing momentum to controller velocity system (like blast impulse)
    
    // 1. Apply Y-component to vertical velocity (preserve upward momentum)
    this.velocity.y = velocity.y;
    
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
      
      console.log(`🪝 CONTROLLER: Applied swing momentum: speed=${this.currentSpeed.toFixed(1)}, direction=(${this.direction.x.toFixed(2)}, ${this.direction.z.toFixed(2)})`);
    }
    
    console.log(`🪝 CONTROLLER: Player velocity AFTER: (${this.velocity.x.toFixed(1)}, ${this.velocity.y.toFixed(1)}, ${this.velocity.z.toFixed(1)})`);
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
    
    console.log(`🎯 CONTROLLER: Received ${isTF2Style ? 'TF2-style' : '3D'} rocket impulse: (${impulse.x.toFixed(1)}, ${impulse.y.toFixed(1)}, ${impulse.z.toFixed(1)})`);
    console.log(`🎯 CONTROLLER: Player velocity BEFORE: (${this.velocity.x.toFixed(1)}, ${this.velocity.y.toFixed(1)}, ${this.velocity.z.toFixed(1)})`);
    console.log(`🎯 CONTROLLER: Player grounded state: ${this.isGrounded}`);
    
    // Apply the 3D blast impulse to the player's velocity system
    // The controller uses separate systems for Y (this.velocity.y) and horizontal (currentSpeed + direction)
    
    // 1. Apply Y-component to vertical velocity
    this.velocity.y += impulse.y;
    
    // 2. Apply horizontal components to the movement system
    const horizontalImpulse = new THREE.Vector3(impulse.x, 0, impulse.z);
    const horizontalSpeed = horizontalImpulse.length();
    
    if (horizontalSpeed > 0.1) {
      // Set the movement direction to the rocket jump direction
      horizontalImpulse.normalize();
      this.direction.copy(horizontalImpulse);
      
          // TF2-style: NO horizontal speed clamping for true rocket jumping freedom
    if (isTF2Style) {
      this.currentSpeed = horizontalSpeed; // Pure horizontal freedom
      this.isRocketJumping = true; // Flag that we're rocket jumping
      this.rocketJumpSpeed = horizontalSpeed; // Store the rocket jump speed
      console.log(`🎯 CONTROLLER: Applied TF2 horizontal rocket velocity: speed=${this.currentSpeed.toFixed(1)} (unclamped), direction=(${this.direction.x.toFixed(2)}, ${this.direction.z.toFixed(2)})`);
    } else {
      // Legacy: Apply speed limit for backwards compatibility
      this.currentSpeed = Math.min(horizontalSpeed, this.maxSpeed);
      this.isRocketJumping = horizontalSpeed > this.moveSpeed; // Flag if above normal speed
      this.rocketJumpSpeed = this.currentSpeed;
      console.log(`🎯 CONTROLLER: Applied horizontal rocket velocity: speed=${this.currentSpeed.toFixed(1)}, direction=(${this.direction.x.toFixed(2)}, ${this.direction.z.toFixed(2)})`);
    }
    }
    
    // 3. Only apply total speed cap if NOT TF2-style (for horizontal freedom)
    if (!isTF2Style) {
      const totalSpeed = Math.sqrt(impulse.x * impulse.x + impulse.y * impulse.y + impulse.z * impulse.z);
      if (totalSpeed > this.maxSpeed) {
        const ratio = this.maxSpeed / totalSpeed;
        this.velocity.y *= ratio;
        this.currentSpeed *= ratio;
        console.log(`🎯 CONTROLLER: Clamped total velocity from ${totalSpeed.toFixed(1)} to ${this.maxSpeed} m/s`);
      }
    }
    
    console.log(`🎯 CONTROLLER: Final velocity - Y: ${this.velocity.y.toFixed(1)}, Horizontal Speed: ${this.currentSpeed.toFixed(1)}`);
    
    // Force player to be considered not grounded to allow the launch
    this.isGrounded = false;
    
    // Reset jump ability after rocket jump
    this.canJump = true;
  }
  
  update(deltaTime: number) {
    // Get current position
    const translation = this.playerBody.translation();
    
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
    
    // Always update direction based on input (no momentum preservation)
    const hasInput = inputDirection.length() > 0;
    if (hasInput) {
      this.direction.copy(inputDirection);
    } else {
      // No input - stop moving (normal behavior)
      this.direction.set(0, 0, 0);
    }
    
    // Determine target speed based on current state
    const normalTargetSpeed = this.isSliding ? this.slideSpeed : this.moveSpeed;
    
    // Reset rocket jump state when grounded (return to normal speeds)
    if (this.isGrounded && this.isRocketJumping) {
      this.isRocketJumping = false;
      this.rocketJumpSpeed = 0;
      console.log(`🎯 VELOCITY: Rocket jump ended - back to normal speeds (grounded)`);
    }
    
    // Determine effective max speed based on current state
    const effectiveMaxSpeed = this.isSwinging ? this.swingMaxSpeed : this.maxSpeed;
    
    // Determine target speed: preserve rocket jump speed while airborne
    let targetSpeed;
    if (this.isRocketJumping && !this.isGrounded) {
      // Airborne rocket jumping - preserve high speed
      targetSpeed = Math.min(this.rocketJumpSpeed, effectiveMaxSpeed);
      console.log(`🎯 VELOCITY: Airborne rocket jump - target speed: ${targetSpeed.toFixed(1)} m/s`);
    } else if (this.isSwinging) {
      // Swinging - allow higher speeds
      targetSpeed = effectiveMaxSpeed;
      console.log(`🎯 VELOCITY: Swinging - target speed: ${targetSpeed.toFixed(1)} m/s`);
    } else {
      // Normal ground movement
      targetSpeed = normalTargetSpeed;
    }
    
    // Handle speed and direction changes
    if (hasInput) {
      // Player is giving input - normalize direction and handle acceleration
      this.direction.normalize();
      const accel = this.isSliding ? this.acceleration * 1.5 : this.acceleration;
      
      if (this.isRocketJumping && !this.isGrounded) {
        // Rocket jumping: REDUCED air control to prevent unrealistic horizontal "walking"
        // Only allow slight direction changes, heavily reduced acceleration
        const airControlFactor = 0.2; // Only 20% normal control in air during rocket jumping
        const speedChange = accel * deltaTime * airControlFactor;
        this.currentSpeed = Math.min(this.currentSpeed + speedChange, effectiveMaxSpeed);
        
        // Blend new direction with current direction for limited air steering
        const steerAmount = 0.3 * deltaTime; // How much we can steer per second
        this.direction.lerp(inputDirection.normalize(), steerAmount);
      } else {
        // Normal movement: accelerate to target speed
        this.currentSpeed = Math.min(this.currentSpeed + accel * deltaTime, targetSpeed);
      }
          } else {
        // No input - decelerate appropriately
        const baseDecel = this.isSliding ? this.deceleration * 0.5 : this.deceleration;
        
        if (this.isRocketJumping && !this.isGrounded) {
          // Rocket jumping with no input: reduced deceleration in air for momentum preservation
          const airDecel = baseDecel * 0.3; // 30% deceleration rate in air (increased from 10% for more realism)
          this.currentSpeed = Math.max(this.currentSpeed - airDecel * deltaTime, 0);
        } else {
          // Normal deceleration
          this.currentSpeed = Math.max(this.currentSpeed - baseDecel * deltaTime, 0);
        }
      }
    
    // Debug velocity state
    if (this.currentSpeed > 15.0 || this.isRocketJumping) {
      console.log(`🎯 VELOCITY DEBUG: speed=${this.currentSpeed.toFixed(1)}, target=${targetSpeed.toFixed(1)}, grounded=${this.isGrounded}, rocketJump=${this.isRocketJumping}, input=${hasInput}`);
    }
    
    // Apply camera rotation to movement direction
    this.euler.set(0, this.yaw, 0);
    this.direction.applyEuler(this.euler);
    
    // Calculate desired movement with smooth speed
    this.moveVector.copy(this.direction).multiplyScalar(this.currentSpeed * deltaTime);
    
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
    
    // Debug: log every few frames (only when debug mode is enabled)
    if (import.meta.env.DEV && Math.random() < 0.001) { // Very reduced frequency for sensor debug
      console.log('Movement computed - Grounded:', this.isGrounded, 'Y-Vel:', this.velocity.y.toFixed(2), 'Y-Move:', movement.y.toFixed(4), 'Sensors excluded from collision');
    }
    
    const newPos = {
      x: translation.x + movement.x,
      y: translation.y + movement.y,
      z: translation.z + movement.z
    };
    

    
    // Update rigid body position
    this.playerBody.setTranslation(newPos, true);
    
    // Update camera position and rotation
    const cameraHeight = this.isSliding ? 0.4 : 0.8; // Lower camera when sliding
    this.camera.position.set(newPos.x, newPos.y + cameraHeight, newPos.z);
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
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

    // Reset killzone tracking
    this.timeInVoid = 0;
    
    console.log(`🎯 VELOCITY: Player reset - all speeds cleared`);
  }
} 