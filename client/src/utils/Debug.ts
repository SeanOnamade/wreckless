/**
 * Debug logging utilities for development
 * Provides conditional logging based on debug flags
 */

// Debug flags - easy to toggle
const DEBUG_FLAGS = {
  SYSTEM_INIT: import.meta.env.DEV && false,     // System initialization logs
  COMBAT: import.meta.env.DEV && false,         // Combat and ability logs  
  NETWORK: import.meta.env.DEV && false,        // Network connection logs
  PERFORMANCE: import.meta.env.DEV && true,     // Performance warnings (keep enabled)
  AUDIO: import.meta.env.DEV && false,          // Audio system logs
  CHARACTER: import.meta.env.DEV && false,      // Character loading logs
  UI: import.meta.env.DEV && false,             // UI creation logs
};

class Debug {
  /**
   * Log system initialization messages
   */
  static system(...args: any[]): void {
    if (DEBUG_FLAGS.SYSTEM_INIT) {
      console.log(...args);
    }
  }

  /**
   * Log combat and ability messages
   */
  static combat(...args: any[]): void {
    if (DEBUG_FLAGS.COMBAT) {
      console.log(...args);
    }
  }

  /**
   * Log network connection messages
   */
  static network(...args: any[]): void {
    if (DEBUG_FLAGS.NETWORK) {
      console.log(...args);
    }
  }

  /**
   * Log performance messages (usually kept enabled)
   */
  static performance(...args: any[]): void {
    if (DEBUG_FLAGS.PERFORMANCE) {
      console.log(...args);
    }
  }

  /**
   * Log audio system messages
   */
  static audio(...args: any[]): void {
    if (DEBUG_FLAGS.AUDIO) {
      console.log(...args);
    }
  }

  /**
   * Log character loading messages
   */
  static character(...args: any[]): void {
    if (DEBUG_FLAGS.CHARACTER) {
      console.log(...args);
    }
  }

  /**
   * Log UI creation messages
   */
  static ui(...args: any[]): void {
    if (DEBUG_FLAGS.UI) {
      console.log(...args);
    }
  }

  /**
   * Always log (for errors, warnings, important messages)
   */
  static always(...args: any[]): void {
    console.log(...args);
  }

  /**
   * Enable/disable debug categories at runtime
   */
  static setFlag(category: keyof typeof DEBUG_FLAGS, enabled: boolean): void {
    (DEBUG_FLAGS as any)[category] = enabled;
    console.log(`🔧 Debug ${category}: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current debug flag states
   */
  static getFlags(): typeof DEBUG_FLAGS {
    return { ...DEBUG_FLAGS };
  }
}

// Make debug available globally for runtime control
(window as any).debug = Debug;

export default Debug;
