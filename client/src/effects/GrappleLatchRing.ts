import * as THREE from 'three';

/**
 * Grapple Latch Ring Effect
 * Creates expanding green rings when grapple hook latches onto surfaces
 * Uses object pooling for performance
 */
export class GrappleLatchRing {
  private scene: THREE.Scene | null = null;
  private eventListener: ((event: Event) => void) | null = null;
  private activeRings: LatchRing[] = [];
  private ringPool: LatchRing[] = [];
  private maxPoolSize = 3; // Maximum rings in pool

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
   * Create a single latch ring
   */
  private createRing(): LatchRing {
    const geometry = new THREE.TorusGeometry(1, 0.15, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff44, // Bright green
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      emissive: 0x004400,
      emissiveIntensity: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2; // Lay flat
    
    return {
      mesh,
      startTime: 0,
      duration: 0.5, // 500ms animation - faster than explosion
      initialRadius: 0.1,
      maxRadius: 3.0, // Smaller than explosion rings
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
   * Initialize the effect - start listening for grapple latch events
   */
  initialize(): void {
    this.eventListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      this.triggerLatchRing(customEvent.detail);
    };
    
    window.addEventListener('grappleLatch', this.eventListener);
  }

  /**
   * Trigger a latch ring effect
   */
  private triggerLatchRing(latchData: any): void {
    if (!this.scene) return;
    
    const { position } = latchData;
    
    // Get a ring from the pool
    const ring = this.getRingFromPool();
    if (!ring) return; // Pool exhausted
    
    // Configure ring
    ring.mesh.position.set(position.x, position.y, position.z);
    ring.mesh.scale.setScalar(ring.initialRadius);
    ring.mesh.visible = true;
    ring.startTime = Date.now();
    ring.isActive = true;
    
    // Reset material opacity
    (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
    
    this.activeRings.push(ring);
  }

  /**
   * Get a ring from the pool
   */
  private getRingFromPool(): LatchRing | null {
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
  private returnRingToPool(ring: LatchRing): void {
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
    const ringsToRemove: LatchRing[] = [];
    
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
      const opacity = 0.8 * (1 - Math.pow(progress, 1.5)); // Ease-out fade
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      
      // Update emissive intensity for extra glow effect
      const emissiveIntensity = 0.3 * (1 - progress);
      (ring.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = emissiveIntensity;
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
      window.removeEventListener('grappleLatch', this.eventListener);
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
  triggerTestRing(position: THREE.Vector3 = new THREE.Vector3(0, 5, 0)): void {
    this.triggerLatchRing({
      position: position,
      timestamp: Date.now()
    });
  }
}

/**
 * Interface for latch ring data
 */
interface LatchRing {
  mesh: THREE.Mesh;
  startTime: number;
  duration: number;
  initialRadius: number;
  maxRadius: number;
  isActive: boolean;
} 