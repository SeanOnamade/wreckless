import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { CheckpointId } from './LapController';
import { LapController } from './LapController';

export interface CheckpointData {
  id: CheckpointId;
  position: THREE.Vector3;
  size: number; // Simplified to radius
  debugMesh?: THREE.Mesh;
  beacon?: THREE.Mesh; // Golden vertical beacon
  lastTriggerTime: number;
  colorTimeout?: number; // Track color reset timeout
}

export class CheckpointSystem {
  private checkpoints: Map<CheckpointId, CheckpointData> = new Map();
  private lapController: LapController;
  private scene: THREE.Scene;
  private isDevelopment: boolean;
  private readonly DEBOUNCE_TIME = 1000; // 1 second debounce per checkpoint
  private readonly CHECK_RADIUS = 6; // Simplified detection radius
  private readonly BEACON_HEIGHT = 50; // Height of golden beacon
  
  // Performance optimization: cache frequently used values
  private currentNextCheckpoint: CheckpointId | null = null;
  private pulseStartTime = Date.now();
  
  // MEMORY OPTIMIZATION: Shared textures and materials
  private static sharedGradientTexture: THREE.CanvasTexture | null = null;
  private static sharedBeaconMaterial: THREE.MeshStandardMaterial | null = null;
  private static sharedParticleMaterial: THREE.MeshBasicMaterial | null = null;
  private static instanceCount = 0;
  
  constructor(scene: THREE.Scene, world: RAPIER.World, lapController: LapController) {
    this.scene = scene;
    this.lapController = lapController;
    this.isDevelopment = true; // Always show checkpoints for better gameplay
    
    CheckpointSystem.instanceCount++;
    this.initializeSharedResources();
    this.initializeCheckpoints();
    this.updateBeacons(); // Initialize beacon visibility
  }
  
  /**
   * Initialize shared textures and materials - MEMORY OPTIMIZED
   */
  private initializeSharedResources(): void {
    // Only create shared resources once across all instances
    if (!CheckpointSystem.sharedGradientTexture) {
      // Create beautiful gradient texture - SHARED ACROSS ALL BEACONS
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Create vertical gradient from thick at bottom to faint at top
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.0)');    // Transparent at top
      gradient.addColorStop(0.3, 'rgba(255, 215, 0, 0.4)');  // Start appearing
      gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.8)');  // Getting thicker
      gradient.addColorStop(1, 'rgba(255, 215, 0, 1.0)');    // Solid gold at bottom
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
      
      CheckpointSystem.sharedGradientTexture = new THREE.CanvasTexture(canvas);
      CheckpointSystem.sharedGradientTexture.wrapS = THREE.RepeatWrapping;
      CheckpointSystem.sharedGradientTexture.wrapT = THREE.RepeatWrapping;
      
