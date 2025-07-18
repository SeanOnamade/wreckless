// Simple server-side game logic (no physics dependencies)
class ServerGameLogic {
  constructor() {
    this.players = new Map();
    this.gameState = {
      players: {},
      timestamp: Date.now()
    };
    
    // Movement constants
    this.MOVE_SPEED = 10.0;
    this.MAX_SPEED = 20.0;
    this.SPAWN_RADIUS = 5.0;
    
    // Dummy management
    this.dummies = new Map(); // dummyId -> { id, health, maxHealth, position, lastHit, respawnTimer, isAlive }
    this.initializeDummies();
  }

  // Initialize dummy positions and health
  initializeDummies() {
    // Sample dummy positions - matches client dummy positions for consistency
    const dummyPositions = [
      { id: 'dummy_1', position: { x: 10, y: 1, z: 5 } },
      { id: 'dummy_2', position: { x: -10, y: 1, z: -5 } },
      { id: 'dummy_3', position: { x: 0, y: 1, z: 15 } },
      { id: 'dummy_4', position: { x: 20, y: 1, z: 0 } },
      { id: 'dummy_5', position: { x: -20, y: 1, z: 10 } }
    ];

    for (const dummyData of dummyPositions) {
      this.dummies.set(dummyData.id, {
        id: dummyData.id,
        health: 100,
        maxHealth: 100,
        position: dummyData.position,
        lastHit: 0,
        respawnTimer: null,
        isAlive: true
      });
    }

    console.log(`🎯 Initialized ${this.dummies.size} server-side dummies`);
  }

  // Handle dummy damage from client
  damageServerDummy(dummyId, damage, playerId) {
    const dummy = this.dummies.get(dummyId);
    if (!dummy || !dummy.isAlive) {
      return false;
    }

    // Apply damage
    const oldHealth = dummy.health;
    dummy.health = Math.max(0, dummy.health - damage);
    dummy.lastHit = Date.now();

    console.log(`🎯 ${dummyId} took ${damage} damage (${oldHealth}→${dummy.health}/${dummy.maxHealth} HP) from ${playerId.slice(-4)}`);

    // Check for KO
    if (dummy.health <= 0 && dummy.isAlive) {
      this.killDummy(dummyId);
    }

    // Update game state to broadcast dummy health
    this.updateGameState();
    return true;
  }

  // Kill dummy and start respawn timer
  killDummy(dummyId) {
    const dummy = this.dummies.get(dummyId);
    if (!dummy) return;

    dummy.isAlive = false;
    console.log(`💀 ${dummyId} KO'd! Respawning in 3 seconds...`);

    // Clear existing timer
    if (dummy.respawnTimer) {
      clearTimeout(dummy.respawnTimer);
    }

    // Set respawn timer
    dummy.respawnTimer = setTimeout(() => {
      this.respawnDummy(dummyId);
    }, 3000);
  }

  // Respawn dummy with full health
  respawnDummy(dummyId) {
    const dummy = this.dummies.get(dummyId);
    if (!dummy) return;

    dummy.health = dummy.maxHealth;
    dummy.isAlive = true;
    dummy.respawnTimer = null;

    console.log(`✨ ${dummyId} respawned!`);
    this.updateGameState();
  }

  // Get dummy states for broadcasting
  getDummyStates() {
    const dummyStates = {};
    for (const [id, dummy] of this.dummies) {
      dummyStates[id] = {
        id: dummy.id,
        health: dummy.health,
        maxHealth: dummy.maxHealth,
        position: dummy.position,
        isAlive: dummy.isAlive,
        lastHit: dummy.lastHit
      };
    }
    return dummyStates;
  }

