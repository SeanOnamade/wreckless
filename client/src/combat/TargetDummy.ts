import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MeleeTarget } from './MeleeCombat';
import { COMBAT_CONFIG } from '../config';

export class TargetDummy implements MeleeTarget {
  public id: string;
  public position: THREE.Vector3;
  public rigidBody!: RAPIER.RigidBody;
  
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private mesh!: THREE.Mesh;
  private maxHealth = 100;
  private currentHealth = 100;
  private respawnTimer?: number;
  
  // Visual effects
  private damageFlashTimer?: number;
  private rangeIndicator?: THREE.Mesh;
  private inRange = false;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    position: THREE.Vector3,
    id: string = 'dummy'
  ) {
    this.scene = scene;
    this.world = world;
    this.position = position.clone();
    this.id = id;
    
    this.createVisualMesh();
    this.createPhysicsBody();
    this.setupPassThroughEffects();
    
    console.log(`🎯 Target dummy "${id}" created at position:`, position);
  }

  private createVisualMesh(): void {
    // Create a capsule-like geometry for the dummy
    const geometry = new THREE.CapsuleGeometry(0.5, 1.8, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      roughness: 0.7,
      metalness: 0.1
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `target_dummy_${this.id}`;
    
    // Add a simple face/target marking
    const faceGeometry = new THREE.CircleGeometry(0.2, 8);
    const faceMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.set(0, 0.6, 0.51); // Front of the dummy, upper part
    this.mesh.add(face);
    
    // Add target rings
    for (let i = 1; i <= 3; i++) {
      const ringGeometry = new THREE.RingGeometry(0.05 * i, 0.05 * i + 0.02, 8);
      const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: i % 2 === 0 ? 0xff0000 : 0xffffff,
        transparent: true,
        opacity: 0.7
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(0, 0.6, 0.52);
      this.mesh.add(ring);
    }
    
    this.scene.add(this.mesh);
    
    // Create range indicator
    this.createRangeIndicator();
  }
  
  private createRangeIndicator(): void {
    // Create a floating outline around the dummy instead of ground ring
    const outlineGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    
    this.rangeIndicator = new THREE.Mesh(outlineGeometry, outlineMaterial);
    this.rangeIndicator.position.copy(this.position);
    this.rangeIndicator.position.y += 2.5; // Float above the dummy
    
    this.scene.add(this.rangeIndicator);
  }

  private createPhysicsBody(): void {
    // Create a static rigid body for the dummy
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(this.position.x, this.position.y, this.position.z);
    
    this.rigidBody = this.world.createRigidBody(rigidBodyDesc);
    
    // Create capsule collider to match visual
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.9, 0.5);
    this.world.createCollider(colliderDesc, this.rigidBody);
  }

  /**
   * Handle taking damage from melee attacks
   */
  takeDamage(damage: number, _direction: THREE.Vector3): void {
    this.currentHealth -= damage;
    
    console.log(`🎯 Dummy ${this.id} took ${damage} damage (${this.currentHealth}/${this.maxHealth} HP remaining)`);
    
    // Visual damage feedback
    this.flashDamage();
    
    // Check for KO
    if (this.currentHealth <= 0) {
      this.triggerKO();
    }
  }

  /**
   * Handle knockback effects
   */
  applyKnockback(force: number, direction: THREE.Vector3): void {
    console.log(`💥 Dummy ${this.id} received ${force.toFixed(1)} knockback force`);
    
    // Visual knockback effect (slight mesh displacement)
    const originalPosition = this.mesh.position.clone();
    const knockbackDistance = Math.min(force * 0.02, 0.3); // Cap knockback visual
    
    this.mesh.position.add(direction.clone().multiplyScalar(knockbackDistance));
    
    // Return to original position after a short delay
    window.setTimeout(() => {
      this.mesh.position.copy(originalPosition);
    }, 200);
  }

  /**
   * Flash red when taking damage
   */
  private flashDamage(): void {
    if (this.damageFlashTimer) {
      window.clearTimeout(this.damageFlashTimer);
    }
    
    // Change to damage color
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(0xff8888);
    material.emissive.setHex(0x220000);
    
    // Reset after flash duration
    this.damageFlashTimer = window.setTimeout(() => {
      material.color.setHex(0xff4444);
      material.emissive.setHex(0x000000);
    }, 150);
  }

  /**
   * Handle KO and respawn logic
   */
  private triggerKO(): void {
    console.log(`💀 Dummy ${this.id} KO'd! Respawning in 3 seconds...`);
    
    // Visual KO effect - make it very obvious
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(0x222222); // Very dark
    material.transparent = true;
    material.opacity = 0.2; // Very transparent
    material.emissive.setHex(0x440000); // Dark red glow
    
    // Scale down the dummy to show it's "defeated"
    this.mesh.scale.set(0.7, 0.7, 0.7);
    
    // Rotate it to "fall over"
    this.mesh.rotation.z = Math.PI / 6; // 30 degrees
    
    // Disable collision temporarily
    this.rigidBody.setEnabled(false);
    
    // Respawn after delay (no label since it's not working well)
    this.respawnTimer = window.setTimeout(() => {
      this.respawn();
    }, 3000);
  }

  /**
   * Respawn the dummy with full health
   */
  private respawn(): void {
    console.log(`✨ Dummy ${this.id} respawned!`);
    
    // Reset health
    this.currentHealth = this.maxHealth;
    
    // Reset visuals with "spawn flash"
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(0xff4444);
    material.transparent = false;
    material.opacity = 1.0;
    material.emissive.setHex(0x00ff00); // Green spawn flash
    
    // Reset scale and rotation
    this.mesh.scale.set(1, 1, 1);
    this.mesh.rotation.z = 0;
    
    // Reset position
    this.mesh.position.copy(this.position);
    
    // Re-enable collision
    this.rigidBody.setEnabled(true);
    
    // Remove spawn flash after a moment
    window.setTimeout(() => {
      material.emissive.setHex(0x000000);
    }, 500);
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      current: this.currentHealth,
      max: this.maxHealth,
      percentage: (this.currentHealth / this.maxHealth) * 100
    };
  }
  
  /**
   * Update range indicator based on player proximity
   */
  updateRangeIndicator(playerPosition: THREE.Vector3, meleeRange: number): void {
    if (!this.rangeIndicator) return;
    
    const distance = this.position.distanceTo(playerPosition);
    const wasInRange = this.inRange;
    this.inRange = distance <= meleeRange;
    
    const material = this.rangeIndicator.material as THREE.MeshBasicMaterial;
    
    if (this.inRange && !wasInRange) {
      // Just entered range - very visible floating indicator
      material.opacity = 1.0;
      material.color.setHex(0x00ff00); // Bright green
      console.log(`🎯 ${this.id} entered melee range (${distance.toFixed(1)}m)`);
    } else if (!this.inRange && wasInRange) {
      // Just left range - fade out
      material.opacity = 0;
      console.log(`🎯 ${this.id} left melee range (${distance.toFixed(1)}m)`);
    } else if (this.inRange) {
      // Still in range - rotating wireframe
      const time = Date.now() * 0.002;
      const pulse = 0.7 + 0.3 * Math.sin(time * 2);
      material.opacity = pulse;
      material.color.setHex(0x00ff00);
      
      // Rotate the indicator
      this.rangeIndicator!.rotation.y = time;
    }
  }

  /**
   * Setup event listeners for pass-through hit effects
   */
  private setupPassThroughEffects(): void {
    // Listen for pass-through hit effects on this dummy
    window.addEventListener('dummyHitEffect', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { targetId, hitPoint, movementType, flashDuration, textColor, textDuration } = customEvent.detail;
      
      if (targetId === this.id) {
        this.flashWhite(flashDuration);
        this.spawnFloatingText('+Speed', textColor, textDuration, hitPoint);
      }
    });
  }

  /**
   * Flash white when hit by pass-through attack
   */
  flashWhite(duration: number = COMBAT_CONFIG.HIT_FLASH_DURATION): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    const originalColor = material.color.clone();
    const originalEmissive = material.emissive.clone();
    
    // Flash white
    material.color.setHex(0xffffff);
    material.emissive.setHex(0x444444);
    
    // Reset after duration
    window.setTimeout(() => {
      material.color.copy(originalColor);
      material.emissive.copy(originalEmissive);
    }, duration * 1000);
  }

  /**
   * Spawn floating "+Speed" text at hit location
   */
  spawnFloatingText(text: string, color: string, duration: number, position?: THREE.Vector3): void {
    // Create canvas for text texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    
    // Style text
    context.font = 'bold 32px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw text
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      alphaTest: 0.1
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    const textPosition = position || this.position.clone().add(new THREE.Vector3(0, 2, 0));
    sprite.position.copy(textPosition);
    sprite.scale.set(2, 0.5, 1);
    
    this.scene.add(sprite);
    
    // Animate sprite (float up and fade out)
    const startY = sprite.position.y;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        // Animation complete - cleanup
        this.scene.remove(sprite);
        material.dispose();
        texture.dispose();
        return;
      }
      
      // Float up
      sprite.position.y = startY + progress * 3;
      
      // Fade out
      material.opacity = 1 - progress;
      
      // Continue animation
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.respawnTimer) {
      window.clearTimeout(this.respawnTimer);
    }
    if (this.damageFlashTimer) {
      window.clearTimeout(this.damageFlashTimer);
    }
    
    this.scene.remove(this.mesh);
    this.world.removeRigidBody(this.rigidBody);
    
    // Clean up range indicator
    if (this.rangeIndicator) {
      this.scene.remove(this.rangeIndicator);
      this.rangeIndicator.geometry.dispose();
      (this.rangeIndicator.material as THREE.Material).dispose();
      this.rangeIndicator = undefined;
    }
    
    console.log(`🗑️ Target dummy ${this.id} destroyed`);
  }


} 