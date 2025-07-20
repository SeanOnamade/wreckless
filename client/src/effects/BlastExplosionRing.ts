import * as THREE from 'three';

/**
 * Blast Explosion Ring Effect
 * Creates expanding torus rings when blast rockets explode
 * Uses object pooling for performance
 */
export class BlastExplosionRing {
  private scene: THREE.Scene | null = null;
  private eventListener: ((event: Event) => void) | null = null;
  private activeRings: ExplosionRing[] = [];
  private ringPool: ExplosionRing[] = [];
  private maxPoolSize = 5; // Maximum rings in pool

  constructor() {
    // Initialize pool
    this.initializePool();
  }

  /**
   * Initialize the ring pool with reusable torus geometries
   */
  private initializePool(): void {
    for (let i = 0; i < this.maxPoolSize; i++) {
      const ring = this.createRing();
      ring.mesh.visible = false;
      this.ringPool.push(ring);
    }
  }

  /**
   * Create a single explosion ring
   */
  private createRing(): ExplosionRing {
    const geometry = new THREE.TorusGeometry(1, 0.2, 8, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2; // Lay flat
    
    return {
      mesh,
      startTime: 0,
      duration: 0.6, // 600ms animation
      initialRadius: 1,
      maxRadius: 6,
      isActive: false
    };
  }

  /**
   * Set the scene reference
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
    
    // Add all pooled rings to scene
    for (const ring of this.ringPool) {
      scene.add(ring.mesh);
    }
  }

  /**
   * Initialize the effect - start listening for explosion events
   */
  initialize(): void {
    this.eventListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      this.triggerExplosionRing(customEvent.detail);
    };
    
    window.addEventListener('rocketExplosion', this.eventListener);
  }

  /**
   * Trigger an explosion ring effect
   */
  private triggerExplosionRing(explosionData: any): void {
    if (!this.scene) return;
    
    const { position, radius } = explosionData;
    
    // Get a ring from the pool
    const ring = this.getRingFromPool();
    if (!ring) return; // Pool exhausted
    
    // Configure ring
    ring.mesh.position.set(position.x, position.y, position.z);
    ring.mesh.scale.setScalar(0.1); // Start small
    ring.mesh.visible = true;
    ring.startTime = Date.now();
    ring.initialRadius = 0.1;
    ring.maxRadius = Math.max(radius * 1.5, 4); // Scale with explosion radius
    ring.isActive = true;
    
    // Reset material opacity
    (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
    
    this.activeRings.push(ring);
  }

  /**
   * Get a ring from the pool
   */
  private getRingFromPool(): ExplosionRing | null {
    if (this.ringPool.length > 0) {
      return this.ringPool.pop()!;
    }
    
    // Pool exhausted - reuse oldest active ring if necessary
    if (this.activeRings.length > 0) {
      const oldestRing = this.activeRings.shift()!;
      oldestRing.mesh.visible = false;
      return oldestRing;
    }
    
    return null;
  }

  /**
   * Return a ring to the pool
   */
  private returnRingToPool(ring: ExplosionRing): void {
    ring.isActive = false;
    ring.mesh.visible = false;
    ring.mesh.scale.setScalar(1);
    this.ringPool.push(ring);
  }

  /**
   * Update all active rings
   */
  update(_deltaTime: number): void {
    const now = Date.now();
    const ringsToRemove: ExplosionRing[] = [];
    
    for (const ring of this.activeRings) {
      if (!ring.isActive) continue;
      
      const elapsed = (now - ring.startTime) / 1000; // Convert to seconds
      const progress = Math.min(elapsed / ring.duration, 1);
      
      if (progress >= 1) {
        // Animation complete
        ringsToRemove.push(ring);
        continue;
      }
      
      // Update scale (expand ring)
      const currentRadius = ring.initialRadius + (ring.maxRadius - ring.initialRadius) * progress;
      ring.mesh.scale.setScalar(currentRadius);
      
      // Update opacity (fade out)
      const opacity = 0.8 * (1 - Math.pow(progress, 2)); // Ease-out fade
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    
    // Remove completed rings
    for (const ring of ringsToRemove) {
      const index = this.activeRings.indexOf(ring);
      if (index !== -1) {
        this.activeRings.splice(index, 1);
      }
      this.returnRingToPool(ring);
    }
  }

  /**
   * Cleanup - remove all rings and listeners
   */
  cleanup(): void {
    // Remove event listener
    if (this.eventListener) {
      window.removeEventListener('rocketExplosion', this.eventListener);
      this.eventListener = null;
    }
    
    // Clean up all rings
    for (const ring of [...this.activeRings, ...this.ringPool]) {
      if (this.scene) {
        this.scene.remove(ring.mesh);
      }
      ring.mesh.geometry.dispose();
      (ring.mesh.material as THREE.Material).dispose();
    }
    
    this.activeRings.length = 0;
    this.ringPool.length = 0;
  }

  /**
   * Manually trigger ring (for testing)
   */
  triggerTestRing(position: THREE.Vector3 = new THREE.Vector3(0, 2, 0)): void {
    this.triggerExplosionRing({
      position: position,
      radius: 4,
      force: 36,
      affectedCount: 1
    });
  }
}

/**
 * Interface for explosion ring data
 */
interface ExplosionRing {
  mesh: THREE.Mesh;
  startTime: number;
  duration: number;
  initialRadius: number;
  maxRadius: number;
  isActive: boolean;
} 