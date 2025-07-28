import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MeleeTarget } from './MeleeCombat';
import { DummyPhysicsManager } from './DummyPhysicsManager';

export class TargetDummy implements MeleeTarget {
  public id: string;
  public position: THREE.Vector3;
  public rigidBody!: RAPIER.RigidBody;
  
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private mesh!: THREE.Object3D;
  private maxHealth = 100;
  private currentHealth = 100;
  private respawnTimer?: number;
  
  // Static counter for model cycling
  private static dummyCounter = 0;
  private modelType: 'stopwatch' | 'hourglass' | 'chronoshard';
  
  // Enhanced FX elements for CursorDay7
  private hitRing?: THREE.Mesh;
  private koRing?: THREE.Mesh;
  private respawnRing?: THREE.Mesh;
  private sparkles: THREE.Mesh[] = [];
  
  // Animation for visual appeal
  private rotationSpeed: number;
  private baseRotationSpeed = 0.3; // Slow rotation (radians per second)
  private floatOffset: number; // For up/down bobbing animation
  private floatSpeed: number; // Speed of floating animation
  private basePosition!: THREE.Vector3; // Store the true base position for floating (set during mesh creation)
  

  
  // MEMORY LEAK FIX: Track animation frames for cleanup
  private activeAnimationFrames: Set<number> = new Set();
  private activePoolContexts: Set<number> = new Set(); // Track which pool contexts this dummy is using
  private isDestroyed = false;
  private isInitialized = false;
  
  // Performance optimization - throttle particle animations to 30fps
  private lastParticleUpdateTime = 0;
  private particleUpdateInterval = 33; // 30fps for particle effects
  
  // CRASH PREVENTION: Limit concurrent animations to prevent buildup
  private readonly MAX_ANIMATION_FRAMES_PER_DUMMY = 4;
  
  // AGGRESSIVE LIMITS: Global animation tracking to prevent system-wide buildup
  private static globalAnimationFrames: Set<number> = new Set();
  private static readonly MAX_GLOBAL_ANIMATION_FRAMES = 20; // System-wide limit
  private static readonly MAX_ANIMATIONS_PER_SECOND = 10; // Rate limiting
  private static lastAnimationTime = 0;
  
  // ANIMATION FRAME POOLING: Reuse animation contexts to prevent memory buildup
  private static animationPool: Array<{
    id: number;
    inUse: boolean;
    startTime: number;
    cleanup: () => void;
  }> = [];
  private static readonly MAX_POOL_SIZE = 50;
  private static nextPoolId = 0; // BUGFIX: Use unique counter instead of array length

  // Note: Scale values finalized - stopwatch: 1.8x, hourglass: 0.4x, chronoshard: 5.6x

  /**
   * Get an animation context from the pool or create a new one
   */
  private static getPooledAnimationContext(): { id: number; startTime: number } | null {
    // First try to reuse an existing context
    for (const context of TargetDummy.animationPool) {
      if (!context.inUse) {
        context.inUse = true;
        context.startTime = Date.now();
        return { id: context.id, startTime: context.startTime };
      }
    }
    
    // If pool is full, deny the animation request
    if (TargetDummy.animationPool.length >= TargetDummy.MAX_POOL_SIZE) {
      return null;
    }
    
    // Create new context with unique ID
    const context = {
      id: TargetDummy.nextPoolId++, // BUGFIX: Use unique counter
      inUse: true,
      startTime: Date.now(),
      cleanup: () => {}
    };
    TargetDummy.animationPool.push(context);
    return { id: context.id, startTime: context.startTime };
  }

  /**
   * Return an animation context to the pool
   */
  private static returnPooledAnimationContext(contextId: number): void {
    // BUGFIX: Find context by ID, don't use ID as array index
    const context = TargetDummy.animationPool.find(ctx => ctx.id === contextId);
    if (context && context.inUse) {
      // Ensure cleanup runs before marking context as available
      if (context.cleanup) {
        context.cleanup();
      }
      context.cleanup = () => {};
      context.inUse = false;
    }
  }
  
  /**
   * Return an animation context and untrack it from this dummy
   */
  private returnAndUntrackPoolContext(contextId: number): void {
    this.activePoolContexts.delete(contextId);
    TargetDummy.returnPooledAnimationContext(contextId);
  }

  /**
   * Global cleanup method to clear stuck animation frames
   */
  public static cleanupGlobalAnimations(): void {

    TargetDummy.globalAnimationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    TargetDummy.globalAnimationFrames.clear();
  }

  /**
   * Get global animation statistics for monitoring
   */
  public static getAnimationStats(): { global: number; limit: number; rate: number } {
    return {
      global: TargetDummy.globalAnimationFrames.size,
      limit: TargetDummy.MAX_GLOBAL_ANIMATION_FRAMES,
      rate: TargetDummy.MAX_ANIMATIONS_PER_SECOND
    };
  }

