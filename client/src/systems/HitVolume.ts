import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { FirstPersonController } from '../controller';
import type { MeleeCombat } from '../combat/MeleeCombat';
import { 
  COMBAT_CONFIG, 
  getHitCapsuleRadius, 
  getCombatMode,
  type HitVolumeType 
} from '../config/combat';
import { getCurrentPlayerKit } from '../kits/classKit';

/**
 * Damage calculation result
 */
interface DamageResult {
  damage: number;
  isBonus: boolean;
  isCrit: boolean;
}

/**
 * HitVolume System - Pass-through damage using capsule sweeps
 * Handles frame-by-frame movement, blink teleportation, and swing path damage
 */
export class HitVolume {
  private world: RAPIER.World;
  private controller: FirstPersonController;
  private meleeCombat: MeleeCombat;
  
  // Position tracking for frame-by-frame sweeps
  private lastPosition: THREE.Vector3 = new THREE.Vector3();
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  
  // Hit tracking to prevent multiple hits per frame
  private hitCooldowns: Map<string, number> = new Map();
  private frameHitTargets: Set<string> = new Set(); // Prevent multiple hits per frame
  private frameCount: number = 0; // Track frame number instead of time
  
  // Performance tracking
  private sweepCount = 0;
  private hitCount = 0;
  
  // Bonus damage tracking (same as MeleeCombat)
  private lastBlinkTime = 0;
  private lastGrappleDetachTime = 0;
  private isSwingingState = false;
  
  constructor(world: RAPIER.World, controller: FirstPersonController, meleeCombat: MeleeCombat) {
    this.world = world;
    this.controller = controller;
    this.meleeCombat = meleeCombat;
    
    // Initialize position tracking
    this.updatePositionTracking();
    
    // Set up bonus damage tracking
    this.setupBonusTracking();
    
    console.log('🎯 HitVolume system initialized for pass-through damage');
  }

  /**
   * Register HitVolume system with the game loop
   * Call this each frame to process movement-based damage
   */
  update(deltaTime: number): void {
    // CRITICAL: Only run in passthrough mode to prevent double damage
    if (getCombatMode() !== 'passthrough') {
      return; // Skip pass-through damage in manual mode
    }
    
    // Clear frame-level hit tracking at start of each frame
    this.frameHitTargets.clear();
    this.frameCount++;
    
    const now = Date.now();
    
    // Update position tracking
    this.updatePositionTracking();
    
    // Clean up expired hit cooldowns
    this.cleanupHitCooldowns(now);
    
    // Perform frame-by-frame movement sweep
    this.performMovementSweep(deltaTime);
  }

  /**
   * Update position tracking for movement sweeps
   */
  private updatePositionTracking(): void {
    // Store previous position
    this.lastPosition.copy(this.currentPosition);
    
    // Get current position from controller
    const playerPosition = this.controller.getPosition();
    this.currentPosition.set(playerPosition.x, playerPosition.y, playerPosition.z);
  }

  /**
   * Perform frame-by-frame movement sweep for pass-through damage
   */
  private performMovementSweep(deltaTime: number): void {
    // Check if we've moved enough to trigger a sweep
    const movementDistance = this.lastPosition.distanceTo(this.currentPosition);
    
    // Increase minimum movement to reduce rapid hits (but not too much)
    const MIN_MOVEMENT = Math.max(COMBAT_CONFIG.MODE.MIN_MOVEMENT_FOR_SWEEP, 0.2); // At least 0.2m movement
    
    if (movementDistance < MIN_MOVEMENT) {
      return; // Not enough movement to trigger sweep
    }
    
    // Limit maximum sweep distance for performance
    const clampedDistance = Math.min(movementDistance, COMBAT_CONFIG.HIT_VOLUME.MAX_SWEEP_DISTANCE);
    
    if (clampedDistance < movementDistance) {
      console.warn(`⚠️ HitVolume: Clamping sweep distance from ${movementDistance.toFixed(2)}m to ${clampedDistance.toFixed(2)}m`);
    }
    
    // Calculate sweep direction
    const sweepDirection = this.currentPosition.clone().sub(this.lastPosition).normalize();
    const sweepStart = this.lastPosition.clone();
    const sweepEnd = sweepStart.clone().add(sweepDirection.multiplyScalar(clampedDistance));
    
    // Perform capsule sweep
    this.performCapsuleSweep(sweepStart, sweepEnd, 'movement', deltaTime);
  }

