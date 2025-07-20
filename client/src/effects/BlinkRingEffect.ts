import * as THREE from 'three';

/**
 * Blink Ring Effect
 * Creates scaling rings at blink departure and arrival positions
 * Uses object pooling for performance
 */
export class BlinkRingEffect {
  private scene: THREE.Scene | null = null;
  private eventListener: ((event: Event) => void) | null = null;
  private activeRings: BlinkRing[] = [];
  private ringPool: BlinkRing[] = [];
  private maxPoolSize = 4; // Maximum rings in pool (2 per blink)

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
   * Create a single blink ring
   */
  private createRing(): BlinkRing {
    const geometry = new THREE.TorusGeometry(1, 0.1, 6, 12);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff, // Cyan to match blink theme
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2; // Lay flat
    
    return {
      mesh,
      startTime: 0,
      duration: 0.6, // 600ms animation (same as blast rings)
      initialScale: 0.1,
      maxScale: 2.0,
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
   * Initialize the effect - start listening for blink events
   */
  initialize(): void {
    this.eventListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      this.triggerBlinkRings(customEvent.detail);
    };
    
    window.addEventListener('blinkEffect', this.eventListener);
  }

  /**
   * Trigger blink ring effects at departure and arrival positions
   */
  private triggerBlinkRings(blinkData: any): void {
    if (!this.scene) return;
    
    const { fromPosition, toPosition } = blinkData;
    
    // Create departure ring
    this.createRingAtPosition(fromPosition, 'departure');
    
    // Create arrival ring with slight delay for visual clarity
    setTimeout(() => {
      this.createRingAtPosition(toPosition, 'arrival');
    }, 50);
  }

  /**
   * Create a ring at a specific position
   */
  private createRingAtPosition(position: { x: number; y: number; z: number }, type: 'departure' | 'arrival'): void {
    if (!this.scene) return;
    
    const ring = this.getRingFromPool();
    if (!ring) return; // Pool exhausted
    
    // Configure ring
    ring.mesh.position.set(position.x, position.y, position.z);
    ring.mesh.scale.setScalar(ring.initialScale);
    ring.mesh.visible = true;
    ring.startTime = Date.now();
    ring.isActive = true;
    
    // Distinct visual difference between departure and arrival
    const material = ring.mesh.material as THREE.MeshBasicMaterial;
    if (type === 'departure') {
      material.color.setHex(0x00ffff); // Cyan for departure
      material.opacity = 0.6;
    } else {
      material.color.setHex(0x0080ff); // Blue for arrival
      material.opacity = 0.9;
    }
    
    this.activeRings.push(ring);
  }

  /**
   * Get a ring from the pool
   */
  private getRingFromPool(): BlinkRing | null {
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
  private returnRingToPool(ring: BlinkRing): void {
    ring.isActive = false;
    ring.mesh.visible = false;
    ring.mesh.scale.setScalar(1);
    
    // Reset material to default
    const material = ring.mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(0x00ffff);
    material.opacity = 0.8;
    
    this.ringPool.push(ring);
  }

  /**
   * Update all active rings
   */
  update(_deltaTime: number): void {
    const now = Date.now();
    const ringsToRemove: BlinkRing[] = [];
    
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
      const currentScale = ring.initialScale + (ring.maxScale - ring.initialScale) * progress;
      ring.mesh.scale.setScalar(currentScale);
      
      // Update opacity (fade out)
      const material = ring.mesh.material as THREE.MeshBasicMaterial;
      const baseOpacity = material.color.getHex() === 0x00ffff ? 0.6 : 0.9; // Different base opacity
      const opacity = baseOpacity * (1 - Math.pow(progress, 1.5)); // Ease-out fade
      material.opacity = opacity;
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
      window.removeEventListener('blinkEffect', this.eventListener);
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
   * Manually trigger rings (for testing)
   */
  triggerTestRings(): void {
    this.triggerBlinkRings({
      fromPosition: { x: 0, y: 2, z: 0 },
      toPosition: { x: 10, y: 2, z: 0 },
      timestamp: Date.now()
    });
  }
}

/**
 * Interface for blink ring data
 */
interface BlinkRing {
  mesh: THREE.Mesh;
  startTime: number;
  duration: number;
  initialScale: number;
  maxScale: number;
  isActive: boolean;
} 