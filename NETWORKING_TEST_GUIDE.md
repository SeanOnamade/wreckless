# 🌐 Networking Test Guide

This guide will help you test your new Socket.io networking layer step by step.

## 🚀 Step 1: Install Server Dependencies

First, install the required server dependencies:

```bash
cd server
npm install
```

This will install:
- `express` - Web server framework
- `socket.io` - Real-time communication 
- `cors` - Cross-origin resource sharing

## 🖥️ Step 2: Start the Test Server

Start the test server in a new terminal:

```bash
cd server
npm run test-server
```

You should see:
```
🚀 Socket.io test server running on http://localhost:3000
📡 Tick rate: 60Hz
🔗 CORS enabled for client development
💚 Health check: http://localhost:3000/ping
```

## 🎮 Step 3: Enable Client Networking

1. **Start your game client** (if not already running):
   ```bash
   cd client
   npm run dev
   ```

2. **Enable networking** by adding `#online` to your URL:
   ```
   http://localhost:5173/#online
   ```

## ✅ Step 4: Verify Connection

### Check Browser Console
You should see these logs:
```
🌐 Network: Online mode detected, initializing Socket.io connection...
🔗 Network: Connecting to http://localhost:3000...
✅ Network: Connected to server (ID: abc123...)
📤 Network: Sending input: {movement: {...}, mouse: {...}, ...}
```

### Check Server Console
You should see:
```
🌐 Client connected: abc123...
📤 Input from abc123: {movement: {...}, mouse: {...}, ...}
📡 Broadcasting state to 1 players
```

## 🧪 Step 5: Test Network Functions

### Debug Network State
In browser console, run:
```javascript
window.debugNetwork()
```

Expected output:
```javascript
{
  isOnlineMode: true,
  connectionStatus: 'connected',
  socketId: 'abc123...',
  lastInput: { movement: {...}, mouse: {...}, ... },
  lastServerState: { players: {...}, timestamp: ... },
  socketConnected: true
}
```

### Test Health Check
Visit in browser: http://localhost:3000/ping

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "connectedClients": 1
}
```

## 🎯 Step 6: Test Input Capture

### Movement Test
1. **Press WASD keys** while connected
2. **Watch server console** for input logs (appears ~1% of the time)
3. **Check `window.debugNetwork()`** - `lastInput.movement` should update

### Mouse Test  
1. **Click left/right mouse buttons**
2. **Move mouse around**
3. **Verify input updates** in debug output

### Ability Test
1. **Press E key** (or other ability keys)
2. **Check input logs** for ability key events

## 🐛 Troubleshooting

### ❌ "Connection failed"
- **Check server is running** on port 3000
- **Verify URL has `#online`**
- **Check browser console** for CORS errors

### ❌ "No input being sent"
- **Verify `#online` in URL**
- **Check `window.debugNetwork()`** for connection status
- **Look for 30Hz input logs** in console

### ❌ "Server not receiving data"
- **Check server console** for connection logs
- **Verify CORS headers** are working
- **Test health endpoint** manually

## 🔄 Step 7: Test Multiple Clients

1. **Open second browser tab** with `#online`
2. **Check server shows 2 connections**
3. **Both clients should receive state updates**
4. **Server console should show multiple player IDs**

## 📊 Expected Performance

- **Client Input**: 30Hz (every ~33ms)
- **Server State**: 60Hz (every ~16ms)  
- **Latency**: <50ms locally
- **No console spam** during normal operation

## 🎉 Success Criteria

✅ **Client connects** to server automatically  
✅ **Input events** send at 30Hz  
✅ **Server state** received at 60Hz  
✅ **Multiple clients** can connect  
✅ **Clean console logs** (no spam)  
✅ **Debug tools** work properly  

## 🔧 Next Steps

Once basic networking works:
1. **Integrate with game input** (hook up WASD handlers)
2. **Add server-side physics** (Rapier headless)
3. **Implement state interpolation** 
4. **Add ability synchronization**
5. **Deploy to Fly.io**

---

**Need help?** Check console logs first, then verify each step above! 🚀 