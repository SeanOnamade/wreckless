import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TargetDummy } from '../combat/TargetDummy';
import type { MeleeCombat } from '../combat/MeleeCombat';
import type { DummyPositionData } from './DummyPositionTypes';
import dummyPositionsData from './dummyPositions.json';
import type { MeleeTarget } from '../combat/MeleeCombat';

export interface SpeedBoostConfig {
  baseDuration: number; // 3 seconds base
  maxDuration: number;  // 5 seconds max  
  baseVelocity: number; // Current max velocity (18)
  boostedVelocity: number; // Boosted max velocity (26)
  damageScaling: number; // How much damage affects duration
}

export class DummyLoader {
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private meleeCombat: MeleeCombat;
  private loadedDummies: RacingTargetDummy[] = [];
  
  private speedBoostConfig: SpeedBoostConfig = {
    baseDuration: 3000,      // 3 seconds base
    maxDuration: 5000,       // 5 seconds max
    baseVelocity: 18,        // Current max velocity
    boostedVelocity: 35,     // Boosted max velocity (increased from 26)
    damageScaling: 30        // 30 damage = +1 second
  };

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    meleeCombat: MeleeCombat
  ) {
    this.scene = scene;
    this.world = world;
    this.meleeCombat = meleeCombat;
  }

  /**
   * Load all dummies from saved positions data
   */
  async loadDummies(): Promise<RacingTargetDummy[]> {
    try {
      const data = dummyPositionsData as DummyPositionData;
      
      console.log(`🎯 Loading ${data.totalDummies} dummies from saved positions...`);
      
      // Clear any existing dummies
      this.clearDummies();
      
      // Create dummies from saved positions
      for (const dummyPos of data.dummyPositions) {
        const position = new THREE.Vector3(
          dummyPos.position.x,
          dummyPos.position.y,
          dummyPos.position.z
        );
        
        // Create racing dummy with speed boost capability
        const dummy = new RacingTargetDummy(
          this.scene,
          this.world,
          position,
          dummyPos.id,
          this.speedBoostConfig
        );
        
        // Add to melee combat system
        this.meleeCombat.addTarget(dummy);
        this.loadedDummies.push(dummy);
      }
      
      console.log(`✅ Successfully loaded ${this.loadedDummies.length} racing dummies`);
      console.log(`🏎️ Speed boost system active: ${this.speedBoostConfig.baseVelocity}→${this.speedBoostConfig.boostedVelocity} m/s`);
      
      return this.loadedDummies;
      
    } catch (error) {
      console.error('❌ Failed to load dummy positions:', error);
      return [];
    }
  }

  /**
   * Clear all loaded dummies
   */
  clearDummies(): void {
    this.loadedDummies.forEach(dummy => {
      this.meleeCombat.removeTarget(dummy.id);
      dummy.destroy();
    });
    this.loadedDummies = [];
  }

  /**
   * Get all loaded dummies
   */
  getDummies(): RacingTargetDummy[] {
    return this.loadedDummies;
  }

  /**
   * Get speed boost configuration
   */
  getSpeedBoostConfig(): SpeedBoostConfig {
    return this.speedBoostConfig;
  }
}

/**
 * Enhanced TargetDummy for racing with speed boost mechanics
 * Uses composition instead of inheritance to avoid private property issues
 */
export class RacingTargetDummy implements MeleeTarget {
  public id: string;
  public position: THREE.Vector3;
  public rigidBody: RAPIER.RigidBody;
  
