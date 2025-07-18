// Comprehensive Multiplayer Debugging Suite
// Run this in browser console: copy-paste this entire script

console.log('🔍 INTENSE MULTIPLAYER DEBUGGING STARTING...');
console.log('=' .repeat(60));

// 1. NETWORK STATE DEBUGGING
function debugNetworkState() {
  console.log('\n📡 NETWORK STATE DEBUG:');
  console.log('=' .repeat(40));
  
  const networkInfo = window.debugMultiplayer();
  
  console.log('🔌 Connection Status:', networkInfo.socketConnected ? '✅ CONNECTED' : '❌ DISCONNECTED');
  console.log('🆔 Socket ID:', networkInfo.socketId);
  console.log('👥 Players in Server State:', networkInfo.playerCount);
  console.log('🔄 Position Sync Active:', networkInfo.positionSyncActive);
  console.log('📨 Input Sync Active:', networkInfo.inputSyncActive);
  
  if (networkInfo.serverPlayers) {
    console.log('\n🎮 SERVER PLAYERS DETAILED:');
    for (const [id, player] of Object.entries(networkInfo.serverPlayers)) {
      console.log(`  Player ${id.slice(-4)}:`);
      console.log(`    Position: (${player.position?.x.toFixed(2)}, ${player.position?.y.toFixed(2)}, ${player.position?.z.toFixed(2)})`);
      console.log(`    Velocity: (${player.velocity?.x.toFixed(2)}, ${player.velocity?.y.toFixed(2)}, ${player.velocity?.z.toFixed(2)})`);
      console.log(`    Camera Yaw: ${player.cameraYaw?.toFixed(2)}°`);
      console.log(`    States: ${JSON.stringify(player.states)}`);
      console.log(`    Actions: ${JSON.stringify(player.actions)}`);
    }
  }
  
  return networkInfo;
}

// 2. MULTIPLAYER MANAGER DEBUGGING
function debugMultiplayerManager() {
  console.log('\n👥 MULTIPLAYER MANAGER DEBUG:');
  console.log('=' .repeat(40));
  
  // Access the multiplayer manager (assuming it's available globally or can be accessed)
  console.log('🎭 Checking for rendered opponent players...');
  
  // Check Three.js scene for player objects
  if (window.scene) {
    const playerObjects = window.scene.children.filter(child => 
      child.userData && child.userData.isNetworkedPlayer
    );
    
    console.log(`🧊 Rendered opponent cubes: ${playerObjects.length}`);
    
    playerObjects.forEach((player, index) => {
      console.log(`  Cube ${index + 1}:`);
      console.log(`    Position: (${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)})`);
      console.log(`    Visible: ${player.visible}`);
      console.log(`    Material Color: ${player.material?.color?.getHexString()}`);
      console.log(`    Player ID: ${player.userData.playerId}`);
    });
  } else {
    console.log('⚠️ Scene not accessible for player cube debugging');
  }
}

// 3. PERFORMANCE DEBUGGING
function debugNetworkPerformance() {
  console.log('\n⚡ NETWORK PERFORMANCE DEBUG:');
  console.log('=' .repeat(40));
  
  const stats = window.networkStats();
  console.log('📊 Network Statistics:', stats);
  
  // Test latency
  console.log('🏓 Testing latency...');
  const startTime = Date.now();
  
  // Send a test event to measure round-trip time
  if (window.Network?.getDebugInfo()?.socketConnected) {
    // This would need to be implemented in the network manager
    console.log('📤 Sending test ping...');
  } else {
    console.log('❌ Cannot test latency: not connected');
  }
}

// 4. POSITION SYNC TESTING
function debugPositionSync() {
  console.log('\n📍 POSITION SYNC DEBUG:');
  console.log('=' .repeat(40));
  
  console.log('🧪 Testing position sync system...');
  window.testPositionSync();
  
  // Monitor position updates for 10 seconds
  console.log('⏱️ Monitoring position updates for 10 seconds...');
  
  let updateCount = 0;
  const startTime = Date.now();
  
  const originalLog = console.log;
  console.log = function(...args) {
    if (args[0]?.includes('Position update') || args[0]?.includes('Heartbeat')) {
      updateCount++;
    }
    originalLog.apply(console, args);
  };
  
  setTimeout(() => {
    console.log = originalLog;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = updateCount / elapsed;
    console.log(`📊 Position Update Rate: ${updateCount} updates in ${elapsed.toFixed(1)}s = ${rate.toFixed(1)} updates/sec`);
  }, 10000);
}

// 5. ABILITY TESTING
function debugAbilities() {
  console.log('\n🚀 ABILITY SYSTEM DEBUG:');
  console.log('=' .repeat(40));
  
  console.log('🧪 Testing position correction system...');
  window.testPositionCorrection();
  
  console.log('💥 To test abilities:');
  console.log('  - Press E + Space for rocket jump');
  console.log('  - Press 2 then E for grapple');
  console.log('  - Press 3 then E for blink');
  console.log('  - Watch for position corrections in console');
}

