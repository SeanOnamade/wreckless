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

const gameLogic = new ServerGameLogic();

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'Server running',
    connectedClients: gameLogic.getPlayerCount(),
    timestamp: Date.now()
  });
});

console.log('🔍 DEBUG SERVER - Comprehensive Multiplayer Debugging');
console.log('=' .repeat(60));

// Enhanced connection handling with debug info
io.on('connection', (socket) => {
  console.log(`\n🌐 CLIENT CONNECTED: ${socket.id}`);
  console.log(`📊 Total players before add: ${gameLogic.getPlayerCount()}`);
  
  // Add player to game logic
  const playerData = gameLogic.addPlayer(socket.id);
  console.log(`✅ Player added to gameLogic:`, {
    playerId: socket.id.slice(-4),
    position: playerData.position,
    totalPlayers: gameLogic.getPlayerCount()
  });
  
  // Send initial state to new player
  const initialState = {
    ...gameLogic.gameState,
    yourId: socket.id,
    serverInfo: {
      type: 'authoritative',
      tickRate: 30
    }
  };
  
  console.log(`📤 Sending initial state to ${socket.id.slice(-4)}:`, {
    playersInState: Object.keys(initialState.players || {}).length,
    yourId: initialState.yourId?.slice(-4)
  });
  
  socket.emit('state', initialState);

  // Debug: Track input processing
  socket.on('input', (inputData) => {
    const result = gameLogic.processPlayerInput(socket.id, inputData);
    
    // Only log significant input changes
    const hasActions = Object.values(inputData.actions || {}).some(v => v);
    const hasStates = Object.values(inputData.states || {}).some(v => v);
    
    if (hasActions || hasStates) {
      console.log(`🎮 INPUT from ${socket.id.slice(-4)}:`, {
        actions: inputData.actions,
        states: inputData.states,
        processed: result,
        latency: Date.now() - inputData.timestamp
      });
    }
  });

  // Debug: Track position updates
  socket.on('position', (update) => {
    console.log(`📍 POSITION from ${socket.id.slice(-4)}:`, {
      pos: `(${update.position.x.toFixed(1)}, ${update.position.y.toFixed(1)}, ${update.position.z.toFixed(1)})`,
      vel: `(${update.velocity.x.toFixed(1)}, ${update.velocity.y.toFixed(1)}, ${update.velocity.z.toFixed(1)})`,
      camera: update.cameraYaw ? update.cameraYaw.toFixed(2) : 'none',
      latency: Date.now() - update.timestamp
    });
    
    const success = gameLogic.updatePlayerPosition(
      socket.id, 
      update.position, 
      update.velocity, 
      update.cameraYaw
    );
    
    if (!success) {
      console.log(`❌ Failed to update position for ${socket.id.slice(-4)}`);
    }
  });

  // Debug: Track ability activations
  socket.on('abilityActivation', (abilityEvent) => {
    console.log(`🌟 ABILITY from ${socket.id.slice(-4)}:`, abilityEvent);
    
    // Broadcast to all other players
    socket.broadcast.emit('abilityActivation', {
      ...abilityEvent,
      fromPlayerId: socket.id
    });
    
    console.log(`📡 Broadcasted ability to ${io.sockets.sockets.size - 1} other players`);
  });

  // Debug: Track position corrections
  socket.on('positionCorrection', (correction) => {
    console.log(`🔧 POSITION CORRECTION from ${socket.id.slice(-4)}:`, {
      reason: correction.reason,
      pos: `(${correction.position.x.toFixed(1)}, ${correction.position.y.toFixed(1)}, ${correction.position.z.toFixed(1)})`,
      vel: `(${correction.velocity.x.toFixed(1)}, ${correction.velocity.y.toFixed(1)}, ${correction.velocity.z.toFixed(1)})`
    });
    
    const success = gameLogic.correctPlayerPosition(
      socket.id, 
      correction.position, 
      correction.velocity, 
      correction.reason
    );
    
    if (success) {
      // Force immediate broadcast
      const currentState = gameLogic.gameState;
      io.emit('state', currentState);
      console.log(`📡 IMMEDIATE broadcast after correction to ${io.sockets.sockets.size} players`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`\n❌ CLIENT DISCONNECTED: ${socket.id}`);
    console.log(`📊 Total players before remove: ${gameLogic.getPlayerCount()}`);
    
    const removed = gameLogic.removePlayer(socket.id);
    console.log(`✅ Player removed:`, {
      success: removed,
      totalPlayers: gameLogic.getPlayerCount()
    });
  });
});

// Enhanced game tick loop with detailed debugging
const TICK_RATE = 30;
const TICK_INTERVAL = 1000 / TICK_RATE;

let broadcastCount = 0;
let lastStatsTime = Date.now();
let tickCount = 0;

console.log(`\n🕒 Starting game loop at ${TICK_RATE}Hz (${TICK_INTERVAL}ms interval)`);

setInterval(() => {
  try {
    tickCount++;
    
    // Update game logic
    const gameState = gameLogic.update();
    
    // Check player count
    const playerCount = gameLogic.getPlayerCount();
    const connectedSockets = io.sockets.sockets.size;
    
    // Debug: Check for player count mismatch
    if (playerCount !== connectedSockets) {
      console.log(`⚠️ PLAYER COUNT MISMATCH: gameLogic=${playerCount}, sockets=${connectedSockets}`);
    }
    
    // Only broadcast if there are players
    if (playerCount > 0) {
      // Debug: Log what we're broadcasting
      const playersInState = Object.keys(gameState.players || {}).length;
      
      if (tickCount % 30 === 0) { // Log every second
        console.log(`📡 Broadcasting state:`, {
          playersInGameState: playersInState,
          playersInGameLogic: playerCount,
          connectedSockets: connectedSockets
        });
      }
      
      io.emit('state', gameState);
      broadcastCount++;
    } else if (connectedSockets > 0) {
      console.log(`🚨 No players in gameLogic but ${connectedSockets} sockets connected!`);
    }
    
    // Performance stats every 10 seconds
    const now = Date.now();
    if (now - lastStatsTime > 10000) {
      const avgBroadcastsPerSec = broadcastCount / 10;
      console.log(`\n📊 SERVER STATS (10s avg):`);
      console.log(`   Players in gameLogic: ${playerCount}`);
      console.log(`   Connected sockets: ${connectedSockets}`);
      console.log(`   Broadcasts/sec: ${avgBroadcastsPerSec.toFixed(1)}`);
      console.log(`   Tick rate: ${TICK_RATE}Hz`);
      console.log(`   Total ticks: ${tickCount}`);
      
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
  console.log(`\n🚀 DEBUG SERVER running on http://localhost:${PORT}`);
  console.log(`📡 Tick rate: ${TICK_RATE}Hz`);
  console.log(`🔗 CORS enabled for client development`);
  console.log(`💚 Health check: http://localhost:${PORT}/ping`);
  console.log(`🔍 Debug mode: ACTIVE`);
  console.log('=' .repeat(60));
});

// Graceful shutdown
const cleanup = () => {
  console.log('\n🛑 Server shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
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