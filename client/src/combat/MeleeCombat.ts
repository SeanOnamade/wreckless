import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PlayerClass } from '../kits/classKit';
import { getCurrentPlayerKit } from '../kits/classKit';
import { COMBAT_CONFIG as HIT_SYSTEM_CONFIG } from '../config';

// Combat constants from PRD
export const COMBAT_CONFIG = {
  BASE_RANGE: 3.6, // meters (doubled from 1.8m)
  BASE_CONE_ANGLE: 120, // degrees - increased from 90° for more generous hits
  MELEE_COOLDOWN: 500, // milliseconds (0.5s)
  
  // Class damage values
  DAMAGE: {
    blast: 60,
    grapple: 25, // Base damage (can crit to 70)
    blink: 30    // Base damage (bonus +20 = 50 total) - reduced from 40
  },
  
  // Class modifiers
  BLAST_RANGE_MULTIPLIER: 1.25,
  GRAPPLE_CRIT_DAMAGE: 70, // Increased from 60
  GRAPPLE_CRIT_WINDOW: 500, // 0.5s after grapple detach
  BLINK_BONUS_DAMAGE: 20, // Increased from 15 (+20 = 50 total)
  BLINK_BONUS_WINDOW: 800, // 0.8s after blink
  
  // Knockback
  KNOCKBACK_MULTIPLIER: 0.4
} as const;

export interface MeleeTarget {
  id: string;
  position: THREE.Vector3;
  rigidBody?: RAPIER.RigidBody;
  takeDamage?: (damage: number, direction: THREE.Vector3) => void;
  applyKnockback?: (force: number, direction: THREE.Vector3) => void;
  updateRangeIndicator?: (playerPosition: THREE.Vector3, range: number) => void;
}

export class MeleeCombat {
  private world: RAPIER.World;
  private camera: THREE.Camera;
  private playerBody: RAPIER.RigidBody;
  private lastMeleeTime = 0;
  private canMelee = true;
  
  // For tracking ability timings for bonus damage
  private lastBlinkTime = 0;
  private lastGrappleDetachTime = 0;
  private isAtSwingBottom = false;
  
  // Test targets (for single player testing)
  private testTargets: Map<string, MeleeTarget> = new Map();

