import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { COMBAT_CONFIG } from '../config';
import type { FirstPersonController } from '../controller';
import type { MeleeTarget } from '../combat/MeleeCombat';

export interface HitVolumeResult {
  target: MeleeTarget;
  distance: number;
  hitPoint: THREE.Vector3;
}

export class HitVolumeManager {
  private world: RAPIER.World;
  private controller: FirstPersonController;
  private targets: Map<string, MeleeTarget> = new Map();
  
  // Performance tracking
  private lastHitTimes: Map<string, number> = new Map();
  private tempVectors = {
    prevPos: new THREE.Vector3(),
    currentPos: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    hitPoint: new THREE.Vector3()
  };

  constructor(world: RAPIER.World, controller: FirstPersonController) {
    this.world = world;
    this.controller = controller;
    
    console.log('🎯 HitVolume system initialized for pass-through dummy hits');
  }

  /**
   * Register a target for hit detection
   */
  addTarget(target: MeleeTarget): void {
    this.targets.set(target.id, target);
    
    // Mark dummy collision bodies for identification
    if (target.rigidBody) {
      target.rigidBody.userData = { isDummy: true, targetId: target.id };
    }
    
    if (COMBAT_CONFIG.LOG_HIT_EVENTS) {
      console.log(`🎯 Registered target for hit detection: ${target.id}`);
    }
  }

  /**
   * Remove a target from hit detection
   */
  removeTarget(targetId: string): void {
    this.targets.delete(targetId);
    this.lastHitTimes.delete(targetId);
    
    if (COMBAT_CONFIG.LOG_HIT_EVENTS) {
      console.log(`🎯 Removed target from hit detection: ${targetId}`);
    }
  }

  /**
   * Perform frame-by-frame movement sweep for normal player movement
   */
  frameMovementSweep(prevPosition: THREE.Vector3, currentPosition: THREE.Vector3): HitVolumeResult[] {
    if (!COMBAT_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES) {
      return [];
    }

    // Skip if no movement
    const movementDistance = prevPosition.distanceTo(currentPosition);
    if (movementDistance < 0.01) {
      return [];
    }

    return this.performCapsuleSweep(
      prevPosition,
      currentPosition,
      COMBAT_CONFIG.HIT_CAPSULE_RADIUS,
      'movement'
    );
  }

  /**
   * Perform capsule cast for blink teleportation
   */
  blinkTeleportSweep(originPosition: THREE.Vector3, targetPosition: THREE.Vector3): HitVolumeResult[] {
    if (!COMBAT_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES) {
      return [];
    }

    const radius = COMBAT_CONFIG.HIT_CAPSULE_RADIUS * COMBAT_CONFIG.BLINK_SWEEP_EXTRA;
    
    return this.performCapsuleSweep(
      originPosition,
      targetPosition,
      radius,
      'blink'
    );
  }

  /**
   * Perform capsule sweep for grapple swinging
   */
  swingMovementSweep(prevPosition: THREE.Vector3, currentPosition: THREE.Vector3): HitVolumeResult[] {
    if (!COMBAT_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES) {
      return [];
    }

    // Use slightly larger radius for swinging due to higher speeds
    const radius = COMBAT_CONFIG.HIT_CAPSULE_RADIUS * 1.2;
    
    return this.performCapsuleSweep(
      prevPosition,
      currentPosition,
      radius,
      'swing'
    );
  }

