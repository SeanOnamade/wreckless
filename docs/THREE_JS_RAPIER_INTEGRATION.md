# Three.js + Rapier Physics Integration Guide

This document explains how **Three.js** (rendering) and **Rapier** (physics) work together in the Wreckless project to create a high-performance, physics-driven 3D game.

## Overview

Wreckless uses a **dual-layer architecture** where Three.js handles all visual rendering while Rapier handles physics simulation. The two systems are synchronized through a shared coordinate system and event-driven communication.

### Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐
│   Three.js      │    │     Rapier      │
│   (Rendering)   │◄──►│   (Physics)     │
├─────────────────┤    ├─────────────────┤
│ • Scene Graph   │    │ • World         │
│ • Meshes        │    │ • RigidBodies   │
│ • Materials     │    │ • Colliders     │
│ • Lighting      │    │ • Joints        │
│ • Camera        │    │ • Forces        │
└─────────────────┘    └─────────────────┘
        │                       │
        └───────────────────────┘
              Event System
```

## Core Setup

### 1. Scene Initialization (`main.ts`)

```typescript
// Three.js Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x99D8F5);

const camera = new THREE.PerspectiveCamera(90, aspectRatio, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

// Rapier Physics Initialization
await RAPIER.init();
const gravity = { x: 0.0, y: -25.0, z: 0.0 };
const world = new RAPIER.World(gravity);
```

**Key Principle**: Three.js creates the visual world, Rapier creates the physics simulation with matching properties.

### 2. Physics Integration (`physics.ts`)

The physics system creates **parallel representations** for objects that need both visual and physical presence:

```typescript
// Visual ground (Three.js)
const groundGeometry = new THREE.BoxGeometry(100, 0.2, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
scene.add(groundMesh);

// Physics ground (Rapier)  
const groundCollider = RAPIER.ColliderDesc.cuboid(50.0, 0.1, 50.0);
world.createCollider(groundCollider);
```

**Key Pattern**: Every visual object that needs physics gets a corresponding Rapier collider with matching dimensions.

## Player Character System

### Kinematic Character Controller (`controller.ts`)

The player uses Rapier's **Kinematic Character Controller** for reliable movement:

```typescript
// Physics body (kinematic = controlled by code, not forces)
const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(SPAWN_POS.x, SPAWN_POS.y, SPAWN_POS.z);
const playerBody = world.createRigidBody(playerBodyDesc);

// Physics shape (capsule for smooth movement)
const playerCollider = RAPIER.ColliderDesc.capsule(height, radius);
world.createCollider(playerCollider, playerBody);

// Character controller for movement and collision
const controller = world.createCharacterController(0.01);
controller.setApplyImpulsesToDynamicBodies(true);
controller.enableAutostep(0.3, 0.1, true);
controller.enableSnapToGround(0.05);
```

**Key Concepts**:
- **Kinematic bodies**: Controlled by code, not physics forces
- **Character controllers**: Handle movement, collision, and ground detection
- **Capsule colliders**: Prevent getting stuck on edges

### Movement Processing

```typescript
update(deltaTime: number) {
  // 1. Process input and calculate desired movement
  const moveVector = this.calculateMovement(deltaTime);
  
  // 2. Test movement against physics world
  this.controller.computeColliderMovement(
    this.playerBody.collider(0)!,
    moveVector,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
  );
  
  // 3. Get the corrected movement from physics
  const movement = this.controller.computedMovement();
  
  // 4. Apply movement to physics body
  const currentPos = this.playerBody.translation();
  this.playerBody.setTranslation({
    x: currentPos.x + movement.x,
    y: currentPos.y + movement.y,
    z: currentPos.z + movement.z
  }, true);
  
  // 5. Sync camera to physics body position
  this.camera.position.set(newPos.x, newPos.y + cameraHeight, newPos.z);
}
```

## Synchronization Loop

The main animation loop keeps physics and rendering synchronized:

```typescript
// Fixed timestep for physics
const fixedTimeStep = 1 / 60; // 60 Hz physics
let accumulator = 0;

function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(clock.getDelta(), 0.1);
  accumulator += deltaTime;
  
  // Fixed timestep physics (always 60 FPS)
  while (accumulator >= fixedTimeStep) {
    if (physicsWorld) {
      physicsWorld.step(fixedTimeStep);
    }
    accumulator -= fixedTimeStep;
  }
  
  // Variable timestep rendering
  renderer.render(scene, camera);
}
```

**Why Fixed Timestep?**
- Ensures consistent physics regardless of frame rate
- Prevents physics simulation from breaking on slow devices
- Makes the game deterministic and reproducible

## Ability Systems Integration

### Blast Jump System (`blast.ts`)

Demonstrates the **physics → rendering** flow:

```typescript
export function blastJump(world: RAPIER.World, camera: THREE.Camera, scene: THREE.Scene) {
  // 1. Create physics projectile
  const projectileBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(startPos.x, startPos.y, startPos.z);
  const projectileBody = world.createRigidBody(projectileBodyDesc);
  
  const colliderDesc = RAPIER.ColliderDesc.ball(0.1);
  world.createCollider(colliderDesc, projectileBody);
  
  // 2. Create visual projectile (follows physics)
  const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
  scene.add(projectileMesh);
  
  // 3. Apply physics force
  const launchVelocity = cameraDirection.multiplyScalar(35);
  projectileBody.setLinvel(launchVelocity, true);
  
  // 4. Visual follows physics every frame (in update loop)
  const translation = projectileBody.translation();
  projectileMesh.position.copy(translation);
}
```

### Grapple Swing System (`grapple.ts`)

Shows advanced physics interaction:

```typescript
export function grappleAttach(context: GrappleAbilityContext) {
  // 1. Raycast to find anchor point (Rapier)
  const ray = new RAPIER.Ray(origin, direction);
  const hit = context.world.castRay(ray, maxDistance, true);
  
  if (hit) {
    // 2. Store anchor point and create visual rope
    swingState.anchorPoint = hitPoint;
    swingState.ropeLength = distance;
    
    // 3. Create visual rope (Three.js)
    const ropeGeometry = new THREE.BufferGeometry();
    const ropeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const ropeLine = new THREE.Line(ropeGeometry, ropeMaterial);
    context.scene.add(ropeLine);
    
    // 4. Apply swing forces via events (see Event System below)
    notifySwingState(true);
  }
}

function updateSwingPhysics(context: GrappleAbilityContext) {
  // Calculate pendulum forces
  const swingForce = calculatePendulumForce(playerPos, anchorPoint, velocity);
  
  // Send forces to controller via events
  window.dispatchEvent(new CustomEvent('swingReleaseImpulse', {
    detail: { velocity: swingForce, reason: 'physics' }
  }));
}
```

## Event-Driven Communication

### Pattern: Loose Coupling

Systems communicate via custom events to maintain separation:

```typescript
// Ability sends impulse to controller
window.dispatchEvent(new CustomEvent('blastSelfImpulse', {
  detail: { 
    impulse: rocketJumpVector,
    explosionPosition: blastCenter,
    isDirectional3D: true,
    isTF2Style: true
  }
}));

// Controller listens for ability events
window.addEventListener('blastSelfImpulse', (event) => {
  const data = event.detail;
  this.handleBlastImpulse(data);
});

// Controller processes physics impulse
private handleBlastImpulse(data: any): void {
  // Apply Y-component to vertical velocity
  this.velocity.y += data.impulse.y;
  
  // Apply horizontal components to movement system
  const horizontalImpulse = new THREE.Vector3(data.impulse.x, 0, data.impulse.z);
  const horizontalSpeed = horizontalImpulse.length();
  
  if (horizontalSpeed > 0.1) {
    horizontalImpulse.normalize();
    this.direction.copy(horizontalImpulse);
    this.currentSpeed = horizontalSpeed;
    this.isRocketJumping = true; // Preserve momentum while airborne
  }
}
```

### Common Event Types

| Event | Purpose | Data |
|-------|---------|------|
| `blastSelfImpulse` | Apply rocket jump force | `{ impulse, explosionPosition, isTF2Style }` |
| `blinkMomentumImpulse` | Apply blink forward momentum | `{ impulse, blinkDirection, distance }` |
| `swingStateChanged` | Track grapple swing state | `{ isSwinging }` |
| `swingReleaseImpulse` | Apply swing release momentum | `{ velocity, reason }` |
| `forceReleaseGrapple` | Emergency grapple cleanup | `{ reason }` |
| `playerRespawn` | Trigger respawn effects | `{ reason, position }` |

## Performance Optimizations

### Memory Management

```typescript
// Reusable vectors (reduce garbage collection)
const tempVector1 = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();

// Use temp vectors instead of creating new ones
tempVector1.copy(playerPosition);
tempVector2.copy(anchorPoint);
tempVector1.sub(tempVector2); // reuse tempVector1 for result

// Always dispose resources
function cleanup() {
  // Three.js cleanup
  mesh.geometry.dispose();
  if (mesh.material instanceof THREE.Material) {
    mesh.material.dispose();
  }
  scene.remove(mesh);
  
  // Rapier cleanup
  world.removeRigidBody(body);
  world.removeCollider(collider);
}
```

### Efficient Collision Filtering

```typescript
// Skip unnecessary collision checks
this.controller.computeColliderMovement(
  this.playerBody.collider(0)!,
  moveVector,
  RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
);

// Use specific collision groups
const colliderDesc = RAPIER.ColliderDesc.ball(0.1)
  .setCollisionGroups(COLLISION_GROUPS.PROJECTILE)
  .setSolverGroups(SOLVER_GROUPS.DYNAMIC);
```

### Texture and Geometry Optimization

```typescript
// Procedural textures instead of large files
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
// ... draw procedural pattern
const texture = new THREE.CanvasTexture(canvas);
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(8, 8); // Tile small texture

// Efficient geometry for simple shapes
const sphereGeometry = new THREE.SphereGeometry(radius, 8, 8); // Low poly
```

## Key Design Patterns

### 1. Physics-Driven Architecture
- **Physics owns truth**: All positions, velocities, and collisions come from Rapier
- **Rendering follows**: Three.js objects sync to physics state every frame
- **Never bypass physics**: Don't directly manipulate Three.js positions

### 2. Separation of Concerns
```typescript
// Physics layer (Rapier)
class PhysicsWorld {
  world: RAPIER.World;
  playerBody: RAPIER.RigidBody;
  step(deltaTime: number): void;
}

// Control layer (Input → Physics)
class FirstPersonController {
  update(deltaTime: number): void; // Converts input to physics movement
}

// Rendering layer (Three.js)
class Renderer {
  render(): void; // Draws current physics state
}

// Game logic layer (Events)
class AbilityManager {
  // Triggers physics changes via events
}
```

### 3. Fixed Physics, Variable Rendering
```typescript
// Physics always runs at 60 Hz
const PHYSICS_TIMESTEP = 1/60;

// Rendering runs at display refresh rate
function animate() {
  requestAnimationFrame(animate);
  
  // Accumulate time for fixed physics steps
  physicsAccumulator += deltaTime;
  while (physicsAccumulator >= PHYSICS_TIMESTEP) {
    world.step(); // Always consistent
    physicsAccumulator -= PHYSICS_TIMESTEP;
  }
  
  // Render at variable rate
  renderer.render(scene, camera);
}
```

### 4. Shared Coordinate System
- **Same units**: 1 Three.js unit = 1 Rapier unit = 1 meter
- **Same handedness**: Both use right-handed Y-up coordinates
- **Same scale**: Player height ~2 units, jump height ~12 units/second

## Debugging and Development Tools

### Physics Visualization

```typescript
// Enable Rapier debug renderer (development only)
if (import.meta.env.DEV) {
  const debugRender = world.debugRender();
  // Render physics shapes as wireframes
}

// Custom debug UI for physics state
class DebugUI {
  update(velocity: THREE.Vector3, grounded: boolean, sliding: boolean) {
    this.velocityDisplay.textContent = `Velocity: ${velocity.length().toFixed(2)} m/s`;
    this.groundedDisplay.textContent = `Grounded: ${grounded}`;
    this.slidingDisplay.textContent = `Sliding: ${sliding}`;
  }
}
```

### Common Debug Information

```typescript
getDebugInfo() {
  const translation = this.playerBody.translation();
  return {
    position: { x: translation.x, y: translation.y, z: translation.z },
    velocity: this.velocity.clone(),
    isGrounded: this.isGrounded,
    currentSpeed: this.currentSpeed,
    isRocketJumping: this.isRocketJumping,
    rocketJumpSpeed: this.rocketJumpSpeed
  };
}
```

## Common Pitfalls and Solutions

### 1. Coordinate System Mismatches
```typescript
// ❌ Wrong: Mixing coordinate systems
mesh.position.set(x, y, z); // Three.js units
body.setTranslation({x: x*2, y: y*2, z: z*2}); // Different scale

// ✅ Correct: Same coordinate system
const pos = body.translation();
mesh.position.set(pos.x, pos.y, pos.z); // 1:1 mapping
```

### 2. Memory Leaks
```typescript
// ❌ Wrong: Not disposing resources
const mesh = new THREE.Mesh(geometry, material);
scene.remove(mesh); // Geometry and material still in memory!

// ✅ Correct: Always dispose
scene.remove(mesh);
mesh.geometry.dispose();
mesh.material.dispose();
```

### 3. Physics Timestep Issues
```typescript
// ❌ Wrong: Variable physics timestep
world.step(deltaTime); // Unstable on slow frames

// ✅ Correct: Fixed timestep with accumulator
while (accumulator >= FIXED_TIMESTEP) {
  world.step(); // Always stable
  accumulator -= FIXED_TIMESTEP;
}
```

### 4. Direct Position Manipulation
```typescript
// ❌ Wrong: Bypassing physics
mesh.position.x += moveSpeed * deltaTime;

// ✅ Correct: Physics-driven movement
const movement = new THREE.Vector3(moveSpeed * deltaTime, 0, 0);
controller.computeColliderMovement(collider, movement);
const correctedMovement = controller.computedMovement();
body.setTranslation(newPosition);
```

## Best Practices Summary

1. **Physics owns truth**: Let Rapier drive all movement and collision
2. **Fixed timestep**: Always use fixed timestep for physics simulation
3. **Event communication**: Use events for loose coupling between systems
4. **Memory management**: Always dispose Three.js and Rapier resources
5. **Shared coordinates**: Keep 1:1 mapping between physics and rendering
6. **Performance first**: Use object pooling, temp vectors, and efficient geometries
7. **Debug early**: Build debugging tools as you develop systems
8. **Test edge cases**: Handle respawning, out-of-bounds, and error states

## Further Reading

- [Rapier.js Documentation](https://rapier.rs/docs/user_guides/javascript/getting_started_js)
- [Three.js Manual](https://threejs.org/manual/)
- [Game Physics Best Practices](https://gafferongames.com/post/integration_basics/)
- [Fixed Timestep Implementation](https://gafferongames.com/post/fix_your_timestep/)

This integration approach provides the **visual fidelity of Three.js** with the **robust physics simulation of Rapier**, creating a solid foundation for high-performance 3D games like Wreckless. 