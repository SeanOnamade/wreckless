import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Export spawn position for consistent usage - above the upper track
export const SPAWN_POS = new THREE.Vector3(0, 6, 0); // Well above both track levels

export function createFigure8Track(scene: THREE.Scene): THREE.Group {
  const trackGroup = new THREE.Group();
  trackGroup.name = 'TrackGroup';
  
  // New constants for proper scale
  const TRACK_WIDTH = 6; // 6m wide
  const STRAIGHT_LEN = 40; // 40m long straights
  const CURVE_RADIUS = 15; // 15m radius curves
  const WALL_HEIGHT = 1.5; // 1.5m tall walls - can't hop over
  const TRACK_THICK = 0.4; // 40cm thick track
  const WALL_THICKNESS = 0.15; // 15cm thick walls
  
  // Calculate proper crossing clearance
  const CAPSULE_HEIGHT = 1.8; // Standard player capsule height
  const CLEARANCE = 2.2; // Meters between lower top and upper bottom
  const UPPER_Y = TRACK_THICK + CAPSULE_HEIGHT + CLEARANCE; // Proper upper track elevation
  
  // Materials
  const trackMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x666666, // Grey color
    roughness: 0.8,
    metalness: 0.2 
  });
  
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444, // Darker grey for walls
    roughness: 0.9,
    metalness: 0.1 
  });
  
  // Create extended straight segments to connect with curves
  const extendedLength = STRAIGHT_LEN + (CURVE_RADIUS * 2); // Extended to reach curve endpoints
  
  // Straight segment 1 (horizontal) - on ground level
  const straight1Geometry = new THREE.BoxGeometry(extendedLength, TRACK_THICK, TRACK_WIDTH);
  const straight1 = new THREE.Mesh(straight1Geometry, trackMaterial);
  straight1.name = 'Straight1';
  straight1.position.set(0, TRACK_THICK / 2, 0); // Top surface at y = TRACK_THICK
  trackGroup.add(straight1);
  
  // Straight segment 2 (vertical, crossing the first) - elevated
  const straight2Geometry = new THREE.BoxGeometry(TRACK_WIDTH, TRACK_THICK, extendedLength);
  const straight2 = new THREE.Mesh(straight2Geometry, trackMaterial);
  straight2.name = 'Straight2';
  straight2.position.set(0, UPPER_Y + TRACK_THICK / 2, 0); // Elevated crossing
  trackGroup.add(straight2);
  
  // Create curved sections using multiple boxes arranged in arcs
  const curveSegments = 20; // Number of segments per 90° curve for smoother curves
  const segmentAngle = (Math.PI / 2) / curveSegments; // 90° / segments
  const segmentLength = (CURVE_RADIUS * segmentAngle); // Arc length per segment
  
  // Function to create a curved section
  function createCurvedSection(startAngle: number, centerX: number, centerZ: number, yOffset: number = 0, namePrefix: string = 'Curve') {
    const curveGroup = new THREE.Group();
    
    for (let i = 0; i < curveSegments; i++) {
      const angle = startAngle + (i * segmentAngle);
      const segmentGeometry = new THREE.BoxGeometry(segmentLength, TRACK_THICK, TRACK_WIDTH);
      const segment = new THREE.Mesh(segmentGeometry, trackMaterial);
      segment.name = `${namePrefix}_${i}`;
      
      // Position segment along the curve
      const x = centerX + Math.cos(angle) * CURVE_RADIUS;
      const z = centerZ + Math.sin(angle) * CURVE_RADIUS;
      segment.position.set(x, yOffset, z);
      segment.rotation.y = angle + Math.PI / 2; // Rotate to follow curve
      
      curveGroup.add(segment);
    }
    
    return curveGroup;
  }
  
  // Create four curved sections for the figure-8
  const halfExtended = extendedLength / 2;
  const lowerY = TRACK_THICK / 2;
  const upperY = UPPER_Y + TRACK_THICK / 2;
  
  // Position curves at the corners of the figure-8 to connect the extended straights
  const curveDistance = halfExtended; // Distance from center to curve center
  
  // Two curves on lower level (connecting to horizontal straight)
  const topRightCurve = createCurvedSection(0, curveDistance, curveDistance, lowerY, 'TopRightCurve');
  trackGroup.add(topRightCurve);
  
  const topLeftCurve = createCurvedSection(Math.PI / 2, -curveDistance, curveDistance, lowerY, 'TopLeftCurve');
  trackGroup.add(topLeftCurve);
  
  // Two curves on upper level (connecting to vertical straight)
  const bottomLeftCurve = createCurvedSection(Math.PI, -curveDistance, -curveDistance, upperY, 'BottomLeftCurve');
  trackGroup.add(bottomLeftCurve);
  
  const bottomRightCurve = createCurvedSection(3 * Math.PI / 2, curveDistance, -curveDistance, upperY, 'BottomRightCurve');
  trackGroup.add(bottomRightCurve);
  
  // Create side walls for straight segments
  function createSideWalls(length: number, isVertical: boolean = false, yOffset: number = 0, namePrefix: string = 'Wall') {
    const wallGroup = new THREE.Group();
    
    if (isVertical) {
      // Walls for vertical straight segment
      const leftWallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, length);
      const rightWallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, length);
      
      const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
      const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
      
      leftWall.name = `${namePrefix}_Left`;
      rightWall.name = `${namePrefix}_Right`;
      
      leftWall.position.set(-TRACK_WIDTH / 2 - WALL_THICKNESS / 2, WALL_HEIGHT / 2 + yOffset, 0);
      rightWall.position.set(TRACK_WIDTH / 2 + WALL_THICKNESS / 2, WALL_HEIGHT / 2 + yOffset, 0);
      
      wallGroup.add(leftWall, rightWall);
    } else {
      // Walls for horizontal straight segment
      const frontWallGeometry = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
      const backWallGeometry = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
      
      const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
      const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
      
      frontWall.name = `${namePrefix}_Front`;
      backWall.name = `${namePrefix}_Back`;
      
      frontWall.position.set(0, WALL_HEIGHT / 2 + yOffset, TRACK_WIDTH / 2 + WALL_THICKNESS / 2);
      backWall.position.set(0, WALL_HEIGHT / 2 + yOffset, -TRACK_WIDTH / 2 - WALL_THICKNESS / 2);
      
      wallGroup.add(frontWall, backWall);
    }
    
    return wallGroup;
  }
  
  // Add walls for straight segments
  const straight1Walls = createSideWalls(extendedLength, false, lowerY, 'Straight1Wall');
  const straight2Walls = createSideWalls(extendedLength, true, upperY, 'Straight2Wall');
  trackGroup.add(straight1Walls, straight2Walls);
  
  // Create walls for curved sections
  function createCurvedWalls(startAngle: number, centerX: number, centerZ: number, yOffset: number = 0, namePrefix: string = 'CurveWall') {
    const wallGroup = new THREE.Group();
    
    for (let i = 0; i < curveSegments; i++) {
      const angle = startAngle + (i * segmentAngle);
      
      // Inner wall
      const innerWallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, segmentLength);
      const innerWall = new THREE.Mesh(innerWallGeometry, wallMaterial);
      const innerRadius = CURVE_RADIUS - TRACK_WIDTH / 2 - WALL_THICKNESS / 2;
      const innerX = centerX + Math.cos(angle) * innerRadius;
      const innerZ = centerZ + Math.sin(angle) * innerRadius;
      innerWall.name = `${namePrefix}_Inner_${i}`;
      innerWall.position.set(innerX, WALL_HEIGHT / 2 + yOffset, innerZ);
      innerWall.rotation.y = angle + Math.PI / 2;
      
      // Outer wall
      const outerWallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, segmentLength);
      const outerWall = new THREE.Mesh(outerWallGeometry, wallMaterial);
      const outerRadius = CURVE_RADIUS + TRACK_WIDTH / 2 + WALL_THICKNESS / 2;
      const outerX = centerX + Math.cos(angle) * outerRadius;
      const outerZ = centerZ + Math.sin(angle) * outerRadius;
      outerWall.name = `${namePrefix}_Outer_${i}`;
      outerWall.position.set(outerX, WALL_HEIGHT / 2 + yOffset, outerZ);
      outerWall.rotation.y = angle + Math.PI / 2;
      
      wallGroup.add(innerWall, outerWall);
    }
    
    return wallGroup;
  }
  
  // Add walls for curved sections
  const topRightWalls = createCurvedWalls(0, curveDistance, curveDistance, lowerY, 'TopRightWall');
  const topLeftWalls = createCurvedWalls(Math.PI / 2, -curveDistance, curveDistance, lowerY, 'TopLeftWall');
  const bottomLeftWalls = createCurvedWalls(Math.PI, -curveDistance, -curveDistance, upperY, 'BottomLeftWall');
  const bottomRightWalls = createCurvedWalls(3 * Math.PI / 2, curveDistance, -curveDistance, upperY, 'BottomRightWall');
  
  trackGroup.add(topRightWalls, topLeftWalls, bottomLeftWalls, bottomRightWalls);
  
  // Add the track group to the scene
  scene.add(trackGroup);
  
  return trackGroup;
}

