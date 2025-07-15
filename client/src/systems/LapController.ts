import * as THREE from 'three';

export type CheckpointId = 'A' | 'B' | 'C' | 'FINISH';

export interface CheckpointVisit {
  id: CheckpointId;
  timestamp: number;
  position: THREE.Vector3;
}

export class LapController {
  private state = { index: 0 }; // Simple index-based tracking
  private expectedOrder: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
  private lastCheckpoint: CheckpointId | null = null;
  private totalLaps = 0;
  private currentLapStartTime = 0;
  private bestLapTime = Infinity;
  private onLapComplete?: (lapTime: number, totalLaps: number) => void;
  private onCheckpointVisit?: (checkpoint: CheckpointId, isValid: boolean) => void;
  
  constructor(
    onLapComplete?: (lapTime: number, totalLaps: number) => void,
    onCheckpointVisit?: (checkpoint: CheckpointId, isValid: boolean) => void
  ) {
    this.onLapComplete = onLapComplete;
    this.onCheckpointVisit = onCheckpointVisit;
    this.resetLap();
  }
  
  /**
   * Visit a checkpoint and validate if it's in the correct sequence
   */
  visit(checkpointId: CheckpointId): boolean {
    const expected = this.expectedOrder[this.state.index];
    
    if (checkpointId !== expected) {
      console.log(`✗ Checkpoint ${checkpointId} visited out of sequence (expected: ${expected})`);
      this.onCheckpointVisit?.(checkpointId, false);
      return false; // wrong order
    }
    
    this.state.index++;
    this.lastCheckpoint = checkpointId;
    
    if (checkpointId === 'FINISH') {
      this.completeLap();
      this.state.index = 0; // reset for next lap
    } else {
      console.log(`✓ Checkpoint ${checkpointId} visited (${this.state.index - 1}/${this.expectedOrder.length - 1})`);
    }
    
    this.onCheckpointVisit?.(checkpointId, true);
    return true;
  }
  
  private completeLap(): void {
    const lapTime = performance.now() - this.currentLapStartTime;
    this.totalLaps++;
    
    if (lapTime < this.bestLapTime) {
      this.bestLapTime = lapTime;
    }
    
    console.log(`🏁 Lap ${this.totalLaps} completed! Time: ${(lapTime / 1000).toFixed(2)}s`);
    
    this.onLapComplete?.(lapTime, this.totalLaps);
    this.resetLap();
  }
  
  private resetLap(): void {
    this.lastCheckpoint = null;
    this.currentLapStartTime = performance.now();
  }
  
  /**
   * Get the current checkpoint progress
   */
  getProgress(): {
    currentSequence: CheckpointId[];
    lastCheckpoint: CheckpointId | null;
    totalLaps: number;
    bestLapTime: number;
    currentLapTime: number;
  } {
    // Build current sequence from state index
    const currentSequence = this.expectedOrder.slice(0, this.state.index);
    
    return {
      currentSequence,
      lastCheckpoint: this.lastCheckpoint,
      totalLaps: this.totalLaps,
      bestLapTime: this.bestLapTime === Infinity ? 0 : this.bestLapTime,
      currentLapTime: performance.now() - this.currentLapStartTime
    };
  }
  
  /**
   * Reset all lap data
   */
  reset(): void {
    this.state.index = 0;
    this.lastCheckpoint = null;
    this.totalLaps = 0;
    this.bestLapTime = Infinity;
    this.currentLapStartTime = performance.now();
  }
} 