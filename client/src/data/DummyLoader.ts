import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TargetDummy } from '../combat/TargetDummy';
import type { MeleeCombat } from '../combat/MeleeCombat';
import type { DummyPositionData } from './DummyPositionTypes';
import dummyPositionsData from './dummyPositions.json';
import type { MeleeTarget } from '../combat/MeleeCombat';
import { Network } from '../net';
import { DummyPhysicsManager } from '../combat/DummyPhysicsManager';

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
    
    // Register for server dummy state updates when online
    if (Network.isNetworkingEnabled()) {
      Network.registerDummyStateCallback((dummyStates) => {
        this.processDummyStateUpdates(dummyStates);
      });
      console.log('🌐 Registered for server dummy state updates');
    }
  }

  /**
   * Load all dummies from saved positions data
   */
  async loadDummies(): Promise<RacingTargetDummy[]> {
    try {
      const data = dummyPositionsData as DummyPositionData;
      
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
  
  /**
   * Process dummy state updates from server (online mode)
   */
  private processDummyStateUpdates(dummyStates: Record<string, any>): void {
    for (const [dummyId, serverState] of Object.entries(dummyStates)) {
      const localDummy = this.loadedDummies.find(d => d.id === dummyId);
      
      if (localDummy) {
        // Update local dummy to match server state
        localDummy.updateFromServerState(serverState);
      }
    }
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
  private isDestroyed = false;
  private activeAnimationFrames: Set<number> = new Set();

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
    
    // Verify HP initialization (check passes silently)
    this.targetDummy.getHealthStatus();
    // Racing dummy initialized silently
  }

  /**
   * Update dummy state from server (online mode)
   */
  updateFromServerState(serverState: any): void {
    if (this.isDestroyed) return; // Guard against updates after destruction
    
    const healthStatus = this.targetDummy.getHealthStatus();
    
    if (serverState.health !== healthStatus.current) {
      
      // Handle KO state changes using proper API instead of direct property access
      if (serverState.health <= 0 && serverState.isAlive === false) {
        // Dummy was KO'd on server - trigger visual KO
        if (healthStatus.current > 0) {
          // Calculate damage needed to reach server health
          const damageNeeded = healthStatus.current - serverState.health;
          if (damageNeeded > 0) {
            this.targetDummy.takeDamage(damageNeeded, new THREE.Vector3(0, 0, 0));
          }
        }
      } else if (serverState.health > 0 && serverState.isAlive === true) {
        // Dummy respawned on server
        if (healthStatus.current <= 0) {
          this.targetDummy.resetHealth();
        }
      } else if (serverState.health !== healthStatus.current) {
        // Health changed but not KO - calculate damage difference
        const healthDiff = healthStatus.current - serverState.health;
        if (healthDiff > 0) {
          // Health decreased - apply damage
          this.targetDummy.takeDamage(healthDiff, new THREE.Vector3(0, 0, 0));
        } else if (healthDiff < 0) {
          // Health increased - reset to full then apply damage to reach target
          this.targetDummy.resetHealth();
          const damageToApply = this.targetDummy.getHealthStatus().max - serverState.health;
          if (damageToApply > 0) {
            this.targetDummy.takeDamage(damageToApply, new THREE.Vector3(0, 0, 0));
          }
        }
      }
    }
  }

  /**
   * Implement MeleeTarget interface by delegating to underlying dummy
   */
  takeDamage(damage: number, direction: THREE.Vector3): void {
    // Don't process damage if destroyed
    if (this.isDestroyed) return;
    
    // Racing mode: Always apply speed boosts
    
    // Check if we're in online mode - send damage to server
    if (Network.isNetworkingEnabled()) {
      
      try {
        // Send damage to server
        Network.sendDummyDamage(this.id, damage);
        
        // Still grant speed boost locally for immediate feedback
        const baseDuration = this.speedBoostConfig.baseDuration;
        const bonusDuration = (damage / this.speedBoostConfig.damageScaling) * 1000;
        const totalDuration = Math.min(baseDuration + bonusDuration, this.speedBoostConfig.maxDuration);
        this.grantSpeedBoost(damage, totalDuration);
        
        // Don't process damage locally - server will handle it and broadcast state
        return;
      } catch (error) {
        console.error(`❌ Failed to send dummy damage to server for ${this.id}:`, error);
        // Fall through to offline processing if network fails
      }
    }
    
    // OFFLINE MODE: Continue with local dummy processing
    const wasAvailable = this.isAvailable;
    
    // Apply damage to underlying dummy
    
    // Calculate speed boost duration based on damage
    const baseDuration = this.speedBoostConfig.baseDuration;
    const bonusDuration = (damage / this.speedBoostConfig.damageScaling) * 1000; // Convert to ms
    const totalDuration = Math.min(
      baseDuration + bonusDuration,
      this.speedBoostConfig.maxDuration
    );
    
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
    if (this.isDestroyed) return; // Guard against destruction
    
    if (this.targetDummy.applyKnockback) {
      this.targetDummy.applyKnockback(force, direction);
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
    
    // SFX: Play speed boost gained sound
    window.dispatchEvent(new CustomEvent('sfxRequest', {
      detail: { category: 'combat', filename: 'speed_boost_gained.wav' }
    }));
    
    // Dispatch speed boost event for the controller to handle
    window.dispatchEvent(new CustomEvent('speedBoostGranted', {
      detail: boostData
    }));
  }

  /**
   * Hide the target visually (simple approach)
   */
  private hideTarget(): void {
    if (this.isDestroyed) return; // Guard against destruction
    
    // ULTRA SAFE: Use centralized physics manager to prevent recursive errors
    const physicsManager = DummyPhysicsManager.getInstance();
    physicsManager.queueSetTranslation(
      this.rigidBody,
      { x: this.position.x, y: this.position.y - 100, z: this.position.z },
      true,
      this.id
    );
  }

  /**
   * Show the target visually 
   */
  private showTarget(): void {
    if (this.isDestroyed) return; // Guard against destruction
    
    // ULTRA SAFE: Use centralized physics manager to prevent recursive errors
    const physicsManager = DummyPhysicsManager.getInstance();
    physicsManager.queueSetTranslation(
      this.rigidBody,
      { x: this.position.x, y: this.position.y, z: this.position.z },
      true,
      this.id
    );
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
    if (this.isDestroyed) return; // Guard against destruction
    
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
  }

  /**
   * Respawn the dummy
   */
  private respawn(): void {
    if (this.isDestroyed) return; // Guard against destruction
    
    this.isAvailable = true;
    this.showTarget();
    
    // Add to combat log  
          // Dummy is now available for speed boosts again
  }

  /**
   * Check if dummy is available for speed boost
   */
  isReadyForSpeedBoost(): boolean {
    if (this.isDestroyed) return false; // Guard against destruction
    return this.isAvailable;
  }

  /**
   * Update dummy animation (delegates to underlying TargetDummy)
   */
  update(deltaTime: number): void {
    if (this.isDestroyed) return; // Guard against destruction
    
    if (this.targetDummy.update) {
      this.targetDummy.update(deltaTime);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Mark as destroyed first to prevent new operations
    this.isDestroyed = true;
    
    // Cancel all active animation frames
    this.activeAnimationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    this.activeAnimationFrames.clear();
    
    // Clear timers
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    
    // Destroy underlying dummy
    this.targetDummy.destroy();
  }
} 