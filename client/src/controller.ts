import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class FirstPersonController {
  private camera: THREE.Camera;
  private playerBody: RAPIER.RigidBody;
  private controller: RAPIER.KinematicCharacterController;
  private world: RAPIER.World;
  
  // Movement state
  private keys: { [key: string]: boolean } = {};
  private moveSpeed = 8.0; // 8 m/s base speed as per PRD
  private jumpVelocity = 7.5; // Adjusted for new gravity system
  private isGrounded = false;
  private canJump = true;
  private lastGroundY = 0; // Track last ground position
  
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
    this.world = world;
    
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
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
    
    // Escape to exit pointer lock
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPointerLocked) {
        document.exitPointerLock();
      }
      // R to reset position
      if (e.code === 'KeyR') {
        this.reset();
      }
    });
  }
  
  update(deltaTime: number) {
    // Get current position
    const translation = this.playerBody.translation();
    
    // Calculate movement direction based on camera rotation
    this.direction.set(0, 0, 0);
    
    if (this.keys['KeyW']) this.direction.z -= 1;
    if (this.keys['KeyS']) this.direction.z += 1;
    if (this.keys['KeyA']) this.direction.x -= 1;
    if (this.keys['KeyD']) this.direction.x += 1;
    
    // Normalize diagonal movement
    const inputLength = this.direction.length();
    if (inputLength > 0) {
      this.direction.normalize();
      // Accelerate
      this.currentSpeed = Math.min(this.currentSpeed + this.acceleration * deltaTime, this.moveSpeed);
    } else {
      // Decelerate
      this.currentSpeed = Math.max(this.currentSpeed - this.deceleration * deltaTime, 0);
    }
    
    // Apply camera rotation to movement direction
    this.euler.set(0, this.yaw, 0);
    this.direction.applyEuler(this.euler);
    
    // Calculate desired movement with smooth speed
    this.moveVector.copy(this.direction).multiplyScalar(this.currentSpeed * deltaTime);
    
    // Reset grounded state each frame
    this.isGrounded = false;
    
    // Check if grounded - cast ray from bottom of capsule
    // Capsule total height is 2 * halfHeight + 2 * radius = 2 * 1.0 + 2 * 0.5 = 3.0
    // So bottom is at translation.y - 1.5
    const rayOrigin = { x: translation.x, y: translation.y - 1.0, z: translation.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const maxDistance = 0.6; // Small distance to check for ground
    const hit = this.world.castRay(ray, maxDistance, true);
    
    if (hit !== null) {
      this.isGrounded = true;
      // Store ground position
      this.lastGroundY = translation.y;
    }
    
    // Apply gravity - ALWAYS apply it unless we're on ground and not jumping up
    if (!this.isGrounded || this.velocity.y > 0) {
      this.velocity.y -= 35 * deltaTime; // Gravity force
    }
    
    // Clamp velocity
    this.velocity.y = Math.max(this.velocity.y, -20); // Terminal velocity
    
    // Handle jumping - only when grounded
    if (this.keys['Space'] && this.isGrounded && this.canJump) {
      this.velocity.y = this.jumpVelocity;
      this.canJump = false;
    }
    
    // Reset jump ability when space is released
    if (!this.keys['Space']) {
      this.canJump = true;
    }
    
    // If we're on the ground and moving down, stop vertical movement
    if (this.isGrounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }
    
    // IMPORTANT: Add vertical velocity to movement - this was missing!
    this.moveVector.y = this.velocity.y * deltaTime;
    
    // Compute collider movement with gravity
    this.controller.computeColliderMovement(
      this.playerBody.collider(0)!,
      this.moveVector,
      RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC
    );
    
    const movement = this.controller.computedMovement();
    
    const newPos = {
      x: translation.x + movement.x,
      y: translation.y + movement.y,
      z: translation.z + movement.z
    };
    
    // Debug: Log significant position changes
    if (Math.abs(movement.y) > 0.001) {
      console.log('Y Movement:', movement.y, 'Velocity:', this.velocity.y, 'Grounded:', this.isGrounded);
    }
    
    // Update rigid body position
    this.playerBody.setTranslation(newPos, true);
    
    // Update camera position and rotation
    this.camera.position.set(newPos.x, newPos.y + 0.8, newPos.z);
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }
  
  getPosition(): THREE.Vector3 {
    const translation = this.playerBody.translation();
    return new THREE.Vector3(translation.x, translation.y, translation.z);
  }
  
  getRotation(): THREE.Euler {
    return new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
  }
  
  getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }
  
  getIsGrounded(): boolean {
    return this.isGrounded;
  }
  
  // Debug method
  getDebugInfo() {
    const translation = this.playerBody.translation();
    return {
      position: { x: translation.x, y: translation.y, z: translation.z },
      velocity: this.velocity.clone(),
      isGrounded: this.isGrounded,
      canJump: this.canJump
    };
  }
  
  reset() {
    // Reset position to spawn point
    this.playerBody.setTranslation({ x: 0, y: 1.6, z: 0 }, true);
    
    // Reset velocity
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    
    // Reset rotation
    this.pitch = 0;
    this.yaw = 0;
    
    // Reset grounded state
    this.isGrounded = false;
    this.canJump = true;
  }
} 