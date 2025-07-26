import * as THREE from 'three';

export class LavaKillzone {
  private scene: THREE.Scene;
  private lavaPlane: THREE.Mesh | null = null;
  private lavaParticles: THREE.Points | null = null;
  private startTime: number = 0;
  private enabled: boolean = true;
  private lastParticleUpdate: number = 0;
  private readonly PARTICLE_UPDATE_INTERVAL = 1000 / 30; // 30 FPS for particles
  private isUpdating: boolean = false; // Prevent race conditions
  private lastShaderUpdate: number = 0;
  private readonly SHADER_UPDATE_INTERVAL = 1000 / 60; // 60 FPS for shader (smooth animation)

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.startTime = Date.now();
    this.lastParticleUpdate = Date.now();
    this.lastShaderUpdate = Date.now();
    
    // Load setting from localStorage
    const stored = localStorage.getItem('wreckless-lava-enabled');
    this.enabled = stored !== null ? stored === 'true' : true; // Default to enabled
  }

  initialize(): void {
    if (this.enabled) {
      this.createLavaPlane();
      this.createLavaParticles();
    }
  }

  private createLavaPlane(): void {
    // Large plane to cover the entire killzone area (700x700 for extra coverage)
    const planeGeometry = new THREE.PlaneGeometry(700, 700, 32, 32);
    
    // Create animated lava shader material
    const lavaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        lavaColor1: { value: new THREE.Color(0xff4500) }, // Orange-red
        lavaColor2: { value: new THREE.Color(0xff0000) }, // Pure red
        lavaColor3: { value: new THREE.Color(0x8b0000) }, // Dark red
        glowColor: { value: new THREE.Color(0xffaa00) },  // Golden glow
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          
          // Create flowing lava waves
          vec3 newPosition = position;
          newPosition.z += sin(position.x * 0.01 + time * 2.0) * 0.5;
          newPosition.z += cos(position.y * 0.015 + time * 1.5) * 0.3;
          newPosition.z += sin(position.x * 0.02 + position.y * 0.02 + time * 3.0) * 0.2;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lavaColor1;
        uniform vec3 lavaColor2;
        uniform vec3 lavaColor3;
        uniform vec3 glowColor;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Optimized flowing lava pattern (reduced calculations)
          float noise1 = sin(vUv.x * 15.0 + time * 2.0) * cos(vUv.y * 12.0 + time * 1.5);
          float noise2 = sin(vUv.x * 20.0 + time * 2.5) * 0.5;
          float noise3 = cos(vUv.x * 8.0 + vUv.y * 8.0 + time * 1.0) * 0.3;
          
          float combined = (noise1 + noise2 + noise3) / 1.8;
          
          // Simplified lava color mixing
          vec3 lavaColor = mix(lavaColor3, lavaColor1, smoothstep(-0.5, 0.5, combined));
          if (combined > 0.2) {
            lavaColor = mix(lavaColor, glowColor, (combined - 0.2) * 1.25);
          }
          
          // Simplified glow effect
          float glow = (1.0 - abs(combined)) * 0.2;
          
          gl_FragColor = vec4(lavaColor + glowColor * glow, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      transparent: false,
    });

    this.lavaPlane = new THREE.Mesh(planeGeometry, lavaMaterial);
    this.lavaPlane.rotation.x = -Math.PI / 2; // Make horizontal
    this.lavaPlane.position.y = -8; // Place below killzone threshold
    this.lavaPlane.receiveShadow = false;
    this.lavaPlane.castShadow = false;

    this.scene.add(this.lavaPlane);
  }

  private createLavaParticles(): void {
    // Create floating ember particles above the lava (optimized count for performance)
    const particleCount = 100;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Random positions across the lava plane (matches 700x700 dimensions)
      positions[i3] = (Math.random() - 0.5) * 600;     // x (slightly smaller than 700 for edge buffer)
      positions[i3 + 1] = -8 + Math.random() * 15;      // y (above lava)
      positions[i3 + 2] = (Math.random() - 0.5) * 600;  // z
      
      // Upward velocities with some random drift
      velocities[i3] = (Math.random() - 0.5) * 0.5;     // x drift
      velocities[i3 + 1] = 0.5 + Math.random() * 1.0;   // y (upward)
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.5; // z drift
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xff4500,
      size: 0.8,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
    });

    this.lavaParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.lavaParticles);
  }

  update(): void {
    if (!this.enabled || this.isUpdating) return;
    
    this.isUpdating = true;
    
    const now = Date.now();

    // Throttle shader updates to 60 FPS for smooth animation
    if (this.lavaPlane && this.lavaPlane.visible && this.lavaPlane.material instanceof THREE.ShaderMaterial && 
        now - this.lastShaderUpdate > this.SHADER_UPDATE_INTERVAL) {
      const currentTime = (now - this.startTime) / 1000;
      this.lavaPlane.material.uniforms.time.value = currentTime;
      this.lastShaderUpdate = now;
    }

    // Throttle particle updates to 30 FPS for performance - only when visible
    if (this.lavaParticles && this.lavaParticles.visible && now - this.lastParticleUpdate > this.PARTICLE_UPDATE_INTERVAL) {
      const deltaTime = Math.min((now - this.lastParticleUpdate) / 1000, 0.05); // Cap deltaTime to prevent jumps
      this.lastParticleUpdate = now;
      
      const positions = this.lavaParticles.geometry.attributes.position.array as Float32Array;
      const velocities = this.lavaParticles.geometry.attributes.velocity.array as Float32Array;

      // Bounds checking for safety
      const maxIndex = positions.length - 3;
      
      // Optimized particle update loop with bounds checking
      for (let i = 0; i <= maxIndex; i += 3) {
        // Update positions based on velocities with capped deltaTime
        positions[i] += velocities[i] * deltaTime; // x
        positions[i + 1] += velocities[i + 1] * deltaTime; // y
        positions[i + 2] += velocities[i + 2] * deltaTime; // z

        // Reset particles that have gone too high
        if (positions[i + 1] > 10) {
          positions[i] = (Math.random() - 0.5) * 600;
          positions[i + 1] = -8;
          positions[i + 2] = (Math.random() - 0.5) * 600;
        }

        // Keep particles within bounds (matches 700x700 lava area)
        const absX = Math.abs(positions[i]);
        const absZ = Math.abs(positions[i + 2]);
        if (absX > 350 || absZ > 350) {
          positions[i] = (Math.random() - 0.5) * 600;
          positions[i + 2] = (Math.random() - 0.5) * 600;
        }
      }

      this.lavaParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    this.isUpdating = false; // Release lock
  }

  dispose(): void {
    // Set flags to prevent further updates during disposal
    this.enabled = false;
    
    // Wait for any ongoing updates to complete
    if (this.isUpdating) {
      setTimeout(() => this.dispose(), 16);
      return;
    }
    
    try {
      if (this.lavaPlane) {
        this.scene.remove(this.lavaPlane);
        
        // Dispose geometry
        if (this.lavaPlane.geometry) {
          this.lavaPlane.geometry.dispose();
        }
        
        // Dispose material and shader uniforms
        if (this.lavaPlane.material instanceof THREE.ShaderMaterial) {
          // Clear uniforms to prevent memory leaks
          const shaderMaterial = this.lavaPlane.material as THREE.ShaderMaterial;
          Object.keys(shaderMaterial.uniforms).forEach(key => {
            const uniform = shaderMaterial.uniforms[key];
            if (uniform.value && typeof uniform.value.dispose === 'function') {
              uniform.value.dispose();
            }
          });
          shaderMaterial.dispose();
        } else if (this.lavaPlane.material instanceof THREE.Material) {
          this.lavaPlane.material.dispose();
        }
        
        this.lavaPlane = null;
      }

      if (this.lavaParticles) {
        this.scene.remove(this.lavaParticles);
        
        // Dispose geometry and attributes
        if (this.lavaParticles.geometry) {
          // BufferAttributes don't need manual disposal, just dispose the geometry
          this.lavaParticles.geometry.dispose();
        }
        
        // Dispose material
        if (this.lavaParticles.material instanceof THREE.Material) {
          this.lavaParticles.material.dispose();
        }
        
        this.lavaParticles = null;
      }
      
      console.log('🧹 LavaKillzone disposed successfully');
    } catch (error) {
      console.error('⚠️ Error during LavaKillzone disposal:', error);
    }
  }

  /**
   * Enable or disable the lava effects (thread-safe)
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    
    // Wait for current update to complete to prevent race conditions
    if (this.isUpdating) {
      // Defer the operation to avoid conflicts
      setTimeout(() => this.setEnabled(enabled), 16); // ~1 frame delay
      return;
    }
    
    this.enabled = enabled;
    localStorage.setItem('wreckless-lava-enabled', enabled.toString());
    
    try {
      if (enabled) {
        // Create lava if it doesn't exist
        if (!this.lavaPlane && !this.lavaParticles) {
          this.createLavaPlane();
          this.createLavaParticles();
        } else {
          // Show existing lava
          if (this.lavaPlane) {
            this.lavaPlane.visible = true;
          }
          if (this.lavaParticles) {
            this.lavaParticles.visible = true;
          }
        }
      } else {
        // Hide lava but don't dispose (for quick re-enable)
        if (this.lavaPlane) {
          this.lavaPlane.visible = false;
        }
        if (this.lavaParticles) {
          this.lavaParticles.visible = false;
        }
      }
    } catch (error) {
      console.error('⚠️ LavaKillzone setEnabled error:', error);
      // Revert enabled state on error
      this.enabled = !enabled;
      localStorage.setItem('wreckless-lava-enabled', this.enabled.toString());
    }
  }

  /**
   * Get current enabled state
   */
  isEnabled(): boolean {
    return this.enabled;
  }


} 