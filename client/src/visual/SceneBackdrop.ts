import * as THREE from 'three';

/**
 * Scene Backdrop System
 * Provides a clean gradient sky background and optional fog
 * Replaces the generic ground tile for better visual clarity
 */
export class SceneBackdrop {
  private scene: THREE.Scene;
  private skyGradient: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    this.createGradientSky();
    console.log('🌌 SceneBackdrop: Initialized with gradient sky');
  }

  private createGradientSky(): void {
    console.log('🌌 Creating sky gradient...');
    
    // Create large inverted sphere for sky backdrop (massive size to prevent clipping)
    const skyGeometry = new THREE.SphereGeometry(2000, 32, 32);
    
    // Create natural sky gradient (lighter at horizon, deeper blue above)
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4A90E2) },    // Deep sky blue at top
        bottomColor: { value: new THREE.Color(0xE8F4FD) }  // Very light blue/white at horizon
      },
      vertexShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vColor;
        void main() {
          // Create gradient based on Y position (-2000 to +2000 normalized to 0-1)
          float mixFactor = (position.y + 2000.0) / 4000.0;
          mixFactor = clamp(mixFactor, 0.0, 1.0);
          
          // Smooth the gradient transition
          mixFactor = smoothstep(0.0, 1.0, mixFactor);
          
          vColor = mix(bottomColor, topColor, mixFactor);
          
          // Force sky to render at maximum depth to prevent clipping
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_Position.z = gl_Position.w * 0.999999; // Force to far plane
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      depthTest: false
    });
    
    this.skyGradient = new THREE.Mesh(skyGeometry, skyMaterial);
    this.skyGradient.renderOrder = -1000; // Render behind everything (lower = earlier)
    this.scene.add(this.skyGradient);
    
    console.log('🌌 Natural sky gradient: deep blue overhead to light horizon');
  }

  /**
   * Update sky position to follow camera (prevents clipping artifacts)
   */
  updateSkyPosition(cameraPosition: THREE.Vector3): void {
    if (this.skyGradient) {
      // Move sky sphere to follow camera position (no Y offset to maintain gradient)
      this.skyGradient.position.copy(cameraPosition);
      this.skyGradient.position.y = 0; // Keep sky centered vertically for proper gradient
    }
  }

  dispose(): void {
    if (this.skyGradient) {
      this.scene.remove(this.skyGradient);
      this.skyGradient.geometry.dispose();
      (this.skyGradient.material as THREE.Material).dispose();
      this.skyGradient = null;
    }
  }
} 