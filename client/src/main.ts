import './style.css';
import * as THREE from 'three';
import initPhysics from './physics';
import type { PhysicsWorld } from './physics';
import { DebugUI } from './ui';
import { GameMenu } from './menu';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x99D8F5); // Light sky blue (lighter than #87CEEB)
scene.fog = new THREE.Fog(0x99D8F5, 30, 120); // Adjusted fog distance and color

// Camera setup
const camera = new THREE.PerspectiveCamera(
  90, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.set(0, 2, 5);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.6); // Sky blue ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Brighter directional light
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024; // Reduced from default 2048 for performance
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Clock for delta time
const clock = new THREE.Clock();

// Fixed timestep for physics
const fixedTimeStep = 1 / 60; // 60 Hz physics
let accumulator = 0;

// Initialize UI
const debugUI = new DebugUI();
const gameMenu = new GameMenu();

// Suppress unused variable warning (gameMenu is used via event handlers)
void gameMenu;

// Handle reset event from menu
window.addEventListener('game-reset', () => {
  if (physicsWorld) {
    physicsWorld.fpsController.reset();
  }
});

// Initialize physics
let physicsWorld: PhysicsWorld | null = null;
initPhysics(scene, camera).then((world) => {
  physicsWorld = world;
  animate();
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time to prevent spiral of death
  accumulator += deltaTime;
  
  // Fixed timestep physics
  while (accumulator >= fixedTimeStep) {
    if (physicsWorld) {
      physicsWorld.step(fixedTimeStep);
    }
    accumulator -= fixedTimeStep;
  }
  
  // Update UI
  if (physicsWorld) {
    const velocity = physicsWorld.fpsController.getVelocity();
    const grounded = physicsWorld.fpsController.getIsGrounded();
    const sliding = physicsWorld.fpsController.getIsSliding();
    debugUI.update(velocity, grounded, sliding);
  }
  
  renderer.render(scene, camera);
}