      // Create shared beacon material
      CheckpointSystem.sharedBeaconMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700, // Golden color
        map: CheckpointSystem.sharedGradientTexture, // Apply gradient texture
        transparent: true,
        opacity: 0.9,
        emissive: 0xffaa00, // Orange-gold glow
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2,
        envMapIntensity: 1.0,
        alphaMap: CheckpointSystem.sharedGradientTexture // Use same texture for alpha
      });
      
      // Create shared particle material
      CheckpointSystem.sharedParticleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
      });
      
      if (import.meta.env.DEV) {
        console.log('✨ Shared checkpoint resources initialized');
      }
    }
  }
  
  private initializeCheckpoints(): void {
    // Define checkpoint positions (simplified data structure)
    const checkpointData = [
      { id: 'A' as CheckpointId, pos: [130.09, 4.32, -289.09] },
      { id: 'B' as CheckpointId, pos: [-0.07, 18.25, -109.52] },
      { id: 'C' as CheckpointId, pos: [98.45, 4.32, 52.05] },
      { id: 'FINISH' as CheckpointId, pos: [0, 3, 0] }
    ];
    
    checkpointData.forEach(({ id, pos }) => {
      this.createCheckpoint(id, new THREE.Vector3(pos[0], pos[1], pos[2]));
    });
  }
  
  private createCheckpoint(id: CheckpointId, position: THREE.Vector3): void {
    // Create debug visual (simplified geometry)
    let debugMesh: THREE.Mesh | undefined;
    if (this.isDevelopment) {
      const geometry = new THREE.SphereGeometry(this.CHECK_RADIUS, 8, 6); // Low-poly sphere
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
    
    // Create enhanced golden beacon with gradient fade - BEAUTIFUL DESIGN
    const beaconGeometry = new THREE.CylinderGeometry(1.2, 1.2, this.BEACON_HEIGHT, 12);
    
    // Use shared material - MEMORY OPTIMIZED
    const beacon = new THREE.Mesh(beaconGeometry, CheckpointSystem.sharedBeaconMaterial!.clone());
    beacon.position.set(position.x, position.y + this.BEACON_HEIGHT / 2, position.z);
    beacon.name = `checkpoint_${id}_beacon`;
    beacon.visible = false; // Hidden by default, will be shown for next checkpoint
    
    // Add a glowing ring at the base - FIXED POSITIONING
    const ringGeometry = new THREE.RingGeometry(1.5, 2.2, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; // Lay flat on ground
    ring.position.set(0, -this.BEACON_HEIGHT / 2 + 0.1, 0); // Position relative to beacon center
    ring.name = `checkpoint_${id}_ring`;
    
    // Add the ring as a child of the beacon for easy management
    beacon.add(ring);
    
    // Add animated particles/sparkles around the beacon - FIXED POSITIONING
    const particleGeometry = new THREE.SphereGeometry(0.1, 6, 6);
    
    // Create several small sparkle particles with deterministic positioning
    for (let i = 0; i < 6; i++) {
      const particle = new THREE.Mesh(particleGeometry, CheckpointSystem.sharedParticleMaterial!.clone());
      const angle = (i / 6) * Math.PI * 2;
      const radius = 2.5;
      
      // FIXED: Deterministic initial positioning (no Math.random())
      const baseHeight = (i / 6) * this.BEACON_HEIGHT * 0.6 - this.BEACON_HEIGHT / 2 + 5; // Spread particles vertically
      
      particle.position.set(
        Math.cos(angle) * radius,
        baseHeight, // Consistent initial height per particle
        Math.sin(angle) * radius
      );
      particle.name = `checkpoint_${id}_particle_${i}`;
      beacon.add(particle);
    }
    
    this.scene.add(beacon);
    
    // Store simplified checkpoint data
    const checkpointData: CheckpointData = {
      id,
      position: position.clone(),
      size: this.CHECK_RADIUS,
      debugMesh,
      beacon,
      lastTriggerTime: 0
    };
    
    this.checkpoints.set(id, checkpointData);
    
    if (import.meta.env.DEV) {
      console.log(`✓ Checkpoint ${id} created with beacon at position:`, position);
    }
  }
  
  /**
   * Update beacon visibility - OPTIMIZED (only when checkpoint changes)
   */
  private updateBeacons(): void {
    const progress = this.lapController.getProgress();
    const checkpointOrder: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
    
    const nextIndex = progress.currentSequence.length;
    const nextCheckpointId = nextIndex < checkpointOrder.length ? checkpointOrder[nextIndex] : null;
    
    // OPTIMIZATION: Only update if next checkpoint changed
    if (this.currentNextCheckpoint === nextCheckpointId) {
      // Still update pulse animation for current beacon
      if (nextCheckpointId) {
        this.updateBeaconPulse(nextCheckpointId);
      }
      return;
    }
    
    // Hide all beacons first
    this.checkpoints.forEach(checkpoint => {
      if (checkpoint.beacon) {
        checkpoint.beacon.visible = false;
      }
    });
    
    // Show beacon for the next expected checkpoint
    if (nextCheckpointId) {
      const nextCheckpoint = this.checkpoints.get(nextCheckpointId);
      if (nextCheckpoint?.beacon) {
        nextCheckpoint.beacon.visible = true;
        this.pulseStartTime = Date.now(); // Reset pulse timing for new beacon
      }
    }
    
    this.currentNextCheckpoint = nextCheckpointId;
  }
  
  /**
   * Update beacon pulse animation with enhanced effects - PERFORMANCE OPTIMIZED
   */
  private updateBeaconPulse(checkpointId: CheckpointId): void {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint?.beacon || !checkpoint.beacon.visible) return;
    
    // OPTIMIZATION: Cache timestamp calculation once per frame
    const currentTime = Date.now();
    const elapsed = (currentTime - this.pulseStartTime) * 0.001;
    const pulse = 0.85 + Math.sin(elapsed * 2) * 0.15; // Pulse between 0.7 and 1.0 opacity
    
    // Main beacon pulse
    (checkpoint.beacon.material as THREE.MeshStandardMaterial).opacity = pulse;
    
    // Animate the ring glow - OPTIMIZED MATH
    const ring = checkpoint.beacon.children.find(child => child.name.includes('ring'));
    if (ring) {
      const ringMaterial = (ring as THREE.Mesh).material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = 0.4 + Math.sin(elapsed * 3) * 0.2; // Faster pulse for ring
    }
    
    // Animate sparkle particles - BATCH CALCULATIONS
    const rotationSpeed = elapsed * 0.5;
    const radiusVariation = elapsed * 2;
    const bobSpeed = elapsed * 3;
    const twinkleSpeed = elapsed * 4;
    
    checkpoint.beacon.children.forEach((child, index) => {
      if (child.name.includes('particle')) {
        // Pre-calculate values for this particle
        const particleOffset = index * 0.5;
        const baseAngle = (index / 6) * Math.PI * 2;
        const animatedAngle = baseAngle + rotationSpeed;
        const radius = 2.5 + Math.sin(radiusVariation + index) * 0.3;
        
        // Update position - OPTIMIZED
        child.position.x = Math.cos(animatedAngle) * radius;
        child.position.z = Math.sin(animatedAngle) * radius;
        
        // Bob particles up and down - DETERMINISTIC
        const bobOffset = Math.sin(bobSpeed + particleOffset) * 2;
        const baseHeight = (index / 6) * this.BEACON_HEIGHT * 0.6 - this.BEACON_HEIGHT / 2 + 5;
        child.position.y = baseHeight + bobOffset;
        
        // Twinkle effect - OPTIMIZED
        const particleMaterial = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        particleMaterial.opacity = 0.6 + Math.sin(twinkleSpeed + index) * 0.4;
      }
    });
    
    // Slight beacon height animation - CACHED CALCULATION
    checkpoint.beacon.scale.y = 0.95 + Math.sin(elapsed * 1.5) * 0.05;
  }
  
  /**
   * Get the next checkpoint position for 3D arrow
   */
  getNextCheckpointPosition(): THREE.Vector3 | null {
    const progress = this.lapController.getProgress();
    const checkpointOrder: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
    
    const nextIndex = progress.currentSequence.length;
    if (nextIndex < checkpointOrder.length) {
      const nextCheckpointId = checkpointOrder[nextIndex];
      const checkpoint = this.checkpoints.get(nextCheckpointId);
      return checkpoint ? checkpoint.position.clone() : null;
    }
    
    return null; // All checkpoints completed
  }
  
  /**
   * Get next checkpoint info for 3D arrow label
   */
  getNextCheckpointInfo(): { id: CheckpointId; position: THREE.Vector3 } | null {
    const progress = this.lapController.getProgress();
    const checkpointOrder: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
    
    const nextIndex = progress.currentSequence.length;
    if (nextIndex < checkpointOrder.length) {
      const nextCheckpointId = checkpointOrder[nextIndex];
      const checkpoint = this.checkpoints.get(nextCheckpointId);
      if (checkpoint) {
        return { id: nextCheckpointId, position: checkpoint.position.clone() };
      }
    }
    
    return null;
  }
  
  /**
   * Simplified checkpoint detection with valid progression check - single distance check
   */
  update(playerPosition: THREE.Vector3, playerVelocity?: THREE.Vector3): void {
    const now = performance.now();
    
    for (const checkpoint of this.checkpoints.values()) {
      // Fast distance check (avoid sqrt with distanceToSquared)
      const distanceSquared = playerPosition.distanceToSquared(checkpoint.position);
      const radiusSquared = checkpoint.size * checkpoint.size;
      
      if (distanceSquared <= radiusSquared) {
        // Check debounce (only for this specific checkpoint)
        if (now - checkpoint.lastTriggerTime < this.DEBOUNCE_TIME) continue;
        
        checkpoint.lastTriggerTime = now;
        
        // Update lap controller FIRST to check if this is valid progression
        const isValidProgression = this.lapController.visit(checkpoint.id);
        
        // Only trigger visual feedback for VALID checkpoint progression
        if (isValidProgression) {
          // Calculate player speed for visual feedback
          const playerSpeed = playerVelocity ? playerVelocity.length() : 0;
          
          // Trigger visual feedback for valid progression only
          window.dispatchEvent(new CustomEvent('checkpointHit', {
            detail: {
              checkpointId: checkpoint.id,
              playerSpeed: playerSpeed,
              timestamp: now
            }
          }));
          
          console.log(`✅ Valid checkpoint progression: ${checkpoint.id} (speed: ${playerSpeed.toFixed(1)} m/s)`);
        } else {
          if (import.meta.env.DEV) {
            console.log(`⚪ Invalid checkpoint: ${checkpoint.id} (not next in sequence)`);
          }
        }
        
        // Flash debug mesh green (with proper cleanup)
        this.flashCheckpoint(checkpoint);
        
        // OPTIMIZATION: Only update beacons when checkpoint hit (not every frame)
        this.updateBeacons();
        break; // Only trigger one checkpoint per frame
      }
    }
    
    // OPTIMIZATION: Only update pulse animation, not full beacon update
    if (this.currentNextCheckpoint) {
      this.updateBeaconPulse(this.currentNextCheckpoint);
    }
  }
  
  private flashCheckpoint(checkpoint: CheckpointData): void {
    if (!checkpoint.debugMesh) return;
    
    const material = checkpoint.debugMesh.material as THREE.MeshBasicMaterial;
    
    // Clear any existing timeout to prevent conflicts
    if (checkpoint.colorTimeout) {
      clearTimeout(checkpoint.colorTimeout);
    }
    
    // Flash green
    material.color.set(0x00ff00);
    
    // Reset to red after delay (with proper cleanup tracking)
    checkpoint.colorTimeout = window.setTimeout(() => {
      material.color.set(0xff0000);
      checkpoint.colorTimeout = undefined;
    }, 300);
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
    return new THREE.Vector3(0, 4, 0); // Default spawn position
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
        return position.clone().add(new THREE.Vector3(0, 2, 0));
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
   * Clean up resources (improved cleanup for enhanced beacons) - MEMORY SAFE
   */
  dispose(): void {
    for (const checkpoint of this.checkpoints.values()) {
      // Clear any pending timeouts
      if (checkpoint.colorTimeout) {
        clearTimeout(checkpoint.colorTimeout);
      }
      
      // Remove debug mesh from scene
      if (checkpoint.debugMesh) {
        this.scene.remove(checkpoint.debugMesh);
        checkpoint.debugMesh.geometry.dispose();
        (checkpoint.debugMesh.material as THREE.Material).dispose();
      }
      
      // Remove beacon and all its components from scene
      if (checkpoint.beacon) {
        // Dispose of all child components (ring, particles) - but NOT shared materials
        checkpoint.beacon.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            // Don't dispose shared materials - they're managed statically
            if (child.material !== CheckpointSystem.sharedParticleMaterial && 
                child.material !== CheckpointSystem.sharedBeaconMaterial) {
              (child.material as THREE.Material).dispose();
            }
          }
        });
        
        // Remove beacon from scene
        this.scene.remove(checkpoint.beacon);
        checkpoint.beacon.geometry.dispose();
        // Don't dispose shared material here
      }
    }
    
    this.checkpoints.clear();
    
    // Decrease instance count and clean up shared resources if last instance
    CheckpointSystem.instanceCount--;
    if (CheckpointSystem.instanceCount <= 0) {
      CheckpointSystem.disposeSharedResources();
    }
    
    console.log('🧹 Enhanced checkpoint system disposed');
  }
  
  /**
   * Clean up shared resources when all instances are disposed - MEMORY SAFE
   */
  private static disposeSharedResources(): void {
    if (CheckpointSystem.sharedGradientTexture) {
      CheckpointSystem.sharedGradientTexture.dispose();
      CheckpointSystem.sharedGradientTexture = null;
    }
    
    if (CheckpointSystem.sharedBeaconMaterial) {
      CheckpointSystem.sharedBeaconMaterial.dispose();
      CheckpointSystem.sharedBeaconMaterial = null;
    }
    
    if (CheckpointSystem.sharedParticleMaterial) {
      CheckpointSystem.sharedParticleMaterial.dispose();
      CheckpointSystem.sharedParticleMaterial = null;
    }
    
    CheckpointSystem.instanceCount = 0;
    
    if (import.meta.env.DEV) {
      console.log('🧹 Shared checkpoint resources disposed');
    }
  }
  
  /**
   * Reset checkpoint system state (improved reset)
   */
  reset(): void {
    const now = performance.now();
    
    // Reset checkpoint trigger times and cleanup timeouts
    this.checkpoints.forEach(checkpoint => {
      checkpoint.lastTriggerTime = now - this.DEBOUNCE_TIME; // Allow immediate triggering
      
      // Clear any pending color timeouts
      if (checkpoint.colorTimeout) {
        clearTimeout(checkpoint.colorTimeout);
        checkpoint.colorTimeout = undefined;
      }
      
      // Reset debug mesh color immediately
      if (checkpoint.debugMesh) {
        const material = checkpoint.debugMesh.material as THREE.MeshBasicMaterial;
        material.color.set(0xff0000); // Reset to red
      }
    });
    
    // Reset cached state for optimization
    this.currentNextCheckpoint = null;
    this.pulseStartTime = Date.now();
    
    // Update beacon visibility for new lap
    this.updateBeacons();
    
    console.log('🔄 Checkpoint system reset');
  }
}