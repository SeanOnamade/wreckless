import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ═══ ROCKET JUMP v2 — TRUE TF2 IMPULSE ═══════════════════════════════════════
const ROCKET = {
  radius: 4,            // metres
  baseImpulse: 36,      // raw force coefficient
  playerSelfBoost: 2.5, // multiplier when hit body === local player
  airborneBonus: 2.0,   // extra when !isGrounded
  maxSpeed: 100,        // hard clamp (m/s) only if exceeded
};

export interface BlastAbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  spawnTime: number;
  world: RAPIER.World;
  scene: THREE.Scene;
  hasExploded: boolean;
  lastPosition: THREE.Vector3;
  stuckFrames: number;
}

// Global state for active projectiles
const activeProjectiles: Set<ActiveProjectile> = new Set();

/**
 * TF2-Style Rocket Jump - Spawns projectile from camera/head position
 */
export function blastJump(
  world: RAPIER.World,
  _playerBody: RAPIER.RigidBody,
  camera: THREE.Camera,
  scene: THREE.Scene
): void {
  // SAFETY CHECK: Validate parameters
  if (!world || !camera || !scene) {
    console.error('⚠️ Blast jump execution failed: Invalid parameters provided');
    return;
  }
  // Spawn projectile from head/camera position (0.8m forward offset)
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  const muzzle = camera.position.clone()
    .add(cameraDirection.clone().multiplyScalar(0.8));
  
  // Create projectile mesh (emissive sphere)
  const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 6);
  const projectileMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff4400,
    emissive: 0xff2200,
    emissiveIntensity: 0.5
  });
  const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
  projectileMesh.position.copy(muzzle);
  scene.add(projectileMesh);
  
  // Create projectile rigid body
  const projectileBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(muzzle.x, muzzle.y, muzzle.z)
    .setLinearDamping(0.1)
    .setAngularDamping(0.5);
  const projectileBody = world.createRigidBody(projectileBodyDesc);
  
  // Create collider
  const projectileColliderDesc = RAPIER.ColliderDesc.ball(0.2)
    .setMass(2.0)
    .setRestitution(0.1)
    .setFriction(0.8);
  world.createCollider(projectileColliderDesc, projectileBody);
  
  // Set projectile velocity (50 m/s forward)
  const velocity = cameraDirection.clone().multiplyScalar(50);
  projectileBody.setLinvel(velocity, true);
  
  // Create active projectile record
  const projectile: ActiveProjectile = {
    mesh: projectileMesh,
    body: projectileBody,
    spawnTime: Date.now(),
    world: world,
    scene: scene,
    hasExploded: false,
    lastPosition: muzzle.clone(),
    stuckFrames: 0
  };
  
  activeProjectiles.add(projectile);
  
  console.log(`🚀 TF2 Rocket launched from head position: ${muzzle.x.toFixed(1)}, ${muzzle.y.toFixed(1)}, ${muzzle.z.toFixed(1)}`);
}

/**
 * Update all active projectiles - check for collisions and fuse timeouts
 */
export function updateBlast(): void {
  // PERFORMANCE FIX: Early return if no projectiles to process
  if (activeProjectiles.size === 0) {
    return;
  }
  
  const now = Date.now();
  const projectilesToRemove: ActiveProjectile[] = [];
  
  for (const projectile of activeProjectiles) {
    if (projectile.hasExploded) {
      projectilesToRemove.push(projectile);
      continue;
    }
    
    // Update mesh position to match physics body
    const bodyPos = projectile.body.translation();
    const currentPosition = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
    projectile.mesh.position.copy(currentPosition);
    
    // Check fuse timeout (1.2s)
    const age = (now - projectile.spawnTime) / 1000;
    if (age >= 1.2) {
      console.log(`🧨 TF2 Rocket fuse expired after ${age.toFixed(2)}s`);
      explodeProjectile(projectile);
      projectilesToRemove.push(projectile);
      continue;
    }
    
    // Collision detection - multiple methods
    let shouldExplode = false;
    let explodeReason = '';
    
    // Method 1: Stuck detection
    const distanceMoved = currentPosition.distanceTo(projectile.lastPosition);
    if (distanceMoved < 0.1 && age > 0.1) {
      projectile.stuckFrames++;
      if (projectile.stuckFrames > 3) {
        shouldExplode = true;
        explodeReason = `stuck (moved only ${distanceMoved.toFixed(3)}m)`;
      }
    } else {
      projectile.stuckFrames = 0;
    }
    
    // Method 2: Velocity check
    const velocity = projectile.body.linvel();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    if (speed < 2.0 && age > 0.2) {
      shouldExplode = true;
      explodeReason = `low velocity (${speed.toFixed(1)} m/s)`;
    }
    
    // Method 3: Contact detection (20ms response time)
    let numContacts = 0;
    projectile.world.contactPairsWith(projectile.body.collider(0)!, (_collider2) => {
      numContacts++;
      return true;
    });
    if (numContacts > 0 && age > 0.02) {
      shouldExplode = true;
      explodeReason = `contact detected (${numContacts} contacts)`;
    }
    
    // Method 4: Ground check
    if (currentPosition.y < -1.0) {
      shouldExplode = true;
      explodeReason = `below ground level (Y=${currentPosition.y.toFixed(1)})`;
    }
    
    if (shouldExplode) {
      console.log(`💥 TF2 Rocket collision detected: ${explodeReason}`);
      explodeProjectile(projectile);
      projectilesToRemove.push(projectile);
      continue;
    }
    
    // Update last position for next frame
    projectile.lastPosition.copy(currentPosition);
  }
  
  // Clean up exploded projectiles
  for (const projectile of projectilesToRemove) {
    activeProjectiles.delete(projectile);
  }
}

