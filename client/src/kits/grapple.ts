import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SWING } from './swingConfig';
import { getCurrentPlayerKit, getRemainingCooldown } from './classKit';

export interface GrappleAbilityContext {
  playerBody: RAPIER.RigidBody;
  world: RAPIER.World;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

export interface GrappleState {
  isSwinging: boolean;
  anchorPoint: THREE.Vector3 | null;
  ropeLength: number;
  hookMesh: THREE.Mesh | null;
  ropeLine: THREE.Mesh | null; // Changed from Line to Mesh for tube geometry
  predictionMesh: THREE.Mesh | null;
  attachTime: number;
  lastInputTime: number; // Track for auto-release
  
  // Hook flash animation
  hookFlashStartTime: number;
  hookFlashDuration: number;
}

// Global swing state
let swingState: GrappleState = {
  isSwinging: false,
  anchorPoint: null,
  ropeLength: 0,
  hookMesh: null,
  ropeLine: null,
  predictionMesh: null,
  attachTime: 0,
  lastInputTime: 0,
  hookFlashStartTime: 0,
  hookFlashDuration: 300 // 300ms flash
};

// Rope smoothing state (like trail system)
let ropeSmoothing = {
  lastPlayerPosition: null as THREE.Vector3 | null,
  smoothedPlayerPosition: null as THREE.Vector3 | null,
  lastVelocity: new THREE.Vector3(),
  lastUpdateTime: 0,
  updateFrequency: 8, // Higher frequency for more responsive rope
  smoothingFactor: 0.8, // Much more responsive - less lag
  velocitySmoothing: 0.9 // Less velocity smoothing for immediate response
};

// Pressed keys tracking for air control
const pressedKeys = new Set<string>();

// PERFORMANCE OPTIMIZATION: Reusable vectors to reduce GC pressure
const tempVector1 = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();

// MEMORY FIX: Store event listener references for proper cleanup
let forceReleaseListener: ((event: Event) => void) | null = null;
let classChangeListener: ((event: Event) => void) | null = null;

// Initialize event listeners (call this once during setup)
function initializeGrappleEventListeners(): void {
  if (forceReleaseListener || classChangeListener) {
    return; // Already initialized
  }

  // Listen for forced grapple release (during respawn, etc.)
  forceReleaseListener = (event: Event) => {
    const customEvent = event as CustomEvent;
    const reason = customEvent.detail?.reason || 'forced';
    
    if (swingState.isSwinging) {
      // Create a dummy context for cleanup - we only need scene for visual cleanup
      const dummyContext = {
        scene: swingState.hookMesh?.parent || swingState.ropeLine?.parent
      } as any;
      
      if (dummyContext.scene) {
        releaseSwing(reason, dummyContext);
      } else {
        // Manual cleanup if no scene reference - add prediction sphere cleanup
        swingState.isSwinging = false;
        swingState.anchorPoint = null;
        swingState.ropeLength = 0;
        swingState.attachTime = 0;
        swingState.lastInputTime = 0;
        
        // MEMORY FIX: Clean up prediction sphere if it exists
        if (swingState.predictionMesh && swingState.predictionMesh.parent) {
          swingState.predictionMesh.parent.remove(swingState.predictionMesh);
          swingState.predictionMesh.geometry.dispose();
          if (swingState.predictionMesh.material instanceof THREE.Material) {
            swingState.predictionMesh.material.dispose();
          }
          swingState.predictionMesh = null;
        }
        
        notifySwingState(false);
      }
    }
  };

  // Listen for class changes to hide prediction sphere when switching away from grapple
  classChangeListener = (event: Event) => {
    const customEvent = event as CustomEvent;
    const newClass = customEvent.detail.className;
    
    // Hide prediction sphere immediately when switching away from grapple class
    if (newClass !== 'grapple' && swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
  };

  window.addEventListener('forceReleaseGrapple', forceReleaseListener);
  window.addEventListener('playerClassChanged', classChangeListener);
}

// Auto-initialize on first import
initializeGrappleEventListeners();

/**
 * TRUE PENDULUM SWING - Sphere constraint with momentum preservation
 */
export function executeGrapple(context: GrappleAbilityContext): void {
  // SAFETY CHECK: Validate context parameters using type guard
  if (!context || !context.playerBody || !context.world || !context.camera || !context.scene) {
    console.error('⚠️ Grapple execution failed: Invalid context provided');
    return;
  }
  
  const { playerBody, world, camera, scene } = context;
  
  // SFX: Play grapple shoot sound immediately when fired
  window.dispatchEvent(new CustomEvent('sfxRequest', {
    detail: { category: 'abilities', filename: 'grapple_shoot.wav' }
  }));
  
  // If already swinging, release
  if (swingState.isSwinging) {
    releaseSwing("manual", context);
    return;
  }
  
  // Get player position and camera direction
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  // Perform raycast
  const hit = performGrappleRaycast(world, playerPosition, direction);
  
  if (hit) {
    const anchorPoint = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
    
    // Validate grapple target (must be above player) - reasonable validation
    if (anchorPoint.y <= playerPosition.y + 2.0) { // Must be at least 2m above player
      // Grapple blocked: anchor too low
      // NO COOLDOWN - just block the attempt
      return;
    }
    
    // Initialize swing state
    swingState.isSwinging = true;
    swingState.anchorPoint = anchorPoint.clone();
    swingState.ropeLength = Math.max(hit.distance - 0.5, SWING.minRope);
    swingState.attachTime = Date.now();
    swingState.lastInputTime = Date.now();
    
    // Reset rope smoothing for clean start
    ropeSmoothing.lastPlayerPosition = playerPosition.clone();
    ropeSmoothing.smoothedPlayerPosition = playerPosition.clone();
    ropeSmoothing.lastVelocity.set(0, 0, 0);
    ropeSmoothing.lastUpdateTime = 0;
    
    // Create visuals
    createSwingVisuals(scene, anchorPoint, playerPosition);
    
    // Trigger hook flash animation
    swingState.hookFlashStartTime = Date.now();
    
    // SFX: Play grapple latch sound on successful attachment
    window.dispatchEvent(new CustomEvent('sfxRequest', {
      detail: { category: 'abilities', filename: 'grapple_latch.wav' }
    }));
    
    // Trigger green latch ring effect
    window.dispatchEvent(new CustomEvent('grappleLatch', {
      detail: {
        position: anchorPoint,
        timestamp: Date.now()
      }
    }));
    
    // Hide prediction sphere
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
    
    // Notify controller of swing state
    notifySwingState(true);
    
    // Debug: Swing attached (silent for performance)
    
  } else {
    // Grapple missed - no valid target
    // NO COOLDOWN - allow immediate retry
  }
}

/**
 * Perform raycast for grapple targeting
 */
function performGrappleRaycast(world: RAPIER.World, origin: THREE.Vector3, direction: THREE.Vector3) {
  // Offset ray start to avoid self-collision
  const rayOrigin = origin.clone().add(direction.clone().multiplyScalar(0.5));
  
  const ray = new RAPIER.Ray(rayOrigin, direction);
  const hit = world.castRay(ray, SWING.maxDistance, true);
  
  if (hit) {
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    const result = {
      point: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
      distance: hit.timeOfImpact + 0.5 // Add back offset
    };
    
    return result;
  }
  
  return null;
}

/**
 * CORE PENDULUM PHYSICS - True sphere constraint
 * Based on "ADVANCED SWINGING in 9 MINUTES" methodology
 */
function applyPendulumConstraint(context: GrappleAbilityContext): void {
  if (!swingState.isSwinging || !swingState.anchorPoint) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  
  // PERFORMANCE FIX: Reuse temp vectors instead of creating new ones
  tempVector1.set(playerPos.x, playerPos.y, playerPos.z); // playerPosition
  
  // Step 1: Compute ropeVec = playerPos - anchor
  tempVector2.copy(tempVector1).sub(swingState.anchorPoint); // ropeVec
  const currentDistance = tempVector2.length();
  
  // Step 2: If distance > ropeLength + slack, apply sphere constraint
  const effectiveRopeLength = swingState.ropeLength + SWING.ropeSlack;
  if (currentDistance > effectiveRopeLength) {
    
    // Project player onto sphere surface (using effective rope length)
    tempVector3.copy(swingState.anchorPoint)
      .add(tempVector2.normalize().multiplyScalar(effectiveRopeLength)); // constrainedPosition
    
    // Get current velocity - reuse tempVector1
    const currentVel = playerBody.linvel();
    tempVector1.set(currentVel.x, currentVel.y, currentVel.z); // velocity
    
    // Step 3: Decompose velocity into radial and tangential components
    const ropeDirection = tempVector2.normalize(); // tempVector2 is already normalized from above
    const radialVelocity = tempVector1.dot(ropeDirection); // v_r (outward) - tempVector1 is velocity
    const tangentialVelocity = tempVector1.clone().sub(ropeDirection.clone().multiplyScalar(radialVelocity)); // v_t
    
    // Step 4: Handle radial velocity based on constraint
    let newRadialVelocity = 0;
    if (radialVelocity > 0) {
      // Moving away from anchor - zero or reflect with low elasticity
      newRadialVelocity = -radialVelocity * SWING.elasticity;
    } else {
      // Moving toward anchor - preserve
      newRadialVelocity = radialVelocity;
    }
    
    // Step 5: Reconstruct velocity with preserved tangential component
    const newVelocity = tangentialVelocity.add(ropeDirection.multiplyScalar(newRadialVelocity));
    
    // Apply constraint: position and velocity
    playerBody.setTranslation(tempVector3, true); // tempVector3 is constrainedPosition
    playerBody.setLinvel(newVelocity, true);
    

  }
}

/**
 * Handle air control while swinging
 */
function handleAirControl(context: GrappleAbilityContext, deltaTime: number): void {
  if (!swingState.isSwinging) return;
  
  const { playerBody, camera } = context;
  let hasInput = false;
  
  // Get camera orientation for control directions
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  const cameraRight = new THREE.Vector3();
  camera.getWorldDirection(cameraRight);
  cameraRight.cross(camera.up).normalize();
  
  const forceVector = new THREE.Vector3();
  
  // A/D - Lateral tangential forces
  if (pressedKeys.has('KeyA')) {
    forceVector.add(cameraRight.clone().negate().multiplyScalar(SWING.lateralForce));
    hasInput = true;
  }
  if (pressedKeys.has('KeyD')) {
    forceVector.add(cameraRight.multiplyScalar(SWING.lateralForce));
    hasInput = true;
  }
  
  // W - Forward tangential force
  if (pressedKeys.has('KeyW')) {
    forceVector.add(cameraDirection.multiplyScalar(SWING.forwardForce));
    hasInput = true;
  }
  
  // Space - Pull in (shorten rope)
  if (pressedKeys.has('Space')) {
    swingState.ropeLength = Math.max(swingState.ropeLength - SWING.shortenRate * deltaTime, SWING.minRope);
    
    // Apply inward pull force
    if (swingState.anchorPoint) {
      const playerPos = playerBody.translation();
      const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      const pullDirection = swingState.anchorPoint.clone().sub(playerPosition).normalize();
      forceVector.add(pullDirection.multiplyScalar(SWING.pullForce));
    }
    
    hasInput = true;
  }
  
  // S - Let out (extend rope)
  if (pressedKeys.has('KeyS')) {
    swingState.ropeLength = Math.min(swingState.ropeLength + SWING.extendRate * deltaTime, SWING.maxRope);
    hasInput = true;
  }
  
  // Apply combined forces
  if (forceVector.length() > 0) {
    playerBody.applyImpulse(forceVector, true);
  }
  
  // Update input time for auto-release
  if (hasInput) {
    swingState.lastInputTime = Date.now();
  }
}

/**
 * Check auto-release conditions
 */
function checkAutoRelease(context: GrappleAbilityContext): void {
  if (!swingState.isSwinging) return;
  
  const currentTime = Date.now();
  const timeSinceInput = (currentTime - swingState.lastInputTime) / 1000;
  
  // Auto-release after no input
  if (timeSinceInput > SWING.maxSwingTime) {
    releaseSwing("auto_timeout", context);
    return;
  }
  
  // Auto-release if rope too long
  if (swingState.ropeLength >= SWING.autoReleaseDistance) {
    releaseSwing("overstretch", context);
    return;
  }
}

/**
 * Release swing and restore normal physics
 */
function releaseSwing(reason: string, context: GrappleAbilityContext): void {
  if (!swingState.isSwinging) return;
  
  const { scene } = context;
  
  // Remove visuals with proper disposal to prevent memory leaks
  if (swingState.hookMesh) {
    scene.remove(swingState.hookMesh);
    // MEMORY FIX: Dispose of geometry and material
    swingState.hookMesh.geometry.dispose();
    if (swingState.hookMesh.material instanceof THREE.Material) {
      swingState.hookMesh.material.dispose();
    }
    swingState.hookMesh = null;
  }
  
  if (swingState.ropeLine) {
    scene.remove(swingState.ropeLine);
    // MEMORY FIX: Dispose of geometry and material
    swingState.ropeLine.geometry.dispose();
    if (swingState.ropeLine.material instanceof THREE.Material) {
      swingState.ropeLine.material.dispose();
    }
    swingState.ropeLine = null;
  }
  
  // Reset state
  swingState.isSwinging = false;
  swingState.anchorPoint = null;
  swingState.ropeLength = 0;
  swingState.attachTime = 0;
  swingState.lastInputTime = 0;
  swingState.hookFlashStartTime = 0;
  
  // Reset rope smoothing
  ropeSmoothing.lastPlayerPosition = null;
  ropeSmoothing.smoothedPlayerPosition = null;
  ropeSmoothing.lastVelocity.set(0, 0, 0);
  ropeSmoothing.lastUpdateTime = 0;
  
  // Capture current momentum before notifying controller (with null check)
  let releaseVelocity = new THREE.Vector3(0, 0, 0);
  if (context.playerBody) {
    const currentVel = context.playerBody.linvel();
    releaseVelocity = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z);
    
    // SWING ARC MOMENTUM BOOST: Add extra upward momentum at bottom of swing arc
    if (swingState.anchorPoint && swingState.isSwinging) {
      const playerPos = context.playerBody.translation();
      const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      const anchorPoint = swingState.anchorPoint as THREE.Vector3; // Explicit type assertion
      const heightDiff = anchorPoint.y - playerPosition.y;
      const horizontalSpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);
      
      // If player is below anchor point and has significant horizontal speed (bottom of arc)
      if (heightDiff > swingState.ropeLength * 0.7 && horizontalSpeed > 5.0) {
        const arcBoost = Math.min(horizontalSpeed * 0.4, 15.0); // Convert some horizontal speed to upward
        releaseVelocity.y += arcBoost;
        
        // Dispatch swing bottom event for combat system
        window.dispatchEvent(new CustomEvent('grappleSwingBottom', {
          detail: { timestamp: Date.now(), horizontalSpeed }
        }));
      }
    }
  } else {
    console.warn('⚠️ Grapple release: playerBody is null during cleanup (likely during respawn)');
  }
  
