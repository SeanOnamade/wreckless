import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
// import { TargetDummy } from './TargetDummy'; // Unused import
import type { MeleeCombat } from './MeleeCombat';
import type { MeleeTarget } from './MeleeCombat';
import { RacingTargetDummy, type SpeedBoostConfig } from '../data/DummyLoader';

interface DummyPlacementData {
  position: THREE.Vector3;
  id: string;
  dummy: RacingTargetDummy; // Changed from TargetDummy to RacingTargetDummy
}

export class DummyPlacementManager {
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private camera: THREE.Camera;
  private meleeCombat: MeleeCombat;
  
  private placedDummies: DummyPlacementData[] = [];
  private loadedDummies: MeleeTarget[] = []; // Reference to loaded JSON dummies
  private dummyCounter = 0;
  private previewMesh?: THREE.Mesh;
  private placementMode = false;
  private editMode = false; // New edit mode for working with all dummies
  
  // Speed boost configuration for placed dummies
  private speedBoostConfig: SpeedBoostConfig = {
    baseDuration: 3000,      // 3 seconds base
    maxDuration: 5000,       // 5 seconds max
    baseVelocity: 18,        // Current max velocity
    boostedVelocity: 35,     // Boosted max velocity (increased from 26)
    damageScaling: 30        // 30 damage = +1 second
  };
  
  constructor(
    scene: THREE.Scene, 
    world: RAPIER.World, 
    camera: THREE.Camera,
    meleeCombat: MeleeCombat
  ) {
    this.scene = scene;
    this.world = world;
    this.camera = camera;
    this.meleeCombat = meleeCombat;
    
    this.setupKeyBindings();
    this.createPreviewMesh();
  }

  /**
   * Set the loaded dummies from the JSON file for editing
   */
  setLoadedDummies(loadedDummies: MeleeTarget[]): void {
    this.loadedDummies = loadedDummies;
    
    // Update UI
    this.updateDummyCount();
  }

  private setupKeyBindings(): void {
    window.addEventListener('keydown', (event) => {
      // Only handle in development mode
      // Level editor enabled in all builds
      
      if (event.code === 'KeyF') {
        event.preventDefault();
        
        if (event.ctrlKey && event.altKey) {
          // Ctrl+Alt+F - Toggle edit mode
          this.toggleEditMode();
        } else if (event.ctrlKey && event.shiftKey) {
          // Ctrl+Shift+F - Remove nearest dummy (any type)
          this.removeNearestDummy();
        } else if (event.ctrlKey) {
          // Ctrl+F - Export positions (all dummies)
          this.exportAllDummyPositions();
        } else if (event.shiftKey) {
          // Shift+F - Remove last dummy
          this.removeLastDummy();
        } else if (event.altKey) {
          // Alt+F - Toggle preview mode
          this.togglePreviewMode();
        } else {
          // F - Place dummy
          this.placeDummy();
        }
      }
    });
  }

