import RAPIER from '@dimforge/rapier3d';

class ServerPhysicsWorld {
  constructor() {
    this.world = null;
    this.isInitialized = false;
    this.players = new Map(); // playerId -> { body, state }
    this.gravity = { x: 0.0, y: -9.81, z: 0.0 };
    
    // Physics constants (matching client values)
    this.PLAYER_RADIUS = 0.5;
    this.PLAYER_HEIGHT = 1.8;
    this.MOVE_FORCE = 50.0;
    this.JUMP_FORCE = 15.0;
    this.MAX_SPEED = 20.0;
    this.DAMPING = 0.95;
  }

  async initialize() {
    try {
      // Initialize Rapier with gravity
      await RAPIER.init();
      this.world = new RAPIER.World(this.gravity);
      
      // Create ground plane (infinite)
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(1000, 0.1, 1000)
        .setTranslation(0, -0.1, 0)
        .setRestitution(0.1)
        .setFriction(0.8);
      
      this.world.createCollider(groundColliderDesc);
      
      this.isInitialized = true;
      console.log('🌍 Server physics world initialized');
      console.log(`📊 Physics: Gravity=${this.gravity.y}, MaxSpeed=${this.MAX_SPEED}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize server physics:', error);
      this.isInitialized = false;
      return false;
    }
  }

  addPlayer(playerId, position = { x: 0, y: 2, z: 0 }) {
    if (!this.isInitialized) {
      console.error('❌ Cannot add player: Physics world not initialized');
      return null;
    }

    try {
      // Create dynamic rigid body for player
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(this.DAMPING)
        .setAngularDamping(0.8)
        .setCcdEnabled(true); // Continuous collision detection

      const body = this.world.createRigidBody(bodyDesc);

      // Create capsule collider for player
      const colliderDesc = RAPIER.ColliderDesc.capsule(this.PLAYER_HEIGHT / 2, this.PLAYER_RADIUS)
        .setRestitution(0.1)
        .setFriction(0.8)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      const collider = this.world.createCollider(colliderDesc, body);

      // Store player data
      this.players.set(playerId, {
        body,
        collider,
        isGrounded: false,
        lastInput: null,
        position: { ...position },
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }
      });

      console.log(`🏃 Player ${playerId} added to physics world at (${position.x}, ${position.y}, ${position.z})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to add player ${playerId}:`, error);
      return false;
    }
  }

  removePlayer(playerId) {
    if (!this.players.has(playerId)) {
      console.warn(`⚠️ Player ${playerId} not found for removal`);
      return false;
    }

    try {
      const playerData = this.players.get(playerId);
      
      // Remove physics bodies
      this.world.removeRigidBody(playerData.body);
      // Collider is automatically removed with the body
      
      this.players.delete(playerId);
      console.log(`👋 Player ${playerId} removed from physics world`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove player ${playerId}:`, error);
      return false;
    }
  }

  processPlayerInput(playerId, input) {
    if (!this.players.has(playerId) || !input) {
      return false;
    }

    try {
      const playerData = this.players.get(playerId);
      const body = playerData.body;
      
      // Store input for processing in physics step
      playerData.lastInput = {
        movement: input.movement || { forward: false, backward: false, left: false, right: false },
        mouse: input.mouse || { leftButton: false, rightButton: false, direction: { x: 0, y: 0 } },
        ability: input.ability || { pressed: false },
        timestamp: input.timestamp || Date.now()
      };

      return true;
    } catch (error) {
      console.error(`❌ Failed to process input for player ${playerId}:`, error);
      return false;
    }
  }

  step(deltaTime = 1/60) {
    if (!this.isInitialized) return null;

    try {
      // Process input for all players before physics step
      for (const [playerId, playerData] of this.players) {
        this.applyPlayerForces(playerId, playerData);
      }

      // Step physics simulation
      this.world.step();

      // Update player states after physics step
      const playerStates = {};
      for (const [playerId, playerData] of this.players) {
        const state = this.updatePlayerState(playerId, playerData);
        if (state) {
          playerStates[playerId] = state;
        }
      }

      return {
        players: playerStates,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Physics step failed:', error);
      return null;
    }
  }

  applyPlayerForces(playerId, playerData) {
    const { body, lastInput } = playerData;
    if (!lastInput) return;

    try {
      const currentVel = body.linvel();
      const { movement } = lastInput;

      // Calculate movement direction
      let forceX = 0;
      let forceZ = 0;

      if (movement.forward) forceZ -= this.MOVE_FORCE;
      if (movement.backward) forceZ += this.MOVE_FORCE;
      if (movement.left) forceX -= this.MOVE_FORCE;
      if (movement.right) forceX += this.MOVE_FORCE;

      // Apply horizontal forces
      if (forceX !== 0 || forceZ !== 0) {
        // Normalize diagonal movement
        const magnitude = Math.sqrt(forceX * forceX + forceZ * forceZ);
        if (magnitude > this.MOVE_FORCE) {
          forceX = (forceX / magnitude) * this.MOVE_FORCE;
          forceZ = (forceZ / magnitude) * this.MOVE_FORCE;
        }

        // Apply force (impulse-based)
        body.applyImpulse({ x: forceX * 0.016, y: 0, z: forceZ * 0.016 }, true);
      }

      // Speed limiting
      const speed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);
      if (speed > this.MAX_SPEED) {
        const scale = this.MAX_SPEED / speed;
        body.setLinvel({ 
          x: currentVel.x * scale, 
          y: currentVel.y, 
          z: currentVel.z * scale 
        }, true);
      }

    } catch (error) {
      console.error(`❌ Failed to apply forces for player ${playerId}:`, error);
    }
  }

  updatePlayerState(playerId, playerData) {
    try {
      const { body } = playerData;
      const translation = body.translation();
      const rotation = body.rotation();
      const velocity = body.linvel();

      // Update stored state
      playerData.position = { x: translation.x, y: translation.y, z: translation.z };
      playerData.velocity = { x: velocity.x, y: velocity.y, z: velocity.z };
      playerData.rotation = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };

      // Check if grounded (simple Y velocity check)
      playerData.isGrounded = Math.abs(velocity.y) < 0.1 && translation.y < 3.0;

      return {
        position: playerData.position,
        velocity: playerData.velocity,
        rotation: playerData.rotation,
        isGrounded: playerData.isGrounded
      };
    } catch (error) {
      console.error(`❌ Failed to update state for player ${playerId}:`, error);
      return null;
    }
  }

  getPlayerCount() {
    return this.players.size;
  }

  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      playerCount: this.players.size,
      playerIds: Array.from(this.players.keys()),
      gravity: this.gravity,
      constants: {
        MOVE_FORCE: this.MOVE_FORCE,
        MAX_SPEED: this.MAX_SPEED,
        PLAYER_RADIUS: this.PLAYER_RADIUS,
        PLAYER_HEIGHT: this.PLAYER_HEIGHT
      }
    };
  }
}

export default ServerPhysicsWorld; 