  // Send swing momentum to controller (like blast impulse)
  window.dispatchEvent(new CustomEvent('swingReleaseImpulse', {
    detail: { 
      velocity: releaseVelocity,
      reason: reason
    }
  }));
  
  // Notify controller
  notifySwingState(false);
  
  // Apply cooldown when swing is actually released (this is the only place cooldown is set for grapple)
  const kit = getCurrentPlayerKit();
  const remainingCooldown = getRemainingCooldown(kit);
  
  if (remainingCooldown <= 0) {
    // Set proper cooldown using the ability system
    kit.ability.lastUsed = Date.now();
    kit.ability.isReady = false;
  }
  
  // Debug: Swing released (silent for performance)
  
  // Dispatch grapple detach event for combat system
  window.dispatchEvent(new CustomEvent('grappleDetached', {
    detail: { reason, timestamp: Date.now() }
  }));
}

/**
 * Update prediction sphere when not swinging
 */
function updatePredictionSphere(context: GrappleAbilityContext): void {
  const { world, camera, scene } = context;
  
  // Only show grapple prediction for grapple class players
  const currentKit = getCurrentPlayerKit();
  if (currentKit.className !== 'grapple') {
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
    return;
  }
  
  if (swingState.isSwinging) {
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
    return;
  }
  
  const playerBody = context.playerBody;
  const playerPos = playerBody.translation();
  const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  const hit = performGrappleRaycast(world, playerPosition, direction);
  
    // Check for valid grapple target
  
  if (hit && hit.distance > 1.0 && hit.point.y > playerPosition.y + 2.0) { // Must be at least 2m above player
    // Valid grapple target found
    
    // Create prediction sphere if needed
    if (!swingState.predictionMesh) {
      const geometry = new THREE.SphereGeometry(0.2, 8, 6);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x90EE90, // Light green
        transparent: true, 
        opacity: 0.7 
      });
      swingState.predictionMesh = new THREE.Mesh(geometry, material);
      scene.add(swingState.predictionMesh);
    }
    
    // Position sphere at hit point
    const hitPoint = hit.point;
    const offset = direction.clone().negate().multiplyScalar(0.3);
    const displayPosition = hitPoint.clone().add(offset);
    
    swingState.predictionMesh.position.copy(displayPosition);
    swingState.predictionMesh.visible = true;
    
  } else {
    // No valid target or target invalid
    if (swingState.predictionMesh) {
      swingState.predictionMesh.visible = false;
    }
  }
}

