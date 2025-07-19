import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import readline from 'readline';
import ServerGameLogic from './ServerGameLogic.js';

const app = express();
const server = createServer(app);

// Configure CORS for development and production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      "https://wreckless-game.netlify.app", 
      "https://wreckless-game.vercel.app",
      "https://polite-muffin-8c0d99.netlify.app", // Previous domain
      "https://polite-muffin-8caea4.netlify.app" // Correct current domain
    ]
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const gameLogic = new ServerGameLogic();

// Global race state to prevent duplicate race starts
let globalRaceStarting = false;

// Post-race voting system
let postRaceVotes = {
  anotherRound: new Set(),
  backToMenu: new Set(),
  totalPlayers: 0
};

// Vote timeout management
let voteTimeoutId = null;
const VOTE_TIMEOUT_MS = 35000; // 35 seconds (5s buffer after client timeout)

// Race scores for leaderboard
let raceScores = new Map(); // socketId -> { score, events, playerId }
let leaderboardSent = false;

// Helper functions for voting and leaderboard
function startVoteTimeout() {
  if (voteTimeoutId) {
    clearTimeout(voteTimeoutId);
    voteTimeoutId = null;
  }
  
  console.log(`⏰ Starting vote timeout: ${VOTE_TIMEOUT_MS / 1000} seconds`);
  
  voteTimeoutId = setTimeout(() => {
    console.log('⏰ Vote timeout reached - forcing BACK TO MENU');
    
    const voteState = {
      anotherRound: 0,
      backToMenu: io.sockets.sockets.size,
      totalPlayers: io.sockets.sockets.size,
      unanimous: true,
      decision: 'backToMenu'
    };
    
    postRaceVotes.anotherRound.clear();
    postRaceVotes.backToMenu.clear();
    
    console.log(`🏠 SERVER TIMEOUT: Forcing all ${voteState.totalPlayers} players back to menu`);
    io.emit('voteUpdate', voteState);
    
    voteTimeoutId = null;
  }, VOTE_TIMEOUT_MS);
}

function stopVoteTimeout() {
  if (voteTimeoutId) {
    clearTimeout(voteTimeoutId);
    voteTimeoutId = null;
    console.log(`⏰ Vote timeout cleared - voting completed`);
  }
}