  /**
   * Core capsule sweep implementation using multiple ray casts
   */
  private performCapsuleSweep(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    radius: number,
    sweepType: string
  ): HitVolumeResult[] {
    const results: HitVolumeResult[] = [];
    const now = Date.now();
    
    // Calculate sweep direction and distance
    this.tempVectors.direction.copy(endPos).sub(startPos);
    const distance = this.tempVectors.direction.length();
    
    if (distance < 0.01) return results;
    
    this.tempVectors.direction.normalize();
    
    // Create multiple rays to simulate capsule (center + 4 cardinal directions)
    const rayPositions = [
      startPos.clone(), // Center ray
      startPos.clone().add(new THREE.Vector3(radius, 0, 0)), // Right
      startPos.clone().add(new THREE.Vector3(-radius, 0, 0)), // Left
      startPos.clone().add(new THREE.Vector3(0, radius, 0)), // Up
      startPos.clone().add(new THREE.Vector3(0, -radius, 0)), // Down
    ];
    
    // Track unique hits to avoid duplicate damage
    const hitTargets = new Set<string>();
    
    for (const rayStart of rayPositions) {
      const ray = new RAPIER.Ray(rayStart, this.tempVectors.direction);
      
      // Cast ray with filters to only hit dummy targets
      const hit = this.world.castRay(
        ray,
        distance,
        true, // solid
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,
        undefined, // groups
        undefined, // exclude collider
        undefined, // exclude rigidbody
        (collider) => {
          // Filter: only hit dummy targets
          const userData = collider.parent()?.userData as any;
          return Boolean(userData && userData.isDummy === true);
        }
      );
      
      if (hit) {
        const userData = hit.collider.parent()?.userData as any;
        const targetId = userData?.targetId;
        const target = targetId ? this.targets.get(targetId) : null;
        
        if (target && !hitTargets.has(target.id)) {
          // Check cooldown to prevent spam hits
          const lastHitTime = this.lastHitTimes.get(target.id) || 0;
          if (now - lastHitTime < COMBAT_CONFIG.HIT_COOLDOWN_PER_DUMMY) {
            continue;
          }
          
          // Calculate hit point
          const hitPoint = ray.pointAt(hit.timeOfImpact);
          
          results.push({
            target,
            distance: hit.timeOfImpact,
            hitPoint: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z)
          });
          
          // Mark target as hit to avoid duplicates
          hitTargets.add(target.id);
          
          // Update hit time
          this.lastHitTimes.set(target.id, now);
          
          if (COMBAT_CONFIG.LOG_HIT_EVENTS) {
            console.log(`🎯 ${sweepType} hit: ${target.id} at distance ${hit.timeOfImpact.toFixed(2)}m`);
          }
          
          // Limit hits per frame for performance
          if (results.length >= COMBAT_CONFIG.MAX_HITS_PER_FRAME) {
            break;
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Process hit results and apply damage/effects
   */
  processHitResults(hitResults: HitVolumeResult[], movementType: string): void {
    for (const hit of hitResults) {
      this.applyPassThroughDamage(hit.target, hit.hitPoint, movementType);
    }
  }

  /**
   * Apply damage and effects for pass-through hits
   */
  private applyPassThroughDamage(target: MeleeTarget, hitPoint: THREE.Vector3, movementType: string): void {
    // Calculate damage based on movement type
    let damage = 30; // Base pass-through damage
    
    switch (movementType) {
      case 'blink':
        damage = 35; // Higher damage for blink hits
        break;
      case 'swing':
        damage = 40; // Highest damage for grapple swing hits
        break;
      case 'movement':
        damage = 25; // Lower damage for normal movement
        break;
    }
    
    // Calculate direction (simplified - from hit point toward target center)
    const direction = new THREE.Vector3().copy(target.position).sub(hitPoint).normalize();
    
    // Apply damage
    if (target.takeDamage) {
      target.takeDamage(damage, direction);
    }
    
    // Trigger visual effects
    this.triggerHitEffects(target, hitPoint, movementType);
    
    // Dispatch hit event for UI/effects
    window.dispatchEvent(new CustomEvent('passThrough Hit', {
      detail: {
        targetId: target.id,
        damage,
        movementType,
        hitPoint: hitPoint.clone(),
        timestamp: Date.now()
      }
    }));
    
    if (COMBAT_CONFIG.LOG_HIT_EVENTS) {
      console.log(`🎯 Pass-through hit: ${target.id} for ${damage} HP (${movementType})`);
    }
  }

  /**
   * Trigger visual feedback effects for hits
   */
  private triggerHitEffects(target: MeleeTarget, hitPoint: THREE.Vector3, movementType: string): void {
    // Dispatch visual effect events
    window.dispatchEvent(new CustomEvent('dummyHitEffect', {
      detail: {
        targetId: target.id,
        hitPoint: hitPoint.clone(),
        movementType,
        flashDuration: COMBAT_CONFIG.HIT_FLASH_DURATION,
        textColor: COMBAT_CONFIG.HIT_TEXT_COLOR,
        textDuration: COMBAT_CONFIG.HIT_TEXT_DURATION
      }
    }));
  }

  /**
   * Get all registered targets
   */
  getTargets(): Map<string, MeleeTarget> {
    return this.targets;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.targets.clear();
    this.lastHitTimes.clear();
    console.log('🎯 HitVolume system destroyed');
  }
}

/**
 * Register hit volumes with the player controller for automatic sweep detection
 */
export function registerHitVolumes(controller: FirstPersonController, world: RAPIER.World): HitVolumeManager {
  const hitVolumeManager = new HitVolumeManager(world, controller);
  
  // TODO: Integrate with controller movement tracking
  // This will be connected in the controller update loop
  
  return hitVolumeManager;
} 