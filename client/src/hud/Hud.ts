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
  private isDevelopment: boolean;
  
  constructor(lapController: LapController, parentContainer: HTMLDivElement) {
    this.lapController = lapController;
    this.isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
    
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
    // Last checkpoint visited
    const lastCheckpointDiv = document.createElement('div');
    lastCheckpointDiv.innerHTML = 'Last Checkpoint: <span id="lastCheckpoint">None</span>';
    this.lastCheckpointElement = lastCheckpointDiv.querySelector('#lastCheckpoint')!;
    
    // Total laps completed
    const totalLapsDiv = document.createElement('div');
    totalLapsDiv.innerHTML = 'Laps: <span id="totalLaps">0</span>';
    this.totalLapsElement = totalLapsDiv.querySelector('#totalLaps')!;
    
    // Current lap time
    const currentLapTimeDiv = document.createElement('div');
    currentLapTimeDiv.innerHTML = 'Current: <span id="currentLapTime">0.00s</span>';
    this.currentLapTimeElement = currentLapTimeDiv.querySelector('#currentLapTime')!;
    
    // Best lap time
    const bestLapTimeDiv = document.createElement('div');
    bestLapTimeDiv.innerHTML = 'Best: <span id="bestLapTime">--:--</span>';
    this.bestLapTimeElement = bestLapTimeDiv.querySelector('#bestLapTime')!;
    
    // Checkpoint progress
    const checkpointProgressDiv = document.createElement('div');
    checkpointProgressDiv.innerHTML = 'Progress: <span id="checkpointProgress">0/3</span>';
    this.checkpointProgressElement = checkpointProgressDiv.querySelector('#checkpointProgress')!;
    
    // Add elements to container
    this.container.appendChild(lastCheckpointDiv);
    this.container.appendChild(totalLapsDiv);
    this.container.appendChild(currentLapTimeDiv);
    this.container.appendChild(bestLapTimeDiv);
    this.container.appendChild(checkpointProgressDiv);
    
    // Add respawn hint in development mode
    if (this.isDevelopment) {
      const respawnHintDiv = document.createElement('div');
      respawnHintDiv.innerHTML = '<span style="color: #888;">Press R to respawn</span>';
      respawnHintDiv.style.marginTop = '4px';
      this.container.appendChild(respawnHintDiv);
    }
  }
  
  /**
   * Update the HUD with current lap progress
   */
  update(): void {
    const progress = this.lapController.getProgress();
    
    // Update last checkpoint
    this.lastCheckpointElement.textContent = progress.lastCheckpoint || 'None';
    this.lastCheckpointElement.style.color = progress.lastCheckpoint ? '#00ff00' : '#ffffff';
    
    // Update total laps
    this.totalLapsElement.textContent = progress.totalLaps.toString();
    
    // Update current lap time
    const currentTime = progress.currentLapTime / 1000;
    this.currentLapTimeElement.textContent = currentTime.toFixed(2) + 's';
    
    // Update best lap time
    if (progress.bestLapTime > 0) {
      const bestTime = progress.bestLapTime / 1000;
      this.bestLapTimeElement.textContent = bestTime.toFixed(2) + 's';
      
      // Color code current time vs best time
      if (currentTime > bestTime && progress.totalLaps > 0) {
        this.currentLapTimeElement.style.color = '#ff6666'; // Red if slower
      } else if (currentTime < bestTime || progress.totalLaps === 0) {
        this.currentLapTimeElement.style.color = '#66ff66'; // Green if faster or first lap
      } else {
        this.currentLapTimeElement.style.color = '#ffffff'; // White if equal
      }
    } else {
      this.bestLapTimeElement.textContent = '--:--';
      this.currentLapTimeElement.style.color = '#ffffff';
    }
    
    // Update checkpoint progress
    const progressText = `${progress.currentSequence.length}/3`;
    this.checkpointProgressElement.textContent = progressText;
    
    // Color code progress
    if (progress.currentSequence.length === 3) {
      this.checkpointProgressElement.style.color = '#00ff00'; // Green when all checkpoints hit
    } else if (progress.currentSequence.length > 0) {
      this.checkpointProgressElement.style.color = '#ffff00'; // Yellow when some checkpoints hit
    } else {
      this.checkpointProgressElement.style.color = '#ffffff'; // White when no checkpoints hit
    }
  }
  
  /**
   * Flash the HUD when a checkpoint is visited
   */
  flashCheckpoint(_checkpointId: CheckpointId, isValid: boolean): void {
    const color = isValid ? '#00ff00' : '#ff0000';
    
    // Flash the checkpoint progress element
    const originalColor = this.checkpointProgressElement.style.color;
    this.checkpointProgressElement.style.color = color;
    this.checkpointProgressElement.style.fontWeight = 'bold';
    
    setTimeout(() => {
      this.checkpointProgressElement.style.color = originalColor;
      this.checkpointProgressElement.style.fontWeight = 'normal';
    }, 500);
  }
  
  /**
   * Flash the HUD when a lap is completed
   */
  flashLapComplete(lapTime: number): void {
    // Flash the total laps element
    const originalColor = this.totalLapsElement.style.color;
    this.totalLapsElement.style.color = '#00ff00';
    this.totalLapsElement.style.fontWeight = 'bold';
    
    setTimeout(() => {
      this.totalLapsElement.style.color = originalColor;
      this.totalLapsElement.style.fontWeight = 'normal';
    }, 1000);
    
    // Show lap time notification
    this.showLapTimeNotification(lapTime);
  }
  
  private showLapTimeNotification(lapTime: number): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      padding: 20px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      z-index: 9999;
      pointer-events: none;
    `;
    
    const timeSeconds = (lapTime / 1000).toFixed(2);
    notification.textContent = `Lap Complete! ${timeSeconds}s`;
    
    document.body.appendChild(notification);
    
    // Remove notification after 2 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 2000);
  }
  
  /**
   * Clean up HUD resources
   */
  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 