  private createPreviewMesh(): void {
    // Create a ghost version of the dummy for preview
    const geometry = new THREE.CapsuleGeometry(0.5, 1.8, 8, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    
    this.previewMesh = new THREE.Mesh(geometry, material);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  private getPlayerPosition(): THREE.Vector3 {
    // Get position from camera (player position)
    return this.camera.position.clone();
  }

  private placeDummy(): void {
    const position = this.getPlayerPosition();
    // Allow placement at any height (midair supported!)
    
    const dummyId = `placed_dummy_${this.dummyCounter}`;
    this.dummyCounter++;
    
    // Create racing dummy with speed boost capability (same as loaded dummies)
    const dummy = new RacingTargetDummy(
      this.scene, 
      this.world, 
      position, 
      dummyId,
      this.speedBoostConfig
    );
    
    // Add to tracking
    this.placedDummies.push({
      position: position.clone(),
      id: dummyId,
      dummy: dummy
    });
    
    // Add to melee combat system
    this.meleeCombat.addTarget(dummy);
    
    // Visual feedback
    this.showPlacementFeedback(position);
    
    // Update UI
    this.updateDummyCount();
  }

  private removeLastDummy(): void {
    if (this.placedDummies.length === 0) {
      return;
    }
    
    const lastDummy = this.placedDummies.pop()!;
    
    // Remove from melee combat system
    this.meleeCombat.removeTarget(lastDummy.id);
    
    // Clean up the dummy
    lastDummy.dummy.destroy();
    
    // Update UI
    this.updateDummyCount();
  }

  private removeNearestDummy(): void {
    const allDummies = this.getAllDummies();
    
    if (allDummies.length === 0) {
      return;
    }
    
    const playerPosition = this.getPlayerPosition();
    let nearestDummy: any = null;
    let nearestDistance = Infinity;
    let nearestType: 'placed' | 'loaded' = 'placed';
    let nearestIndex = -1;
    
    // Check placed dummies
    this.placedDummies.forEach((dummyData, index) => {
      const distance = playerPosition.distanceTo(dummyData.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDummy = dummyData;
        nearestType = 'placed';
        nearestIndex = index;
      }
    });
    
    // Check loaded dummies
    this.loadedDummies.forEach((dummyData, index) => {
      const distance = playerPosition.distanceTo(dummyData.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDummy = dummyData;
        nearestType = 'loaded';
        nearestIndex = index;
      }
    });
    
    if (nearestDummy) {
      if (nearestType === 'placed') {
        // Remove placed dummy
        this.placedDummies.splice(nearestIndex, 1);
        this.meleeCombat.removeTarget(nearestDummy.id);
        nearestDummy.dummy.destroy();
      } else {
        // Remove loaded dummy
        this.loadedDummies.splice(nearestIndex, 1);
        this.meleeCombat.removeTarget(nearestDummy.id);
        
        // Clean up loaded dummy (if it has destroy method)
        if (nearestDummy.destroy) {
          nearestDummy.destroy();
        } else if (nearestDummy.targetDummy?.destroy) {
          nearestDummy.targetDummy.destroy();
        }
      }
      
      // Update UI
      this.updateDummyCount();
    }
  }

  private getAllDummies(): (DummyPlacementData | MeleeTarget)[] {
    return [...this.placedDummies, ...this.loadedDummies];
  }

  private exportAllDummyPositions(): void {
    const placedPositions = this.placedDummies.map(dummy => ({
      id: dummy.id,
      position: {
        x: Number(dummy.position.x.toFixed(2)),
        y: Number(dummy.position.y.toFixed(2)),
        z: Number(dummy.position.z.toFixed(2))
      }
    }));
    
    const loadedPositions = this.loadedDummies.map(dummy => ({
      id: dummy.id,
      position: {
        x: Number(dummy.position.x.toFixed(2)),
        y: Number(dummy.position.y.toFixed(2)),
        z: Number(dummy.position.z.toFixed(2))
      }
    }));
    
    const allPositions = [...loadedPositions, ...placedPositions];
    
    const exportData = {
      dummyPositions: allPositions,
      totalDummies: allPositions.length,
      exportedAt: new Date().toISOString(),
      note: `Includes ${loadedPositions.length} loaded + ${placedPositions.length} newly placed dummies`
    };
    
    // Export data to console and clipboard
    
    // Copy to clipboard
    try {
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    } catch (error) {
      // Clipboard copy failed
    }
  }

  private toggleEditMode(): void {
    this.editMode = !this.editMode;
    
    // Update UI
    window.dispatchEvent(new CustomEvent('dummyEditModeChanged', {
      detail: { enabled: this.editMode }
    }));
  }

  private togglePreviewMode(): void {
    this.placementMode = !this.placementMode;
    
    if (this.previewMesh) {
      this.previewMesh.visible = this.placementMode;
    }
    
    console.log(`🔍 Preview mode ${this.placementMode ? 'ON' : 'OFF'}`);
    
    // Update UI
    window.dispatchEvent(new CustomEvent('dummyPreviewModeChanged', {
      detail: { enabled: this.placementMode }
    }));
  }

  private showPlacementFeedback(position: THREE.Vector3): void {
    // Create a temporary green flash at the placement location
    const flashGeometry = new THREE.SphereGeometry(0.5, 8, 6);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    this.scene.add(flash);
    
    // Animate and remove
    let opacity = 0.8;
    const fadeOut = () => {
      opacity -= 0.05;
      flashMaterial.opacity = opacity;
      
      if (opacity > 0) {
        requestAnimationFrame(fadeOut);
      } else {
        this.scene.remove(flash);
        flashGeometry.dispose();
        flashMaterial.dispose();
      }
    };
    
    fadeOut();
  }

  // Update method for placement preview
  update(): void {
    if (this.placementMode && this.previewMesh) {
      const playerPosition = this.getPlayerPosition();
      this.previewMesh.position.copy(playerPosition);
    }
  }

  // Public getters
  getPlacedDummies(): RacingTargetDummy[] { // Changed return type
    return this.placedDummies.map(data => data.dummy);
  }
  
  getLoadedDummies(): MeleeTarget[] {
    return this.loadedDummies;
  }
  
  getTotalDummyCount(): number {
    return this.placedDummies.length + this.loadedDummies.length;
  }

  /**
   * Clean up all resources when destroying the placement manager
   */
  destroy(): void {
    // Clean up all placed dummies
    this.placedDummies.forEach(dummyData => {
      this.meleeCombat.removeTarget(dummyData.id);
      dummyData.dummy.destroy();
    });
    this.placedDummies.length = 0;

    // Clean up preview mesh
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      (this.previewMesh.material as THREE.Material).dispose();
      this.previewMesh = undefined;
    }

    // Clear loaded dummies reference (don't destroy them, they're owned by DummyLoader)
    this.loadedDummies.length = 0;
  }

  /**
   * Update UI with current dummy count
   */
  private updateDummyCount(): void {
    window.dispatchEvent(new CustomEvent('dummyCountChanged', {
      detail: {
        loaded: this.loadedDummies.length,
        placed: this.placedDummies.length
      }
    }));
  }
}