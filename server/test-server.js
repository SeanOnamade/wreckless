import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import ServerPhysicsWorld from './physics/ServerPhysics.js';

const app = express();
const server = createServer(app);

// Configure CORS for development
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Game state
const gameState = {
  players: {},
  dummies: {},
  timestamp: Date.now()
};

// Initialize physics world
const physicsWorld = new ServerPhysicsWorld();
let physicsInitialized = false;

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    connectedClients: Object.keys(gameState.players).length
  });
});

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log(`🌐 Client connected: ${socket.id}`);
  
  // Ensure physics is initialized
  if (!physicsInitialized) {
    console.log('🌍 Initializing server physics world...');
    const success = await physicsWorld.initialize();
    if (!success) {
      console.error('❌ Failed to initialize physics world');
      socket.emit('error', { message: 'Server physics initialization failed' });
      return;
    }
    physicsInitialized = true;
    console.log('✅ Server physics world ready');
  }
  
  // Add player to physics world
  const spawnPosition = { x: Math.random() * 4 - 2, y: 2, z: Math.random() * 4 - 2 };
  const physicsSuccess = physicsWorld.addPlayer(socket.id, spawnPosition);
  
  if (!physicsSuccess) {
    console.error(`❌ Failed to add player ${socket.id} to physics world`);
    socket.emit('error', { message: 'Failed to join physics simulation' });
    return;
  }
  
  // Initialize player in game state
  gameState.players[socket.id] = {
    id: socket.id,
    position: spawnPosition,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    health: 100,
    lastInput: null,
    lastSeen: Date.now(),
    isGrounded: false
  };

  // Send initial state to new player
  socket.emit('state', {
    ...gameState,
    timestamp: Date.now(),
    yourId: socket.id
  });

  // Handle client input
  socket.on('input', (inputData) => {
    // Store latest input for this player
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].lastInput = inputData;
      gameState.players[socket.id].lastSeen = Date.now();
      
      // Process input in physics world
      if (physicsInitialized) {
        physicsWorld.processPlayerInput(socket.id, inputData);
      }
      
      // Debug log occasionally (reduced frequency)
      if (Math.random() < 0.005) { // 0.5% chance
        console.log(`📤 Input from ${socket.id}:`, {
          movement: inputData.movement,
          mouse: inputData.mouse,
          ability: inputData.ability,
          latency: Date.now() - inputData.timestamp
        });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    
    // Remove from physics world
    if (physicsInitialized) {
      physicsWorld.removePlayer(socket.id);
    }
    
    // Remove from game state
    delete gameState.players[socket.id];
  });

  // Handle custom events for testing
  socket.on('test', (data) => {
    console.log(`🧪 Test event from ${socket.id}:`, data);
    socket.emit('testResponse', { received: data, timestamp: Date.now() });
  });
});

// Game tick loop - broadcast state at 60Hz
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

setInterval(() => {
  try {
    // Step physics simulation
    let physicsState = null;
    if (physicsInitialized) {
      physicsState = physicsWorld.step();
    }
    
    // Update game state with physics results
    if (physicsState && physicsState.players) {
      for (const [playerId, physicsData] of Object.entries(physicsState.players)) {
        if (gameState.players[playerId]) {
          // Update player state with physics simulation results
          gameState.players[playerId].position = physicsData.position;
          gameState.players[playerId].velocity = physicsData.velocity;
          gameState.players[playerId].rotation = physicsData.rotation;
          gameState.players[playerId].isGrounded = physicsData.isGrounded;
        }
      }
    }
    
    // Update timestamp
    gameState.timestamp = Date.now();
    
    // Remove stale players (haven't sent input in 10 seconds)
    const now = Date.now();
    Object.keys(gameState.players).forEach(playerId => {
      const player = gameState.players[playerId];
      if (now - player.lastSeen > 10000) {
        console.log(`🧹 Removing stale player: ${playerId}`);
        
        // Remove from physics world
        if (physicsInitialized) {
          physicsWorld.removePlayer(playerId);
        }
        
        delete gameState.players[playerId];
      }
    });
    
    // Broadcast current state to all connected clients
    io.emit('state', gameState);
    
    // Debug log occasionally
    if (Math.random() < 0.002) { // Reduced frequency
      console.log(`📡 Broadcasting state to ${Object.keys(gameState.players).length} players`);
      if (physicsInitialized) {
        console.log(`🌍 Physics: ${physicsWorld.getPlayerCount()} players simulated`);
      }
    }
  } catch (error) {
    console.error('❌ Game tick error:', error);
  }
}, TICK_INTERVAL);

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.io test server running on http://localhost:${PORT}`);
  console.log(`📡 Tick rate: ${TICK_RATE}Hz`);
  console.log(`🔗 CORS enabled for client development`);
  console.log(`💚 Health check: http://localhost:${PORT}/ping`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 