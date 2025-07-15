import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface RocketSettings {
  projectileSpeed: number;   // e.g. 50 m/s
  radius: number;           // 4 m blast radius
  force: number;            // base impulse magnitude
  fuse: number;             // max lifetime 1.2 s
}

export const defaultSettings: RocketSettings = {
  projectileSpeed: 50,
  radius: 4,
  force: 36,              // base
  fuse: 1.2
};

// Additional settings for rocket jumping feel
export const PLAYER_MULTIPLIER = 2.5;  // self-launch boost
export const AIRBORNE_MULTIPLIER = 2;  // chain boost

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
  settings: RocketSettings;
  world: RAPIER.World;
  scene: THREE.Scene;
  hasExploded: boolean;
  lastPosition: THREE.Vector3;
  stuckFrames: number;
}

// Global state for active projectiles
const activeProjectiles: Set<ActiveProjectile> = new Set();

/**
 * Rocket Jump - True projectile-based blast
 * Spawns a projectile that explodes on contact or timeout
 */
export function blastJump(
  world: RAPIER.World,
  playerBody: RAPIER.RigidBody,
  camera: THREE.Camera,
  scene: THREE.Scene,
  settings: RocketSettings = defaultSettings
): void {
  // Get camera position and direction
  const cameraPos = camera.position.clone();
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  // Calculate spawn position (muzzle offset)
  const spawnPosition = cameraPos.clone().add(cameraDirection.clone().multiplyScalar(1.0));
  
  // Create projectile mesh (emissive sphere)
  const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 6);
  const projectileMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff4400,
    emissive: 0xff2200,
    emissiveIntensity: 0.5
  });
  const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
  projectileMesh.position.copy(spawnPosition);
  scene.add(projectileMesh);
  
  // Create projectile rigid body (dynamic, with proper mass and damping)
  const projectileBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(spawnPosition.x, spawnPosition.y, spawnPosition.z)
    .setLinearDamping(0.1) // Reduce bouncing
    .setAngularDamping(0.5); // Reduce spinning
  const projectileBody = world.createRigidBody(projectileBodyDesc);
  
  // Create small sphere collider with low restitution (less bouncy)
  const projectileColliderDesc = RAPIER.ColliderDesc.ball(0.2)
    .setMass(2.0) // Heavier projectile
    .setRestitution(0.1) // Low bounciness
    .setFriction(0.8); // High friction to stick to surfaces
  world.createCollider(projectileColliderDesc, projectileBody);
  
  // Set projectile velocity
  const velocity = cameraDirection.clone().multiplyScalar(settings.projectileSpeed);
  projectileBody.setLinvel(velocity, true);
  
  // Create active projectile record
  const projectile: ActiveProjectile = {
    mesh: projectileMesh,
    body: projectileBody,
    spawnTime: Date.now(),
    settings: settings,
    world: world,
    scene: scene,
    hasExploded: false,
    lastPosition: spawnPosition.clone(),
    stuckFrames: 0
  };
  
  activeProjectiles.add(projectile);
  
  console.log(`🚀 Rocket launched at ${settings.projectileSpeed} m/s from position: ${spawnPosition.x.toFixed(1)}, ${spawnPosition.y.toFixed(1)}, ${spawnPosition.z.toFixed(1)}`);
  
  // Dispatch event for visual effects
  window.dispatchEvent(new CustomEvent('abilityUsed', {
    detail: {
      ability: 'rocketJump',
      position: spawnPosition,
      direction: cameraDirection,
      settings: settings
    }
  }));
}

/**
 * Update all active projectiles - check for collisions and fuse timeouts
 */
