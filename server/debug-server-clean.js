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

console.log('🚀 CLEAN DEBUG SERVER - Reduced Logging for Usability');
console.log('=' .repeat(50));

// Clean connection handling with minimal logging
io.on('connection', (socket) => {
  console.log(`🌐 Player connected: ${socket.id.slice(-4)}`);
  
  // Add player to game logic
  const playerData = gameLogic.addPlayer(socket.id);
  console.log(`✅ Player spawned at (${playerData.position.x.toFixed(1)}, ${playerData.position.y.toFixed(1)}, ${playerData.position.z.toFixed(1)}) - Total: ${gameLogic.getPlayerCount()}`);
  
  // Send initial state to new player
  const initialState = {
    ...gameLogic.gameState,
    yourId: socket.id,
    serverInfo: {
      type: 'authoritative',
      tickRate: 30
    }
  };
  
  socket.emit('state', initialState);

  // Handle input (only log significant actions)
  socket.on('input', (inputData) => {
    gameLogic.processPlayerInput(socket.id, inputData);
    
    // Only log ability usage or jumping
    const hasAbility = inputData.actions?.ability;
    const hasJump = inputData.actions?.jump;
    
    if (hasAbility || hasJump) {
      console.log(`🎮 ${socket.id.slice(-4)}: ${hasAbility ? 'ABILITY' : ''} ${hasJump ? 'JUMP' : ''}`);
    }
  });

  // Track first position update
  let firstPositionUpdate = true;

  // Handle position updates (log only when moving fast)
  socket.on('position', (update) => {
    // Log first position update to debug timing
    if (firstPositionUpdate) {
      console.log(`📍 ${socket.id.slice(-4)}: First position update received`);
      firstPositionUpdate = false;
    }

    const success = gameLogic.updatePlayerPosition(
      socket.id, 
      update.position, 
      update.velocity, 
      update.cameraYaw
    );
    
    if (!success) {
      console.log(`❌ ${socket.id.slice(-4)}: Position update failed - player not in gameLogic`);
      return;
    }
    
    // Only log fast movement (abilities)
    const speed = Math.sqrt(
      update.velocity.x ** 2 + 
      update.velocity.y ** 2 + 
      update.velocity.z ** 2
    );
    
    if (speed > 8) { // Log significant movement
      console.log(`🚀 ${socket.id.slice(-4)}: Fast movement ${speed.toFixed(1)}m/s at (${update.position.x.toFixed(1)}, ${update.position.y.toFixed(1)}, ${update.position.z.toFixed(1)})`);
    }
  });

  // Handle ability activations
  socket.on('abilityActivation', (abilityEvent) => {
    console.log(`🌟 ${socket.id.slice(-4)}: ${abilityEvent.abilityType} ability`);
    
    // Broadcast to all other players
    socket.broadcast.emit('abilityActivation', {
      ...abilityEvent,
      fromPlayerId: socket.id
    });
  });

  // Handle position corrections
  socket.on('positionCorrection', (correction) => {
    console.log(`🔧 ${socket.id.slice(-4)}: Position correction (${correction.reason})`);
    
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
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id.slice(-4)}`);
    const removed = gameLogic.removePlayer(socket.id);
    if (removed) {
      console.log(`👋 Total players: ${gameLogic.getPlayerCount()}`);
    }
  });

  // Comprehensive debug command for intense debugging
  socket.on('intensiveDebug', () => {
    console.log(`\n🔍 INTENSIVE DEBUG REQUEST from ${socket.id.slice(-4)}`);
    console.log('=' .repeat(50));
    
    const debugInfo = {
      serverInfo: {
        connectedSockets: io.sockets.sockets.size,
        playersInGameLogic: gameLogic.getPlayerCount(),
        serverTime: Date.now(),
        tickRate: 30,
        uptime: process.uptime()
      },
      gameLogicInfo: gameLogic.getDebugInfo(),
      playerDetails: {},
      socketDetails: []
    };
    
    // Detailed player information
    console.log('👥 PLAYER DETAILS:');
    for (const [playerId, playerData] of gameLogic.players) {
      const timeSinceUpdate = Date.now() - playerData.lastUpdateTime;
      debugInfo.playerDetails[playerId] = {
        id: playerId.slice(-4),
        position: playerData.position,
        velocity: playerData.velocity,
        lastUpdateTime: playerData.lastUpdateTime,
        timeSinceUpdate: timeSinceUpdate,
        isStale: timeSinceUpdate > 12000,
        actions: playerData.actions,
        states: playerData.states,
        cameraYaw: playerData.lastInput?.camera?.yaw
      };
      
      console.log(`  Player ${playerId.slice(-4)}:`);
      console.log(`    Position: (${playerData.position.x.toFixed(2)}, ${playerData.position.y.toFixed(2)}, ${playerData.position.z.toFixed(2)})`);
      console.log(`    Velocity: (${playerData.velocity.x.toFixed(2)}, ${playerData.velocity.y.toFixed(2)}, ${playerData.velocity.z.toFixed(2)})`);
      console.log(`    Last update: ${timeSinceUpdate}ms ago ${timeSinceUpdate > 12000 ? '⚠️ STALE' : '✅'}`);
      console.log(`    States: ${JSON.stringify(playerData.states)}`);
    }
    
    // Socket information
    console.log('🔌 SOCKET DETAILS:');
    for (const [socketId, socket] of io.sockets.sockets) {
      debugInfo.socketDetails.push({
        id: socketId.slice(-4),
        connected: socket.connected,
        rooms: Array.from(socket.rooms)
      });
      
      console.log(`  Socket ${socketId.slice(-4)}: ${socket.connected ? 'Connected' : 'Disconnected'}`);
    }
    
    console.log('📡 SERVER HEALTH CHECK:');
    console.log(`  ✅ Sockets: ${io.sockets.sockets.size}`);
    console.log(`  ✅ Players: ${gameLogic.getPlayerCount()}`);
    console.log(`  ✅ Match: ${io.sockets.sockets.size === gameLogic.getPlayerCount() ? 'YES' : 'NO ⚠️'}`);
    
    socket.emit('intensiveDebugResponse', debugInfo);
  });
});

// Clean game tick loop with minimal logging
const TICK_RATE = 30;
const TICK_INTERVAL = 1000 / TICK_RATE;

let broadcastCount = 0;
let lastStatsTime = Date.now();

setInterval(() => {
  try {
    // Update game logic
    const gameState = gameLogic.update();
    
    // Check player count
    const playerCount = gameLogic.getPlayerCount();
    const connectedSockets = io.sockets.sockets.size;
    
    // Only broadcast if there are players
    if (playerCount > 0) {
      io.emit('state', gameState);
      broadcastCount++;
    }
    
    // Stats every 30 seconds (instead of 10)
    const now = Date.now();
    if (now - lastStatsTime > 30000) {
      const avgBroadcastsPerSec = broadcastCount / 30;
      console.log(`📊 Stats: ${playerCount} players, ${connectedSockets} sockets, ${avgBroadcastsPerSec.toFixed(1)} broadcasts/sec`);
      
      // Only warn about mismatches occasionally
      if (playerCount !== connectedSockets) {
        console.log(`⚠️ Player count mismatch: gameLogic=${playerCount}, sockets=${connectedSockets}`);
      }
      
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Tick rate: ${TICK_RATE}Hz (reduced logging)`);
  console.log(`🔧 Open http://localhost:5173/#online to test`);
  console.log('=' .repeat(50));
});

// Enhanced graceful shutdown
const cleanup = () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force exit after 2 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('⚠️ Force exit');
    process.exit(1);
  }, 2000);
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