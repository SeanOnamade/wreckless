/**
 * Lightweight performance profiler for debug builds
 * Tracks frame times and identifies performance bottlenecks during gameplay
 */

interface FrameMetrics {
  frameTime: number;
  deltaTime: number;
  timestamp: number;
  activeAnimations: number;
  physicsStepTime?: number;
}

interface PerformanceStats {
  averageFrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  p95FrameTime: number;
  droppedFrames: number;
  totalFrames: number;
  averageFPS: number;
}

class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private enabled: boolean = false;
  private frameMetrics: FrameMetrics[] = [];
  private lastFrameTime: number = 0;
  private maxSamples: number = 1800; // Keep last 30 seconds at 60fps
  private logInterval: number = 30000; // Log every 30 seconds
  private lastLogTime: number = 0;
  
  // Frame time thresholds
  private readonly DROP_THRESHOLD = 33.33; // 30fps (dropped frame)

  private constructor() {
    // Only enable in development builds - use import.meta.env for Vite
    this.enabled = import.meta.env.DEV;
  }

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  /**
   * Enable/disable profiling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.frameMetrics = [];
    }
  }

  /**
   * Record frame timing - call this once per game loop iteration
   */
  recordFrame(activeAnimations: number = 0, physicsStepTime?: number): void {
    if (!this.enabled) return;

    const now = performance.now();
    const frameTime = this.lastFrameTime > 0 ? now - this.lastFrameTime : 0;
    const deltaTime = frameTime;

    if (this.lastFrameTime > 0) {
      this.frameMetrics.push({
        frameTime,
        deltaTime,
        timestamp: now,
        activeAnimations,
        physicsStepTime
      });

      // Keep only recent samples
      if (this.frameMetrics.length > this.maxSamples) {
        this.frameMetrics.shift();
      }

      // Log periodic stats
      if (now - this.lastLogTime > this.logInterval) {
        this.logPerformanceStats();
        this.lastLogTime = now;
      }
    }

    this.lastFrameTime = now;
  }

  /**
   * Mark the start of a specific operation for timing
   */
  startTiming(label: string): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Only log if operation takes significant time
      if (duration > 1.0) {
        console.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats | null {
    if (!this.enabled || this.frameMetrics.length === 0) return null;

    const frameTimes = this.frameMetrics.map(m => m.frameTime);
    const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
    
    const droppedFrames = frameTimes.filter(ft => ft > this.DROP_THRESHOLD).length;
    const totalFrames = frameTimes.length;
    const averageFrameTime = frameTimes.reduce((sum, ft) => sum + ft, 0) / totalFrames;
    
    return {
      averageFrameTime,
      minFrameTime: Math.min(...frameTimes),
      maxFrameTime: Math.max(...frameTimes),
      p95FrameTime: sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)],
      droppedFrames,
      totalFrames,
      averageFPS: 1000 / averageFrameTime
    };
  }

  /**
   * Log aggregated performance statistics
   */
  private logPerformanceStats(): void {
    const stats = this.getStats();
    if (!stats) return;

    const { averageFPS, droppedFrames, totalFrames, p95FrameTime, maxFrameTime } = stats;
    const dropRate = (droppedFrames / totalFrames * 100).toFixed(1);

    console.group('🔍 Performance Stats (30s window)');
    console.log(`Average FPS: ${averageFPS.toFixed(1)}`);
    console.log(`Frame drops: ${droppedFrames}/${totalFrames} (${dropRate}%)`);
    console.log(`95th percentile: ${p95FrameTime.toFixed(1)}ms`);
    console.log(`Worst frame: ${maxFrameTime.toFixed(1)}ms`);
    
    // Warning for performance issues
    if (averageFPS < 45) {
      console.warn('⚠️ Low average FPS detected');
    }
    if (parseFloat(dropRate) > 10) {
      console.warn('⚠️ High frame drop rate detected');
    }
    
    console.groupEnd();
  }

  /**
   * Export performance data for analysis
   */
  exportData(): FrameMetrics[] {
    return [...this.frameMetrics];
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.frameMetrics = [];
  }
}

export default PerformanceProfiler;