function checkAndSendLeaderboard() {
  const totalPlayers = io.sockets.sockets.size;
  const scoresReceived = raceScores.size;
  
  console.log(`🏆 Checking leaderboard: ${scoresReceived}/${totalPlayers} scores, sent: ${leaderboardSent}`);
  
  if (scoresReceived === totalPlayers && totalPlayers > 0 && !leaderboardSent) {
    leaderboardSent = true;
    
    const playerScores = Array.from(raceScores.values());
    playerScores.sort((a, b) => b.score - a.score);
    
    const leaderboard = playerScores.map((player, index) => ({
      rank: index + 1,
      playerId: player.playerId,
      playerClass: player.playerClass,
      score: player.score,
      events: player.events
    }));
    
    console.log('🏆 Broadcasting leaderboard:');
    leaderboard.forEach((player, index) => {
      console.log(`  ${index + 1}. ${player.playerId} (${player.playerClass}): ${player.score} pts`);
    });
    
    io.emit('leaderboard', { leaderboard, totalPlayers });
    startVoteTimeout();
    
    return true;
  }
  return false;
}

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Wreckless Multiplayer Server',
    status: 'Running',
    version: '1.0.0',
    connectedClients: gameLogic.getPlayerCount(),
    endpoints: {
      health: '/ping',
      websocket: 'ws://wreckless-multiplayer.fly.dev'
    },
    timestamp: Date.now()
  });
});

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

  // Handle dummy damage from clients
  socket.on('dummyDamage', (damageData) => {
    const { dummyId, damage } = damageData;
    console.log(`🎯 ${socket.id.slice(-4)}: Hit ${dummyId} for ${damage} damage`);
    
    // Apply damage on server
    const success = gameLogic.damageServerDummy(dummyId, damage, socket.id);
    
    if (success) {
      // Game state will be broadcast on next tick with updated dummy health
      console.log(`✅ Server processed dummy damage`);
    } else {
      console.log(`❌ Failed to damage ${dummyId} (dead or missing)`);
    }
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

  // Handle test connection
  socket.on('test', (data) => {
    const playerId = socket.id.slice(-4);
    console.log(`🧪 TEST: Received test from ${playerId}:`, data);
    socket.emit('testResponse', { message: 'Hello back from server!' });
  });

  // Handle class selection
  socket.on('classSelection', (data) => {
    const playerId = socket.id.slice(-4);
    console.log(`🎯 Class selection from ${playerId}: ${data.playerClass}`);
    
    // Store player's class selection
    socket.playerClass = data.playerClass;
    
    // Get all connected players and their classes
    const allPlayers = {};
    io.sockets.sockets.forEach((s, id) => {
      allPlayers[id.slice(-4)] = {
        id: id.slice(-4),
        playerClass: s.playerClass || null,
        isHost: false // We'll determine host logic later
      };
    });
    
    // Determine host (first connected player)
    const socketIds = Array.from(io.sockets.sockets.keys());
    if (socketIds.length > 0) {
      const hostId = socketIds[0].slice(-4);
      if (allPlayers[hostId]) {
        allPlayers[hostId].isHost = true;
      }
    }
    
    // Broadcast class update to all players
    const updateData = {
      playerId: playerId,
      playerClass: data.playerClass,
      allPlayers: allPlayers
    };
    console.log(`📡 Broadcasting class update: ${playerId} → ${data.playerClass} (${Object.keys(allPlayers).length} players)`);
    io.emit('classUpdate', updateData);
  });

  // Handle lobby state requests
  socket.on('requestLobbyState', () => {
    const playerId = socket.id.slice(-4);
    console.log(`🏠 Lobby state request from ${playerId}`);
    
    // Get all connected players and their classes
    const allPlayers = {};
    io.sockets.sockets.forEach((s, id) => {
      allPlayers[id.slice(-4)] = {
        id: id.slice(-4),
        playerClass: s.playerClass || null,
        isHost: false
      };
    });
    
    // Determine host (first connected player)
    const socketIds = Array.from(io.sockets.sockets.keys());
    if (socketIds.length > 0) {
      const hostId = socketIds[0].slice(-4);
      if (allPlayers[hostId]) {
        allPlayers[hostId].isHost = true;
      }
    }
    
    // Send current lobby state to requesting player
    const lobbyState = {
      playerId: playerId,
      playerClass: socket.playerClass || null,
      allPlayers: allPlayers
    };
    console.log(`📡 Sending lobby state to ${playerId} (${Object.keys(allPlayers).length} players)`);
    socket.emit('classUpdate', lobbyState);
  });

  // Handle race start with duplicate prevention
  socket.on('startRace', () => {
    const playerId = socket.id.slice(-4);
    console.log(`🏁 Race start request from ${playerId}`);
    
    // Prevent race start spam (server-side protection)
    if (globalRaceStarting) {
      console.log(`🚫 Race start already in progress, ignoring duplicate from ${playerId}`);
      return;
    }
    
    globalRaceStarting = true;
    
    // Broadcast race start to all players
    console.log(`📡 Broadcasting race start to all players`);
    io.emit('raceStarted');
    
    // Reset leaderboard state for new race
    raceScores.clear();
    leaderboardSent = false;
    console.log(`🏆 Leaderboard state reset for new race`);
    
    // Reset flag after a delay to allow new races
    setTimeout(() => {
      globalRaceStarting = false;
    }, 5000); // 5 second cooldown
  });

  // Handle post-race voting
  socket.on('voteAnotherRound', () => {
    const playerId = socket.id.slice(-4);
    console.log(`🗳️ Vote: ${playerId} wants ANOTHER ROUND`);
    
    postRaceVotes.backToMenu.delete(socket.id);
    postRaceVotes.anotherRound.add(socket.id);
    postRaceVotes.totalPlayers = io.sockets.sockets.size;
    
    const voteState = {
      anotherRound: postRaceVotes.anotherRound.size,
      backToMenu: postRaceVotes.backToMenu.size,
      totalPlayers: postRaceVotes.totalPlayers,
      unanimous: false
    };
    
    if (voteState.backToMenu > 0) {
      voteState.unanimous = true;
      voteState.decision = 'backToMenu';
      console.log(`🏠 MENU PRIORITY: ${voteState.backToMenu} player(s) voted for menu - forcing all players back`);
      postRaceVotes.anotherRound.clear();
      postRaceVotes.backToMenu.clear();
      stopVoteTimeout();
    } else if (voteState.anotherRound === voteState.totalPlayers) {
      voteState.unanimous = true;
      voteState.decision = 'anotherRound';
      console.log(`🎉 Unanimous decision: ANOTHER ROUND (${voteState.anotherRound}/${voteState.totalPlayers})`);
      postRaceVotes.anotherRound.clear();
      postRaceVotes.backToMenu.clear();
      stopVoteTimeout();
    }
    
    console.log(`📊 Vote update: Another Round (${voteState.anotherRound}/${voteState.totalPlayers}), Back to Menu (${voteState.backToMenu}/${voteState.totalPlayers})`);
    io.emit('voteUpdate', voteState);
  });

  socket.on('voteBackToMenu', () => {
    const playerId = socket.id.slice(-4);
    console.log(`🗳️ Vote: ${playerId} wants BACK TO MENU`);
    
    postRaceVotes.anotherRound.delete(socket.id);
    postRaceVotes.backToMenu.add(socket.id);
    postRaceVotes.totalPlayers = io.sockets.sockets.size;
    
    const voteState = {
      anotherRound: postRaceVotes.anotherRound.size,
      backToMenu: postRaceVotes.backToMenu.size,
      totalPlayers: postRaceVotes.totalPlayers,
      unanimous: false
    };
    
    if (voteState.backToMenu > 0) {
      voteState.unanimous = true;
      voteState.decision = 'backToMenu';
      console.log(`🏠 MENU PRIORITY: ${voteState.backToMenu} player(s) voted for menu - forcing all players back`);
      postRaceVotes.anotherRound.clear();
      postRaceVotes.backToMenu.clear();
      stopVoteTimeout();
    }
    
    console.log(`📊 Vote update: Another Round (${voteState.anotherRound}/${voteState.totalPlayers}), Back to Menu (${voteState.backToMenu}/${voteState.totalPlayers})`);
    io.emit('voteUpdate', voteState);
  });

  // Handle final race scores
  socket.on('finalScore', (data) => {
    const playerId = socket.id.slice(-4);
    console.log(`🏆 Final score from ${playerId}: ${data.score} points`);
    
    const playerClass = socket.playerClass || 'unknown';
    if (!socket.playerClass) {
      console.warn(`⚠️ Player ${playerId} has no class set, using 'unknown'`);
    }
    
    raceScores.set(socket.id, {
      score: data.score,
      events: data.events,
      playerId: playerId,
      playerClass: playerClass
    });
    
    checkAndSendLeaderboard();
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id.slice(-4)}`);
    
    // Remove from vote tracking
    const hadVote = postRaceVotes.anotherRound.has(socket.id) || postRaceVotes.backToMenu.has(socket.id);
    postRaceVotes.anotherRound.delete(socket.id);
    postRaceVotes.backToMenu.delete(socket.id);
    
    // Remove from leaderboard tracking
    const hadScore = raceScores.has(socket.id);
    raceScores.delete(socket.id);
    
    // Handle leaderboard state if anyone disconnects during scoring
    if (hadScore) {
      leaderboardSent = false;
      console.log(`🏆 Leaderboard reset due to player disconnect`);
      
      if (raceScores.size > 0) {
        console.log(`🏆 Checking if remaining ${raceScores.size} players can complete leaderboard...`);
        checkAndSendLeaderboard();
      }
    }
    
    // Update total players count
    postRaceVotes.totalPlayers = Math.max(0, io.sockets.sockets.size - 1);
    
    // Broadcast updated vote state if there were votes
    if (hadVote && postRaceVotes.totalPlayers > 0) {
      const voteState = {
        anotherRound: postRaceVotes.anotherRound.size,
        backToMenu: postRaceVotes.backToMenu.size,
        totalPlayers: postRaceVotes.totalPlayers,
        unanimous: false
      };
      
      if (voteState.backToMenu > 0 && voteState.totalPlayers > 0) {
        voteState.unanimous = true;
        voteState.decision = 'backToMenu';
        console.log(`🏠 MENU PRIORITY after disconnect: ${voteState.backToMenu} player(s) voted for menu - forcing all players back`);
        postRaceVotes.anotherRound.clear();
        postRaceVotes.backToMenu.clear();
        stopVoteTimeout();
      } else if (voteState.anotherRound === voteState.totalPlayers && voteState.totalPlayers > 0) {
        voteState.unanimous = true;
        voteState.decision = 'anotherRound';
        console.log(`🎉 Unanimous after disconnect: ANOTHER ROUND (${voteState.anotherRound}/${voteState.totalPlayers})`);
        postRaceVotes.anotherRound.clear();
        postRaceVotes.backToMenu.clear();
        stopVoteTimeout();
      }
      
      console.log(`📊 Vote update after disconnect: Another Round (${voteState.anotherRound}/${voteState.totalPlayers}), Back to Menu (${voteState.backToMenu}/${voteState.totalPlayers})`);
      io.emit('voteUpdate', voteState);
    }
    
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
const PORT = process.env.PORT || 3000;
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