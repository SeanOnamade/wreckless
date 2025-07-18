# Networking Module

This module provides a clean, modular Socket.io networking layer for multiplayer functionality.

## 🔧 Activation

The networking system **only activates** when the URL contains `#online`:

```
http://localhost:5173/#online    ✅ Network enabled
http://localhost:5173/           ❌ Network disabled (offline mode)
```

## 📡 Usage

### Basic Import
```typescript
import { Network } from './net';

// Check if networking is active
if (Network.isNetworkingEnabled()) {
  console.log('Multiplayer mode active');
}
```

### Input Updates (for game systems)
```typescript
// Update movement state
Network.updateMovementInput(
  forwardPressed,  // W key
  backwardPressed, // S key  
  leftPressed,     // A key
  rightPressed     // D key
);

// Update mouse state
Network.updateMouseInput(
  leftMouseDown,   // LMB
  rightMouseDown,  // RMB
  { x: normalizedX, y: normalizedY } // mouse direction
);

// Update ability state
Network.updateAbilityInput(
  abilityPressed,  // ability key pressed
  'blast'          // optional: which ability
);
```

### Server State Access
```typescript
const serverState = Network.getLastServerState();
if (serverState) {
  // Access player positions, dummy states, etc.
  console.log('Server state:', serverState);
}
```

### Connection Status
```typescript
const status = Network.getConnectionStatus(); // 'connected' | 'connecting' | 'disconnected'
const isOnline = Network.isOnline(); // boolean - connected and ready
```

## 🐛 Debugging

### Browser Console
```javascript
// Get detailed network info
window.debugNetwork()

// Expected output:
{
  isOnlineMode: true,
  connectionStatus: 'connected',
  socketId: 'abc123',
  lastInput: { movement: {...}, mouse: {...}, ... },
  lastServerState: { players: {...}, ... },
  socketConnected: true
}
```

### Network Events
Watch the console for these logs:
- `🌐 Network: Online mode detected...` - Networking initializing
- `✅ Network: Connected to server` - Successfully connected
- `📤 Network: Sending input:` - Input being sent (every ~1 second)
- `❌ Network: Disconnected from server` - Connection lost

## 🛡️ Safety Features

1. **No Core Game Modification**: This module doesn't modify any existing game systems
2. **Offline Fallback**: Game runs normally when networking is disabled
3. **Connection Resilience**: Handles connection failures gracefully
4. **Clean State**: Input updates are no-ops when offline

## 🔌 Server Connection

- **Development**: Connects to `localhost:3000`
- **Production**: Uses current origin
- **Protocols**: WebSocket with polling fallback

## 📦 Data Flow

### Outbound (Client → Server)
- **Event**: `'input'`
- **Rate**: 30Hz (every ~33ms)
- **Data**: Current input state + timestamp

### Inbound (Server → Client)  
- **Event**: `'state'`
- **Rate**: 60Hz (from server)
- **Data**: Player positions, dummy states, etc.

## 🔄 Integration Steps (Future)

1. **Import**: Add `import { Network } from './net'` to main game file
2. **Input Capture**: Call `Network.updateXXXInput()` methods from existing input handlers
3. **State Consumption**: Read `Network.getLastServerState()` in render/update loops
4. **Connection UI**: Show connection status in HUD if desired

## 🚨 Important Notes

- This module is **completely isolated** - safe to import anywhere
- Only activates with `#online` URL hash
- Does not interfere with offline gameplay
- Ready for server-side integration when networking backend is ready 