// Wall collision check function removed since it was causing issues
// Can be re-implemented later if needed

/**
 * TF2-Style Explosion with exact impulse math
 */
function explodeProjectile(projectile: ActiveProjectile): void {
  if (projectile.hasExploded) return;
  projectile.hasExploded = true;
  
  const explosionCenter = projectile.body.translation();
  const explosionPos = new THREE.Vector3(explosionCenter.x, explosionCenter.y, explosionCenter.z);
  
  console.log(`💥 TF2 EXPLOSION at position: ${explosionPos.x.toFixed(1)}, ${explosionPos.y.toFixed(1)}, ${explosionPos.z.toFixed(1)}`);
  
  // Find all bodies within blast radius
  const affectedBodies = findBodiesInExplosionRadius(projectile.world, explosionPos, ROCKET.radius);
  
  let affectedCount = 0;
  
  // Apply TF2-style impulses
  for (const bodyData of affectedBodies) {
    const { body } = bodyData;
    
    // Get player head position (use camera world position if available)
    let playerPoint: THREE.Vector3;
    if (body.bodyType() === RAPIER.RigidBodyType.KinematicPositionBased) {
      // For player, use camera position or body position as head
      const bodyPos = body.translation();
      playerPoint = new THREE.Vector3(bodyPos.x, bodyPos.y + 1.5, bodyPos.z); // Approximate head
    } else {
      // For other bodies, use center
      const bodyPos = body.translation();
      playerPoint = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
    }
    
    // Guard vs walls - raycast from explosion to player (DISABLED for now)
    // if (checkWallCollision(projectile.world, explosionPos, playerPoint)) {
    //   console.log(`⚠️ Skipping impulse due to wall collision`);
    //   continue;
    // }
    
    // ═══ EXACT TF2 IMPULSE MATH ═══
    const dir = playerPoint.clone().sub(explosionPos);
    const dist = Math.max(0.2, Math.min(dir.length(), ROCKET.radius)); // Clamp distance
    dir.normalize(); // Pure direction
    
    const falloff = 1 - (dist / ROCKET.radius); // Linear 0-1 falloff
    
    // Check if this is the local player and if grounded
    const isLocalPlayer = body.bodyType() === RAPIER.RigidBodyType.KinematicPositionBased;
    const currentVel = body.linvel();
    const grounded = Math.abs(currentVel.y) < 0.1;
    
    // Calculate final impulse magnitude
    let impulseMag = ROCKET.baseImpulse * falloff;
    if (isLocalPlayer) {
      impulseMag *= ROCKET.playerSelfBoost;
      if (!grounded) {
        impulseMag *= ROCKET.airborneBonus;
      }
    }
    
    // Final impulse vector
    const impulseVec = dir.clone().multiplyScalar(impulseMag);
    
    // Store pre-impulse velocity for debug
    const preVel = { x: currentVel.x, y: currentVel.y, z: currentVel.z };
    
    if (isLocalPlayer) {
      // KINEMATIC PLAYER - Send event to controller
      console.log(`🚀 TF2 KINEMATIC PLAYER: Sending impulse event`);
      console.log('🚀', { 
        pre: preVel, 
        impulseVec: { x: impulseVec.x, y: impulseVec.y, z: impulseVec.z },
        falloff: falloff,
        grounded: grounded,
        airborneBonus: !grounded ? ROCKET.airborneBonus : 1
      });
      
      window.dispatchEvent(new CustomEvent('blastSelfImpulse', {
        detail: { 
          impulse: impulseVec,
          explosionPosition: explosionPos,
          distance: dist,
          isDirectional3D: true,
          isTF2Style: true
        }
      }));
    } else {
      // DYNAMIC BODY - Apply impulse directly
      body.applyImpulse({
        x: impulseVec.x,
        y: impulseVec.y,
        z: impulseVec.z
      }, true);
      
      const postVel = body.linvel();
      console.log('🚀', { 
        pre: preVel, 
        post: { x: postVel.x, y: postVel.y, z: postVel.z }, 
        impulseVec: { x: impulseVec.x, y: impulseVec.y, z: impulseVec.z }
      });
    }
    
    affectedCount++;
  }
  
  console.log(`💥 TF2 Rocket explosion affected ${affectedCount} bodies within ${ROCKET.radius}m radius`);
  
  // Safety check - if player falls into kill zone, respawn
  setTimeout(() => {
    checkPlayerSafety(projectile.world);
  }, 100);
  
  // Clean up projectile
  cleanupProjectile(projectile);
  
  // Dispatch explosion event
  window.dispatchEvent(new CustomEvent('rocketExplosion', {
    detail: {
      position: explosionPos,
      radius: ROCKET.radius,
      force: ROCKET.baseImpulse,
      affectedCount: affectedCount,
      isTF2Style: true
    }
  }));
}

