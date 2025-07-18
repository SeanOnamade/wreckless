# 🚀 Development Workflow Guide

This guide explains how to run your game in different modes with proper startup and shutdown procedures.

## 📋 **Quick Reference**

| Mode | Command | What it does | Ports Used |
|------|---------|--------------|------------|
| **Offline** | `npm run dev` | Client only (default) | 5173 |
| **Offline** | `npm run dev:offline` | Client only (explicit) | 5173 |
| **Online** | `npm run dev:online` | Client + Networking Server | 5173, 3000 |

## 🔧 **Development Modes**

### 🌍 **Offline Mode (Default)**
For normal single-player development and testing.

```bash
# Start offline mode
npm run dev
# OR
npm run dev:offline
```

**What runs:**
- ✅ Client dev server (http://localhost:5173)
- ❌ No networking server

**Use when:**
- Developing game mechanics
- Testing single-player features
- Working on UI/UX
- Normal development work

### 🌐 **Online Mode**
For multiplayer networking development and testing.

```bash
# Start online mode  
npm run dev:online
```

**What runs:**
- ✅ Client dev server (http://localhost:5173)
- ✅ Socket.io test server (http://localhost:3000)

**Use when:**
- Testing multiplayer networking
- Developing server-side features
- Testing real-time synchronization
- Working on Socket.io integration

## 🛑 **Graceful Shutdown**

### **Offline Mode Shutdown**
```bash
Ctrl+C  # Stops client dev server
```

### **Online Mode Shutdown**  
```bash
Ctrl+C  # Stops BOTH client AND networking server automatically
```

The `--kill-others --kill-others-on-fail` flags ensure that when you Ctrl+C:
- ✅ **Both processes stop together**
- ✅ **No orphaned servers on port 3000**
- ✅ **Clean shutdown of all services**

## 🔗 **Accessing Your Game**

### **Offline Mode**
```
http://localhost:5173/          ← Offline gameplay
```

### **Online Mode**
```
http://localhost:5173/          ← Offline gameplay
http://localhost:5173/#online   ← Online gameplay (networking enabled)
```

## 🧪 **Testing Networking**

When running `npm run dev:online`:

1. **Test offline behavior:**  
   Visit: `http://localhost:5173/`
   
2. **Test online behavior:**  
   Visit: `http://localhost:5173/#online`

3. **Debug networking:**
   ```javascript
   window.debugNetwork()  // In browser console
   ```

4. **Test health endpoint:**
   ```
   http://localhost:3000/ping
   ```

## 🚨 **Troubleshooting**

### **Port 3000 Already in Use**
```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual number)
taskkill /PID [PID] /F
```

### **Port 5173 Already in Use**
```bash
# Find what's using port 5173  
netstat -ano | findstr :5173

# Kill the process
taskkill /PID [PID] /F
```

### **Networking Not Working**
1. **Check URL has `#online`**
2. **Check both servers are running** (npm run dev:online)
3. **Check browser console** for connection logs
4. **Check server console** for client connections

### **Game Won't Start**
1. **Install dependencies:** `npm install`
2. **Clear node_modules:** Delete and `npm install`
3. **Check ports are free:** Kill any existing processes
4. **Try offline mode first:** `npm run dev:offline`

## 📊 **Port Reference**

| Port | Service | Used In | Purpose |
|------|---------|---------|---------|
| **5173** | Vite Dev Server | Both modes | Client development |
| **3000** | Socket.io Test Server | Online mode only | Networking/multiplayer |
| **3001** | Original Server | Not used in dev | Legacy/production |

## 🔄 **Workflow Examples**

### **Normal Development Day:**
```bash
# Start with offline mode
npm run dev

# Work on game features...
# When ready to test networking:
Ctrl+C

# Switch to online mode  
npm run dev:online

# Test multiplayer features...
# Back to offline development:
Ctrl+C
npm run dev
```

### **Networking Development:**
```bash
# Start online mode
npm run dev:online

# Test in browser with #online
# Check server logs
# Debug with window.debugNetwork()
# When done:
Ctrl+C  # Everything stops cleanly
```

## 💡 **Pro Tips**

1. **Default to offline mode** for most development
2. **Use online mode only when testing networking**
3. **Always check `#online` in URL** when testing multiplayer
4. **Use `window.debugNetwork()`** to debug connections
5. **Ctrl+C stops everything** - no manual port cleanup needed
6. **Check both browser and server consoles** when debugging

---

**Happy coding!** 🚀 