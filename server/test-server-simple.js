import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import readline from 'readline';
import ServerGameLogic from './ServerGameLogic.js';

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

// Initialize game logic
const gameLogic = new ServerGameLogic();

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    connectedClients: gameLogic.getPlayerCount(),
    serverType: 'simple-authoritative'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🌐 Client connected: ${socket.id}`);
  
  // Add player to game logic
  const playerData = gameLogic.addPlayer(socket.id);
  
  // Send initial state to new player
  socket.emit('state', {
    ...gameLogic.gameState,
    yourId: socket.id,
    serverInfo: {
      type: 'authoritative',
      tickRate: 60
    }
  });

  // Handle client input (for actions/states only, position handled separately)
  socket.on('input', (inputData) => {
    // Process input in game logic (for actions/states)
    gameLogic.processPlayerInput(socket.id, inputData);
    
    // Debug: Log actions and states only (reduced spam since position is handled separately)
    const hasActions = Object.values(inputData.actions || {}).some(v => v);
    const hasSpecialStates = Object.values(inputData.states || {}).some(v => v);
    
    if (hasActions || hasSpecialStates) {
      console.log(`🎮 ACTIONS/STATES from ${socket.id.slice(-4)}:`, {
        actions: inputData.actions,
        states: inputData.states,
        latency: Date.now() - inputData.timestamp
      });
    }
  });

  // Handle ability activations
  socket.on('abilityActivation', (abilityEvent) => {
    console.log(`🌟 ABILITY ACTIVATION from ${socket.id.slice(-4)}:`, abilityEvent);
    
    // Broadcast to all other players (not the sender)
    socket.broadcast.emit('abilityActivation', {
      ...abilityEvent,
      fromPlayerId: socket.id
    });
  });

  // Handle regular position updates (client-authoritative)
  socket.on('positionUpdate', (update) => {
    // Accept client position with basic validation
    const success = gameLogic.updatePlayerPosition(socket.id, update.position, update.velocity, update.cameraYaw);
    
    // Debug log for high-speed movement only
    if (success) {
      const speed = Math.sqrt(update.velocity.x**2 + update.velocity.y**2 + update.velocity.z**2);
      if (speed > 15) { // Only log fast movement (abilities)
        console.log(`🚀 Fast movement from ${socket.id.slice(-4)}: speed=${speed.toFixed(1)}m/s`, {
          pos: `(${update.position.x.toFixed(1)}, ${update.position.y.toFixed(1)}, ${update.position.z.toFixed(1)})`,
          latency: Date.now() - update.timestamp
        });
      }
    }
  });

  // Handle position corrections (from abilities) - kept for compatibility
  socket.on('positionCorrection', (correction) => {
    console.log(`📍 POSITION CORRECTION from ${socket.id.slice(-4)}: ${correction.reason}`, {
      position: correction.position,
      velocity: correction.velocity
    });
    
    // Apply correction to server's player state
    const success = gameLogic.correctPlayerPosition(socket.id, correction.position, correction.velocity, correction.reason);
    
    if (success) {
      // Force immediate broadcast of updated state
      const currentState = gameLogic.gameState;
      io.emit('state', currentState);
      console.log(`📡 IMMEDIATE broadcast after position correction`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    gameLogic.removePlayer(socket.id);
  });

  // Handle custom events for testing
  socket.on('test', (data) => {
    console.log(`🧪 Test event from ${socket.id}:`, data);
    socket.emit('testResponse', { received: data, timestamp: Date.now() });
  });

  // Debug command
  socket.on('debug', () => {
    socket.emit('debugInfo', gameLogic.getDebugInfo());
  });
});

// Game tick loop - optimized for performance
const TICK_RATE = 30; // Reduced from 60Hz to 30Hz for less bandwidth
const TICK_INTERVAL = 1000 / TICK_RATE;

let broadcastCount = 0;
let lastStatsTime = Date.now();

setInterval(() => {
  try {
    // Update game logic
    const gameState = gameLogic.update();
    
    // Only broadcast if there are players
    const playerCount = gameLogic.getPlayerCount();
    if (playerCount > 0) {
      io.emit('state', gameState);
      broadcastCount++;
    }
    
    // Performance stats every 10 seconds
    const now = Date.now();
    if (now - lastStatsTime > 10000) {
      const avgBroadcastsPerSec = broadcastCount / 10;
      console.log(`📊 Server stats: ${playerCount} players, ${avgBroadcastsPerSec.toFixed(1)} broadcasts/sec, ${TICK_RATE}Hz tick`);
      broadcastCount = 0;
      lastStatsTime = now;
    }
  } catch (error) {
    console.error('❌ Game tick error:', error);
  }
}, TICK_INTERVAL);

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Simple Authoritative Server running on http://localhost:${PORT}`);
  console.log(`📡 Tick rate: ${TICK_RATE}Hz`);
  console.log(`🔗 CORS enabled for client development`);
  console.log(`💚 Health check: http://localhost:${PORT}/ping`);
  console.log(`🎮 Server-authoritative movement: ✅`);
});

// Graceful shutdown with better process management
const cleanup = () => {
  console.log('\n🛑 Server shutting down gracefully...');
  
  // Notify all clients of shutdown
  io.emit('serverShutdown', { message: 'Server is shutting down' });
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('❌ Forcing server shutdown');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  cleanup();
});

// Handle Windows Ctrl+C
if (process.platform === "win32") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", () => {
    process.emit("SIGINT");
  });
} 