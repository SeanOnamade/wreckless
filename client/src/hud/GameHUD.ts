import type { CheckpointId } from '../systems/LapController';
import { LapController } from '../systems/LapController';
import type { CheckpointSystem } from '../systems/CheckpointSystem';
import * as THREE from 'three';

export class GameHUD {
  private lapController: LapController;
  private checkpointSystem: CheckpointSystem | null = null;
  private container!: HTMLDivElement;
  private checkpointBar!: HTMLDivElement;
  private lapTimerElement!: HTMLSpanElement;
  private checkpointElements: Map<CheckpointId, HTMLSpanElement> = new Map();
  
  // 2D Checkpoint arrow system (HUD-based)
  private arrowContainer!: HTMLDivElement;
  private arrowElement!: HTMLDivElement;
  private camera: THREE.Camera | null = null;
  private lastArrowUpdate = 0;
  private readonly ARROW_UPDATE_INTERVAL = 100; // Back to 100ms for smoother 2D updates
  
  // Animation timeout tracking for proper cleanup
  private activeTimeouts: Set<number> = new Set();
  private timerActive = false;
  
  constructor(lapController: LapController) {
    this.lapController = lapController;
    this.createHUD();
  }
  
  /**
   * Set the checkpoint system reference and camera for 2D arrow calculations
   */
  setCheckpointSystem(checkpointSystem: CheckpointSystem, _scene?: THREE.Scene, camera?: THREE.Camera): void {
    this.checkpointSystem = checkpointSystem;
    if (camera) this.camera = camera;
  }
  