  /**
   * Perform blink path sweep from origin to destination
   */
  blinkSweep(originPosition: THREE.Vector3, destinationPosition: THREE.Vector3): void {
    console.log(`⚡ HitVolume: Blink sweep from (${originPosition.x.toFixed(1)}, ${originPosition.y.toFixed(1)}, ${originPosition.z.toFixed(1)}) to (${destinationPosition.x.toFixed(1)}, ${destinationPosition.y.toFixed(1)}, ${destinationPosition.z.toFixed(1)})`);
    
    this.performCapsuleSweep(originPosition, destinationPosition, 'blink');
  }

  /**
   * Perform swing path sweep for grapple movement
   */
  swingSweep(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    if (COMBAT_CONFIG.DEBUG.LOG_HIT_DETECTION) {
      console.log(`🪝 HitVolume: Swing sweep from (${fromPosition.x.toFixed(1)}, ${fromPosition.y.toFixed(1)}, ${fromPosition.z.toFixed(1)}) to (${toPosition.x.toFixed(1)}, ${toPosition.y.toFixed(1)}, ${toPosition.z.toFixed(1)})`);
    }
    
    this.performCapsuleSweep(fromPosition, toPosition, 'swing');
  }

  /**
   * Core capsule sweep implementation using Rapier physics
   * Uses position sampling along the path for reliable hit detection
   */
  private performCapsuleSweep(
    startPos: THREE.Vector3, 
    endPos: THREE.Vector3, 
    hitType: HitVolumeType,
    deltaTime: number = 0.016 // Default to 60fps
  ): void {
    this.sweepCount++;
    
    // Get capsule parameters based on hit type
    const capsuleRadius = getHitCapsuleRadius(hitType);
    
    // Calculate sweep vector
    const sweepVector = endPos.clone().sub(startPos);
    const sweepDistance = sweepVector.length();
    
    if (sweepDistance < 0.01) {
      return; // No meaningful movement
    }
    
    if (COMBAT_CONFIG.DEBUG.LOG_HIT_DETECTION) {
      console.log(`🎯 Performing ${hitType} capsule sweep: distance=${sweepDistance.toFixed(2)}m, radius=${capsuleRadius.toFixed(2)}m`);
    }
    
    // Sample positions along the sweep path for hit detection
    const numSamples = Math.max(3, Math.ceil(sweepDistance / 2.0)); // Sample every 2 meters
    const hitTargets = new Set<string>(); // Prevent multiple hits on same target
    
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const samplePos = startPos.clone().lerp(endPos, t);
      
      // Check for intersections at this position
      this.checkIntersectionsAtPosition(samplePos, capsuleRadius, hitType, sweepDistance, deltaTime, hitTargets);
    }
  }

  /**
   * Check for intersections at a specific position along the sweep path
   */
  private checkIntersectionsAtPosition(
    position: THREE.Vector3, 
    radius: number, 
    hitType: HitVolumeType, 
    sweepDistance: number, 
    deltaTime: number,
    hitTargets: Set<string>
  ): void {
    // Create a ball shape for intersection testing
    const testShape = new RAPIER.Ball(radius);
    const testPos = { x: position.x, y: position.y, z: position.z };
    const testRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
    
    // Check for intersections with dummy colliders
    this.world.intersectionsWithShape(testPos, testRot, testShape, (collider: RAPIER.Collider) => {
      const userData = collider.parent()?.userData as any;
      const rigidBody = collider.parent();
      
      // Filter for dummy colliders only
      if (!userData || !userData.isDummy || !rigidBody) {
        return true; // Continue checking
      }
      
      // Skip disabled rigidBodies (KO'd dummies)
      const isEnabled = rigidBody.isEnabled();
      
      if (!isEnabled) {
        return true; // Continue checking (dummy is KO'd)
      }
      
      const targetId = userData.id;
      if (!targetId || hitTargets.has(targetId)) {
        return true; // Continue if already hit or no ID
      }
      
      // Mark as hit to prevent multiple hits
      hitTargets.add(targetId);
      
      // Process the hit
      this.processHitOnTarget(targetId, hitType, sweepDistance, deltaTime);
      
      return true; // Continue checking for more targets
    });
  }

  /**
   * Process hit on a specific target and apply damage
   */
  private processHitOnTarget(
    targetId: string,
    hitType: HitVolumeType,
    sweepDistance: number,
    _deltaTime: number
  ): void {
    const now = Date.now();
    
    // FRAME-LEVEL protection: Prevent multiple hits on same target in same frame
    if (this.frameHitTargets.has(targetId)) {
      console.log(`🛡️ HitVolume: Prevented duplicate hit on ${targetId} in same frame ${this.frameCount}`);
      return;
    }
    
    // Check hit cooldown to prevent rapid-fire hits (500ms for racing)
    const lastHitTime = this.hitCooldowns.get(targetId);
    const HIT_COOLDOWN_MS = 500; // Increased from 300ms to 500ms
    
    if (lastHitTime && (now - lastHitTime) < HIT_COOLDOWN_MS) {
      console.log(`⏰ HitVolume: ${targetId} still on cooldown (${now - lastHitTime}ms < ${HIT_COOLDOWN_MS}ms)`);
      return; // Still on cooldown
    }
    
    // CRITICAL: Set cooldown BEFORE applying damage to prevent race conditions
    this.frameHitTargets.add(targetId);
    this.hitCooldowns.set(targetId, now);
    this.hitCount++;
    

    
    // Get the target from melee combat system
    const target = this.meleeCombat.getTarget(targetId);
    if (!target) {
      console.warn(`⚠️ HitVolume: Target ${targetId} not found in melee combat system`);
      return;
    }
    
    // Calculate damage with bonuses based on player class and state
    const playerVelocity = this.controller.getVelocity();
    const velocity3D = new THREE.Vector3(playerVelocity.x, playerVelocity.y, playerVelocity.z);
    const speed = velocity3D.length();
    
    // Calculate damage with blink/grapple bonuses
    const damageResult = this.calculateDamage();
    const finalDamage = damageResult.damage;
    
    // Calculate hit direction (from player towards target)
    const targetPos = target.position;
    const playerPos = this.currentPosition;
    const hitDirection = targetPos.clone().sub(playerPos).normalize();
    
    // Log BEFORE applying damage for debugging
    const timeSinceLastHit = lastHitTime ? now - lastHitTime : 'never';
    console.log(`🎯 HitVolume: Applying ${finalDamage} damage to ${targetId} (${hitType}) - Last hit: ${timeSinceLastHit}ms ago`);
    
    // Apply damage with error handling
    if (target.takeDamage) {
      try {
      target.takeDamage(finalDamage, hitDirection);
      } catch (damageError) {
        console.error(`❌ HitVolume: Exception in takeDamage for ${targetId}:`, damageError);
        if (damageError instanceof Error) {
          console.error(`❌ Stack trace:`, damageError.stack);
        }
      }
    } else {
      console.warn(`⚠️ Target ${targetId} has no takeDamage method`);
    }
    
    // Log the hit with error handling
    try {
    let hitDescription = `${finalDamage} HP`;
    if (damageResult.isCrit) hitDescription = `${finalDamage} HP CRIT`;
    if (damageResult.isBonus) hitDescription = `${finalDamage} HP BONUS`;
    
    console.log(`💥 Hit ${targetId} for ${hitDescription}`);
      
      // Get player class safely
      const playerClass = this.getCurrentPlayerClass();
    
    // Dispatch hit event for combat log (same format as MeleeCombat)
    window.dispatchEvent(new CustomEvent('meleeHit', {
      detail: {
        targetId,
        damage: finalDamage,
          className: playerClass,
        knockbackForce: finalDamage * 10, // Same knockback calculation as MeleeCombat
        direction: hitDirection,
        isCrit: damageResult.isCrit,
        isBonus: damageResult.isBonus
      }
    }));
    
    // Add clean hit info to combat log
    let logMessage = `💥 ${finalDamage} HP`;
    if (damageResult.isCrit) logMessage = `💥 ${finalDamage} HP CRIT`;
    if (damageResult.isBonus) logMessage = `💥 ${finalDamage} HP BONUS`;
    
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: logMessage }
    }));
    
      // Dispatch hit event for UI/effects (CRITICAL for scoring)
    window.dispatchEvent(new CustomEvent('passthroughHit', {
      detail: {
        targetId,
        damage: finalDamage,
        hitType,
        speed,
        sweepDistance,
        timestamp: now
      }
    }));
      
    } catch (error) {
      console.error(`❌ HitVolume: Error in event dispatch for ${targetId}:`, error);
      
      // Try to dispatch at least the scoring event
      try {
        window.dispatchEvent(new CustomEvent('passthroughHit', {
          detail: {
            targetId,
            damage: finalDamage,
            hitType,
            speed: 0,
            sweepDistance: 0,
            timestamp: now
          }
        }));
      } catch (emergencyError) {
        console.error(`❌ HitVolume: Emergency dispatch also failed:`, emergencyError);
      }
    }
  }

  /**
   * Get current player class name
   */
  private getCurrentPlayerClass(): string {
    const currentKit = getCurrentPlayerKit();
    return currentKit.className;
  }

  /**
   * Set up event listeners for bonus damage tracking
   */
  private setupBonusTracking(): void {
    // Track blink activations for bonus damage
    window.addEventListener('abilityActivated', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.className === 'blink') {
        this.lastBlinkTime = Date.now();
        console.log('⚡ HitVolume: Blink timestamp recorded for bonus damage');
      }
    });
    
    // Track grapple state changes
    window.addEventListener('swingStateChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.isSwingingState = customEvent.detail.isSwinging;
      if (!this.isSwingingState) {
        this.lastGrappleDetachTime = Date.now();
        console.log('🪝 HitVolume: Grapple detach timestamp recorded for crit bonus');
      }
    });
    
    window.addEventListener('grappleDetached', (_event: Event) => {
      this.lastGrappleDetachTime = Date.now();
      this.isSwingingState = false;
      console.log('🪝 HitVolume: Grapple detach timestamp recorded for crit bonus');
    });
  }

  /**
   * Calculate damage with bonus modifiers based on player class and state
   */
  private calculateDamage(): DamageResult {
    const currentKit = getCurrentPlayerKit();
    const className = currentKit.className;
    const now = Date.now();
    
    // Base flat damage values
    let damage = 0;
    let isBonus = false;
    let isCrit = false;
    
    switch (className) {
      case 'blast':
        damage = 60; // Flat blast damage (no bonuses)
        break;
        
      case 'grapple':
        damage = 25; // Base grapple damage
        
        // Check for grapple crit conditions
        const timeSinceGrappleDetach = now - this.lastGrappleDetachTime;
        const recentlyDetached = timeSinceGrappleDetach < 1000; // 1 second window
        
        if (this.isSwingingState || recentlyDetached) {
          damage = 70; // Grapple crit damage
          isCrit = true;
          console.log(`🪝 HitVolume: Grapple CRIT! (swinging: ${this.isSwingingState}, recently detached: ${recentlyDetached})`);
        }
        break;
        
      case 'blink':
        damage = 30; // Base blink damage
        
        // Check for blink bonus window (500ms after blink)
        const timeSinceLastBlink = now - this.lastBlinkTime;
        if (timeSinceLastBlink < 500) {
          damage = 50; // Blink bonus damage (30 + 20)
          isBonus = true;
          console.log(`⚡ HitVolume: Blink BONUS! (${timeSinceLastBlink}ms after blink)`);
        }
        break;
        
      default:
        damage = 25; // Fallback
    }
    
    return { damage, isBonus, isCrit };
  }

  /**
   * Clean up expired hit cooldowns for performance
   */
  private cleanupHitCooldowns(now: number): void {
    const cooldownDuration = COMBAT_CONFIG.DUMMY.HIT_COOLDOWN_MS;
    
    for (const [targetId, lastHitTime] of this.hitCooldowns) {
      if (now - lastHitTime > cooldownDuration * 2) { // Clean up after 2x cooldown duration
        this.hitCooldowns.delete(targetId);
      }
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): { sweepCount: number; hitCount: number; hitCooldowns: number } {
    return {
      sweepCount: this.sweepCount,
      hitCount: this.hitCount,
      hitCooldowns: this.hitCooldowns.size
    };
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats(): void {
    this.sweepCount = 0;
    this.hitCount = 0;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.hitCooldowns.clear();
    console.log('🎯 HitVolume system destroyed');
  }
}

/**
 * Global HitVolume instance for system registration
 */
let globalHitVolume: HitVolume | null = null;

/**
 * Register HitVolume system with game components
 */
export function registerHitVolumes(
  world: RAPIER.World,
  controller: FirstPersonController, 
  meleeCombat: MeleeCombat
): HitVolume {
  if (globalHitVolume) {
    globalHitVolume.destroy();
  }
  
  globalHitVolume = new HitVolume(world, controller, meleeCombat);
  
  console.log('🎯 HitVolume system registered globally');
  return globalHitVolume;
}

/**
 * Get the global HitVolume instance
 */
export function getHitVolume(): HitVolume | null {
  return globalHitVolume;
}

/**
 * Cleanup global HitVolume instance
 */
export function destroyHitVolume(): void {
  if (globalHitVolume) {
    globalHitVolume.destroy();
    globalHitVolume = null;
  }
} 