  /**
   * Get active animation count for performance monitoring
   */
  public static getActiveAnimationCount(): number {
    return TargetDummy.globalAnimationFrames.size;
  }

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    position: THREE.Vector3,
    id: string = 'dummy'
  ) {
    this.scene = scene;
    this.world = world;
    this.position = position.clone();
    this.id = id;
    
    // Determine model type based on counter (cycles through 3 models)
    const modelIndex = TargetDummy.dummyCounter % 3;
    this.modelType = modelIndex === 0 ? 'stopwatch' : 
                    modelIndex === 1 ? 'hourglass' : 'chronoshard';
    TargetDummy.dummyCounter++;
    
    // Initialize rotation with slight randomness for variety
    this.rotationSpeed = this.baseRotationSpeed + (Math.random() - 0.5) * 0.2; // ±0.1 variance
    
    // Initialize floating animation with randomness for natural variety
    this.floatOffset = Math.random() * Math.PI * 2; // Random starting phase
    this.floatSpeed = 2.5 + (Math.random() - 0.5) * 1.0; // 2.0 to 3.0 speed variance (much faster bobbing)
    // Note: basePosition will be set during mesh creation
    
    // ASYNC FIX: Handle initialization properly with error handling
    this.initializeDummy().catch(error => {
      console.error(`❌ Failed to initialize dummy ${this.id}:`, error);
      // Create fallback mesh to ensure dummy is functional
      this.createFallbackMesh();
      this.createPhysicsBody();
      this.createFXElements();
      this.isInitialized = true;
    });
  }

  /**
   * Initialize the dummy with async model loading
   */
  private async initializeDummy(): Promise<void> {
    if (this.isDestroyed) return; // Guard against destruction during initialization
    
    try {
      await this.createVisualMesh();
      if (this.isDestroyed) return; // Check again after async operation
      
      this.createPhysicsBody();
      this.createFXElements();
      this.isInitialized = true;
      
      // Target dummy created silently
    } catch (error) {
      console.error(`❌ Error during dummy ${this.id} initialization:`, error);
      throw error; // Re-throw to be handled by constructor
    }
  }

  private async createVisualMesh(): Promise<void> {
    try {
      // Load the appropriate GLB model based on type
      const loader = new GLTFLoader();
      const modelPath = `/models/${this.modelType}.glb`;
      const gltf = await loader.loadAsync(modelPath);
      
      // Clone the scene to create an independent instance
      this.mesh = gltf.scene.clone();
      
      // Optimized scales for visual consistency and gameplay balance
      const modelScales = {
        stopwatch: 1.8,   // Balanced size
        hourglass: 0.4,   // Smaller, more delicate
        chronoshard: 5.6  // Larger, more imposing (+0.2 from 5.4)
      };
      
      // Apply visual scale but normalize aspect ratio for gameplay consistency
      const baseScale = modelScales[this.modelType];
      
      // Normalize aspect ratios - make all models roughly the same height/width ratio
      // This ensures more consistent gameplay despite visual differences
      const aspectNormalization = {
        stopwatch: { x: baseScale * 1.0, y: baseScale * 1.0, z: baseScale * 1.0 },   // Square proportions
        hourglass: { x: baseScale * 1.2, y: baseScale * 1.0, z: baseScale * 1.2 },   // Slightly wider for visibility
        chronoshard: { x: baseScale * 0.8, y: baseScale * 1.0, z: baseScale * 0.8 }  // Narrower to balance large scale
      };
      
      const normalizedScale = aspectNormalization[this.modelType];
      this.mesh.scale.set(normalizedScale.x, normalizedScale.y, normalizedScale.z);
      
      // Position and setup
      this.mesh.position.copy(this.position);
      
      // Store the adjusted base position for floating animation
      this.basePosition = this.position.clone();
      if (this.modelType === 'hourglass') {
        this.basePosition.y -= 0.6; // Move hourglass down slightly for better centering
      } else if (this.modelType === 'chronoshard') {
        this.basePosition.y += 0.4; // Move chronoshard up slightly for better visibility
      }
      
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      
      // Enable shadows and add magical glow to all child meshes
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Add subtle magical glow based on dummy type
          if (child.material instanceof THREE.MeshStandardMaterial) {
            this.addMagicalGlow(child.material);
          }
        }
      });
      
      // Set userData for identification
      this.mesh.userData = {
        isDummy: true,
        id: this.id,
        type: 'TargetDummy',
        modelType: this.modelType
      };
      
      this.scene.add(this.mesh);
      
              // console.log(`✨ Loaded ${this.modelType} model for dummy ${this.id}`); // Suppressed spam
      
    } catch (error) {
      console.error(`❌ Failed to load ${this.modelType} model for dummy ${this.id}:`, error);
      
      // Fallback to basic geometry if model loading fails
      this.createFallbackMesh();
    }
  }

  /**
   * Create a fallback mesh if GLB loading fails
   */
  private createFallbackMesh(): void {
    const geometry = new THREE.CapsuleGeometry(0.8, 2.4, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      metalness: 0.2,
      roughness: 0.6
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Add magical glow to fallback mesh too
    this.addMagicalGlow(material);
    
    // Set fallback basePosition for floating animation
    this.basePosition = this.position.clone();
    if (this.modelType === 'hourglass') {
      this.basePosition.y -= 0.6; // Apply hourglass offset
    } else if (this.modelType === 'chronoshard') {
      this.basePosition.y += 0.4; // Apply chronoshard offset
    }
    
    this.mesh.userData = {
      isDummy: true,
      id: this.id,
      type: 'TargetDummy'
    };
    
    this.scene.add(this.mesh);
    console.log(`⚠️ Using fallback mesh for dummy ${this.id}`);
  }

  /**
   * Create enhanced FX elements for hit/KO/respawn feedback
   */
  private createFXElements(): void {
    // Hit ring - orange emissive torus (scaled for larger dummy)
    const hitRingGeometry = new THREE.TorusGeometry(1.5, 0.3, 8, 16);
    const hitRingMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0,
      emissive: 0xff3300,
      emissiveIntensity: 0,
      side: THREE.DoubleSide
    });
    this.hitRing = new THREE.Mesh(hitRingGeometry, hitRingMaterial);
    this.hitRing.position.copy(this.position);
    this.hitRing.rotation.x = Math.PI / 2; // Lay flat
    this.hitRing.visible = false;
    this.scene.add(this.hitRing);

    // KO ring - red explosion ring (scaled for larger dummy)
    const koRingGeometry = new THREE.TorusGeometry(1.8, 0.4, 8, 16);
    const koRingMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0,
      emissive: 0xff0000,
      emissiveIntensity: 0,
      side: THREE.DoubleSide
    });
    this.koRing = new THREE.Mesh(koRingGeometry, koRingMaterial);
    this.koRing.position.copy(this.position);
    this.koRing.rotation.x = Math.PI / 2;
    this.koRing.visible = false;
    this.scene.add(this.koRing);

    // Respawn ring - green spawn ring (scaled for larger dummy)
    const respawnRingGeometry = new THREE.TorusGeometry(1.6, 0.35, 8, 16);
    const respawnRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff44,
      transparent: true,
      opacity: 0,
      emissive: 0x00ff44,
      emissiveIntensity: 0,
      side: THREE.DoubleSide
    });
    this.respawnRing = new THREE.Mesh(respawnRingGeometry, respawnRingMaterial);
    this.respawnRing.position.copy(this.position);
    this.respawnRing.rotation.x = Math.PI / 2;
    this.respawnRing.visible = false;
    this.scene.add(this.respawnRing);

    // Create sparkle particles
    const sparkleGeometry = new THREE.SphereGeometry(0.05, 6, 6);
    const sparkleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0
    });
    
    for (let i = 0; i < 6; i++) {
      const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial.clone());
      sparkle.position.copy(this.position);
      sparkle.visible = false;
      this.sparkles.push(sparkle);
      this.scene.add(sparkle);
    }
  }
  


  private createPhysicsBody(): void {
    // Create a static rigid body for the dummy
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(this.position.x, this.position.y, this.position.z);
    
    this.rigidBody = this.world.createRigidBody(rigidBodyDesc);
    
    // CRITICAL: Set userData for HitVolume system detection
    this.rigidBody.userData = {
      isDummy: true,
      id: this.id,
      type: 'TargetDummy'
    };
    
    // Create STANDARDIZED SENSOR collider - same hitbox for all dummy types regardless of visual scale
    // This ensures consistent gameplay: all dummies have identical hit detection
    // Capsule: radius 0.9, half-height 1.3 (good balance for all visual models)
    const colliderDesc = RAPIER.ColliderDesc.capsule(1.3, 0.9)
      .setSensor(true); // CRITICAL: Makes dummy pass-through for movement
    
    this.world.createCollider(colliderDesc, this.rigidBody);
    
          // Dummy created as SENSOR (silenced)
  }

  /**
   * Handle taking damage from melee attacks
   */
  takeDamage(damage: number, _direction: THREE.Vector3): void {
    // Don't take damage if destroyed or not initialized
    if (this.isDestroyed || !this.isInitialized) return;
    
    // Don't take damage if already KO'd
    if (this.currentHealth <= 0) {
      return; // Silently reject damage for KO'd dummies
    }
    
    // SFX: Play dummy hit sound (glass breaking impact)
    window.dispatchEvent(new CustomEvent('sfxRequest', {
      detail: { category: 'combat', filename: 'dummy_hit.wav' }
    }));
    
    // Log HP BEFORE damage
    const hpBefore = this.currentHealth;
    
    this.currentHealth -= damage;
    
    // Combat log message (can be immediate)
    if (!this.isDestroyed) {
      window.dispatchEvent(new CustomEvent('combatLogMessage', {
        detail: { 
          message: `🎯 ${this.id}: ${hpBefore} HP → ${damage} dmg → ${this.currentHealth} HP remaining` 
        }
      }));
    }
    
    // Enhanced visual damage feedback (handles its own animation frames)
    this.triggerHitFX();
    
    // Check for KO
    if (this.currentHealth <= 0) {
      this.triggerKO(); // triggerKO now uses DummyPhysicsManager for safety
    }
  }



  /**
   * Simplified hit feedback - no visual changes to dummy appearance
   */
  private triggerHitFX(): void {
    // AGGRESSIVE CRASH PREVENTION: Multiple limits to prevent animation buildup
    const now = Date.now();
    
    // Global animation frame limit
    if (TargetDummy.globalAnimationFrames.size >= TargetDummy.MAX_GLOBAL_ANIMATION_FRAMES) {
      return; // Silent skip - system overloaded
    }
    
    // Rate limiting - prevent too many animations per second
    if (now - TargetDummy.lastAnimationTime < (1000 / TargetDummy.MAX_ANIMATIONS_PER_SECOND)) {
      return; // Silent skip - too frequent
    }
    
    // Per-dummy limit
    if (this.activeAnimationFrames.size >= this.MAX_ANIMATION_FRAMES_PER_DUMMY) {
      return; // Silent skip - dummy overloaded
    }
    
    // ANIMATION POOLING: Get a pooled animation context
    const animContext = TargetDummy.getPooledAnimationContext();
    if (!animContext) {
      return; // Pool exhausted - skip animation
    }
    
    // Track this context for cleanup
    this.activePoolContexts.add(animContext.id);
    
    TargetDummy.lastAnimationTime = now;
    
    // Keep hit ring effect but no color/scale changes to the dummy itself
    if (this.hitRing && !this.isDestroyed) {
      this.hitRing.visible = true;
      this.hitRing.scale.set(0.1, 0.1, 0.1);
      const ringMaterial = this.hitRing.material as THREE.MeshStandardMaterial;
      ringMaterial.opacity = 0.8;
      ringMaterial.emissiveIntensity = 1.0;
      
      // Animate ring expansion with pooled frame tracking
      const animateHitRing = () => {
        if (this.isDestroyed || !this.hitRing) {
          this.returnAndUntrackPoolContext(animContext.id);
          return; // Guard against destruction
        }
        
        const elapsed = Date.now() - animContext.startTime;
        const progress = Math.min(elapsed / 300, 1); // 300ms animation
        
        const scale = 0.1 + (2.0 * progress); // Expand from 0.1 to 2.1
        this.hitRing.scale.set(scale, scale, scale);
        
        const opacity = 0.8 * (1 - progress); // Fade out
        const intensity = 1.0 * (1 - progress);
        ringMaterial.opacity = opacity;
        ringMaterial.emissiveIntensity = intensity;
        
        if (progress < 1) {
          const frameId = requestAnimationFrame(animateHitRing);
          this.activeAnimationFrames.add(frameId);
          TargetDummy.globalAnimationFrames.add(frameId);
          
          // Set cleanup function for the pooled context
          const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
          if (poolContext) {
            // Clear previous cleanup to prevent double-cancellation
            if (poolContext.cleanup) {
              poolContext.cleanup();
            }
            poolContext.cleanup = () => {
              cancelAnimationFrame(frameId);
              this.activeAnimationFrames.delete(frameId);
              TargetDummy.globalAnimationFrames.delete(frameId);
            };
          }
        } else {
          this.hitRing.visible = false;
          this.returnAndUntrackPoolContext(animContext.id);
        }
      };
      
      const initialFrameId = requestAnimationFrame(animateHitRing);
      this.activeAnimationFrames.add(initialFrameId);
      TargetDummy.globalAnimationFrames.add(initialFrameId);
      
      // Set initial cleanup function
      const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
      if (poolContext) {
        poolContext.cleanup = () => {
          cancelAnimationFrame(initialFrameId);
          this.activeAnimationFrames.delete(initialFrameId);
          TargetDummy.globalAnimationFrames.delete(initialFrameId);
        };
      }
    }

    // Keep sparkle particles effect
    this.triggerSparkles();
    
    // Note: No color or scale changes to the dummy mesh itself
  }

  /**
   * Sparkle particle effect around the dummy
   */
  private triggerSparkles(): void {
    if (this.isDestroyed) return; // Guard against destruction
    
    // AGGRESSIVE LIMITS: Skip sparkles entirely if system is stressed
    if (TargetDummy.globalAnimationFrames.size >= TargetDummy.MAX_GLOBAL_ANIMATION_FRAMES - 5) {
      return; // Save global animation frames for more important effects
    }
    
    if (this.activeAnimationFrames.size >= this.MAX_ANIMATION_FRAMES_PER_DUMMY - 2) {
      return; // Save dummy animation frames
    }
    
    // ANIMATION POOLING: Limit sparkle animations by pooling
    const sparkleContexts: Array<{ id: number; startTime: number }> = [];
    
    this.sparkles.forEach((sparkle, index) => {
      if (this.isDestroyed) return; // Check for each sparkle
      
      // Try to get a pooled context for this sparkle
      const animContext = TargetDummy.getPooledAnimationContext();
      if (!animContext) {
        return; // Pool exhausted - skip this sparkle
      }
      
      // Track this context for cleanup
      this.activePoolContexts.add(animContext.id);
      
      sparkleContexts.push(animContext);
      
      sparkle.visible = true;
      
      // Random position around larger dummy
      const angle = (index / this.sparkles.length) * Math.PI * 2;
      const radius = 2.0; // Increased for larger dummy
      const height = Math.random() * 2.5; // Taller sparkle range
      
      sparkle.position.set(
        this.position.x + Math.cos(angle) * radius,
        this.position.y + height,
        this.position.z + Math.sin(angle) * radius
      );
      
      const sparkleMaterial = sparkle.material as THREE.MeshBasicMaterial;
      sparkleMaterial.opacity = 1.0;
      
      // Animate sparkles with pooled frame tracking
      const animateSparkle = () => {
        if (this.isDestroyed) {
          this.returnAndUntrackPoolContext(animContext.id);
          return; // Guard against destruction
        }
        
        // Throttle particle updates to 30fps for better performance
        const now = performance.now();
        if (now - this.lastParticleUpdateTime < this.particleUpdateInterval) {
          requestAnimationFrame(animateSparkle);
          return;
        }
        this.lastParticleUpdateTime = now;
        
        const elapsed = Date.now() - animContext.startTime;
        const progress = Math.min(elapsed / 400, 1); // 400ms animation
        
        // Float upward
        sparkle.position.y = this.position.y + height + (progress * 1.5);
        
        // Fade out
        sparkleMaterial.opacity = 1.0 * (1 - progress);
        
        if (progress < 1) {
          const frameId = requestAnimationFrame(animateSparkle);
          this.activeAnimationFrames.add(frameId);
          TargetDummy.globalAnimationFrames.add(frameId);
          
          // Set cleanup function for the pooled context
          const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
          if (poolContext) {
            poolContext.cleanup = () => {
              cancelAnimationFrame(frameId);
              this.activeAnimationFrames.delete(frameId);
              TargetDummy.globalAnimationFrames.delete(frameId);
            };
          }
        } else {
          sparkle.visible = false;
          this.returnAndUntrackPoolContext(animContext.id);
        }
      };
      
      const initialFrameId = requestAnimationFrame(animateSparkle);
      this.activeAnimationFrames.add(initialFrameId);
      TargetDummy.globalAnimationFrames.add(initialFrameId);
      
      // Set initial cleanup function
      const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
      if (poolContext) {
        poolContext.cleanup = () => {
          cancelAnimationFrame(initialFrameId);
          this.activeAnimationFrames.delete(initialFrameId);
          TargetDummy.globalAnimationFrames.delete(initialFrameId);
        };
      }
    });
  }

  /**
   * Handle knockback effects
   */
  applyKnockback(force: number, direction: THREE.Vector3): void {
    // Don't apply knockback if destroyed or not initialized
    if (this.isDestroyed || !this.isInitialized || !this.mesh) return;
    
    // DEFER ALL MESH OPERATIONS to avoid Rapier conflicts
    requestAnimationFrame(() => {
      if (this.isDestroyed || !this.mesh) return;
      
      try {
        // Visual knockback effect (slight mesh displacement)
        const originalPosition = this.mesh.position.clone();
        const knockbackDistance = Math.min(force * 0.02, 0.3); // Cap knockback visual
        
        this.mesh.position.add(direction.clone().multiplyScalar(knockbackDistance));
        
        // Return to original position after a short delay
        window.setTimeout(() => {
          if (!this.isDestroyed && this.mesh) {
            this.mesh.position.copy(originalPosition);
          }
        }, 200);
      } catch (error) {
        console.warn(`⚠️ Knockback error for dummy ${this.id}:`, error);
      }
    });
  }

  /**
   * Handle KO and respawn logic with minimal visual changes
   */
  private triggerKO(): void {
    console.log(`💀 Dummy ${this.id} KO'd! Respawning in 3 seconds...`);
    
    try {
      // Just hide the mesh instead of changing colors/scale
      this.mesh.visible = false;

      // KO explosion ring effect
      if (this.koRing) {
        this.koRing.visible = true;
        this.koRing.scale.set(0.1, 0.1, 0.1);
        const ringMaterial = this.koRing.material as THREE.MeshStandardMaterial;
        ringMaterial.opacity = 1.0;
        ringMaterial.emissiveIntensity = 1.5;
        
        // ANIMATION POOLING: Get pooled context for KO ring
        const animContext = TargetDummy.getPooledAnimationContext();
        if (animContext) {
          // Track this context for cleanup
          this.activePoolContexts.add(animContext.id);
          
          // Animate explosion ring with pooled frame tracking
          const animateKORing = () => {
            if (this.isDestroyed || !this.koRing) {
              this.returnAndUntrackPoolContext(animContext.id);
              return; // Guard against destruction
            }
            
            const elapsed = Date.now() - animContext.startTime;
            const progress = Math.min(elapsed / 600, 1); // 600ms animation
            
            const scale = 0.1 + (3.5 * progress); // Large explosion ring
            this.koRing.scale.set(scale, scale, scale);
            
            const opacity = 1.0 * (1 - Math.pow(progress, 1.5)); // Fade out
            const intensity = 1.5 * (1 - progress);
            ringMaterial.opacity = opacity;
            ringMaterial.emissiveIntensity = intensity;
            
            if (progress < 1) {
              const frameId = requestAnimationFrame(animateKORing);
              this.activeAnimationFrames.add(frameId);
              TargetDummy.globalAnimationFrames.add(frameId);
              
              // Set cleanup function for the pooled context
              const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
              if (poolContext) {
                poolContext.cleanup = () => {
                  cancelAnimationFrame(frameId);
                  this.activeAnimationFrames.delete(frameId);
                  TargetDummy.globalAnimationFrames.delete(frameId);
                };
              }
            } else {
              this.koRing.visible = false;
              this.returnAndUntrackPoolContext(animContext.id);
            }
          };
          
          const initialFrameId = requestAnimationFrame(animateKORing);
          this.activeAnimationFrames.add(initialFrameId);
          TargetDummy.globalAnimationFrames.add(initialFrameId);
          
          // Set initial cleanup function
          const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
          if (poolContext) {
            poolContext.cleanup = () => {
              cancelAnimationFrame(initialFrameId);
              this.activeAnimationFrames.delete(initialFrameId);
              TargetDummy.globalAnimationFrames.delete(initialFrameId);
            };
          }
        }
      }
      
      // ULTRA SAFE: Use centralized physics manager to prevent recursive errors
      const physicsManager = DummyPhysicsManager.getInstance();
      physicsManager.queueDisableRigidBody(this.rigidBody, this.id);
      
      // Respawn after delay
      this.respawnTimer = window.setTimeout(() => {
        this.respawn();
      }, 3000);
      
    } catch (error) {
      console.error(`Error in triggerKO for ${this.id}:`, error);
    }
  }

  /**
   * Respawn the dummy with minimal visual changes
   */
  private respawn(): void {
    
    // SAFETY: Defer event dispatching to avoid physics conflicts
    setTimeout(() => {
      if (!this.isDestroyed) {
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: `✨ ${this.id} respawned with full HP!` }
    }));
      }
    }, 0);
    
    // Reset health
    this.currentHealth = this.maxHealth;
    
    // Reset position and rotation immediately with corruption protection
    if (this.mesh) {
      this.mesh.position.copy(this.basePosition); // Use basePosition for respawn
      this.mesh.rotation.set(0, 0, 0); // Clear all rotation
      
      // SIMPLE FIX: Use correct scale for this dummy type instead of 1,1,1
      const expectedScale = this.getExpectedScale();
      this.mesh.scale.set(expectedScale.x, expectedScale.y, expectedScale.z);
      
      this.mesh.visible = true;
    }
    
    // CRITICAL FIX: Recreate physics body if it's null (prevents corruption)
    if (!this.rigidBody) {
      console.warn(`⚠️ RigidBody null during respawn for ${this.id} - recreating physics body`);
      this.createPhysicsBody();
    } else {
      // Re-enable collision using centralized physics manager
      const physicsManager = DummyPhysicsManager.getInstance();
      physicsManager.queueEnableRigidBody(this.rigidBody, this.id);
    }

    // Keep respawn ring effect but no changes to dummy appearance
    if (this.respawnRing) {
      this.respawnRing.visible = true;
      this.respawnRing.scale.set(3.0, 3.0, 3.0);
      const ringMaterial = this.respawnRing.material as THREE.MeshStandardMaterial;
      ringMaterial.opacity = 0.8;
      ringMaterial.emissiveIntensity = 1.2;
      
      // ANIMATION POOLING: Get pooled context for respawn ring
      const animContext = TargetDummy.getPooledAnimationContext();
      if (animContext) {
        // Track this context for cleanup
        this.activePoolContexts.add(animContext.id);
        
        // Animate respawn ring (contracts inward) with pooled frame tracking
        const animateRespawnRing = () => {
          if (this.isDestroyed || !this.respawnRing) {
            this.returnAndUntrackPoolContext(animContext.id);
            return; // Guard against destruction
          }
          
          const elapsed = Date.now() - animContext.startTime;
          const progress = Math.min(elapsed / 400, 1); // 400ms animation
          
          const scale = 3.0 - (2.7 * progress); // Contract from 3.0 to 0.3
          this.respawnRing.scale.set(scale, scale, scale);
          
          const opacity = 0.8 * (1 - progress);
          const intensity = 1.2 * (1 - progress);
          ringMaterial.opacity = opacity;
          ringMaterial.emissiveIntensity = intensity;
          
          if (progress < 1) {
            const frameId = requestAnimationFrame(animateRespawnRing);
            this.activeAnimationFrames.add(frameId);
            TargetDummy.globalAnimationFrames.add(frameId);
            
            // Set cleanup function for the pooled context
            const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
            if (poolContext) {
              poolContext.cleanup = () => {
                cancelAnimationFrame(frameId);
                this.activeAnimationFrames.delete(frameId);
                TargetDummy.globalAnimationFrames.delete(frameId);
              };
            }
          } else {
            this.respawnRing.visible = false;
            this.returnAndUntrackPoolContext(animContext.id);
          }
        };
        
        const initialFrameId = requestAnimationFrame(animateRespawnRing);
        this.activeAnimationFrames.add(initialFrameId);
        TargetDummy.globalAnimationFrames.add(initialFrameId);
        
        // Set initial cleanup function
        const poolContext = TargetDummy.animationPool.find(ctx => ctx.id === animContext.id);
        if (poolContext) {
          poolContext.cleanup = () => {
            cancelAnimationFrame(initialFrameId);
            this.activeAnimationFrames.delete(initialFrameId);
            TargetDummy.globalAnimationFrames.delete(initialFrameId);
          };
        }
      }
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      current: this.currentHealth,
      max: this.maxHealth,
      percentage: (this.currentHealth / this.maxHealth) * 100
    };
  }

  /**
   * Reset health to full (for round resets)
   */
  resetHealth(): void {
    this.currentHealth = this.maxHealth;
    
    // Clear any respawn timer
    if (this.respawnTimer) {
      window.clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    
    // Reset visual state - just ensure dummy is visible and positioned correctly
    if (this.mesh) {
      this.mesh.visible = true;
      this.mesh.position.copy(this.basePosition); // Use basePosition for reset
      
      // SIMPLE FIX: Use correct scale for this dummy type instead of 1,1,1
      const expectedScale = this.getExpectedScale();
      this.mesh.scale.set(expectedScale.x, expectedScale.y, expectedScale.z);
      this.mesh.rotation.set(0, 0, 0);
    }
    
    // Re-enable collision if disabled (with null check)
    if (this.rigidBody && !this.rigidBody.isEnabled()) {
      this.rigidBody.setEnabled(true);
    } else if (!this.rigidBody) {
      console.warn(`⚠️ RigidBody null during reset for ${this.id} - recreating physics body`);
      this.createPhysicsBody();
    }
    
    // Add to combat log for round resets
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: `🔄 ${this.id} health reset to ${this.currentHealth}/${this.maxHealth} HP` }
    }));
  }
  


  /**
   * Cleanup resources
   */
  destroy(): void {
    // Mark as destroyed first to prevent any ongoing operations
    this.isDestroyed = true;
    
    // Cancel all active animation frames and track which pool contexts to clean
    this.activeAnimationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
      TargetDummy.globalAnimationFrames.delete(frameId); // Clean up global tracking
    });
    this.activeAnimationFrames.clear();
    
    // BUGFIX: Clean up only this dummy's pool contexts
    this.activePoolContexts.forEach(contextId => {
      TargetDummy.returnPooledAnimationContext(contextId);
    });
    this.activePoolContexts.clear();
    
    // Clear timers
    if (this.respawnTimer) {
      window.clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    
    // Clean up main mesh and its materials/geometries
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    
    // Clean up physics body (check if world still exists)
    try {
      if (this.rigidBody && this.world) {
        this.world.removeRigidBody(this.rigidBody);
      }
    } catch (error) {
      console.warn(`⚠️ Error removing rigid body for ${this.id}:`, error);
    }

    // Clean up FX elements
    if (this.hitRing) {
      this.scene.remove(this.hitRing);
      this.hitRing.geometry.dispose();
      (this.hitRing.material as THREE.Material).dispose();
      this.hitRing = undefined;
    }
    if (this.koRing) {
      this.scene.remove(this.koRing);
      this.koRing.geometry.dispose();
      (this.koRing.material as THREE.Material).dispose();
      this.koRing = undefined;
    }
    if (this.respawnRing) {
      this.scene.remove(this.respawnRing);
      this.respawnRing.geometry.dispose();
      (this.respawnRing.material as THREE.Material).dispose();
      this.respawnRing = undefined;
    }
    this.sparkles.forEach(sparkle => {
      this.scene.remove(sparkle);
      sparkle.geometry.dispose();
      (sparkle.material as THREE.Material).dispose();
    });
    this.sparkles = [];
    
    console.log(`🗑️ Target dummy ${this.id} destroyed`);
  }



  /**
   * Add magical glow effect to dummy materials based on type
   */
  private addMagicalGlow(material: THREE.MeshStandardMaterial): void {
    // Define glow colors and tinting for each dummy type to match their time-travel theme
    const glowConfig = {
      stopwatch: {
        emissive: 0x6699cc, // Soft blue-gray glow - representing clockwork precision
        intensity: 0.08,
        colorTint: 0x8899dd, // Blue tint to shift red components toward blue
        tintStrength: 0.4 // How much to blend the tint (0 = none, 1 = full override)
      },
      hourglass: {
        emissive: 0xff8844, // Warm amber glow - representing flowing time
        intensity: 0.12,
        colorTint: 0xddaa77, // Warm amber tint to enhance natural colors
        tintStrength: 0.2 // Subtle tinting for hourglass
      },
      chronoshard: {
        emissive: 0x44ff88, // Green-cyan glow - representing temporal energy
        intensity: 0.18,
        colorTint: 0x77dd99, // Green-cyan tint for temporal energy
        tintStrength: 0.3 // Moderate tinting for mystical look
      }
    };
    
    const config = glowConfig[this.modelType];
    
    // Apply color tinting to harmonize model colors with glow
    if (config.tintStrength > 0) {
      const originalColor = material.color.clone();
      const tintColor = new THREE.Color(config.colorTint);
      
      // Blend original color with tint color
      material.color.lerpColors(originalColor, tintColor, config.tintStrength);
    }
    
    // Apply the glow effect
    material.emissive.setHex(config.emissive);
    material.emissiveIntensity = config.intensity;
    
    // Enhance metalness and reduce roughness for more magical appearance
    material.metalness = Math.min(material.metalness + 0.2, 1.0);
    material.roughness = Math.max(material.roughness - 0.1, 0.0);
  }

  /**
   * Update dummy animations (rotation and floating) - called each frame
   * SIMPLIFIED: Reduced complexity to prevent animation frame buildup
   */
  update(deltaTime: number): void {
    // Don't update if destroyed or not initialized
    if (this.isDestroyed || !this.isInitialized || !this.mesh) return;
    
    // SAFETY: Don't animate if physics body is null (prevents corruption)
    if (!this.rigidBody) return;
    
    // PERFORMANCE: Skip animations if system is overloaded
    if (TargetDummy.globalAnimationFrames.size >= TargetDummy.MAX_GLOBAL_ANIMATION_FRAMES - 10) {
      return; // Skip all dummy animations when system stressed
    }
    
    // SIMPLE FIX: Remove aggressive scale corruption check that was causing size changes
    // The scale is set correctly during initialization and shouldn't change during gameplay
    
    // Only animate if dummy is alive and visible
    if (this.currentHealth > 0 && this.mesh.visible) {
      // Simple rotation - reduced complexity
      this.mesh.rotation.y += this.rotationSpeed * deltaTime * 0.5; // Slower rotation
      
      // Keep rotation in range
      if (this.mesh.rotation.y > Math.PI * 2) {
        this.mesh.rotation.y -= Math.PI * 2;
      }
      
      // SIMPLIFIED: Basic floating without complex easing
      this.floatOffset += this.floatSpeed * deltaTime * 0.3; // Slower floating
      const floatAmount = Math.sin(this.floatOffset) * 0.15; // Reduced amplitude
      
      // Apply basic floating (with corruption protection)
      if (this.basePosition) {
        this.mesh.position.copy(this.basePosition);
        this.mesh.position.y += floatAmount;
      } else {
        this.mesh.position.copy(this.position);
      }
    }
  }

  /**
   * Get the expected scale for the current dummy model type.
   */
  private getExpectedScale(): THREE.Vector3 {
    // Optimized scales for visual consistency and gameplay balance (same as in createVisualMesh)
    const modelScales = {
      stopwatch: 1.8,   // Balanced size
      hourglass: 0.4,   // Smaller, more delicate
      chronoshard: 5.6  // Larger, more imposing (+0.2 from 5.4)
    };
    
    const baseScale = modelScales[this.modelType];
    
    // Normalize aspect ratios - make all models roughly the same height/width ratio (same as in createVisualMesh)
    const aspectNormalization = {
      stopwatch: { x: baseScale * 1.0, y: baseScale * 1.0, z: baseScale * 1.0 },   // Square proportions
      hourglass: { x: baseScale * 1.2, y: baseScale * 1.0, z: baseScale * 1.2 },   // Slightly wider for visibility
      chronoshard: { x: baseScale * 0.8, y: baseScale * 1.0, z: baseScale * 0.8 }  // Narrower to balance large scale
    };
    
    const normalizedScale = aspectNormalization[this.modelType];
    return new THREE.Vector3(normalizedScale.x, normalizedScale.y, normalizedScale.z);
  }


} 