  addPlayer(playerId) {
    // Random spawn position
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.SPAWN_RADIUS;
    
    const playerData = {
      id: playerId,
      position: {
        x: Math.cos(angle) * radius,
        y: 2.0,
        z: Math.sin(angle) * radius
      },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      lastInput: null,
      lastUpdateTime: Date.now(),
      isGrounded: true
    };

    this.players.set(playerId, playerData);
    this.updateGameState();
    
    console.log(`🏃 Player ${playerId} spawned at (${playerData.position.x.toFixed(1)}, ${playerData.position.y}, ${playerData.position.z.toFixed(1)})`);
    return playerData;
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      this.players.delete(playerId);
      this.updateGameState();
      console.log(`👋 Player ${playerId} removed`);
      return true;
    }
    return false;
  }

  processPlayerInput(playerId, input) {
    if (!this.players.has(playerId) || !input) {
      return false;
    }

    const playerData = this.players.get(playerId);
    
    // Only store input for actions/states (position handled separately)
    if (input.actions) {
      playerData.actions = input.actions;
    }
    if (input.states) {
      playerData.states = input.states;
    }
    
    // Keep camera data from input for compatibility
    if (input.camera && playerData.lastInput) {
      playerData.lastInput.camera = input.camera;
    }
    
    return true;
  }

  updatePlayerPosition(playerId, position, velocity, cameraYaw) {
    if (!this.players.has(playerId)) {
      console.warn(`Cannot update position for unknown player: ${playerId}`);
      return false;
    }

    const playerData = this.players.get(playerId);
    
    // Basic validation (prevent teleporting too far)
    const maxDistance = 10.0; // Max 10 units per update
    const distance = Math.sqrt(
      Math.pow(position.x - playerData.position.x, 2) +
      Math.pow(position.y - playerData.position.y, 2) +
      Math.pow(position.z - playerData.position.z, 2)
    );
    
    if (distance > maxDistance) {
      console.warn(`⚠️ Player ${playerId.slice(-4)} large position change: ${distance.toFixed(2)}m (possible teleport/lag)`);
      // Still accept it but log for monitoring
    }
    
    // Accept client's authoritative position
    playerData.position = { ...position };
    playerData.velocity = { ...velocity };
    playerData.lastUpdateTime = Date.now();
    
    // Update camera yaw from position update
    if (cameraYaw !== undefined) {
      if (!playerData.lastInput) {
        playerData.lastInput = { camera: {} };
      }
      playerData.lastInput.camera.yaw = cameraYaw;
    }
    
    // CRITICAL: Update game state after position change
    this.updateGameState();
    
    return true;
  }

  correctPlayerPosition(playerId, position, velocity, reason) {
    if (!this.players.has(playerId)) {
      console.warn(`Cannot correct position for unknown player: ${playerId}`);
      return false;
    }

    const playerData = this.players.get(playerId);
    const oldPos = { ...playerData.position };
    
    // Accept client's position correction (from abilities)
    playerData.position = { ...position };
    playerData.velocity = { ...velocity };
    playerData.lastUpdateTime = Date.now();
    
    console.log(`📍 ${reason}: Player ${playerId.slice(-4)} position corrected`);
    console.log(`  Old: (${oldPos.x.toFixed(2)}, ${oldPos.y.toFixed(2)}, ${oldPos.z.toFixed(2)})`);
    console.log(`  New: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    
    // Force immediate state update to broadcast corrected position
    this.updateGameState();
    
    return true;
  }

  update(deltaTime = 1/60) {
    const now = Date.now();
    
    // Client-authoritative mode: Don't simulate movement, just update game state
    // Positions are updated via positionUpdate events from clients
    
    // Only remove stale players that haven't sent updates (increased timeout)
    for (const [playerId, playerData] of this.players) {
      const timeSinceUpdate = now - playerData.lastUpdateTime;
      if (timeSinceUpdate > 12000) { // 12 seconds (heartbeat is 5s)
        console.log(`⏰ Removing stale player ${playerId.slice(-4)} (no updates for ${Math.round(timeSinceUpdate/1000)}s)`);
        this.players.delete(playerId);
      }
    }
    
    this.updateGameState();
    return this.gameState;
  }

  updatePlayer(playerData, deltaTime, now) {
    if (!playerData.lastInput) return;

    const { movement, camera } = playerData.lastInput;
    const dt = deltaTime;

    // Use camera yaw directly from client (camera-relative movement)
    const yaw = camera?.yaw || 0;

    // Calculate movement direction relative to camera rotation
    let moveX = 0;
    let moveZ = 0;

    if (movement.forward) moveZ -= 1;
    if (movement.backward) moveZ += 1;
    if (movement.left) moveX -= 1;
    if (movement.right) moveX += 1;

    // Apply camera rotation to movement direction
    if (moveX !== 0 || moveZ !== 0) {
      const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const normalizedX = moveX / magnitude;
      const normalizedZ = moveZ / magnitude;
      
      // Rotate movement by camera yaw (camera-relative movement)
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      
      const rotatedX = normalizedX * cos - normalizedZ * sin;
      const rotatedZ = normalizedX * sin + normalizedZ * cos;
      
      moveX = rotatedX * this.MOVE_SPEED;
      moveZ = rotatedZ * this.MOVE_SPEED;
      
      // Debug: Log movement calculation  
      const yawDegrees = (yaw * 180 / Math.PI).toFixed(1);
      console.log(`  📐 Movement calc: Original(${normalizedX.toFixed(2)}, ${normalizedZ.toFixed(2)}) + Yaw:${yawDegrees}° = Final(${rotatedX.toFixed(2)}, ${rotatedZ.toFixed(2)})`);
      console.log(`  🎯 Final velocity: X=${moveX.toFixed(2)} Z=${moveZ.toFixed(2)}`);
    }

    // Update velocity with simple damping
    playerData.velocity.x = playerData.velocity.x * 0.8 + moveX * 0.2;
    playerData.velocity.z = playerData.velocity.z * 0.8 + moveZ * 0.2;

    // Apply speed limit
    const currentSpeed = Math.sqrt(
      playerData.velocity.x * playerData.velocity.x + 
      playerData.velocity.z * playerData.velocity.z
    );
    
    if (currentSpeed > this.MAX_SPEED) {
      const scale = this.MAX_SPEED / currentSpeed;
      playerData.velocity.x *= scale;
      playerData.velocity.z *= scale;
    }

    // Update position
    const oldPos = {x: playerData.position.x, z: playerData.position.z};
    playerData.position.x += playerData.velocity.x * dt;
    playerData.position.z += playerData.velocity.z * dt;
    
    // Debug: Log position changes when there's movement
    if (Math.abs(playerData.velocity.x) > 0.1 || Math.abs(playerData.velocity.z) > 0.1) {
      const deltaX = playerData.position.x - oldPos.x;
      const deltaZ = playerData.position.z - oldPos.z;
      console.log(`  📍 Position: (${oldPos.x.toFixed(2)}, ${oldPos.z.toFixed(2)}) → (${playerData.position.x.toFixed(2)}, ${playerData.position.z.toFixed(2)}) Δ(${deltaX.toFixed(3)}, ${deltaZ.toFixed(3)})`);
    }

    // Simple ground constraint
    playerData.position.y = 2.0;
    playerData.velocity.y = 0;

    // World boundaries (simple)
    const boundary = 50;
    if (Math.abs(playerData.position.x) > boundary) {
      playerData.position.x = Math.sign(playerData.position.x) * boundary;
      playerData.velocity.x = 0;
    }
    if (Math.abs(playerData.position.z) > boundary) {
      playerData.position.z = Math.sign(playerData.position.z) * boundary;
      playerData.velocity.z = 0;
    }
  }

  updateGameState() {
    this.gameState.players = {};
    this.gameState.dummies = this.getDummyStates(); // Add dummy states
    this.gameState.timestamp = Date.now();

    for (const [playerId, playerData] of this.players) {
      this.gameState.players[playerId] = {
        id: playerId,
        position: { ...playerData.position },
        velocity: { ...playerData.velocity },
        rotation: { ...playerData.rotation },
        // Include camera rotation for opponent facing direction
        cameraYaw: playerData.lastInput?.camera?.yaw || 0,
        isGrounded: playerData.isGrounded,
        // Include ability states for multiplayer visualization
        actions: playerData.actions ? { ...playerData.actions } : { jump: false, slide: false, ability: false },
        states: playerData.states ? { ...playerData.states } : { 
          isRocketJumping: false, 
          isSwinging: false, 
          isBlinkMomentum: false, 
          isSliding: false 
        }
      };
    }
  }

  getPlayerCount() {
    return this.players.size;
  }

  getDebugInfo() {
    return {
      playerCount: this.players.size,
      playerIds: Array.from(this.players.keys()),
      gameState: this.gameState
    };
  }
}

export default ServerGameLogic; 