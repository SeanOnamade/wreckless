import type { CheckpointId } from '../systems/LapController';
import { LapController } from '../systems/LapController';

export class LapHUD {
  private lapController: LapController;
  private container: HTMLDivElement;
  private lastCheckpointElement!: HTMLSpanElement;
  private totalLapsElement!: HTMLSpanElement;
  private currentLapTimeElement!: HTMLSpanElement;
  private bestLapTimeElement!: HTMLSpanElement;
  private checkpointProgressElement!: HTMLSpanElement;
  
  // Timeout tracking for proper cleanup - separate tracking for different operations
  private activeTimeouts: Set<number> = new Set();
  private checkpointFlashTimeout?: number;
  private lapCompleteTimeout?: number;
  private isDestroyed = false;
  
  constructor(lapController: LapController, parentContainer: HTMLDivElement) {
    this.lapController = lapController;
    
    // Create HUD container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.3);
    `;
    
    this.createElements();
    parentContainer.appendChild(this.container);
  }
  
  private createElements(): void {
    // Use unique IDs to prevent conflicts
    const instanceId = Date.now().toString();
    
    // Last checkpoint visited
    const lastCheckpointDiv = document.createElement('div');
    lastCheckpointDiv.innerHTML = `Last Checkpoint: <span id="lastCheckpoint-${instanceId}">None</span>`;
    this.lastCheckpointElement = lastCheckpointDiv.querySelector(`#lastCheckpoint-${instanceId}`)!;
    
    // Total laps completed
    const totalLapsDiv = document.createElement('div');
    totalLapsDiv.innerHTML = `Laps: <span id="totalLaps-${instanceId}">0</span>`;
    this.totalLapsElement = totalLapsDiv.querySelector(`#totalLaps-${instanceId}`)!;
    
    // Current lap time
    const currentLapTimeDiv = document.createElement('div');
    currentLapTimeDiv.innerHTML = `Current: <span id="currentLapTime-${instanceId}">0.00s</span>`;
    this.currentLapTimeElement = currentLapTimeDiv.querySelector(`#currentLapTime-${instanceId}`)!;
    
    // Best lap time
    const bestLapTimeDiv = document.createElement('div');
    bestLapTimeDiv.innerHTML = `Best: <span id="bestLapTime-${instanceId}">--:--</span>`;
    this.bestLapTimeElement = bestLapTimeDiv.querySelector(`#bestLapTime-${instanceId}`)!;
    
    // Checkpoint progress (FIXED to show completed/total)
    const checkpointProgressDiv = document.createElement('div');
    checkpointProgressDiv.innerHTML = `Progress: <span id="checkpointProgress-${instanceId}">0/4</span>`;
    this.checkpointProgressElement = checkpointProgressDiv.querySelector(`#checkpointProgress-${instanceId}`)!;
    
    // Add elements to container
    this.container.appendChild(lastCheckpointDiv);
    this.container.appendChild(totalLapsDiv);
    this.container.appendChild(currentLapTimeDiv);
    this.container.appendChild(bestLapTimeDiv);
    this.container.appendChild(checkpointProgressDiv);
  }
  
  /**
   * Update the HUD with current lap progress (FIXED)
   */
  update(): void {
    if (this.isDestroyed) return; // Guard against updates after destruction
    
    const progress = this.lapController.getProgress();
    
    // Update last checkpoint (with safety check)
    if (this.lastCheckpointElement) {
      this.lastCheckpointElement.textContent = progress.lastCheckpoint || 'None';
      this.lastCheckpointElement.style.color = progress.lastCheckpoint ? '#00ff00' : '#ffffff';
    }
    
    // Update total laps (with safety check)
    if (this.totalLapsElement) {
      this.totalLapsElement.textContent = progress.totalLaps.toString();
    }
    
    // Update current lap time (with safety check)
    if (this.currentLapTimeElement) {
      const currentTime = progress.currentLapTime / 1000;
      this.currentLapTimeElement.textContent = currentTime.toFixed(2) + 's';
      
      // Update best lap time
      if (progress.bestLapTime > 0) {
        const bestTime = progress.bestLapTime / 1000;
        if (this.bestLapTimeElement) {
          this.bestLapTimeElement.textContent = bestTime.toFixed(2) + 's';
        }
        
        // Color code current time vs best time
        if (currentTime > bestTime && progress.totalLaps > 0) {
          this.currentLapTimeElement.style.color = '#ff6666'; // Red if slower
        } else if (currentTime < bestTime || progress.totalLaps === 0) {
          this.currentLapTimeElement.style.color = '#66ff66'; // Green if faster or first lap
        } else {
          this.currentLapTimeElement.style.color = '#ffffff'; // White if equal
        }
      } else {
        if (this.bestLapTimeElement) {
          this.bestLapTimeElement.textContent = '--:--';
        }
        this.currentLapTimeElement.style.color = '#ffffff';
      }
    }
    
    // Update checkpoint progress (FIXED: show completed/total including finish)
    if (this.checkpointProgressElement) {
      const completedCount = progress.currentSequence.length;
      const totalCount = 4; // A, B, C, FINISH
      const progressText = `${completedCount}/${totalCount}`;
      this.checkpointProgressElement.textContent = progressText;
      
      // Color code progress (FIXED logic)
      if (completedCount === totalCount) {
        this.checkpointProgressElement.style.color = '#00ff00'; // Green when lap complete
      } else if (completedCount > 0) {
        this.checkpointProgressElement.style.color = '#ffff00'; // Yellow when some checkpoints hit
      } else {
        this.checkpointProgressElement.style.color = '#ffffff'; // White when no checkpoints hit
      }
    }
  }
  
