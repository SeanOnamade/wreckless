import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { CheckpointId } from './LapController';
import { LapController } from './LapController';

export interface CheckpointData {
  id: CheckpointId;
  position: THREE.Vector3;
  size: THREE.Vector3;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  debugMesh?: THREE.Mesh;
  lastTriggerTime: number;
}

export class CheckpointSystem {
  private checkpoints: Map<CheckpointId, CheckpointData> = new Map();
  private checkpointByHandle: Map<number, CheckpointData> = new Map();
  private lapController: LapController;
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private isDevelopment: boolean;
  private lastTriggerTime = 0; // Global debounce for all checkpoints
  
  constructor(scene: THREE.Scene, world: RAPIER.World, lapController: LapController) {
    this.scene = scene;
    this.world = world;
    this.lapController = lapController;
    this.isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
    
    this.initializeCheckpoints();
  }
  
  private initializeCheckpoints(): void {
    // Define checkpoint positions as specified
    const checkpointPositions = {
      A: new THREE.Vector3(130.09, 2.32, -289.09),
      B: new THREE.Vector3(-0.07, 16.25, -109.52),
      C: new THREE.Vector3(98.45, 2.32, 52.05),
      FINISH: new THREE.Vector3(0, 1, 0) // Finish line near spawn/start
    };
    
    // Create checkpoint volumes
    Object.entries(checkpointPositions).forEach(([id, position]) => {
      this.createCheckpoint(id as CheckpointId, position);
    });
  }
  
  private createCheckpoint(id: CheckpointId, position: THREE.Vector3): void {
    // Define checkpoint size (slightly larger for easier triggering)
    const size = new THREE.Vector3(8, 6, 8); // 8m x 6m x 8m volume
    
    // Create a static rigid body for the sensor (ensures proper physics behavior)
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    
    // Create physics collider (sensor - no collision, just triggers)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setSensor(true) // Make it a sensor (trigger volume)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS); // Enable collision events
    
    const collider = this.world.createCollider(colliderDesc, rigidBody);
    
    // Create debug visual (only in development)
    let debugMesh: THREE.Mesh | undefined;
    if (this.isDevelopment) {
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
        wireframe: true
      });
      
      debugMesh = new THREE.Mesh(geometry, material);
      debugMesh.position.copy(position);
      debugMesh.name = `checkpoint_${id}_debug`;
      this.scene.add(debugMesh);
    }
    
    // Store checkpoint data
    const checkpointData = {
      id,
      position: position.clone(),
      size: size.clone(),
      rigidBody,
      collider,
      debugMesh,
      lastTriggerTime: 0
    };
    
    this.checkpoints.set(id, checkpointData);
    this.checkpointByHandle.set(collider.handle, checkpointData);
    
    if (import.meta.env.DEV) {
      console.log(`✓ Checkpoint ${id} created at position:`, position, `(sensor: ${collider.isSensor()})`);
    }
    
    // Debug: Verify sensor configuration
    if (!collider.isSensor()) {
      console.error(`❌ Checkpoint ${id} is NOT a sensor! This will block the player.`);
    }
  }
  

  
  /**
   * Check for checkpoint intersections using proper sensor detection
   */
  update(playerPosition: THREE.Vector3): void {
    // Since sensors are intangible, we can use distance-based detection for reliability
    for (const [_id, checkpoint] of this.checkpoints) {
      // Check if player is within checkpoint bounds
      if (this.isPlayerInCheckpoint(playerPosition, checkpoint)) {
        const now = performance.now();
        if (now - this.lastTriggerTime < 500) return; // 0.5s debounce
        
        this.lastTriggerTime = now;
        this.lapController.visit(checkpoint.id);
        
        // Flash debug mesh green once
        if (checkpoint.debugMesh) {
          const material = checkpoint.debugMesh.material as THREE.MeshBasicMaterial;
          material.color.set(0x00ff00);
          setTimeout(() => material.color.set(0xff0000), 200);
        }
        break; // Only trigger one checkpoint per frame
      }
    }
  }
  
  private isPlayerInCheckpoint(playerPosition: THREE.Vector3, checkpoint: CheckpointData): boolean {
    const distance = playerPosition.distanceTo(checkpoint.position);
    const maxDistance = Math.max(checkpoint.size.x, checkpoint.size.y, checkpoint.size.z) / 2;
    
    // Simple sphere-based collision detection for now
    // Could be improved with proper box collision if needed
    return distance <= maxDistance;
  }
  

  
  /**
   * Get checkpoint position for respawning
   */
  getCheckpointPosition(checkpointId: CheckpointId): THREE.Vector3 | null {
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? checkpoint.position.clone() : null;
  }
  
  /**
   * Get the spawn position for respawning
   */
  getSpawnPosition(): THREE.Vector3 {
    // Default spawn position (can be overridden)
    return new THREE.Vector3(0, 2, 0);
  }
  
  /**
   * Get the last valid checkpoint position for respawning
   */
  getLastCheckpointPosition(): THREE.Vector3 {
    const progress = this.lapController.getProgress();
    
    if (progress.lastCheckpoint) {
      const position = this.getCheckpointPosition(progress.lastCheckpoint);
      if (position) {
        // Spawn slightly above the checkpoint
        return position.clone().add(new THREE.Vector3(0, 1, 0));
      }
    }
    
    // Fall back to spawn position
    return this.getSpawnPosition();
  }
  
  /**
   * Toggle debug visualization
   */
  toggleDebugVisualization(show: boolean): void {
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.debugMesh) {
        checkpoint.debugMesh.visible = show;
      }
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    for (const checkpoint of this.checkpoints.values()) {
      // Remove debug mesh from scene
      if (checkpoint.debugMesh) {
        this.scene.remove(checkpoint.debugMesh);
        checkpoint.debugMesh.geometry.dispose();
        (checkpoint.debugMesh.material as THREE.Material).dispose();
      }
      
      // Remove collider and rigid body from world
      this.world.removeCollider(checkpoint.collider, false);
      this.world.removeRigidBody(checkpoint.rigidBody);
    }
    
    this.checkpoints.clear();
    this.checkpointByHandle.clear();
  }
} 