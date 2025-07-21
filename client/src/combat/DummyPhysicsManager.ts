import RAPIER from '@dimforge/rapier3d-compat';

// Manager to batch and safely execute all dummy-related physics operations
// This prevents "recursive use" errors by executing operations outside the physics step
export class DummyPhysicsManager {
  private static instance: DummyPhysicsManager;
  private pendingOperations: Array<() => void> = [];
  private isProcessing = false;
  
  public static getInstance(): DummyPhysicsManager {
    if (!DummyPhysicsManager.instance) {
      DummyPhysicsManager.instance = new DummyPhysicsManager();
    }
    return DummyPhysicsManager.instance;
  }
  
  /**
   * Queue a physics operation to be executed safely outside the physics step
   */
  public queuePhysicsOperation(operation: () => void): void {
    this.pendingOperations.push(operation);
    
    // Process operations in next idle callback or frame
    if (!this.isProcessing) {
      this.processOperations();
    }
  }
  
  /**
   * Safely disable a dummy's rigid body
   */
  public queueDisableRigidBody(rigidBody: RAPIER.RigidBody, dummyId: string): void {
    if (!rigidBody) {
      console.warn(`⚠️ Cannot disable dummy ${dummyId}: null rigidBody`);
      return;
    }
    
    this.queuePhysicsOperation(() => {
      try {
        if (rigidBody && !rigidBody.isSleeping() && rigidBody.isValid()) {
          rigidBody.setEnabled(false);
          console.log(`🔒 Dummy ${dummyId} physics disabled (deferred)`);
        }
      } catch (error) {
        console.warn(`⚠️ Error disabling dummy ${dummyId} physics:`, error);
      }
    });
  }
  
  /**
   * Safely enable a dummy's rigid body
   */
  public queueEnableRigidBody(rigidBody: RAPIER.RigidBody, dummyId: string): void {
    if (!rigidBody) {
      console.warn(`⚠️ Cannot enable dummy ${dummyId}: null rigidBody`);
      return;
    }
    
    this.queuePhysicsOperation(() => {
      try {
        if (rigidBody && rigidBody.isValid()) {
          rigidBody.setEnabled(true);
          console.log(`🔓 Dummy ${dummyId} physics enabled (deferred)`);
        }
      } catch (error) {
        console.warn(`⚠️ Error enabling dummy ${dummyId} physics:`, error);
      }
    });
  }
  
  /**
   * Safely set rigid body translation
   */
  public queueSetTranslation(rigidBody: RAPIER.RigidBody, translation: { x: number, y: number, z: number }, wake: boolean, dummyId: string): void {
    if (!rigidBody) {
      console.warn(`⚠️ Cannot set translation for dummy ${dummyId}: null rigidBody`);
      return;
    }
    
    this.queuePhysicsOperation(() => {
      try {
        if (rigidBody && rigidBody.isValid()) {
          rigidBody.setTranslation(translation, wake);
          console.log(`📍 Dummy ${dummyId} position updated (deferred)`);
        }
      } catch (error) {
        console.warn(`⚠️ Error updating dummy ${dummyId} position:`, error);
      }
    });
  }
  
  /**
   * Process all pending operations using browser idle time
   */
  private processOperations(): void {
    if (this.isProcessing || this.pendingOperations.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    const executeOperations = () => {
      // Process operations in batches to avoid blocking
      const batchSize = Math.min(5, this.pendingOperations.length);
      const batch = this.pendingOperations.splice(0, batchSize);
      
      batch.forEach(operation => {
        try {
          operation();
        } catch (error) {
          console.warn('⚠️ Dummy physics operation error:', error);
        }
      });
      
      // Continue processing if more operations are queued
      if (this.pendingOperations.length > 0) {
        // Use requestIdleCallback for smooth processing
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(executeOperations);
        } else {
          setTimeout(executeOperations, 0);
        }
      } else {
        this.isProcessing = false;
      }
    };
    
    // Start processing with maximum safety
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(executeOperations);
    } else {
      setTimeout(executeOperations, 16); // ~1 frame delay
    }
  }
  
  /**
   * Get stats for debugging
   */
  public getStats(): { pending: number, processing: boolean } {
    return {
      pending: this.pendingOperations.length,
      processing: this.isProcessing
    };
  }
  
  /**
   * Clear all pending operations and reset state
   */
  public dispose(): void {
    this.pendingOperations = [];
    this.isProcessing = false;
    console.log('🧹 DummyPhysicsManager disposed');
  }
} 