/**
 * Create curved rope geometry using catenary curve for realistic sag
 */
function createCurvedRopeGeometry(playerPos: THREE.Vector3, anchorPoint: THREE.Vector3): THREE.TubeGeometry {
  const ropeDistance = playerPos.distanceTo(anchorPoint);
  const segments = Math.max(8, Math.floor(ropeDistance * 2)); // More segments for longer ropes
  const sagAmount = Math.min(ropeDistance * 0.15, 3); // 15% sag, max 3 meters
  
  // Create curve points for catenary (rope sag under gravity)
  const curvePoints: THREE.Vector3[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Linear interpolation between player and anchor
    const x = playerPos.x + (anchorPoint.x - playerPos.x) * t;
    const z = playerPos.z + (anchorPoint.z - playerPos.z) * t;
    
    // Catenary curve for Y (simplified parabolic sag)
    const baseY = playerPos.y + (anchorPoint.y - playerPos.y) * t;
    const sagFactor = 4 * t * (1 - t); // Parabolic sag (0 at endpoints, max at middle)
    const y = baseY - sagAmount * sagFactor;
    
    curvePoints.push(new THREE.Vector3(x, y, z));
  }
  
  // Create smooth curve from points
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  
  // Create tube geometry following the curve
  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.02, 6, false);
  
  return tubeGeometry;
}