  constructor(world: RAPIER.World, camera: THREE.Camera, playerBody: RAPIER.RigidBody) {
    this.world = world;
    this.camera = camera;
    this.playerBody = playerBody;
    
    // Listen for ability events to track timing
    window.addEventListener('abilityActivated', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.className === 'blink') {
        this.lastBlinkTime = Date.now();
        console.log('⚡ Blink timestamp recorded for damage bonus');
      }
    });
    
    // Listen for grapple state changes
    window.addEventListener('swingStateChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.isSwingingState = customEvent.detail.isSwinging;
      if (!this.isSwingingState) {
        this.lastGrappleDetachTime = Date.now();
        console.log('🪝 Grapple detach timestamp recorded for crit bonus');
      }
    });
    
    window.addEventListener('grappleDetached', (_event: Event) => {
      this.lastGrappleDetachTime = Date.now();
      this.isSwingingState = false;
      console.log('🪝 Grapple detach timestamp recorded for crit bonus');
    });
    
    // Listen for swing bottom events (if available)
    window.addEventListener('grappleSwingBottom', (_event: Event) => {
      this.isAtSwingBottom = true;
      console.log('🪝 At swing bottom - grapple crit ready!');
      // Reset flag after a short window
      window.setTimeout(() => {
        this.isAtSwingBottom = false;
      }, 200);
    });
  }

  /**
   * Register a target that can be hit by melee attacks
   */
  addTarget(target: MeleeTarget): void {
    this.testTargets.set(target.id, target);
    console.log(`🎯 Added melee target: ${target.id}`);
  }

  /**
   * Remove a target from melee consideration
   */
  removeTarget(targetId: string): void {
    this.testTargets.delete(targetId);
    console.log(`🎯 Removed melee target: ${targetId}`);
  }

  /**
   * Attempt to perform a melee attack
   * ARCHIVED: This method is only used for PvP combat when pass-through dummies are enabled
   */
  performMelee(playerVelocity?: THREE.Vector3): boolean {
    const now = Date.now();
    
    // ARCHIVED LOGIC: Skip dummy targeting if pass-through is enabled
    if (HIT_SYSTEM_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES) {
      // Only perform manual melee on player targets (future PvP)
      const playerTargets = Array.from(this.testTargets.values()).filter(target => 
        target.id.includes('player') // Future: proper player detection
      );
      
      if (playerTargets.length === 0) {
        console.log('🗡️ Manual melee skipped - no player targets (dummies use pass-through)');
        return false;
      }
    }
    
    // Check cooldown
    if (!this.canMelee || (now - this.lastMeleeTime) < COMBAT_CONFIG.MELEE_COOLDOWN) {
      console.log('⏳ Melee on cooldown');
      return false;
    }

    const currentKit = getCurrentPlayerKit();
    const className = currentKit.className;
    
    console.log(`🗡️ Attempting ${className} melee attack...`);
    
    // Get camera position and direction
    const cameraPosition = this.camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    // Calculate attack parameters based on class
    const attackParams = this.calculateAttackParameters(className, playerVelocity);
    
    // Perform cone sweep or 360° detection
    const hitTargets = this.performHitDetection(
      cameraPosition,
      cameraDirection,
      attackParams
    );
    
    // Apply damage and effects to hit targets
    let totalHits = 0;
    for (const target of hitTargets) {
      this.applyDamageToTarget(target, attackParams, cameraDirection);
      totalHits++;
    }
    
    // Set cooldown
    this.lastMeleeTime = now;
    this.canMelee = false;
    setTimeout(() => {
      this.canMelee = true;
    }, COMBAT_CONFIG.MELEE_COOLDOWN);
    
    console.log(`🗡️ Melee complete: ${totalHits} targets hit`);
    return totalHits > 0;
  }

  /**
   * Calculate attack parameters based on player class and state
   */
  private calculateAttackParameters(className: PlayerClass, playerVelocity?: THREE.Vector3) {
    let range = COMBAT_CONFIG.BASE_RANGE;
    let coneAngle: number = COMBAT_CONFIG.BASE_CONE_ANGLE;
    let damage: number = COMBAT_CONFIG.DAMAGE[className];
    let is360Sweep = false;
    
    // Apply class-specific modifiers
    switch (className) {
      case 'blast':
        // +25% range
        range *= COMBAT_CONFIG.BLAST_RANGE_MULTIPLIER;
        console.log('🔥 Blast class: +25% range boost!');
        break;
        
                      case 'grapple':
          // Get velocity first for logging
          const speed = playerVelocity ? Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z) : 0;
          const fullSpeed = playerVelocity ? Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.y * playerVelocity.y + playerVelocity.z * playerVelocity.z) : 0;
          
          console.log(`🪝 Grapple attack - Speed: ${speed.toFixed(1)} m/s (3D: ${fullSpeed.toFixed(1)}), Velocity: (${playerVelocity?.x.toFixed(1) || 'N/A'}, ${playerVelocity?.y.toFixed(1) || 'N/A'}, ${playerVelocity?.z.toFixed(1) || 'N/A'}), Swinging: ${this.isSwingingState}, Recently detached: ${(Date.now() - this.lastGrappleDetachTime) < COMBAT_CONFIG.GRAPPLE_CRIT_WINDOW}`);
          
          // Add detailed velocity info to combat log
          window.dispatchEvent(new CustomEvent('combatLogMessage', {
            detail: { message: `🪝 Grapple - Speed: ${speed.toFixed(1)} m/s, Swinging: ${this.isSwingingState}` }
          }));
          
          // Always use 360° sweep while grappling (much more generous)
          if (this.isSwingingState) {
            is360Sweep = true;
            coneAngle = 360 as number;
            
            // Velocity-based damage for grapple
            if (speed > 8.0) { // If moving fast while swinging
              damage = COMBAT_CONFIG.GRAPPLE_CRIT_DAMAGE; // 70 HP
              console.log(`🪝 VELOCITY CRIT! (${speed.toFixed(1)} m/s) - 70 HP`);
              // Add to combat log
              window.dispatchEvent(new CustomEvent('combatLogMessage', {
                detail: { message: `🪝 VELOCITY CRIT! (${speed.toFixed(1)} m/s)` }
              }));
            } else if (speed > 4.0) { // Medium speed
              damage = COMBAT_CONFIG.DAMAGE.grapple + 20; // 25 + 20 = 45
              console.log(`🪝 Speed bonus (${speed.toFixed(1)} m/s) - 45 HP`);
              // Add to combat log
              window.dispatchEvent(new CustomEvent('combatLogMessage', {
                detail: { message: `🪝 Speed bonus (${speed.toFixed(1)} m/s) - 45 HP` }
              }));
            } else {
              console.log(`🪝 Slow swing (${speed.toFixed(1)} m/s) - 25 HP`);
              // Add to combat log
              window.dispatchEvent(new CustomEvent('combatLogMessage', {
                detail: { message: `🪝 Slow swing (${speed.toFixed(1)} m/s) - 25 HP` }
              }));
            }
            
            console.log('🔄 Grapple 360° swing active!');
          } else {
            // Not swinging - check for recent detach bonus or just use velocity
            const timeSinceGrappleDetach = Date.now() - this.lastGrappleDetachTime;
            if (timeSinceGrappleDetach < COMBAT_CONFIG.GRAPPLE_CRIT_WINDOW) {
              damage = COMBAT_CONFIG.GRAPPLE_CRIT_DAMAGE;
              console.log(`🪝 POST-SWING CRIT! (${speed.toFixed(1)} m/s) - 70 HP`);
              // Add to combat log
              window.dispatchEvent(new CustomEvent('combatLogMessage', {
                detail: { message: `🪝 POST-SWING CRIT! (${speed.toFixed(1)} m/s)` }
              }));
            } else if (speed > 6.0) {
              // Even without swinging, reward high velocity
              damage = COMBAT_CONFIG.GRAPPLE_CRIT_DAMAGE;
              console.log(`🪝 HIGH VELOCITY! (${speed.toFixed(1)} m/s) - 70 HP`);
              // Add to combat log
              window.dispatchEvent(new CustomEvent('combatLogMessage', {
                detail: { message: `🪝 HIGH VELOCITY! (${speed.toFixed(1)} m/s)` }
              }));
            } else {
              console.log(`🪝 Ground attack (${speed.toFixed(1)} m/s) - 25 HP`);
              // Add to combat log
              window.dispatchEvent(new CustomEvent('combatLogMessage', {
                detail: { message: `🪝 Ground attack (${speed.toFixed(1)} m/s) - 25 HP` }
              }));
            }
          }
          break;
          
        case 'blink':
          // Check for bonus damage window
          const timeSinceLastBlink = Date.now() - this.lastBlinkTime;
          if (timeSinceLastBlink < COMBAT_CONFIG.BLINK_BONUS_WINDOW) {
            damage += COMBAT_CONFIG.BLINK_BONUS_DAMAGE;
            console.log('⚡ BLINK BONUS! (+20 HP = 50 total)');
          }
          break;
    }
    
    return {
      range,
      coneAngle,
      damage,
      is360Sweep,
      className,
      isCrit: (className === 'grapple' && damage >= COMBAT_CONFIG.GRAPPLE_CRIT_DAMAGE) || 
              (className === 'grapple' && damage > COMBAT_CONFIG.DAMAGE.grapple + 15), // Include speed bonus as crit
      isBonus: (className === 'blink' && damage > COMBAT_CONFIG.DAMAGE.blink)
    };
  }

  /**
   * Perform hit detection using raycast cone sweep
   */
  private performHitDetection(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    params: { range: number; coneAngle: number; is360Sweep: boolean }
  ): MeleeTarget[] {
    const hitTargets: MeleeTarget[] = [];
    
    if (params.is360Sweep) {
      // 360° sweep - check all targets within range
      for (const target of this.testTargets.values()) {
        const distance = origin.distanceTo(target.position);
        if (distance <= params.range) {
          console.log(`🎯 360° sweep hit: ${target.id} at ${distance.toFixed(2)}m`);
          hitTargets.push(target);
        }
      }
    } else {
      // Cone sweep using multiple raycasts
      const numRays = 7; // Increased from 5 for better coverage with larger cone
      const halfAngle = (params.coneAngle * Math.PI / 180) / 2;
      
      for (let i = 0; i < numRays; i++) {
        // Calculate ray direction within the cone
        const angle = i === 0 ? 0 : ((i - 1) / (numRays - 2) - 0.5) * 2 * halfAngle;
        
        // Create ray direction by rotating around camera's up vector
        const rayDirection = direction.clone();
        const cameraUp = new THREE.Vector3(0, 1, 0);
        rayDirection.applyAxisAngle(cameraUp, angle);
        
        // Perform raycast
        this.performSingleRaycast(origin, rayDirection, params.range, hitTargets);
      }
      
      // Additional horizontal spread rays
      for (let i = 0; i < 5; i++) {
        const angle = (i - 2) * halfAngle * 0.8; // Increased horizontal spread
        const rayDirection = direction.clone();
        const cameraRight = new THREE.Vector3();
        this.camera.getWorldDirection(cameraRight);
        cameraRight.cross(new THREE.Vector3(0, 1, 0));
        rayDirection.applyAxisAngle(cameraRight, angle);
        
        this.performSingleRaycast(origin, rayDirection, params.range, hitTargets);
      }
    }
    
    return hitTargets;
  }

  /**
   * Perform a single raycast and check for target hits
   */
  private performSingleRaycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    hitTargets: MeleeTarget[]
  ): void {
    // For now, we'll use distance-based detection with test targets
    // In multiplayer, this would use Rapier raycasting
    
    for (const target of this.testTargets.values()) {
      if (hitTargets.includes(target)) continue; // Already hit
      
      // Calculate if target is within the ray's effective area
      const toTarget = target.position.clone().sub(origin);
      const distance = toTarget.length();
      
      if (distance > maxDistance) continue;
      
      // Check if target is roughly in the ray direction (within cone)
      const dotProduct = toTarget.normalize().dot(direction);
      const angleThreshold = Math.cos(Math.PI / 8); // ~22.5 degrees tolerance
      
      if (dotProduct > angleThreshold) {
        console.log(`🎯 Raycast hit: ${target.id} (distance: ${distance.toFixed(2)}m, dot: ${dotProduct.toFixed(2)})`);
        hitTargets.push(target);
      }
    }
  }

  /**
   * Apply damage and knockback to a target
   */
  private applyDamageToTarget(
    target: MeleeTarget,
    attackParams: { damage: number; className: PlayerClass; isCrit?: boolean; isBonus?: boolean },
    attackDirection: THREE.Vector3
  ): void {
    const damage = attackParams.damage;
    const knockbackForce = damage * COMBAT_CONFIG.KNOCKBACK_MULTIPLIER;
    
    // Generate appropriate log message
    let logMessage = `🗡️ Melee hit ${target.id} for ${damage} HP`;
    if (attackParams.isCrit) {
      logMessage = `🪝 GRAPPLE CRIT! Hit ${target.id} for ${damage} HP`;
    } else if (attackParams.isBonus) {
      logMessage = `⚡ BONUS HIT! Hit ${target.id} for ${damage} HP`;
    }
    console.log(logMessage);
    
    // Apply damage
    if (target.takeDamage) {
      target.takeDamage(damage, attackDirection);
    }
    
    // Apply knockback
    if (target.applyKnockback) {
      target.applyKnockback(knockbackForce, attackDirection);
    }
    
    // Trigger visual feedback for special hits
    if (attackParams.isCrit || attackParams.isBonus) {
      this.triggerSpecialHitFeedback(attackParams.isCrit ? 'crit' : 'bonus');
    }
    
    // Dispatch hit event for effects/UI
    window.dispatchEvent(new CustomEvent('meleeHit', {
      detail: {
        targetId: target.id,
        damage,
        className: attackParams.className,
        knockbackForce,
        direction: attackDirection,
        isCrit: attackParams.isCrit || false,
        isBonus: attackParams.isBonus || false
      }
    }));
  }
  
  /**
   * Trigger visual feedback for special hits
   */
  private triggerSpecialHitFeedback(type: 'crit' | 'bonus'): void {
    // Dispatch screen effect event
    window.dispatchEvent(new CustomEvent('specialHitEffect', {
      detail: { type, timestamp: Date.now() }
    }));
    
    console.log(`💥 Special hit feedback: ${type.toUpperCase()}`);
  }

  /**
   * Check if the player is currently swinging
   */
  private isCurrentlySwinging(): boolean {
    return this.isSwingingState;
  }
  

  
  private isSwingingState = false;

  /**
   * Get current melee state for UI
   */
  getMeleeState() {
    return {
      canMelee: this.canMelee,
      lastMeleeTime: this.lastMeleeTime,
      cooldownRemaining: Math.max(0, COMBAT_CONFIG.MELEE_COOLDOWN - (Date.now() - this.lastMeleeTime))
    };
  }

  /**
   * Get nearest target information for UI display
   */
  getNearestTargetInfo(playerPosition: THREE.Vector3): { id: string; health: number; maxHealth: number } | undefined {
    let nearestTarget: MeleeTarget | null = null;
    let nearestDistance = Infinity;
    
    for (const target of this.testTargets.values()) {
      const distance = playerPosition.distanceTo(target.position);
      if (distance < nearestDistance && distance <= 5.0) { // Show targets within 5 meters
        nearestDistance = distance;
        nearestTarget = target;
      }
    }
    
    if (nearestTarget && 'getHealthStatus' in nearestTarget) {
      const healthStatus = (nearestTarget as any).getHealthStatus();
      return {
        id: nearestTarget.id,
        health: healthStatus.current,
        maxHealth: healthStatus.max
      };
    }
    
    return undefined;
  }
} 