  /**
   * Flash the HUD when a checkpoint is visited (simplified with cleanup)
   */
  flashCheckpoint(_checkpointId: CheckpointId, isValid: boolean): void {
    if (this.isDestroyed || !this.checkpointProgressElement) return; // Guard against destruction
    
    const color = isValid ? '#00ff00' : '#ff0000';
    
    // Flash the checkpoint progress element
    const originalColor = this.checkpointProgressElement.style.color;
    const originalWeight = this.checkpointProgressElement.style.fontWeight;
    
    this.checkpointProgressElement.style.color = color;
    this.checkpointProgressElement.style.fontWeight = 'bold';
    
    // Clear any existing checkpoint flash timeout (only this specific operation)
    if (this.checkpointFlashTimeout) {
      clearTimeout(this.checkpointFlashTimeout);
      this.activeTimeouts.delete(this.checkpointFlashTimeout);
    }
    
    this.checkpointFlashTimeout = window.setTimeout(() => {
      if (this.isDestroyed || !this.checkpointProgressElement) return;
      
      this.checkpointProgressElement.style.color = originalColor;
      this.checkpointProgressElement.style.fontWeight = originalWeight;
      
      if (this.checkpointFlashTimeout) {
        this.activeTimeouts.delete(this.checkpointFlashTimeout);
        this.checkpointFlashTimeout = undefined;
      }
    }, 400);
    this.activeTimeouts.add(this.checkpointFlashTimeout);
    

  }
  
  /**
   * Flash when lap is completed (simplified)
   */
  flashLapComplete(lapTime: number): void {
    if (this.isDestroyed || !this.bestLapTimeElement) return; // Guard against destruction
    
    const timeSeconds = (lapTime / 1000).toFixed(2);
    
    // Clear any existing lap complete timeout (only this specific operation)
    if (this.lapCompleteTimeout) {
      clearTimeout(this.lapCompleteTimeout);
      this.activeTimeouts.delete(this.lapCompleteTimeout);
    }
    
    // Flash the best lap time element green
    const originalColor = this.bestLapTimeElement.style.color;
    this.bestLapTimeElement.style.color = '#00ff00';
    this.bestLapTimeElement.style.fontWeight = 'bold';
    
    this.lapCompleteTimeout = window.setTimeout(() => {
      if (this.isDestroyed || !this.bestLapTimeElement) return;
      
      this.bestLapTimeElement.style.color = originalColor;
      this.bestLapTimeElement.style.fontWeight = 'normal';
      
      if (this.lapCompleteTimeout) {
        this.activeTimeouts.delete(this.lapCompleteTimeout);
        this.lapCompleteTimeout = undefined;
      }
    }, 800);
    this.activeTimeouts.add(this.lapCompleteTimeout);
    
    if (import.meta.env.DEV) {
      console.log(`🏁 LapHUD: Lap completed in ${timeSeconds}s`);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Mark as destroyed to prevent further operations
    this.isDestroyed = true;
    
    // Clear specific timeouts
    if (this.checkpointFlashTimeout) {
      clearTimeout(this.checkpointFlashTimeout);
      this.checkpointFlashTimeout = undefined;
    }
    
    if (this.lapCompleteTimeout) {
      clearTimeout(this.lapCompleteTimeout);
      this.lapCompleteTimeout = undefined;
    }
    
    // Clear all remaining active timeouts
    this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeTimeouts.clear();
    
    // Remove from DOM if still attached
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 