/**
 * Create visual elements (hook + rope)
 */
function createSwingVisuals(scene: THREE.Scene, anchorPoint: THREE.Vector3, playerPos: THREE.Vector3): void {
  // Hook sphere at anchor - enhanced with emissive glow
  const hookGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  const hookMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x006600, // Dark green
    emissive: 0x004400, // Dark green glow
    emissiveIntensity: 0.6
  });
  swingState.hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
  swingState.hookMesh.position.copy(anchorPoint);
  scene.add(swingState.hookMesh);
  
  // Curved rope using tube geometry with multiple segments
  const ropeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xF4A460, // Sandy brown - much lighter and more visible
    roughness: 0.6,
    metalness: 0.05,
    emissive: 0x332211, // Subtle warm glow for visibility
    emissiveIntensity: 0.1
  });
  
  // Create curved rope geometry
  const ropeGeometry = createCurvedRopeGeometry(playerPos, anchorPoint);
  swingState.ropeLine = new THREE.Mesh(ropeGeometry, ropeMaterial);
  scene.add(swingState.ropeLine);
}

/**
 * Update rope visual tube - SMOOTHED: Uses position smoothing like trail system
 */
function updateRopeVisual(context: GrappleAbilityContext): void {
  if (!swingState.isSwinging || !swingState.anchorPoint || !swingState.ropeLine) return;
  
  const { playerBody } = context;
  const playerPos = playerBody.translation();
  const currentPlayerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
  const now = Date.now();
  
  // Performance optimization: limit geometry recreation to 30 FPS for better performance
  if (now - ropeSmoothing.lastUpdateTime < 33) { // 33ms = 30 FPS
    return;
  }
  ropeSmoothing.lastUpdateTime = now;
  
  // Use real-time player position for zero lag (no smoothing)
  const smoothedPlayerPos = currentPlayerPosition;
  
  // Only recreate geometry if player moved significantly (performance optimization)
  const lastPos = ropeSmoothing.lastPlayerPosition;
  if (lastPos && smoothedPlayerPos.distanceTo(lastPos) < 0.2) {
    return; // Skip update if movement is too small
  }
  
  // Recreate curved geometry with new player position
  const newGeometry = createCurvedRopeGeometry(smoothedPlayerPos, swingState.anchorPoint);
  
  // Dispose old geometry safely and update with new curved geometry
  if (swingState.ropeLine.geometry) {
    swingState.ropeLine.geometry.dispose();
  }
  swingState.ropeLine.geometry = newGeometry;
  
  // Update last position for next frame
  ropeSmoothing.lastPlayerPosition = currentPlayerPosition.clone();
}

