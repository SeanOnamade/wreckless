import * as THREE from 'three';

export interface DummyPosition {
  id: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

export interface DummyPositionData {
  dummyPositions: DummyPosition[];
  totalDummies: number;
  exportedAt: string;
  mapName?: string;
  description?: string;
}

export interface DummyLoaderConfig {
  scene: THREE.Scene;
  world: any; // RAPIER.World
  meleeCombat: any; // MeleeCombat instance
}

// Utility function to convert position object to THREE.Vector3
export function positionToVector3(pos: DummyPosition['position']): THREE.Vector3 {
  return new THREE.Vector3(pos.x, pos.y, pos.z);
}

// Future: DummyLoader class for loading saved positions
// export class DummyLoader {
//   static async loadFromFile(filePath: string, config: DummyLoaderConfig): Promise<TargetDummy[]> {
//     // Implementation for loading dummy positions from saved data
//   }
// } 