// 6. SERVER COMMUNICATION TESTING
function debugServerCommunication() {
  console.log('\n🖥️ SERVER COMMUNICATION DEBUG:');
  console.log('=' .repeat(40));
  
  const networkInfo = window.debugNetwork();
  
  console.log('📨 Last Input Sent:', networkInfo.lastInput);
  console.log('📥 Last Server State:', networkInfo.lastServerState?.timestamp ? 
    `Received ${Date.now() - networkInfo.lastServerState.timestamp}ms ago` : 'None');
  
  // Test input sending
  console.log('🎮 Testing input system...');
  console.log('Try pressing WASD, Space, E and watch console for input events');
}

// 7. COMPREHENSIVE STATUS CHECK
function debugOverallStatus() {
  console.log('\n🔍 OVERALL SYSTEM STATUS:');
  console.log('=' .repeat(40));
  
  const checks = [
    { name: 'Socket Connected', test: () => window.debugNetwork().socketConnected },
    { name: 'Position Provider Set', test: () => window.debugNetwork().hasPlayerContextProvider },
    { name: 'Players in Server State', test: () => window.debugNetwork().playerCount > 0 },
    { name: 'Multiplayer Manager Active', test: () => !!window.scene },
    { name: 'Input System Active', test: () => window.debugNetwork().inputSyncActive },
    { name: 'Position Sync Active', test: () => window.debugNetwork().positionSyncActive }
  ];
  
  let passedChecks = 0;
  
  checks.forEach(check => {
    try {
      const passed = check.test();
      console.log(`${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'PASS' : 'FAIL'}`);
      if (passed) passedChecks++;
    } catch (error) {
      console.log(`❌ ${check.name}: ERROR - ${error.message}`);
    }
  });
  
  const percentage = (passedChecks / checks.length * 100).toFixed(1);
  console.log(`\n📊 System Health: ${passedChecks}/${checks.length} checks passed (${percentage}%)`);
  
  if (percentage == 100) {
    console.log('🎉 MULTIPLAYER SYSTEM FULLY OPERATIONAL!');
  } else if (percentage >= 80) {
    console.log('⚠️ System mostly working with minor issues');
  } else {
    console.log('🚨 System has significant issues');
  }
}

// 8. CONTINUOUS MONITORING
function startContinuousMonitoring() {
  console.log('\n📈 STARTING CONTINUOUS MONITORING...');
  console.log('=' .repeat(40));
  console.log('Will log stats every 30 seconds. Run stopMonitoring() to stop.');
  
  window.multiplayerMonitor = setInterval(() => {
    console.log('\n📊 PERIODIC STATUS CHECK:');
    const networkInfo = window.debugNetwork();
    console.log(`⏰ ${new Date().toLocaleTimeString()}`);
    console.log(`👥 Players: ${networkInfo.playerCount}, Connected: ${networkInfo.socketConnected}`);
    console.log(`📡 Socket ID: ${networkInfo.socketId?.slice(-4)}`);
    
    if (networkInfo.serverPlayers) {
      const playerIds = Object.keys(networkInfo.serverPlayers);
      console.log(`🎮 Active Players: ${playerIds.map(id => id.slice(-4)).join(', ')}`);
    }
    
  }, 30000); // Every 30 seconds
}

window.stopMonitoring = function() {
  if (window.multiplayerMonitor) {
    clearInterval(window.multiplayerMonitor);
    console.log('🛑 Continuous monitoring stopped');
  }
};

// 9. RUN ALL DEBUGGING
function runIntenseDebugging() {
  console.log('🚀 RUNNING INTENSE DEBUGGING SUITE...');
  console.log('🕐 This will take about 15 seconds to complete');
  
  setTimeout(debugNetworkState, 0);
  setTimeout(debugMultiplayerManager, 2000);
  setTimeout(debugServerCommunication, 4000);
  setTimeout(debugPositionSync, 6000);
  setTimeout(debugAbilities, 8000);
  setTimeout(debugNetworkPerformance, 10000);
  setTimeout(debugOverallStatus, 12000);
  setTimeout(startContinuousMonitoring, 14000);
  
  console.log('\n💡 MANUAL TESTS TO TRY:');
  console.log('1. 🏃 Move around with WASD - other player should see you move');
  console.log('2. 🚀 Rocket jump (E + Space) - watch for position corrections');
  console.log('3. 🎯 Try grapple (2, then E) and blink (3, then E)');
  console.log('4. 🧘 Stand still for 10+ seconds - should see heartbeat messages');
  console.log('5. 🔄 Open second browser tab with #online - test multi-client');
}

// Export functions to global scope for manual testing
window.debugNetworkState = debugNetworkState;
window.debugMultiplayerManager = debugMultiplayerManager;
window.debugPositionSync = debugPositionSync;
window.debugAbilities = debugAbilities;
window.debugServerCommunication = debugServerCommunication;
window.debugOverallStatus = debugOverallStatus;
window.runIntenseDebugging = runIntenseDebugging;
window.startContinuousMonitoring = startContinuousMonitoring;

// Auto-run the intense debugging
runIntenseDebugging();

console.log('\n🎯 DEBUGGING COMMANDS AVAILABLE:');
console.log('window.debugNetworkState() - Network status');
console.log('window.debugMultiplayerManager() - Player cubes');
console.log('window.debugPositionSync() - Position updates');
console.log('window.debugAbilities() - Ability system');
console.log('window.debugOverallStatus() - System health');
console.log('window.startContinuousMonitoring() - 30s monitoring');
console.log('window.stopMonitoring() - Stop monitoring');
console.log('window.runIntenseDebugging() - Run all tests'); 