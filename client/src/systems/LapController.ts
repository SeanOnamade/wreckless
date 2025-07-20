import * as THREE from 'three';

export type CheckpointId = 'A' | 'B' | 'C' | 'FINISH';

export class LapController {
  private checkpointIndex = 0; // Number of checkpoints completed in current lap
  private readonly expectedOrder: CheckpointId[] = ['A', 'B', 'C', 'FINISH'];
  private lastCheckpoint: CheckpointId | null = null;
  private totalLaps = 0;
  private currentLapStartTime = 0;
  private bestLapTime = Infinity;
  private isActive = false;
  
  // Cached progress object to avoid creating new objects every call
  private cachedProgress = {
    currentSequence: [] as CheckpointId[],
    lastCheckpoint: null as CheckpointId | null,
    totalLaps: 0,
    bestLapTime: 0,
    currentLapTime: 0
  };
  
  private onLapComplete?: (lapTime: number, totalLaps: number) => void;
  private onCheckpointVisit?: (checkpoint: CheckpointId, isValid: boolean) => void;
  
  constructor(
    onLapComplete?: (lapTime: number, totalLaps: number) => void,
    onCheckpointVisit?: (checkpoint: CheckpointId, isValid: boolean) => void
  ) {
    this.onLapComplete = onLapComplete;
    this.onCheckpointVisit = onCheckpointVisit;
  }
  
  /**
   * Visit a checkpoint and validate if it's in the correct sequence
   */
  visit(checkpointId: CheckpointId): boolean {
    const expected = this.expectedOrder[this.checkpointIndex];
    
    if (checkpointId !== expected) {
      // Wrong sequence - trigger callback but don't advance state
      if (import.meta.env.DEV) {
        console.log(`❌ Wrong checkpoint: got ${checkpointId}, expected ${expected}`);
      }
      this.onCheckpointVisit?.(checkpointId, false);
      return false;
    }
    
    // Valid checkpoint - advance state
    this.checkpointIndex++;
    this.lastCheckpoint = checkpointId;
    
    if (import.meta.env.DEV) {
      console.log(`✓ Checkpoint ${checkpointId} completed (${this.checkpointIndex}/${this.expectedOrder.length})`);
    }
    
    // Trigger callback BEFORE checking for lap completion
    this.onCheckpointVisit?.(checkpointId, true);
    
    if (checkpointId === 'FINISH') {
      this.completeLap();
      this.checkpointIndex = 0; // Reset for next lap
      this.lastCheckpoint = null; // Clear last checkpoint for new lap
    }
    
    return true;
  }
  
  private completeLap(): void {
    if (!this.isActive) return; // Don't complete laps if timing isn't active
    
    const lapTime = performance.now() - this.currentLapStartTime;
    this.totalLaps++;
    
    if (lapTime < this.bestLapTime) {
      this.bestLapTime = lapTime;
    }
    
    if (import.meta.env.DEV) {
      console.log(`🏁 Lap ${this.totalLaps} completed! Time: ${(lapTime / 1000).toFixed(2)}s`);
    }
    
    this.onLapComplete?.(lapTime, this.totalLaps);
    this.resetLap();
  }
  
  private resetLap(): void {
    if (this.isActive) {
      this.currentLapStartTime = performance.now();
    }
  }
  
  /**
   * Get the current checkpoint progress (optimized to reuse object)
   */
  getProgress(): typeof this.cachedProgress {
    // Update cached progress object instead of creating new one
    this.cachedProgress.currentSequence = this.expectedOrder.slice(0, this.checkpointIndex);
    this.cachedProgress.lastCheckpoint = this.lastCheckpoint;
    this.cachedProgress.totalLaps = this.totalLaps;
    this.cachedProgress.bestLapTime = this.bestLapTime === Infinity ? 0 : this.bestLapTime;
    this.cachedProgress.currentLapTime = this.isActive ? performance.now() - this.currentLapStartTime : 0;
    
    return this.cachedProgress;
  }
  
  /**
   * Reset all lap data
   */
  reset(): void {
    this.checkpointIndex = 0;
    this.lastCheckpoint = null;
    this.totalLaps = 0;
    this.bestLapTime = Infinity;
    this.isActive = false;
    this.currentLapStartTime = 0;
    
    // Reset cached progress
    this.cachedProgress.currentSequence = [];
    this.cachedProgress.lastCheckpoint = null;
    this.cachedProgress.totalLaps = 0;
    this.cachedProgress.bestLapTime = 0;
    this.cachedProgress.currentLapTime = 0;
    
    if (import.meta.env.DEV) {
      console.log('🔄 Lap controller reset');
    }
  }
  
  /**
   * Start the lap timing
   */
  start(): void {
    this.isActive = true;
    this.currentLapStartTime = performance.now();
    
    if (import.meta.env.DEV) {
      console.log('🏁 Lap controller timing started');
    }
  }
  
  /**
   * Stop the lap timing
   */
  stop(): void {
    this.isActive = false;
    
    if (import.meta.env.DEV) {
      console.log('⏹️ Lap controller timing stopped');
    }
  }
} 