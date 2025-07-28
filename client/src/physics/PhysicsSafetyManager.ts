/**
 * Global Physics Safety Manager
 * 
 * Prevents "recursive use" errors by tracking when it's safe to call Rapier APIs.
 * This manager ensures that all Rapier queries (intersectionsWithShape, contactPairsWith, etc.)
 * are deferred until the physics step is completely finished.
 */
export class PhysicsSafetyManager {
  private static instance: PhysicsSafetyManager;
  private isInPhysicsStep = false;
  private safetyBuffer = 0; // Additional safety buffer time in ms
  private stepStartTime = 0;
  private deferredOperations: Array<() => void> = [];
  
  public static getInstance(): PhysicsSafetyManager {
    if (!PhysicsSafetyManager.instance) {
      PhysicsSafetyManager.instance = new PhysicsSafetyManager();
    }
    return PhysicsSafetyManager.instance;
  }
  
  /**
   * Mark the start of a physics step - all Rapier API calls become unsafe
   */
  public startPhysicsStep(): void {
    this.isInPhysicsStep = true;
    this.stepStartTime = performance.now();
  }
  
  /**
   * Mark the end of a physics step - Rapier API calls become safe again after buffer
   */
  public endPhysicsStep(): void {
    this.isInPhysicsStep = false;
    
    // Add a small safety buffer to ensure step is completely finished
    setTimeout(() => {
      this.processDeferredOperations();
    }, this.safetyBuffer);
  }
  
  /**
   * Check if it's currently safe to call Rapier APIs
   */
  public isSafeForPhysicsQueries(): boolean {
    return !this.isInPhysicsStep;
  }
  
  /**
   * Execute a Rapier API call safely, deferring if necessary
   */
  public safeExecute(operation: () => void, context?: string): void {
    if (this.isSafeForPhysicsQueries()) {
      try {
        operation();
      } catch (error) {
        console.warn(`⚠️ Physics operation failed${context ? ` (${context})` : ''}:`, error);
      }
    } else {
      // Defer the operation until it's safe
      this.deferredOperations.push(() => {
        try {
          operation();
        } catch (error) {
          console.warn(`⚠️ Deferred physics operation failed${context ? ` (${context})` : ''}:`, error);
        }
      });
    }
  }
  
  /**
   * Process all deferred operations that were queued during unsafe periods
   */
  private processDeferredOperations(): void {
    if (this.deferredOperations.length === 0) {
      return;
    }
    
    const operations = this.deferredOperations.splice(0);
    console.log(`🔄 Processing ${operations.length} deferred physics operations`);
    
    for (const operation of operations) {
      operation();
    }
  }
  
  /**
   * Get safety statistics for debugging
   */
  public getStats(): {
    isInStep: boolean,
    deferredCount: number,
    stepDuration: number
  } {
    return {
      isInStep: this.isInPhysicsStep,
      deferredCount: this.deferredOperations.length,
      stepDuration: this.isInPhysicsStep ? performance.now() - this.stepStartTime : 0
    };
  }
  
  /**
   * Clear all deferred operations (emergency cleanup)
   */
  public clearDeferredOperations(): void {
    this.deferredOperations = [];
    console.log('🧹 Cleared all deferred physics operations');
  }
}

// Global convenience functions
export function isSafeForPhysicsQueries(): boolean {
  return PhysicsSafetyManager.getInstance().isSafeForPhysicsQueries();
}

export function safePhysicsExecute(operation: () => void, context?: string): void {
  PhysicsSafetyManager.getInstance().safeExecute(operation, context);
}
