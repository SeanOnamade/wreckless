import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MeleeTarget } from './MeleeCombat';

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
    
    console.log(`🎯 Target dummy "${id}" created at position:`, position);
    console.log(`🎯 Dummy "${id}" initialized with ${this.currentHealth}/${this.maxHealth} HP`);
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
    
    // CRITICAL: Set userData for HitVolume system detection
    this.rigidBody.userData = {
      isDummy: true,
      id: this.id,
      type: 'TargetDummy'
    };
    
    // Create SENSOR collider - detectable but not solid (pass-through for players)
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.9, 0.5)
      .setSensor(true); // CRITICAL: Makes dummy pass-through for movement
    
    this.world.createCollider(colliderDesc, this.rigidBody);
    
    console.log(`🎯 Dummy ${this.id} created as SENSOR (pass-through for movement, detectable for hits)`);
  }

  /**
   * Handle taking damage from melee attacks
   */
  takeDamage(damage: number, _direction: THREE.Vector3): void {
    // Don't take damage if already KO'd
    if (this.currentHealth <= 0) {
      console.log(`🎯 Dummy ${this.id} rejected damage (already KO'd) - ${this.currentHealth}/${this.maxHealth} HP`);
      return; // Silently reject damage for KO'd dummies
    }
    
    // Log HP BEFORE damage
    const hpBefore = this.currentHealth;
    
    this.currentHealth -= damage;
    
    // Enhanced combat log showing before/after HP
    console.log(`🎯 Dummy ${this.id}: ${hpBefore}/${this.maxHealth} HP → took ${damage} damage → ${this.currentHealth}/${this.maxHealth} HP remaining`);
    
    // Add to combat log with clear HP status
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { 
        message: `🎯 ${this.id}: ${hpBefore} HP → ${damage} dmg → ${this.currentHealth} HP remaining` 
      }
    }));
    
    // Note: meleeHit events are dispatched by the calling system (HitVolume/MeleeCombat)
    // to avoid double-dispatching in racing mode
    
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
    
    try {
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
      
      // DEFER rigidBody.setEnabled(false) to avoid Rapier "recursive use" error
      // This happens when setEnabled is called during an active physics query
      requestAnimationFrame(() => {
        try {
          // Disable collision temporarily (deferred to avoid Rapier conflict)
          this.rigidBody.setEnabled(false);
        } catch (deferredError) {
          console.error(`Error in deferred rigidBody disable for ${this.id}:`, deferredError);
        }
      });
      
      // Respawn after delay
      this.respawnTimer = window.setTimeout(() => {
        this.respawn();
      }, 3000);
      
    } catch (error) {
      console.error(`Error in triggerKO for ${this.id}:`, error);
    }
  }

  /**
   * Respawn the dummy with full health
   */
  private respawn(): void {
    console.log(`✨ Dummy ${this.id} respawned!`);
    
    // Add to combat log
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: `✨ ${this.id} respawned with full HP!` }
    }));
    
    // Reset health
    this.currentHealth = this.maxHealth;
    console.log(`✨ Dummy ${this.id} health reset: ${this.currentHealth}/${this.maxHealth} HP`);
    
    // Enhanced respawn animation with prominent green flash
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    
    // Start with bright green spawn flash
    material.color.setHex(0x00ff44); // Bright green color
    material.transparent = false;
    material.opacity = 1.0;
    material.emissive.setHex(0x00ff00); // Bright green emissive
    
    // Start with slightly larger scale for pop effect
    this.mesh.scale.set(1.2, 1.2, 1.2);
    
    // Reset rotation to upright immediately
    this.mesh.rotation.z = 0;
    
    // Reset position
    this.mesh.position.copy(this.position);
    
    // Re-enable collision
    this.rigidBody.setEnabled(true);
    
    // Re-enable collision completed
    
    // Animate scale back to normal over 200ms
    const startTime = Date.now();
    const animateScale = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 200, 1); // 200ms animation
      const scale = 1.2 - (0.2 * progress); // From 1.2 to 1.0
      
      this.mesh.scale.set(scale, scale, scale);
      
      if (progress < 1) {
        requestAnimationFrame(animateScale);
      }
    };
    requestAnimationFrame(animateScale);
    
    // Remove green flash and return to normal color after 300ms
    window.setTimeout(() => {
      material.color.setHex(0xff4444); // Back to normal red
      material.emissive.setHex(0x000000); // Remove emissive
    }, 300);
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
   * Reset health to full (for round resets)
   */
  resetHealth(): void {
    const oldHealth = this.currentHealth;
    this.currentHealth = this.maxHealth;
    
    // Clear any respawn timer
    if (this.respawnTimer) {
      window.clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    
    // Reset visual state
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(0xff4444); // Normal red
    material.transparent = false;
    material.opacity = 1.0;
    material.emissive.setHex(0x000000); // No emissive
    
    // Reset scale and rotation
    this.mesh.scale.set(1, 1, 1);
    this.mesh.rotation.z = 0;
    this.mesh.position.copy(this.position);
    
    // Re-enable collision if disabled
    if (!this.rigidBody.isEnabled()) {
      this.rigidBody.setEnabled(true);
    }
    
    console.log(`🔄 Dummy ${this.id} health reset: ${oldHealth}/${this.maxHealth} HP → ${this.currentHealth}/${this.maxHealth} HP (full)`);
    
    // Add to combat log for round resets
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: `🔄 ${this.id} health reset to ${this.currentHealth}/${this.maxHealth} HP` }
    }));
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