import * as THREE from 'three';
import { NetworkManager_Instance as Network } from './Network';

export class MultiplayerManager {
  private scene: THREE.Scene;
  private otherPlayers: Map<string, THREE.Mesh> = new Map();
  private mySocketId: string | null = null;
  private updateInterval: number | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.startUpdateLoop();
    
    if (Network.isNetworkingEnabled()) {
      this.setupRemoteAbilityHandling();
    }
  }

  private startUpdateLoop(): void {
    // Update other players at 20Hz (lighter than server rate)
    this.updateInterval = setInterval(() => {
      this.updateOtherPlayers();
    }, 1000 / 20);
  }

  private updateOtherPlayers(): void {
    if (!Network.isNetworkingEnabled()) return;

    const debugInfo = Network.getDebugInfo() as any;
    if (!debugInfo.lastServerState?.players) return;

    // Get my socket ID
    if (!this.mySocketId) {
      this.mySocketId = debugInfo.socketId;
    }

    const serverPlayers = debugInfo.lastServerState.players;

    // Update/create meshes for other players
    for (const [playerId, playerData] of Object.entries(serverPlayers)) {
      if (playerId === this.mySocketId) continue; // Skip self

      if (!this.otherPlayers.has(playerId)) {
        // Create new player mesh
        this.createPlayerMesh(playerId);
      }

      // Update position and ability states
      const mesh = this.otherPlayers.get(playerId);
      const player = playerData as any;
      if (mesh && player.position) {
        // Calculate position with ability-based offsets
        const baseY = player.position.y + 1; // Slightly above ground for visibility
        let yOffset = 0;
        
        // Real movement based on abilities
        if (player.actions?.jump) {
          yOffset += 0.5; // Jump up
        }
        if (player.actions?.slide || player.states?.isSliding) {
          yOffset -= 0.3; // Slide down
        }
        if (player.states?.isRocketJumping) {
          yOffset += 0.2; // Slight elevation for blast momentum
        }
        
        // Update position with movement offsets
        mesh.position.set(
          player.position.x,
          baseY + yOffset,
          player.position.z
        );
        
        // Update rotation to face camera direction
        if (player.cameraYaw !== undefined) {
          mesh.rotation.y = player.cameraYaw;
        }
        
        // Update visual effects based on ability states
        this.updatePlayerAbilityVisuals(mesh, player);
      }
    }

    // Remove disconnected players
    for (const [playerId, mesh] of this.otherPlayers.entries()) {
      if (!serverPlayers[playerId]) {
        this.scene.remove(mesh);
        this.otherPlayers.delete(playerId);
        console.log('🚪 Player disconnected:', playerId);
        this.showDisconnectNotification(playerId);
      }
    }
  }

  private createPlayerMesh(playerId: string): void {
    // Create a simple colored cube for other players
    const geometry = new THREE.BoxGeometry(1, 2, 1); // Player-sized cube
    const color = this.getPlayerColor(playerId);
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add a simple nametag
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, 256, 64);
    context.fillStyle = 'white';
    context.font = 'bold 20px Arial';
    context.textAlign = 'center';
    context.fillText(playerId.slice(-4), 128, 40); // Show last 4 chars of ID
    
    const texture = new THREE.CanvasTexture(canvas);
    const nametagMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide
    });
    const nametagGeometry = new THREE.PlaneGeometry(2, 0.5);
    const nametag = new THREE.Mesh(nametagGeometry, nametagMaterial);
    nametag.position.y = 2.5; // Above the player cube
    nametag.lookAt(0, 2.5, 1); // Face towards camera direction
    
    mesh.add(nametag);
    
    this.scene.add(mesh);
    this.otherPlayers.set(playerId, mesh);
    
    console.log('👋 New player joined:', playerId, 'as', color);
    this.showJoinNotification(playerId, color);
  }

  private getPlayerColor(playerId: string): number {
    // Generate consistent color based on player ID
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to bright, saturated color
    const hue = Math.abs(hash) % 360;
    return new THREE.Color().setHSL(hue / 360, 0.8, 0.6).getHex();
  }

  private showJoinNotification(playerId: string, color: number): void {
    // Create notification element
    const notification = document.createElement('div');
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    
    // Calculate offset for stacking notifications
    const existingNotifications = document.querySelectorAll('[data-multiplayer-notification]').length;
    const topOffset = 80 + (existingNotifications * 60); // Stack vertically
    
    notification.setAttribute('data-multiplayer-notification', 'true');
    notification.style.cssText = `
      position: fixed;
      top: ${topOffset}px;
      right: 250px;
      background: linear-gradient(135deg, rgba(0, 40, 60, 0.95), rgba(0, 60, 80, 0.95));
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 998;
      border: 2px solid ${colorHex};
      box-shadow: 0 0 20px ${colorHex}40;
      backdrop-filter: blur(5px);
      min-width: 220px;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 12px; height: 12px; background: ${colorHex}; border-radius: 2px;"></div>
        <span>👋 Player joined: ...${playerId.slice(-4)}</span>
      </div>
    `;
    
    // Add CSS animation
    if (!document.querySelector('#multiplayer-animations')) {
      const style = document.createElement('style');
      style.id = 'multiplayer-animations';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
         }, 3000);
   }

  private showDisconnectNotification(playerId: string): void {
    // Create notification element
    const notification = document.createElement('div');
    
    // Calculate offset for stacking notifications
    const existingNotifications = document.querySelectorAll('[data-multiplayer-notification]').length;
    const topOffset = 80 + (existingNotifications * 60); // Stack vertically
    
    notification.setAttribute('data-multiplayer-notification', 'true');
    notification.style.cssText = `
      position: fixed;
      top: ${topOffset}px;
      right: 250px;
      background: linear-gradient(135deg, rgba(60, 20, 20, 0.95), rgba(80, 30, 30, 0.95));
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 998;
      border: 2px solid #ff4444;
      box-shadow: 0 0 20px #ff444440;
      backdrop-filter: blur(5px);
      min-width: 220px;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 12px; height: 12px; background: #ff4444; border-radius: 2px;"></div>
        <span>👋 Player left: ...${playerId.slice(-4)}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Remove all player meshes
    for (const [_, mesh] of this.otherPlayers.entries()) {
      this.scene.remove(mesh);
    }
    this.otherPlayers.clear();
  }

  private updatePlayerAbilityVisuals(mesh: THREE.Mesh, player: any): void {
    if (!mesh.material) return;
    
    const material = mesh.material as THREE.MeshLambertMaterial;
    if (!material) return;
    
    // Reset to base color and scale
    const baseColor = this.getPlayerColor(player.id);
    material.color.setHex(baseColor);
    material.emissive.setHex(0x000000);
    mesh.scale.set(1, 1, 1); // Reset scale
    
    // Subtle visual effects for different ability states (since we show real movement)
    if (player.actions?.jump) {
      // Jumping - slight yellow glow
      material.emissive.setHex(0x221100); // Subtle yellow glow
    }
    
    if (player.actions?.slide || player.states?.isSliding) {
      // Sliding - flatten and blue tint (real visual change)
      mesh.scale.set(1.1, 0.7, 1.1); // Flatten for sliding
      material.emissive.setHex(0x001122); // Blue glow
    }
    
    if (player.states?.isRocketJumping) {
      // Rocket jumping - orange glow (position already shows elevation)
      material.emissive.setHex(0x221100); // Orange glow
    }
    
    if (player.states?.isSwinging) {
      // Swinging - purple glow
      material.emissive.setHex(0x110022); // Purple glow
    }
    
    if (player.states?.isBlinkMomentum) {
      // Blink momentum - cyan glow with subtle pulsing
      material.emissive.setHex(0x002222); // Cyan glow
      const pulseFactor = 1.0 + Math.sin(Date.now() * 0.008) * 0.05; // Subtle pulse
      if (!player.actions?.slide && !player.states?.isSliding) {
        mesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
      }
    }
  }

  private setupRemoteAbilityHandling(): void {
    // For now, just log ability events - positions will be synced through server state
    window.addEventListener('remoteAbilityActivation', (event: Event) => {
      const abilityEvent = (event as CustomEvent).detail;
      console.log(`🎮 Remote ability: ${abilityEvent.abilityType} from ${abilityEvent.fromPlayerId} - position will be synced via server`);
    });
  }
} 