/**
 * Creates a static Rapier collider from a THREE.Mesh with BoxGeometry
 * @param mesh - The THREE.Mesh to create a collider for
 * @param world - The Rapier world to add the collider to
 * @returns The created RigidBody
 */
export function createColliderFromMesh(mesh: THREE.Mesh, world: RAPIER.World): RAPIER.RigidBody {
  // Extract the box dimensions from the geometry
  const boundingBox = new THREE.Box3().setFromObject(mesh);
  const size = boundingBox.getSize(new THREE.Vector3());
  
  // Create half-extents for Rapier (cuboid uses half-extents)
  const halfWidth = size.x / 2;
  const halfHeight = size.y / 2;
  const halfDepth = size.z / 2;
  
  // Get world position and rotation
  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  mesh.getWorldPosition(worldPosition);
  mesh.getWorldQuaternion(worldQuaternion);
  
  // Debug logging for position verification (uncomment if needed)
  
  
  // Create rigid body descriptor (static/fixed)
  const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
    .setRotation({
      x: worldQuaternion.x,
      y: worldQuaternion.y,
      z: worldQuaternion.z,
      w: worldQuaternion.w
    });
  
  // Create collider descriptor (cuboid shape with half-extents)
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth);
  
  // Create the rigid body and attach the collider
  const rigidBody = world.createRigidBody(rigidBodyDesc);
  world.createCollider(colliderDesc, rigidBody);
  
  return rigidBody;
}

/**
 * Creates static Rapier colliders for all meshes in a track group
 * @param trackGroup - The THREE.Group containing track meshes
 * @param world - The Rapier world to add colliders to
 * @returns Array of created RigidBodies
 */
export function createTrackColliders(trackGroup: THREE.Group, world: RAPIER.World): RAPIER.RigidBody[] {
  const colliders: RAPIER.RigidBody[] = [];
  
  // Recursively traverse all children in the track group
  trackGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
      const collider = createColliderFromMesh(child, world);
      colliders.push(collider);
    }
  });
  
  return colliders;
} 