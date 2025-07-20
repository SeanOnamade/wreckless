import * as THREE from 'three';

/**
 * Tron-Style Trail System
 * Creates a continuous glowing line trail behind the player using a single BufferGeometry
 * More efficient than individual spheres and provides smooth continuous visual feedback
 */
export class TrailSystem {
  private scene: THREE.Scene;
  private trailMesh: THREE.Line | null = null;
  private trailGeometry: THREE.BufferGeometry | null = null;
  private trailMaterial: THREE.LineBasicMaterial | null = null;
  
  // Simple, smooth line configuration
  private maxTrailPoints = 50; // More points for very smooth curves with interpolation
  private trailSpacing = 0.12; // Small spacing for continuous lines
  private speedThreshold = 10; // m/s - reasonable threshold
  private fadeTime = 1600; // Nice fade time for smooth trails
  private trailWidth = 0.5; // Not used for line trails
  
  // Trail data
  private trailPoints: Array<{
    position: THREE.Vector3;
    spawnTime: number;
  }> = [];
  private lastPosition: THREE.Vector3 | null = null;
  private smoothedPosition: THREE.Vector3 | null = null;
  private lastVelocity: THREE.Vector3 = new THREE.Vector3();
  private currentSpeed = 0;
  
  // Smoothing parameters (smooth and curvy)
  private smoothingFactor = 0.3; // Good balance for smooth curves
  private velocitySmoothing = 0.8; // More smoothing for fluid trails
  
  // Performance optimization
  private lastUpdateTime = 0;
  private updateFrequency = 20; // ~50 FPS update rate for better performance
  
  // Clean, vibrant colors for smooth lines
  private baseColor = new THREE.Color(0.4, 0.8, 1.2); // Nice cyan default
  private highSpeedColor = new THREE.Color(1.2, 0.9, 0.3); // Warm yellow at high speed
  private classColors = {
    blast: new THREE.Color(1.4, 0.3, 0.2),   // Vibrant red-orange for blast
    grapple: new THREE.Color(0.2, 1.4, 0.4), // Bright green for grapple  
    blink: new THREE.Color(0.3, 0.5, 1.4)    // Nice blue for blink
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createTrailMesh();
  }

