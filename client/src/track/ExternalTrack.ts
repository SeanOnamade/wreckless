import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export const SPAWN_POS = new THREE.Vector3(0, 2.0, 0); // 2m above ground to clear road surface

export async function loadExternalTrack(scene: THREE.Scene, world: RAPIER.World): Promise<void> {
  try {
    // Import required utilities
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const BufferGeometryUtils = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
    
    if (import.meta.env.DEV) {
    console.log('Loading lowpoly_racetrack.glb...');
  }
    
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/lowpoly_racetrack.glb');
    const track = gltf.scene;
    
    // Scale and position the track
    track.scale.setScalar(2);          // enlarge to match capsule scale
    track.position.y = 0;              // road sits on ground plane
    
    // Collect all meshes for collision (since GLB uses generic names like Object_XXX)
    const allMeshes: THREE.Mesh[] = [];
    const collisionGeometries: THREE.BufferGeometry[] = [];
    
    if (import.meta.env.DEV) {
      console.log('🏁 Loading track collision from all meshes...');
    }
    
    // Collect all meshes and process them for collision
    track.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        allMeshes.push(child);
        
        // Enable shadows for better visual quality
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Add all meshes to collision (GLB uses generic Object_XXX names)
        child.updateWorldMatrix(true, false);
        const geometry = child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);
        collisionGeometries.push(geometry);
      }
    });
    
    if (import.meta.env.DEV) {
      console.log(`📊 Processing ${allMeshes.length} meshes for collision...`);
    }
    
    // Add the visual track to the scene
    scene.add(track);
    
    if (collisionGeometries.length === 0) {
      console.error('❌ No meshes found at all! Creating simple ground plane...');
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const collider = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
      world.createCollider(collider, body);
    } else {
      if (import.meta.env.DEV) {
      console.log(`🔗 Merging ${collisionGeometries.length} geometries for collision...`);
    }
      
      // Merge all geometries into a single collision mesh
      const mergedGeometry = BufferGeometryUtils.mergeGeometries(collisionGeometries);
      
      if (mergedGeometry) {
        // Generate trimesh collider from merged geometry
        const positionAttribute = mergedGeometry.getAttribute('position');
        const indexAttribute = mergedGeometry.getIndex();
        
                 if (positionAttribute && indexAttribute) {
           const vertices = positionAttribute.array as Float32Array;
           const indices = indexAttribute.array as Uint32Array;
           
           // Create the collision body and trimesh collider directly
           const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
           const collider = RAPIER.ColliderDesc.trimesh(vertices, indices);
           world.createCollider(collider, body);
           
           if (import.meta.env.DEV) {
      console.log(`✅ Trimesh collider created with ${vertices.length / 3} vertices and ${indices.length / 3} triangles`);
    }
           
           // Add invisible safety rail around track perimeter
           const bb = new THREE.Box3().setFromBufferAttribute(positionAttribute as THREE.BufferAttribute);
           const curbH = 0.1; // 10cm high
           const curbPad = 0.5; // 50cm padding around track
           
           const curbBody = world.createRigidBody(
             RAPIER.RigidBodyDesc.fixed()
               .setTranslation(
                 (bb.min.x + bb.max.x) / 2,
                 bb.min.y + curbH / 2,
                 (bb.min.z + bb.max.z) / 2
               )
           );
           
           world.createCollider(
             RAPIER.ColliderDesc.cuboid(
               (bb.max.x - bb.min.x + curbPad * 2) / 2,
               curbH / 2,
               (bb.max.z - bb.min.z + curbPad * 2) / 2
             ),
             curbBody
           );
           
           if (import.meta.env.DEV) {
      console.log(`🛡️  Safety rail added around track perimeter`);
    }
           
         } else {
           console.error('❌ Failed to extract position/index data from merged geometry');
         }
        
                 // Clean up temporary geometries
         collisionGeometries.forEach((geo: THREE.BufferGeometry) => geo.dispose());
        mergedGeometry.dispose();
      } else {
        console.error('❌ Failed to merge road geometries');
      }
    }
    
    if (import.meta.env.DEV) {
      console.log(`✅ Lowpoly racetrack loaded successfully!`);
    }
    
  } catch (error) {
    console.error('❌ Error loading lowpoly racetrack:', error);
    
    // Fallback to simple placeholder track
    if (import.meta.env.DEV) {
      console.log('🔄 Loading fallback placeholder track...');
    }
    const trackGeometry = new THREE.BoxGeometry(50, 0.4, 10);
    const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.position.y = 0.4;
    scene.add(track);

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const collider = RAPIER.ColliderDesc.cuboid(25, 0.2, 5);
    world.createCollider(collider, body);
    
    if (import.meta.env.DEV) {
      console.log('📦 Fallback placeholder track loaded.');
    }
  }
} 