  private createHUD(): void {
    // Create main container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: bold;
      z-index: 1000;
      pointer-events: none;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    
    // Create checkpoint progress bar
    this.checkpointBar = document.createElement('div');
    this.checkpointBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
      justify-content: center;
    `;
    
    // Create checkpoint elements (simplified)
    const checkpoints: { id: CheckpointId; label: string }[] = [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' },
      { id: 'FINISH', label: '🏁' }
    ];
    
    checkpoints.forEach((checkpoint, index) => {
      const element = document.createElement('span');
      element.textContent = checkpoint.label;
      element.style.cssText = `
        display: inline-block;
        width: 35px;
        height: 35px;
        line-height: 35px;
        text-align: center;
        border-radius: 50%;
        border: 2px solid #666;
        background: rgba(40, 40, 40, 0.8);
        color: #666;
        font-size: 16px;
        transition: all 0.2s ease;
      `;
      
      this.checkpointElements.set(checkpoint.id, element);
      this.checkpointBar.appendChild(element);
      
      // Add arrows between checkpoints (except after the last one)
      if (index < checkpoints.length - 1) {
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.style.cssText = `color: #666; font-size: 20px; margin: 0 5px;`;
        this.checkpointBar.appendChild(arrow);
      }
    });
    
    // Create lap timer
    const lapTimerContainer = document.createElement('div');
    lapTimerContainer.style.cssText = `
      text-align: center;
      font-size: 24px;
      color: #00ff00;
    `;
    lapTimerContainer.innerHTML = 'Lap Time: <span id="lapTimer">0.00s</span>';
    this.lapTimerElement = lapTimerContainer.querySelector('#lapTimer')!;
    
    // Create 2D checkpoint arrow
    this.create2DArrow();
    
    // Assemble HUD
    this.container.appendChild(this.checkpointBar);
    this.container.appendChild(lapTimerContainer);
    document.body.appendChild(this.container);
    document.body.appendChild(this.arrowContainer);
    
    // Initial update to sync with current state
    this.updateCheckpointDisplay();
  }
  
  /**
   * Create 2D arrow in a stylish container
   */
  private create2DArrow(): void {
    // Create arrow container with stylish background (optimized size)
    this.arrowContainer = document.createElement('div');
    this.arrowContainer.style.cssText = `
      position: fixed;
      top: 130px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1001;
      pointer-events: none;
      transition: transform 0.2s ease;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid rgba(255, 215, 0, 0.5);
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      width: 75px;
      height: 75px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create arrow element - smaller, well-proportioned triangle
    this.arrowElement = document.createElement('div');
    this.arrowElement.style.cssText = `
      width: 0;
      height: 0;
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-bottom: 45px solid #ffd700;
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 3px rgba(255, 215, 0, 1));
      transition: transform 0.2s ease;
      margin: 0 auto;
    `;
    
    // Add a subtle compass background pattern (proportional)
    const compassBg = document.createElement('div');
    compassBg.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50px;
      height: 50px;
      border: 1px solid rgba(255, 215, 0, 0.2);
      border-radius: 50%;
      z-index: -1;
    `;
    
    this.arrowContainer.appendChild(compassBg);
    this.arrowContainer.appendChild(this.arrowElement);
    
    // Initially hidden
    this.arrowContainer.style.display = 'none';
    
    if (import.meta.env.DEV) {
      console.log('✨ 2D checkpoint arrow created with styled container');
    }
  }
  
  /**
   * Update 2D arrow to point toward the beacon - PERFORMANCE OPTIMIZED
   */
  private update2DArrow(playerPosition?: THREE.Vector3): void {
    if (!this.camera || !this.checkpointSystem || !playerPosition) {
      this.arrowContainer.style.display = 'none';
      return;
    }
    
    // OPTIMIZATION: Only update every 100ms
    const now = Date.now();
    if (now - this.lastArrowUpdate < this.ARROW_UPDATE_INTERVAL) {
      return;
    }
    this.lastArrowUpdate = now;
    
    const nextCheckpointInfo = this.checkpointSystem.getNextCheckpointInfo();
    if (!nextCheckpointInfo) {
      // No next checkpoint (lap complete)
      this.arrowContainer.style.display = 'none';
      return;
    }
    
    // Show arrow
    this.arrowContainer.style.display = 'block';
    
    // OPTIMIZED: Cache camera calculations
    const camera = this.camera as THREE.PerspectiveCamera;
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, camera.up).normalize();
    
    // OPTIMIZED: Single direction calculation
    const directionToCheckpoint = new THREE.Vector3()
      .subVectors(nextCheckpointInfo.position, playerPosition)
      .normalize();
    
    // OPTIMIZED: Batch dot product calculations
    const rightComponent = directionToCheckpoint.dot(cameraRight);
    const forwardComponent = directionToCheckpoint.dot(cameraDirection);
    
    // Convert to screen angle - OPTIMIZED CALCULATION
    // (0° = up/ahead, 90° = right, 180° = down/behind, 270° = left)
    const angle = Math.atan2(rightComponent, forwardComponent) * 57.29577951308232; // Pre-calculated 180/Math.PI
    
    // Apply rotation to point toward checkpoint - OPTIMIZED TRANSFORM
    this.arrowElement.style.transform = `rotate(${angle}deg)`;
    
    // OPTIMIZED: Distance check with early exit
    const distanceSquared = playerPosition.distanceToSquared(nextCheckpointInfo.position);
    this.arrowContainer.style.opacity = distanceSquared < 100 ? '0.3' : '1.0'; // 10^2 = 100
  }
  
  /**
   * Update checkpoint display based on LapController state (FIXED)
   */
  private updateCheckpointDisplay(): void {
    const progress = this.lapController.getProgress();
    const checkpoints: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
    
    // Reset all checkpoints to default first
    this.checkpointElements.forEach((element) => {
      element.style.border = '2px solid #666';
      element.style.background = 'rgba(40, 40, 40, 0.8)';
      element.style.color = '#666';
      element.style.transform = 'scale(1.0)';
    });
    
    // Mark completed checkpoints as green
    progress.currentSequence.forEach(checkpointId => {
      const element = this.checkpointElements.get(checkpointId);
      if (element) {
        element.style.border = '2px solid #00ff00';
        element.style.background = 'rgba(0, 255, 0, 0.3)';
        element.style.color = '#00ff00';
      }
    });
    
    // Highlight the NEXT expected checkpoint in yellow (if not finished)
    const nextIndex = progress.currentSequence.length;
    if (nextIndex < checkpoints.length) {
      const nextCheckpointId = checkpoints[nextIndex];
      const element = this.checkpointElements.get(nextCheckpointId);
      if (element) {
        element.style.border = '2px solid #ffff00';
        element.style.background = 'rgba(255, 255, 0, 0.2)';
        element.style.color = '#ffff00';
      }
    }
  }
  
  /**
   * Called when a checkpoint is visited (FIXED)
   */
  onCheckpointVisited(checkpointId: CheckpointId, isValid: boolean): void {
    const element = this.checkpointElements.get(checkpointId);
    if (!element) return;
    
    if (isValid) {
      // Simple flash effect (with proper cleanup)
      const timeoutId = window.setTimeout(() => {
        element.style.transform = 'scale(1.1)';
        
        const timeoutId2 = window.setTimeout(() => {
          element.style.transform = 'scale(1.0)';
          this.activeTimeouts.delete(timeoutId2);
        }, 150);
        this.activeTimeouts.add(timeoutId2);
        
        this.activeTimeouts.delete(timeoutId);
      }, 50);
      this.activeTimeouts.add(timeoutId);
      
      // Update display to reflect new state (AFTER the flash)
      const timeoutId3 = window.setTimeout(() => {
        this.updateCheckpointDisplay();
        this.activeTimeouts.delete(timeoutId3);
      }, 200);
      this.activeTimeouts.add(timeoutId3);
      
    } else {
      // Invalid checkpoint - simple flash red (with cleanup)
      const original = {
        border: element.style.border,
        background: element.style.background,
        color: element.style.color
      };
      
      element.style.border = '2px solid #ff0000';
      element.style.background = 'rgba(255, 0, 0, 0.3)';
      element.style.color = '#ff0000';
      
      const timeoutId = window.setTimeout(() => {
        element.style.border = original.border;
        element.style.background = original.background;
        element.style.color = original.color;
        this.activeTimeouts.delete(timeoutId);
      }, 400);
      this.activeTimeouts.add(timeoutId);
    }
  }
  
  /**
   * Called when a lap is completed
   */
  onLapComplete(_lapTime: number, totalLaps: number): void {
    // Simple lap completion feedback
    this.lapTimerElement.style.color = '#00ff00';
    
    const timeoutId = window.setTimeout(() => {
      this.lapTimerElement.style.color = '#00ff00'; // Reset to default green
      this.activeTimeouts.delete(timeoutId);
    }, 1000);
    this.activeTimeouts.add(timeoutId);
    
    // Update checkpoint display for new lap
    this.updateCheckpointDisplay();
    
    if (import.meta.env.DEV) {
      console.log(`🏁 GameHUD: Lap ${totalLaps} completed`);
    }
  }
  
  /**
   * Start the timer display
   */
  startTimer(): void {
    this.timerActive = true;
  }
  
  /**
   * Stop the timer display
   */
  stopTimer(): void {
    this.timerActive = false;
  }
  
  /**
   * Reset checkpoint progress display
   */
  resetCheckpointProgress(): void {
    // Clear any active timeouts
    this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeTimeouts.clear();
    
    // Reset timer display
    this.lapTimerElement.textContent = '0.00s';
    this.lapTimerElement.style.color = '#00ff00';
    
    // Update display to reflect reset state
    this.updateCheckpointDisplay();
  }
  
  /**
   * Update lap timer display and 3D checkpoint arrow (optimized)
   */
  update(playerPosition?: THREE.Vector3): void {
    if (!this.timerActive) return; // Only update if timer is active
    
    const progress = this.lapController.getProgress();
    const currentTime = progress.currentLapTime / 1000;
    this.lapTimerElement.textContent = currentTime.toFixed(2) + 's';
    
    // Simple color coding
    if (progress.bestLapTime > 0) {
      const bestTime = progress.bestLapTime / 1000;
      this.lapTimerElement.style.color = currentTime > bestTime ? '#ff6666' : '#66ff66';
    } else {
      this.lapTimerElement.style.color = '#00ff00'; // Default green
    }
    
    // Update 2D checkpoint arrow with player position (OPTIMIZED)
    this.update2DArrow(playerPosition);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all active timeouts
    this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeTimeouts.clear();
    
    // Remove 2D HUD elements from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.arrowContainer && this.arrowContainer.parentNode) {
      this.arrowContainer.parentNode.removeChild(this.arrowContainer);
    }
    
    // Clear references
    this.checkpointElements.clear();
    this.camera = null;
    this.checkpointSystem = null;
  }
} 