  private createTrailMesh(): void {
    // Create simple, smooth line geometry
    this.trailGeometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(this.maxTrailPoints * 3);
    const colors = new Float32Array(this.maxTrailPoints * 3);
    
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Simple, clean line material
    this.trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      linewidth: 4, // Thick, visible lines
    });
    
    // Create the trail line
    this.trailMesh = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);
  }

  update(playerPosition: THREE.Vector3, currentSpeed: number, activeKit: string): void {
    this.currentSpeed = currentSpeed;
    const now = Date.now();
    
    // Performance optimization: limit geometry updates to ~50 FPS
    if (now - this.lastUpdateTime < this.updateFrequency) {
      return;
    }
    this.lastUpdateTime = now;
    
    // Initialize smoothed position on first update
    if (!this.smoothedPosition || !this.lastPosition) {
      this.smoothedPosition = playerPosition.clone();
      this.lastPosition = playerPosition.clone();
      return;
    }
    
    // Calculate velocity (change in position)
    const currentVelocity = playerPosition.clone().sub(this.lastPosition);
    
    // Smooth the velocity to reduce jerkiness
    this.lastVelocity.multiplyScalar(this.velocitySmoothing)
                    .addScaledVector(currentVelocity, 1 - this.velocitySmoothing);
    
    // Apply smoothed movement to smoothed position
    const targetPosition = this.smoothedPosition.clone().add(this.lastVelocity);
    this.smoothedPosition.lerp(targetPosition, this.smoothingFactor);
    
    // Only generate trail points and show trail above speed threshold
    if (currentSpeed < this.speedThreshold) {
      if (this.trailMaterial) {
        this.trailMaterial.opacity = 0;
      }
      // Don't generate new trail points below threshold - let existing ones fade naturally
      this.lastPosition = this.smoothedPosition.clone();
      return;
    }
    
    // Set trail visibility based on speed
    const speedFactor = Math.min((currentSpeed - this.speedThreshold) / 15, 1);
    if (this.trailMaterial) {
      this.trailMaterial.opacity = speedFactor * 0.9;
    }
    
    // Generate smooth trail points with interpolation
    if (this.smoothedPosition.distanceTo(this.lastPosition) > this.trailSpacing) {
      // Add trail point with slight interpolation for extra smoothness
      const distance = this.smoothedPosition.distanceTo(this.lastPosition);
      if (distance > this.trailSpacing * 2) {
        // Add intermediate point for very smooth trails
        const midPoint = this.lastPosition.clone().lerp(this.smoothedPosition, 0.5);
        this.addTrailPoint(midPoint, now);
      }
      this.addTrailPoint(this.smoothedPosition.clone(), now);
      this.lastPosition = this.smoothedPosition.clone();
    }
    
    // Always remove old trail points to keep trails clean
    this.removeOldPoints(now);
    
    // Update trail geometry
    this.updateTrailGeometry(currentSpeed, activeKit);
  }

  private addTrailPoint(position: THREE.Vector3, spawnTime: number): void {
    this.trailPoints.push({ position, spawnTime });
    
    // Limit trail length
    if (this.trailPoints.length > this.maxTrailPoints) {
      this.trailPoints.shift();
    }
  }

  private removeOldPoints(currentTime: number): void {
    while (this.trailPoints.length > 0) {
      const age = currentTime - this.trailPoints[0].spawnTime;
      if (age > this.fadeTime) {
        this.trailPoints.shift();
      } else {
        break;
      }
    }
  }

  private updateTrailGeometry(currentSpeed: number, activeKit: string): void {
    if (!this.trailGeometry || this.trailPoints.length === 0) return;
    
    const positions = this.trailGeometry.attributes.position as THREE.BufferAttribute;
    const colors = this.trailGeometry.attributes.color as THREE.BufferAttribute;
    const now = Date.now();
    
    // Get class color
    const classColor = this.classColors[activeKit as keyof typeof this.classColors] || this.baseColor;
    
    // Smooth color blending
    const speedFactor = Math.min(currentSpeed / 50, 1);
    const colorBlend = speedFactor * 0.3;
    const trailColor = classColor.clone().lerp(this.highSpeedColor, colorBlend);
    
    // Update line positions and colors
    for (let i = 0; i < this.maxTrailPoints; i++) {
      if (i < this.trailPoints.length) {
        const point = this.trailPoints[i];
        const age = now - point.spawnTime;
        const fadeProgress = Math.max(0, 1 - age / this.fadeTime);
        
        // Set position
        positions.setXYZ(i, point.position.x, point.position.y, point.position.z);
        
        // Set color with smooth fade
        const intensity = fadeProgress * 1.2;
        colors.setXYZ(i, trailColor.r * intensity, trailColor.g * intensity, trailColor.b * intensity);
      } else {
        // Clear unused points
        positions.setXYZ(i, 0, 0, 0);
        colors.setXYZ(i, 0, 0, 0);
      }
    }
    
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    
    // Update draw range
    this.trailGeometry.setDrawRange(0, Math.max(0, this.trailPoints.length - 1));
  }



  clear(): void {
    this.trailPoints = [];
    this.lastPosition = null;
    this.smoothedPosition = null;
    this.lastVelocity.set(0, 0, 0);
    if (this.trailGeometry) {
      this.trailGeometry.setDrawRange(0, 0);
    }
  }

  /**
   * Reset trail smoothly for teleports/respawns without jarring lines
   */
  resetToPosition(newPosition: THREE.Vector3): void {
    this.clear();
    this.smoothedPosition = newPosition.clone();
    this.lastPosition = newPosition.clone();
  }

  dispose(): void {
    if (this.trailMesh) {
      this.scene.remove(this.trailMesh);
    }
    if (this.trailGeometry) {
      this.trailGeometry.dispose();
    }
    if (this.trailMaterial) {
      this.trailMaterial.dispose();
    }
  }

  // Configuration methods
  setSpeedThreshold(threshold: number): void {
    this.speedThreshold = threshold;
  }

  setMaxTrailPoints(count: number): void {
    this.maxTrailPoints = count;
    // Would need to recreate geometry to change max points
  }

  setFadeTime(time: number): void {
    this.fadeTime = time;
  }
} 