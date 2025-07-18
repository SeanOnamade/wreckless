import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export class DeveloperTools {
  private playerBody: RAPIER.RigidBody;
  private isDevelopment: boolean;

  constructor(playerBody: RAPIER.RigidBody) {
    this.playerBody = playerBody;
    this.isDevelopment = true; // Always enable for testing and debugging
    
    if (this.isDevelopment) {
      this.setupEventListeners();
      console.log('🛠️ Developer Tools enabled:');
      console.log('  📍 Press P to log current position');
      console.log('  📋 Press C to copy position to clipboard');
    }
  }



  private setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        this.logCurrentPosition();
      } else if (e.code === 'KeyC') {
        this.copyPositionToClipboard();
      }
    });
  }

  private logCurrentPosition() {
    const pos = this.getCurrentPosition();
    console.log(`🎯 CHECKPOINT POSITION: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    console.log(`📋 Vector3: new THREE.Vector3(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
  }

  private async copyPositionToClipboard() {
    const pos = this.getCurrentPosition();
    const vectorString = `new THREE.Vector3(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
    
    try {
      await navigator.clipboard.writeText(vectorString);
      console.log(`📋 Copied to clipboard: ${vectorString}`);
      
      // Show temporary feedback
      this.showCopyFeedback();
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  private showCopyFeedback() {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 90px;
      right: 10px;
      background: rgba(0, 150, 0, 0.8);
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      z-index: 1001;
      pointer-events: none;
    `;
    feedback.textContent = 'Copied to clipboard!';
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  }

  public getCurrentPosition(): THREE.Vector3 {
    const translation = this.playerBody.translation();
    return new THREE.Vector3(translation.x, translation.y, translation.z);
  }
} 