export function updateBlast(): void {
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
    
    // Check fuse timeout
    const age = (now - projectile.spawnTime) / 1000; // Convert to seconds
    if (age >= projectile.settings.fuse) {
      console.log(`🧨 Rocket fuse expired after ${age.toFixed(2)}s`);
      explodeProjectile(projectile);
      projectilesToRemove.push(projectile);
      continue;
    }
    
    // Improved collision detection - check multiple conditions
    let shouldExplode = false;
    let explodeReason = '';
    
    // Method 1: Check if projectile is stuck (not moving much)
    const distanceMoved = currentPosition.distanceTo(projectile.lastPosition);
    if (distanceMoved < 0.1 && age > 0.1) {
      projectile.stuckFrames++;
      if (projectile.stuckFrames > 3) { // Stuck for 3+ frames
        shouldExplode = true;
        explodeReason = `stuck (moved only ${distanceMoved.toFixed(3)}m)`;
      }
    } else {
      projectile.stuckFrames = 0; // Reset if moving
    }
    
    // Method 2: Check velocity + time (more lenient)
    const velocity = projectile.body.linvel();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    if (speed < 2.0 && age > 0.2) { // Lower threshold, longer delay
      shouldExplode = true;
      explodeReason = `low velocity (${speed.toFixed(1)} m/s)`;
    }
    
    // Method 3: Use Rapier collision detection (most responsive)
    let numContacts = 0;
    projectile.world.contactPairsWith(projectile.body.collider(0)!, (collider2) => {
      numContacts++;
      return true; // Continue checking
    });
    if (numContacts > 0 && age > 0.02) { // Even faster collision response (20ms)
      shouldExplode = true;
      explodeReason = `contact detected (${numContacts} contacts)`;
    }
    
    // Method 4: Check if projectile went below reasonable height (hit ground)
    if (currentPosition.y < -1.0) {
      shouldExplode = true;
      explodeReason = `below ground level (Y=${currentPosition.y.toFixed(1)})`;
    }
    
    if (shouldExplode) {
      console.log(`💥 Rocket collision detected: ${explodeReason}`);
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

/**
 * Explode a projectile at its current position
 */
function explodeProjectile(projectile: ActiveProjectile): void {
  if (projectile.hasExploded) return;
  projectile.hasExploded = true;
  
  const explosionCenter = projectile.body.translation();
  const explosionPos = new THREE.Vector3(explosionCenter.x, explosionCenter.y, explosionCenter.z);
  
  console.log(`💥 EXPLOSION at position: ${explosionPos.x.toFixed(1)}, ${explosionPos.y.toFixed(1)}, ${explosionPos.z.toFixed(1)}`);
  
  // Find all dynamic bodies within blast radius using sphere intersection
  const affectedBodies = findBodiesInExplosionRadius(
    projectile.world, 
    explosionPos, 
    projectile.settings.radius
  );
  
  let affectedCount = 0;
  
  // Apply impulses to all affected bodies using full 3D physics
  for (const bodyData of affectedBodies) {
    const { body, distance } = bodyData;
    
    // Calculate full 3D direction from explosion center to body
    const bodyPos = body.translation();
    const bodyPosition = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
    const dir = bodyPosition.clone().sub(explosionPos);
    
    // Clamp distance to avoid division by zero
    const dist = Math.max(0.2, dir.length());
    
    // Normalize direction for pure directional force
    if (dist > 0.01) {
      dir.normalize();
      
      // Calculate falloff and base impulse
      const falloff = 1 - Math.min(dist / projectile.settings.radius, 1);
      const base = projectile.settings.force * falloff;
      
              if (body.bodyType() === RAPIER.RigidBodyType.KinematicPositionBased) {
          // PLAYER ROCKET JUMPING - KINEMATIC BODY REQUIRES EVENT-BASED APPROACH
          // Kinematic bodies don't respond to impulses, so we send event to controller
          
          // Get current velocity to check if airborne (from rigid body, not controller)
          const currentVel = body.linvel();
          const isPlayerGrounded = Math.abs(currentVel.y) < 0.1;
          
          // Player vs others multiplier
          const scale = PLAYER_MULTIPLIER;
          
          // Airborne bonus
          const airborneBonus = isPlayerGrounded ? 1 : AIRBORNE_MULTIPLIER;
          
          // Calculate final 3D impulse vector (pure directional force)
          const impulseVec = dir.clone().multiplyScalar(base * scale * airborneBonus);
          
          console.log(`🚀 KINEMATIC PLAYER: Sending 3D impulse event (${impulseVec.x.toFixed(1)}, ${impulseVec.y.toFixed(1)}, ${impulseVec.z.toFixed(1)}) with ${airborneBonus}x airborne bonus`);
          
          // Send 3D impulse to controller for manual application
          window.dispatchEvent(new CustomEvent('blastSelfImpulse', {
            detail: { 
              impulse: impulseVec,
              explosionPosition: explosionPos,
              distance: dist,
              isDirectional3D: true
            }
          }));
        
      } else {
        // Apply normal impulse to dynamic bodies
        const impulseVec = dir.clone().multiplyScalar(base);
        body.applyImpulse({
          x: impulseVec.x,
          y: impulseVec.y,
          z: impulseVec.z
        }, true);
        console.log(`🚀 Applied impulse to dynamic body: (${impulseVec.x.toFixed(1)}, ${impulseVec.y.toFixed(1)}, ${impulseVec.z.toFixed(1)})`);
      }
      
      affectedCount++;
    }
  }
  
  console.log(`💥 Rocket explosion affected ${affectedCount} bodies within ${projectile.settings.radius}m radius`);
  
  // Clean up projectile
  cleanupProjectile(projectile);
  
  // Dispatch explosion event
  window.dispatchEvent(new CustomEvent('rocketExplosion', {
    detail: {
      position: explosionPos,
      radius: projectile.settings.radius,
      force: projectile.settings.force,
      affectedCount: affectedCount
    }
  }));
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
  
  // Iterate through all rigid bodies in the world
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
  
  console.log('🧹 Cleaned up rocket projectile');
}

/**
 * Execute blast jump with context
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
  console.log('🧹 Reset blast state - cleaned up all projectiles');
}

/**
 * Get count of active projectiles (for debugging)
 */
export function getActiveProjectileCount(): number {
  return activeProjectiles.size;
} 