/**
 * Update hook flash animation
 */
function updateHookFlash(): void {
  if (!swingState.isSwinging || !swingState.hookMesh || swingState.hookFlashStartTime === 0) return;
  
  const now = Date.now();
  const elapsed = now - swingState.hookFlashStartTime;
  
  if (elapsed < swingState.hookFlashDuration) {
    // Flash animation is active
    const progress = elapsed / swingState.hookFlashDuration;
    const intensity = 1 - progress; // Fade out over time
    
    // Scale pulse effect
    const scalePulse = 1 + intensity * 0.3; // Scale up to 130% then back to 100%
    swingState.hookMesh.scale.setScalar(scalePulse);
    
    // Brightness flash effect
    const material = swingState.hookMesh.material as THREE.MeshStandardMaterial;
    const baseEmissiveIntensity = 0.6;
    const flashIntensity = baseEmissiveIntensity + intensity * 0.8; // Bright flash that fades
    material.emissiveIntensity = flashIntensity;
  } else {
    // Flash animation complete - reset to normal
    swingState.hookMesh.scale.setScalar(1);
    const material = swingState.hookMesh.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.6; // Back to normal glow
    swingState.hookFlashStartTime = 0; // Stop animation
  }
}

// Helper functions

function notifySwingState(isSwinging: boolean): void {
  window.dispatchEvent(new CustomEvent('swingStateChanged', {
    detail: { isSwinging }
  }));
}

