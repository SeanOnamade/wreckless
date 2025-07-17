import type { CheckpointId } from '../systems/LapController';
import { LapController } from '../systems/LapController';

export class GameHUD {
  private lapController: LapController;
  private container!: HTMLDivElement;
  private checkpointBar!: HTMLDivElement;
  private lapTimerElement!: HTMLSpanElement;
  private checkpointElements: Map<CheckpointId, HTMLSpanElement> = new Map();
  private currentCheckpointIndex = 0;
  private pulseInterval: number | null = null;
  private timerActive = false;
  
  constructor(lapController: LapController) {
    this.lapController = lapController;
    
    this.createHUD();
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
    
    // Create checkpoint elements
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
        transition: all 0.3s ease;
      `;
      
      this.checkpointElements.set(checkpoint.id, element);
      this.checkpointBar.appendChild(element);
      
      // Add arrows between checkpoints (except after the last one)
      if (index < checkpoints.length - 1) {
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.style.cssText = `
          color: #666;
          font-size: 20px;
          margin: 0 5px;
        `;
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
    this.lapTimerElement = lapTimerContainer.querySelector('#lapTimer')!
    
    // Assemble HUD
    this.container.appendChild(this.checkpointBar);
    this.container.appendChild(lapTimerContainer);
    document.body.appendChild(this.container);
    
    // Start current checkpoint pulse
    this.startCurrentCheckpointPulse();
  }
  
  private startCurrentCheckpointPulse(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
    }
    
    const checkpoints: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
    const currentCheckpoint = checkpoints[this.currentCheckpointIndex];
    const element = this.checkpointElements.get(currentCheckpoint);
    
    if (!element) return;
    
    let isHighlighted = false;
    this.pulseInterval = setInterval(() => {
      isHighlighted = !isHighlighted;
      
      if (isHighlighted) {
        element.style.border = '2px solid #ffff00';
        element.style.background = 'rgba(255, 255, 0, 0.2)';
        element.style.color = '#ffff00';
        element.style.transform = 'scale(1.1)';
      } else {
        element.style.border = '2px solid #666';
        element.style.background = 'rgba(40, 40, 40, 0.8)';
        element.style.color = '#666';
        element.style.transform = 'scale(1.0)';
      }
    }, 800) as unknown as number;
  }
  
  /**
   * Called when a checkpoint is visited
   */
  onCheckpointVisited(checkpointId: CheckpointId, isValid: boolean): void {
    const element = this.checkpointElements.get(checkpointId);
    if (!element) return;
    
    if (isValid) {
      // Mark checkpoint as completed
      element.style.border = '2px solid #00ff00';
      element.style.background = 'rgba(0, 255, 0, 0.3)';
      element.style.color = '#00ff00';
      element.style.transform = 'scale(1.0)';
      
      // Update current checkpoint index
      const checkpoints: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
      this.currentCheckpointIndex = checkpoints.indexOf(checkpointId) + 1;
      
      // Flash effect
      setTimeout(() => {
        element.style.transform = 'scale(1.2)';
        setTimeout(() => {
          element.style.transform = 'scale(1.0)';
        }, 150);
      }, 50);
      
      // Update pulse for next checkpoint
      if (checkpointId !== 'FINISH') {
        this.startCurrentCheckpointPulse();
      } else {
        // Stop pulsing when lap is complete
        if (this.pulseInterval) {
          clearInterval(this.pulseInterval);
          this.pulseInterval = null;
        }
      }
    } else {
      // Invalid checkpoint - flash red
      const originalBorder = element.style.border;
      const originalBackground = element.style.background;
      const originalColor = element.style.color;
      
      element.style.border = '2px solid #ff0000';
      element.style.background = 'rgba(255, 0, 0, 0.3)';
      element.style.color = '#ff0000';
      
      setTimeout(() => {
        element.style.border = originalBorder;
        element.style.background = originalBackground;
        element.style.color = originalColor;
      }, 500);
    }
  }
  
  /**
   * Called when a lap is completed
   */
  onLapComplete(lapTime: number, lapNumber: number): void {
    // Show lap completion message
    this.showLapCompleteMessage(lapTime, lapNumber);
    
    // Reset checkpoint progress
    this.doResetCheckpointProgress();
  }
  
  private showLapCompleteMessage(lapTime: number, lapNumber: number): void {
    const timeSeconds = (lapTime / 1000).toFixed(2);
    
    // Create completion message overlay
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      padding: 30px 50px;
      border-radius: 15px;
      font-family: 'Courier New', monospace;
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      z-index: 9999;
      pointer-events: none;
      border: 3px solid #00ff00;
      box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
    `;
    
    message.innerHTML = `
      <div style="margin-bottom: 10px;">🏁 LAP ${lapNumber} COMPLETE! 🏁</div>
      <div style="font-size: 28px; color: #ffffff;">${timeSeconds}s</div>
    `;
    
    document.body.appendChild(message);
    
    // Animate and remove message
    setTimeout(() => {
      message.style.opacity = '0';
      message.style.transform = 'translate(-50%, -50%) scale(0.8)';
      message.style.transition = 'all 0.5s ease';
      
      setTimeout(() => {
        document.body.removeChild(message);
      }, 500);
    }, 2000);
  }
  
  private doResetCheckpointProgress(): void {
    // Reset all checkpoints to default state
    this.checkpointElements.forEach((element) => {
      element.style.border = '2px solid #666';
      element.style.background = 'rgba(40, 40, 40, 0.8)';
      element.style.color = '#666';
      element.style.transform = 'scale(1.0)';
    });
    
    // Reset to first checkpoint
    this.currentCheckpointIndex = 0;
    this.startCurrentCheckpointPulse();
  }

  /**
   * Public method to reset checkpoint progress (called from main.ts on round reset)
   */
  resetCheckpointProgress(): void {
    this.doResetCheckpointProgress();
  }
  
  /**
   * Start the lap timer (called when round starts after countdown)
   */
  startTimer(): void {
    this.timerActive = true;
  }
  
  /**
   * Stop/reset the lap timer
   */
  stopTimer(): void {
    this.timerActive = false;
    this.lapTimerElement.textContent = '0.00s';
    this.lapTimerElement.style.color = '#00ff00';
  }
  
  /**
   * Update lap timer display
   */
  update(): void {
    if (!this.timerActive) return; // Only update if timer is active
    
    const progress = this.lapController.getProgress();
    const currentTime = progress.currentLapTime / 1000;
    this.lapTimerElement.textContent = currentTime.toFixed(2) + 's';
    
    // Color code the timer
    if (progress.bestLapTime > 0) {
      const bestTime = progress.bestLapTime / 1000;
      if (currentTime > bestTime && progress.totalLaps > 0) {
        this.lapTimerElement.style.color = '#ff6666'; // Red if slower than best
      } else {
        this.lapTimerElement.style.color = '#66ff66'; // Green if faster or first lap
      }
    } else {
      this.lapTimerElement.style.color = '#00ff00'; // Default green
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
    }
    
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 