  private targetDummy: TargetDummy;
  private speedBoostConfig: SpeedBoostConfig;
  private respawnTimer?: number;
  private isAvailable = true;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    position: THREE.Vector3,
    id: string,
    speedBoostConfig: SpeedBoostConfig
  ) {
    // Create underlying TargetDummy
    this.targetDummy = new TargetDummy(scene, world, position, id);
    
    // Copy properties from underlying dummy
    this.id = this.targetDummy.id;
    this.position = this.targetDummy.position;
    this.rigidBody = this.targetDummy.rigidBody;
    
    this.speedBoostConfig = speedBoostConfig;
  }

  /**
   * Implement MeleeTarget interface by delegating to underlying dummy
   */
  takeDamage(damage: number, direction: THREE.Vector3): void {
    // Racing mode: Always apply speed boosts
    
    // RACING MODE: Always give speed boosts, but still handle respawn for visual feedback
    const wasAvailable = this.isAvailable;
    
    // Calculate speed boost duration based on damage
    const baseDuration = this.speedBoostConfig.baseDuration;
    const bonusDuration = (damage / this.speedBoostConfig.damageScaling) * 1000; // Convert to ms
    const totalDuration = Math.min(
      baseDuration + bonusDuration,
      this.speedBoostConfig.maxDuration
    );
    
    // Calculate speed boost duration
    
    // Apply speed boost to player
    this.grantSpeedBoost(damage, totalDuration);
    
    // Apply damage to underlying dummy (handles HP tracking and visual feedback)
    this.targetDummy.takeDamage(damage, direction);
    
    // Only disable/respawn if dummy was available (for visual feedback)
    if (wasAvailable) {
      this.isAvailable = false;
      this.hideTarget();
      this.scheduleRespawn();
      
      // Dummy disabled for visual respawn feedback
    }
    
    // Speed boost granted (logging handled by controller)
  }

  /**
   * Delegate applyKnockback to underlying dummy
   */
  applyKnockback(force: number, direction: THREE.Vector3): void {
    if (this.targetDummy.applyKnockback) {
      this.targetDummy.applyKnockback(force, direction);
    }
  }

  /**
   * Delegate updateRangeIndicator to underlying dummy
   */
  updateRangeIndicator(playerPosition: THREE.Vector3, range: number): void {
    if (this.targetDummy.updateRangeIndicator) {
      this.targetDummy.updateRangeIndicator(playerPosition, range);
    }
  }

  /**
   * Grant speed boost to player based on damage dealt
   */
  private grantSpeedBoost(damage: number, duration: number): void {
    const boostData = {
      fromVelocity: this.speedBoostConfig.baseVelocity,
      toVelocity: this.speedBoostConfig.boostedVelocity,
      duration: duration,
      damage: damage,
      source: this.id
    };
    
    // Dispatch speed boost event
    
    // Dispatch speed boost event for the controller to handle
    window.dispatchEvent(new CustomEvent('speedBoostGranted', {
      detail: boostData
    }));
  }

  /**
   * Hide the target visually (simple approach)
   */
  private hideTarget(): void {
    // Move dummy underground temporarily
    this.rigidBody.setTranslation({
      x: this.position.x,
      y: this.position.y - 100,
      z: this.position.z
    }, true);
  }

  /**
   * Show the target visually 
   */
  private showTarget(): void {
    // Move dummy back to original position
    this.rigidBody.setTranslation({
      x: this.position.x,
      y: this.position.y,
      z: this.position.z
    }, true);
  }

  /**
   * Schedule dummy respawn
   */
  private scheduleRespawn(): void {
    // Clear existing timer
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
    }
    
    // Respawn after 2-3 seconds (much faster for racing)
    const respawnDelay = 2000 + Math.random() * 1000;
    
    this.respawnTimer = window.setTimeout(() => {
      this.respawn();
    }, respawnDelay);
  }

  /**
   * Reset health to full (for round resets)
   */
  resetHealth(): void {
    // Reset underlying dummy health
    if (this.targetDummy.resetHealth) {
      this.targetDummy.resetHealth();
    }
    
    // Clear respawn timer
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    
    // Reset availability
    this.isAvailable = true;
    this.showTarget();
    
    console.log(`🔄 Racing dummy ${this.id} reset to full health`);
  }

  /**
   * Respawn the dummy
   */
  private respawn(): void {
    this.isAvailable = true;
    this.showTarget();
    
    console.log(`🔄 Dummy ${this.id} respawned and ready for boost!`);
    
    // Add to combat log  
          // Dummy is now available for speed boosts again
  }

  /**
   * Check if dummy is available for speed boost
   */
  isReadyForSpeedBoost(): boolean {
    return this.isAvailable;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
    }
    this.targetDummy.destroy();
  }
} 