/**
 * Safety guard - check if player fell into kill zone
 */
function checkPlayerSafety(world: RAPIER.World): void {
  world.forEachRigidBody((body) => {
    if (body.bodyType() === RAPIER.RigidBodyType.KinematicPositionBased) {
      const bodyPos = body.translation();
      if (bodyPos.y < -8) {
        console.log('⚠️ Player fell into kill zone after rocket jump - triggering respawn');
        // Dispatch respawn event
        window.dispatchEvent(new CustomEvent('playerRespawn', {
          detail: { reason: 'killzone', position: bodyPos }
        }));
      }
    }
  });
}

/**
 * Find all bodies within explosion radius using direct iteration
 */
function findBodiesInExplosionRadius(
  world: RAPIER.World,
  center: THREE.Vector3,
  radius: number
): Array<{ body: RAPIER.RigidBody; distance: number }> {
  const bodiesInRadius: Array<{ body: RAPIER.RigidBody; distance: number }> = [];
  
  world.forEachRigidBody((body) => {
    const bodyPos = body.translation();
    const bodyPosition = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
    const distance = center.distanceTo(bodyPosition);
    
    if (distance <= radius) {
      bodiesInRadius.push({ body, distance });
      console.log(`🎯 Found body in explosion radius: ${body.bodyType()}, distance: ${distance.toFixed(2)}m`);
    }
  });
  
  console.log(`💥 Explosion found ${bodiesInRadius.length} bodies within ${radius}m radius`);
  return bodiesInRadius;
}

/**
 * Clean up projectile mesh and physics body
 */
function cleanupProjectile(projectile: ActiveProjectile): void {
  // Remove mesh from scene
  if (projectile.mesh.parent) {
    projectile.scene.remove(projectile.mesh);
  }
  
  // Dispose of geometry and material
  projectile.mesh.geometry.dispose();
  if (projectile.mesh.material instanceof THREE.Material) {
    projectile.mesh.material.dispose();
  }
  
  // Remove physics body
  projectile.world.removeRigidBody(projectile.body);
  
  console.log('🧹 Cleaned up TF2 rocket projectile');
}

/**
 * Execute TF2-style blast jump with context
 */
export function executeBlast(context: BlastAbilityContext): void {
  const { playerBody, world, camera, scene } = context;
  blastJump(world, playerBody, camera, scene);
}

/**
 * Clean up all active projectiles (for scene reset, etc.)
 */
export function resetBlastState(): void {
  for (const projectile of activeProjectiles) {
    cleanupProjectile(projectile);
  }
  activeProjectiles.clear();
  console.log('🧹 Reset TF2 blast state - cleaned up all projectiles');
}

/**
 * Get count of active projectiles (for debugging)
 */
export function getActiveProjectileCount(): number {
  return activeProjectiles.size;
} 