/**
 * Main update loop - TRUE PENDULUM PHYSICS
 */
export function updateGrapple(context: GrappleAbilityContext, deltaTime: number = 1/60): void {
  // Always update prediction sphere
  updatePredictionSphere(context);
  
  // Handle swing physics
  if (swingState.isSwinging && swingState.anchorPoint) {
    // Step 1: Apply gravity + air control forces
    handleAirControl(context, deltaTime);
    
    // Step 2: Apply pendulum constraint (sphere projection + velocity decomposition)
    applyPendulumConstraint(context);
    
    // Step 3: Update visuals
    updateRopeVisual(context);
    updateHookFlash();
    
    // Step 4: Check auto-release conditions
    checkAutoRelease(context);
  }
}

// Input handling
export function onKeyDown(event: KeyboardEvent): void {
  pressedKeys.add(event.code);
}

export function onKeyUp(event: KeyboardEvent): void {
  pressedKeys.delete(event.code);
}

// State accessors
export function getGrappleState(): GrappleState {
  return swingState;
}

/**
 * Comprehensive cleanup for grapple system - disposes all resources
 * Call this during scene cleanup or when switching levels
 */
export function cleanupGrappleSystem(scene: THREE.Scene): void {
  // MEMORY FIX: Remove event listeners
  if (forceReleaseListener) {
    window.removeEventListener('forceReleaseGrapple', forceReleaseListener);
    forceReleaseListener = null;
  }
  if (classChangeListener) {
    window.removeEventListener('playerClassChanged', classChangeListener);
    classChangeListener = null;
  }

  // Dispose of hook mesh
  if (swingState.hookMesh) {
    scene.remove(swingState.hookMesh);
    swingState.hookMesh.geometry.dispose();
    if (swingState.hookMesh.material instanceof THREE.Material) {
      swingState.hookMesh.material.dispose();
    }
    swingState.hookMesh = null;
  }

  // Dispose of rope line
  if (swingState.ropeLine) {
    scene.remove(swingState.ropeLine);
    swingState.ropeLine.geometry.dispose();
    if (swingState.ropeLine.material instanceof THREE.Material) {
      swingState.ropeLine.material.dispose();
    }
    swingState.ropeLine = null;
  }

  // Dispose of prediction sphere
  if (swingState.predictionMesh) {
    scene.remove(swingState.predictionMesh);
    swingState.predictionMesh.geometry.dispose();
    if (swingState.predictionMesh.material instanceof THREE.Material) {
      swingState.predictionMesh.material.dispose();
    }
    swingState.predictionMesh = null;
  }

  // Reset all state
  swingState.isSwinging = false;
  swingState.anchorPoint = null;
  swingState.ropeLength = 0;
  swingState.attachTime = 0;
  swingState.lastInputTime = 0;

  console.log('🧹 Grapple system cleaned up - all resources disposed');
}

export function isSwinging(): boolean {
  return swingState.isSwinging;
}

// Debug function removed for production 