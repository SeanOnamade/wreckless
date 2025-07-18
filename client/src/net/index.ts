// Networking module exports
export { NetworkManager_Instance as Network } from './Network';
export { MultiplayerManager } from './MultiplayerManager';
export type { InputState, ServerState } from './Network';

// Debug: Log networking status on module load
import { NetworkManager_Instance } from './Network';

console.log('📡 Net Module: Loaded, online mode =', NetworkManager_Instance.isNetworkingEnabled());

// Make network manager available on window for debugging (development only)
if (typeof window !== 'undefined') {
  (window as any).debugNetwork = () => NetworkManager_Instance.getDebugInfo();
  (window as any).debugMultiplayer = () => NetworkManager_Instance.debugMultiplayer();
  (window as any).requestServerDebug = () => NetworkManager_Instance.requestServerDebug();
  (window as any).testPositionCorrection = () => NetworkManager_Instance.testPositionCorrection();
  (window as any).testPositionSync = () => NetworkManager_Instance.testPositionSync();
  (window as any).networkStats = () => NetworkManager_Instance.getNetworkStats();
  console.log('🔧 Dev: Access network debug info with window.debugNetwork()');
  console.log('🔧 Dev: Enhanced multiplayer debug with window.debugMultiplayer()');
  console.log('🔧 Dev: Request server debug with window.requestServerDebug()');
  console.log('🔧 Dev: Test position corrections with window.testPositionCorrection()');
  console.log('🔧 Dev: Test position sync with window.testPositionSync()');
  console.log('🔧 Dev: Monitor network performance with window.networkStats()');
} 