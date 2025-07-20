import * as THREE from 'three';

/**
 * Collision Clipper Utility
 * Clips collision geometry to remove parts below a Y threshold
 * while preserving track surfaces above the threshold
 */
export class CollisionClipper {
  
  /**
   * Clip geometry to only include parts above Y threshold
   * @param geometry - The geometry to clip
   * @param minY - Minimum Y coordinate to keep
   * @returns Clipped geometry or null if no geometry remains
   */
  static clipGeometryAtY(geometry: THREE.BufferGeometry, minY: number): THREE.BufferGeometry | null {
    const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
    const indexAttribute = geometry.index;
    
    if (!positionAttribute || !indexAttribute) {
      return null;
    }
    
    const positions = positionAttribute.array as Float32Array;
    const indices = indexAttribute.array;
    
    const newVertices: number[] = [];
    const newIndices: number[] = [];
    const vertexMap = new Map<number, number>(); // Original index -> new index
    
    // First pass: collect vertices above threshold
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      if (y >= minY) {
        const newIndex = newVertices.length / 3;
        vertexMap.set(i / 3, newIndex);
        newVertices.push(positions[i], positions[i + 1], positions[i + 2]);
      }
    }
    
    if (newVertices.length === 0) {
      return null; // No vertices above threshold
    }
    
    // Second pass: collect triangles where all vertices are above threshold
    for (let i = 0; i < indices.length; i += 3) {
      const v0 = indices[i];
      const v1 = indices[i + 1]; 
      const v2 = indices[i + 2];
      
      const newV0 = vertexMap.get(v0);
      const newV1 = vertexMap.get(v1);
      const newV2 = vertexMap.get(v2);
      
      // Only include triangle if all vertices are mapped (above threshold)
      if (newV0 !== undefined && newV1 !== undefined && newV2 !== undefined) {
        newIndices.push(newV0, newV1, newV2);
      }
    }
    
    if (newIndices.length === 0) {
      return null; // No triangles remain
    }
    
    // Create new geometry with clipped data
    const clippedGeometry = new THREE.BufferGeometry();
    clippedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newVertices, 3));
    clippedGeometry.setIndex(newIndices);
    clippedGeometry.computeVertexNormals();
    
    return clippedGeometry;
  }
  
  /**
   * Clip geometry to only include parts within a Y range
   * @param geometry - The geometry to clip
   * @param minY - Minimum Y coordinate to keep
   * @param maxY - Maximum Y coordinate to keep
   * @returns Clipped geometry or null if no geometry remains
   */
  static clipGeometryToRange(geometry: THREE.BufferGeometry, minY: number, maxY: number): THREE.BufferGeometry | null {
    const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
    const indexAttribute = geometry.index;
    
    if (!positionAttribute || !indexAttribute) {
      return null;
    }
    
    const positions = positionAttribute.array as Float32Array;
    const indices = indexAttribute.array;
    
    const newVertices: number[] = [];
    const newIndices: number[] = [];
    const vertexMap = new Map<number, number>(); // Original index -> new index
    
    // First pass: collect vertices within Y range
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      if (y >= minY && y <= maxY) {
        const newIndex = newVertices.length / 3;
        vertexMap.set(i / 3, newIndex);
        newVertices.push(positions[i], positions[i + 1], positions[i + 2]);
      }
    }
    
    if (newVertices.length === 0) {
      return null; // No vertices in range
    }
    
    // Second pass: collect triangles where all vertices are in range
    for (let i = 0; i < indices.length; i += 3) {
      const v0 = indices[i];
      const v1 = indices[i + 1]; 
      const v2 = indices[i + 2];
      
      const newV0 = vertexMap.get(v0);
      const newV1 = vertexMap.get(v1);
      const newV2 = vertexMap.get(v2);
      
      // Only include triangle if all vertices are mapped (in range)
      if (newV0 !== undefined && newV1 !== undefined && newV2 !== undefined) {
        newIndices.push(newV0, newV1, newV2);
      }
    }
    
    if (newIndices.length === 0) {
      return null; // No triangles remain
    }
    
    // Create new geometry with clipped data
    const clippedGeometry = new THREE.BufferGeometry();
    clippedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newVertices, 3));
    clippedGeometry.setIndex(newIndices);
    clippedGeometry.computeVertexNormals();
    
    return clippedGeometry;
  }

  /**
   * Filter collision meshes using range clipping to keep only track roadway
   * @param geometries - Array of geometries to process  
   * @param minY - Minimum Y threshold
   * @param maxY - Maximum Y threshold
   * @returns Filtered array of range-clipped geometries
   */
  static clipCollisionGeometriesRange(geometries: THREE.BufferGeometry[], minY: number, maxY: number): THREE.BufferGeometry[] {
    const clippedGeometries: THREE.BufferGeometry[] = [];
    
    for (const geometry of geometries) {
      const clipped = this.clipGeometryToRange(geometry, minY, maxY);
      if (clipped) {
        clippedGeometries.push(clipped);
        if (import.meta.env.DEV) {
          const boundingBox = new THREE.Box3().setFromBufferAttribute(clipped.attributes.position as THREE.BufferAttribute);
          // Debug: Range-clipped geometry (silent for performance)
        }
      }
      // Dispose original geometry
      geometry.dispose();
    }
    
    return clippedGeometries;
  }

  /**
   * Alternative: Filter collision meshes using clipping instead of exclusion
   * @param geometries - Array of geometries to process
   * @param minY - Minimum Y threshold
   * @returns Filtered array of clipped geometries
   */
  static clipCollisionGeometries(geometries: THREE.BufferGeometry[], minY: number): THREE.BufferGeometry[] {
    const clippedGeometries: THREE.BufferGeometry[] = [];
    
    for (const geometry of geometries) {
      const clipped = this.clipGeometryAtY(geometry, minY);
      if (clipped) {
        clippedGeometries.push(clipped);
        if (import.meta.env.DEV) {
          const boundingBox = new THREE.Box3().setFromBufferAttribute(clipped.attributes.position as THREE.BufferAttribute);
          console.log(`🔧 Clipped geometry: Y range ${boundingBox.min.y.toFixed(1)} to ${boundingBox.max.y.toFixed(1)}`);
        }
      }
      // Dispose original geometry
      geometry.dispose();
    }
    
    return clippedGeometries;
  }
} 