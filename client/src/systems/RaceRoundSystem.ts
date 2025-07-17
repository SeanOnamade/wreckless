import type { CheckpointId } from './LapController';

export type RoundState = 'waiting' | 'active' | 'ended';

export interface ScoreEvent {
  type: 'dummyKO' | 'checkpoint' | 'lap';
  points: number;
  timestamp: number;
  details?: string;
}

export interface RoundConfig {
  dummyKOPoints: number;
  checkpointPoints: number;
  lapCompletePoints: number;
  roundDurationMs: number;
}

export class RaceRoundSystem {
  private state: RoundState = 'waiting';
  private score = 0;
  private scoreEvents: ScoreEvent[] = [];
  private roundStartTime = 0;
  private roundDurationMs: number;
  private roundTimer: number | null = null;
  private config: RoundConfig;
  private isDestroyed = false;
  
  // Event callbacks (arrays to support multiple listeners)
  private onStateChangeCallbacks: ((state: RoundState) => void)[] = [];
  private onScoreChangeCallbacks: ((score: number, event: ScoreEvent) => void)[] = [];
  private onRoundEndCallbacks: ((finalScore: number, events: ScoreEvent[]) => void)[] = [];
  
  // Event listener references for cleanup
  private passthroughHitListener?: (event: Event) => void;
  
  constructor(config: Partial<RoundConfig> = {}) {
    this.config = {
      dummyKOPoints: 10,
      checkpointPoints: 30,
      lapCompletePoints: 50,
      roundDurationMs: 120000, // 2 minutes
      ...config
    };
    this.roundDurationMs = this.config.roundDurationMs;
    
    this.setupEventListeners();
  }
  
