import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SPAWN_POS } from './track/ExternalTrack';
import { CheckpointSystem } from './systems/CheckpointSystem';

export class FirstPersonController {
  private camera: THREE.Camera;
  private playerBody: RAPIER.RigidBody;
  private controller: RAPIER.KinematicCharacterController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private world: RAPIER.World; // Used for physics queries
  private checkpointSystem: CheckpointSystem | null = null;
  
  // Killzone detection
  private timeInVoid = 0;
  
  // Movement state
  private keys: { [key: string]: boolean } = {};
  private moveSpeed = 12.0; // 12 m/s base speed (increased from 8 m/s)
  private slideSpeed = 16.0; // 16 m/s slide speed (increased from 12 m/s)
  private jumpVelocity = 10.0; // Adjusted for corrected gravity system
  private isGrounded = false;
  private canJump = true;
  private isSliding = false;
  
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
  private acceleration = 20.0; // How fast we accelerate
  private deceleration = 15.0; // How fast we stop
  
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
    
    // Suppress unused variable warning
    void this.world;
    
    this.setupEventListeners();
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
  }
  
  update(deltaTime: number) {
    // Get current position
    const translation = this.playerBody.translation();
    
    // Check for killzone conditions (multiple fallbacks for robustness)
    const shouldRespawn = this.checkKillzoneConditions(translation);
    if (shouldRespawn) {
      console.log(`⚠️ Killzone triggered - Y: ${translation.y.toFixed(2)}, Time in void: ${this.timeInVoid.toFixed(1)}s`);
      this.reset();
      return; // Skip rest of update to avoid processing movement
    }
    
    // Check slide state
    this.isSliding = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    
    // Calculate movement direction based on camera rotation
    this.direction.set(0, 0, 0);
    
    if (this.keys['KeyW']) this.direction.z -= 1;
    if (this.keys['KeyS']) this.direction.z += 1;
    if (this.keys['KeyA']) this.direction.x -= 1;
    if (this.keys['KeyD']) this.direction.x += 1;
    
    // Determine target speed based on slide state
    const targetSpeed = this.isSliding ? this.slideSpeed : this.moveSpeed;
    
    // Normalize diagonal movement
    const inputLength = this.direction.length();
    if (inputLength > 0) {
      this.direction.normalize();
      // Accelerate - faster acceleration when sliding
      const accel = this.isSliding ? this.acceleration * 1.5 : this.acceleration;
      this.currentSpeed = Math.min(this.currentSpeed + accel * deltaTime, targetSpeed);
    } else {
      // Decelerate - slower deceleration when sliding (momentum preservation)
      const decel = this.isSliding ? this.deceleration * 0.5 : this.deceleration;
      this.currentSpeed = Math.max(this.currentSpeed - decel * deltaTime, 0);
    }
    
    // Apply camera rotation to movement direction
    this.euler.set(0, this.yaw, 0);
    this.direction.applyEuler(this.euler);
    
    // Calculate desired movement with smooth speed
    this.moveVector.copy(this.direction).multiplyScalar(this.currentSpeed * deltaTime);
    
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
    
    // Apply gravity only when not grounded
    if (!this.isGrounded) {
      this.velocity.y -= 30 * deltaTime; // Gravity force (matching physics world)
    }
    
    // Clamp velocity
    this.velocity.y = Math.max(this.velocity.y, -30); // Terminal velocity
    
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
    if (Math.random() < 0.001) { // Very reduced frequency for sensor debug
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
    if (this.timeInVoid > 0.5 && Math.random() < 0.02) {
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
  
  // Debug method
  getDebugInfo() {
    const translation = this.playerBody.translation();
    return {
      position: { x: translation.x, y: translation.y, z: translation.z },
      velocity: this.velocity.clone(),
      isGrounded: this.isGrounded,
      canJump: this.canJump,
      isSliding: this.isSliding,
      currentSpeed: this.currentSpeed
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
    
    // Reset killzone tracking
    this.timeInVoid = 0;
  }
} 