  /**
   * Add event callbacks (supports multiple listeners)
   */
  addCallbacks(callbacks: {
    onStateChange?: (state: RoundState) => void;
    onScoreChange?: (score: number, event: ScoreEvent) => void;
    onRoundEnd?: (finalScore: number, events: ScoreEvent[]) => void;
  }): void {
    if (callbacks.onStateChange) {
      this.onStateChangeCallbacks.push(callbacks.onStateChange);
    }
    if (callbacks.onScoreChange) {
      this.onScoreChangeCallbacks.push(callbacks.onScoreChange);
    }
    if (callbacks.onRoundEnd) {
      this.onRoundEndCallbacks.push(callbacks.onRoundEnd);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  setCallbacks(callbacks: {
    onStateChange?: (state: RoundState) => void;
    onScoreChange?: (score: number, event: ScoreEvent) => void;
    onRoundEnd?: (finalScore: number, events: ScoreEvent[]) => void;
  }): void {
    this.addCallbacks(callbacks);
  }
  
  /**
   * Start the race round
   */
  startRound(): void {
    if (this.isDestroyed) {
      console.warn('Cannot start round - system is destroyed');
      return;
    }
    
    if (this.state !== 'waiting') {
      console.warn('Cannot start round - not in waiting state');
      return;
    }
    
    try {
      this.state = 'active';
      this.score = 0;
      this.scoreEvents = [];
      this.roundStartTime = performance.now();
      
      // Clear any existing timer
      if (this.roundTimer) {
        clearTimeout(this.roundTimer);
      }
      
      // Start round timer
      this.roundTimer = window.setTimeout(() => {
        this.endRound();
      }, this.roundDurationMs);
      
      console.log(`🏁 Round started! Duration: ${this.roundDurationMs / 1000}s`);
      this.safeExecuteCallbacks(this.onStateChangeCallbacks, this.state);
    } catch (error) {
      console.error('Error starting round:', error);
      this.state = 'waiting';
    }
  }
  
  /**
   * End the race round
   */
  endRound(): void {
    if (this.isDestroyed) {
      console.warn('Cannot end round - system is destroyed');
      return;
    }
    
    if (this.state !== 'active') {
      console.warn(`Cannot end round - not in active state (current: ${this.state})`);
      return;
    }
    
    this.state = 'ended';
    
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    
    console.log(`🏁 Round ended! Final score: ${this.score} points`);
    this.safeExecuteCallbacks(this.onStateChangeCallbacks, this.state);
    this.safeExecuteCallbacks(this.onRoundEndCallbacks, this.score, this.scoreEvents);
  }
  
  /**
   * Reset for a new round
   */
  resetRound(): void {
    if (this.isDestroyed) {
      console.warn('Cannot reset round - system is destroyed');
      return;
    }
    
    // Clear any active timer regardless of state
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    
    this.state = 'waiting';
    this.score = 0;
    this.scoreEvents = [];
    this.roundStartTime = 0;
    
    console.log('🔄 Round reset - ready for new round');
    
    // Reset game systems with error handling
    try {
      window.dispatchEvent(new CustomEvent('roundReset'));
      window.dispatchEvent(new CustomEvent('resetPlayerPosition'));
      window.dispatchEvent(new CustomEvent('clearCombatLog'));
      window.dispatchEvent(new CustomEvent('resetAllDummies'));
    } catch (error) {
      console.error('Error dispatching reset events:', error);
    }
    
    this.safeExecuteCallbacks(this.onStateChangeCallbacks, this.state);
  }
  
  /**
   * Add points to the score
   */
  private addScore(type: ScoreEvent['type'], points: number, details?: string): void {
    if (this.isDestroyed) {
      console.warn('Cannot add score - system is destroyed');
      return;
    }
    
    if (this.state !== 'active') {
      console.warn(`Cannot add score - round not active (current state: ${this.state})`);
      return; // Only score during active rounds
    }
    
    this.score += points;
    
    const event: ScoreEvent = {
      type,
      points,
      timestamp: performance.now(),
      details
    };
    
    this.scoreEvents.push(event);
    
    console.log(`📊 +${points} pts (${type}) - Total: ${this.score}`);
    this.safeExecuteCallbacks(this.onScoreChangeCallbacks, this.score, event);
  }
  
  /**
   * Get current round info
   */
  getRoundInfo(): {
    state: RoundState;
    score: number;
    timeRemaining: number;
    roundProgress: number;
  } {
    const timeElapsed = this.state === 'active' ? performance.now() - this.roundStartTime : 0;
    const timeRemaining = Math.max(0, this.roundDurationMs - timeElapsed);
    const roundProgress = this.state === 'active' ? timeElapsed / this.roundDurationMs : 0;
    
    return {
      state: this.state,
      score: this.score,
      timeRemaining,
      roundProgress: Math.min(roundProgress, 1)
    };
  }
  
  /**
   * Get score events for display
   */
  getScoreEvents(): ScoreEvent[] {
    return [...this.scoreEvents];
  }
  
  /**
   * Set up event listeners for scoring
   */
  private setupEventListeners(): void {
    // Remove any existing listeners first to prevent accumulation
    if (this.passthroughHitListener) {
      window.removeEventListener('passthroughHit', this.passthroughHitListener);
    }
    
    // Create bound listener function for cleanup
    this.passthroughHitListener = (event: Event) => {
      if (this.isDestroyed) return;
      
      try {
        const customEvent = event as CustomEvent;
        const { targetId } = customEvent.detail;
        
        this.addScore('dummyKO', this.config.dummyKOPoints, `Hit dummy ${targetId}`);
      } catch (error) {
        console.error('Error handling passthrough hit:', error);
      }
    };
    
    // Only listen to passthroughHit to avoid double scoring
    window.addEventListener('passthroughHit', this.passthroughHitListener);
  }

  /**
   * Safely execute callback arrays with error handling
   */
  private safeExecuteCallbacks<T extends any[]>(callbacks: ((...args: T) => void)[], ...args: T): void {
    if (this.isDestroyed) return;
    
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error('Error in round system callback:', error);
      }
    });
  }

  /**
   * Cleanup resources and event listeners
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Clear timer
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    
    // Remove event listeners
    if (this.passthroughHitListener) {
      window.removeEventListener('passthroughHit', this.passthroughHitListener);
    }
    
    // Clear callbacks
    this.onStateChangeCallbacks = [];
    this.onScoreChangeCallbacks = [];
    this.onRoundEndCallbacks = [];
    
    console.log('🧹 RaceRoundSystem destroyed and cleaned up');
  }
  
  /**
   * Manually trigger checkpoint score (called by lap controller)
   */
  onCheckpointReached(checkpointId: CheckpointId, isValid: boolean): void {
    if (isValid) {
      this.addScore('checkpoint', this.config.checkpointPoints, `Checkpoint ${checkpointId}`);
    }
  }
  
  /**
   * Manually trigger lap completion score (called by lap controller)
   */
  onLapComplete(lapTime: number, totalLaps: number): void {
    this.addScore('lap', this.config.lapCompletePoints, `Lap ${totalLaps} (${(lapTime / 1000).toFixed(2)}s)`);
  }
  
  /**
   * Get configuration
   */
  getConfig(): RoundConfig {
    return { ...this.config };
  }
} 