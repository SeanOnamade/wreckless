# 🧪 **PvP Combat Testing Guide**

**How to test the new PvP combat system without multiplayer**

---

## **✅ What You Can Test Right Now**

### **🎮 NEW: V Key Testing Suite**
**Press `V` in-game for beautiful on-screen help overlay!**

| Keybind | Action |
|---------|--------|
| **V** | Toggle on-screen help overlay ✅ |
| **Shift+V** | Take 30 damage (respects blocking) ✅ |
| **Alt+V** | Reset health to full ✅ |
| **Shift+Ctrl+V** | Test KO (100 damage) ✅ |
| **Shift+Alt+V** | Show PvP setup instructions ✅ |

### **✨ NEW: Beautiful On-Screen Help Overlay**
- **Location:** Far left side, center height
- **Features:**
  - ⌨️ Testing Keybinds section
  - ⚔️ Combat Controls section  
  - 🔧 Real-time Combat State display (attack & block timers)
  - Beautiful glass-like styling with animations
  - Auto-updates when combat state changes

### **📝 What Shift+Alt+V Does**
**Shift+Alt+V** shows detailed PvP setup instructions in the console:
1. How to enable PvP mode in config file
2. How to create test enemy players
3. How to test actual PvP combat
4. Step-by-step setup guide

It's basically a **comprehensive help system** for setting up multiplayer testing!

**⚠️ FIXED ISSUES:**
- ✅ V keybinds now work properly (added event.preventDefault())  
- ✅ KO at 0 HP now respawns player correctly
- ✅ Added debugging logs to trace issues
- ✅ **NEW:** On-screen help instead of console logs!
- ✅ **NEW:** Mutual exclusivity - attack and block can't be used together
- ✅ **NEW:** Block time limit (1 second, same as attack)
- ✅ **REMOVED:** Ctrl+V (regeneration effect didn't work properly)

**🔍 Expected Console Logs:**
- `🧪 V key detected, calling handleVKeybinds...` (when V pressed)
- `🧪 [V] Toggling on-screen help overlay...` (when toggling help)
- `💔 Player health: X → Y/100 HP (damage: Z)` (when damaged)  
- `💀 Health at 0 - triggering KO...` (when KO'd)
- `🔄 Player respawn triggered: combat-ko` (when respawning)
- `✅ Player reset completed for reason: combat-ko` (respawn success)

### **1. 🎨 Beautiful Health Bar** *(Already Visible)*
- **Where:** Bottom-left corner of screen
- **Features:** 
  - Animated health bar with shine effect
  - Color-coded: Green (healthy) → Yellow → Orange → Red (critical)
  - Smooth animations and damage flash effects
  - Shows "100 / 100" health text
  - **FIXED:** Now starts green at full health

### **2. 💔 Health Regeneration System**
**Easy Test:** Press `Shift+V` to take 30 damage, then wait!
1. **Watch:** Health bar drops to 70/100, turns yellow
2. **Wait 4 seconds:** Regeneration starts (green pulse effect)  
3. **Watch:** Health slowly regenerates at 25 HP/s back to full

**Manual Test (Console):**
```javascript
// Simulate taking 30 damage
window.dispatchEvent(new CustomEvent('playerTakeDamage', {
  detail: { damage: 30, isBlocking: false }
}));
```

### **3. 🛡️ Blocking System**
**Easy Test:** 
1. Hold **RMB** (Right Mouse Button)
2. While holding RMB, press `Shift+V` 
3. **Expected:** Only take ~8 damage instead of 30 (75% reduction)
4. **Combat Log:** Shows "🛡️ Blocked! Damage reduced to 8"

**Manual Test (Console):**
```javascript
// Simulate blocked damage (75% reduction)
window.dispatchEvent(new CustomEvent('playerTakeDamage', {
  detail: { damage: 60, isBlocking: true }
}));
```

### **4. 💀 KO and Respawn System**
**Easy Test:** Press `Shift+Ctrl+V` to instantly KO yourself!
1. **Expected:** Instant respawn at last checkpoint with full health
2. **Health bar:** Immediately returns to 100/100 HP

**Manual Test (Console):**
```javascript
// Simulate fatal damage
window.dispatchEvent(new CustomEvent('playerTakeDamage', {
  detail: { damage: 100, isBlocking: false }
}));
```

### **5. 🏃 Killzone Respawn Health Reset**
**Test Steps:**
1. Fall off the map or go to Y < -5
2. **Expected:** Respawn with full health (health bar shows 100/100)
3. **Combat Log:** Shows "✨ Respawned with full health (out-of-bounds)"

---

## **🎮 Manual PvP Testing** *(Advanced)*

If you want to test actual PvP mechanics:

### **Step 1: Enable PvP**
In `client/src/config/combat.ts`, change:
```typescript
PVP_ENABLED: false, // Change this to true
```

### **Step 2: Create Second Player** *(Manual)*
Add this to your console to create a dummy "enemy player":
```javascript
// This creates a fake second player for testing
const scene = window.scene; // Assuming scene is globally accessible
const world = window.world;  // Assuming world is globally accessible

if (scene && world) {
  // Create enemy player geometry
  const geometry = new THREE.CapsuleGeometry(0.5, 1.0);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const enemyMesh = new THREE.Mesh(geometry, material);
  enemyMesh.position.set(5, 2, 0); // 5 meters to your right
  scene.add(enemyMesh);

  // Create enemy physics body
  const enemyBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(5, 2, 0);
  const enemyBody = world.createRigidBody(enemyBodyDesc);
  
  // CRITICAL: Tag as player
  enemyBody.userData = { 
    isPlayer: true, 
    id: 'testEnemy',
    type: 'Player'
  };
  
  const enemyColliderDesc = RAPIER.ColliderDesc.capsule(1.0, 0.5);
  world.createCollider(enemyColliderDesc, enemyBody);
  
  console.log('✅ Test enemy player created at (5, 2, 0)');
}
```

### **Step 3: Test PvP Combat**
1. **Hold LMB** (Left Mouse Button) - max 1 second duration
2. **Walk into the red enemy player**
3. **Expected:** PvP damage applied, combat log shows "⚔️ PvP: [damage] HP"
4. **Note:** Attack automatically stops after 1 second for fairness

### **🎮 Updated Combat Controls**
- **LMB (hold max 1s)** - Attack mode (blocks RMB, auto-stops after 1 second)
- **RMB (hold max 1s)** - Block mode (blocks LMB, 75% damage reduction, auto-stops after 1 second)
- **Mutual Exclusivity** - Cannot attack and block at the same time
- **Press V** - Show all testing keybinds

---

## **🔧 Advanced Testing Commands**

### **Damage Testing**
```javascript
// Test different damage amounts
window.dispatchEvent(new CustomEvent('playerTakeDamage', {
  detail: { damage: 25, isBlocking: false }
}));

// Test critical health (below 25%)
window.dispatchEvent(new CustomEvent('playerTakeDamage', {
  detail: { damage: 80, isBlocking: false }
}));
```

### **Combat State Testing**
```javascript
// Check if you're attacking (while holding LMB)
console.log('Combat State:', window.physicsWorld?.fpsController?.getCombatState());

// Expected output: { isAttacking: true/false, isBlocking: true/false }
```

### **Health Bar Effects**
```javascript
// Test regeneration visual
window.dispatchEvent(new CustomEvent('playerRegenStateChanged', {
  detail: { isRegenerating: true }
}));

// Test damage flash
window.dispatchEvent(new CustomEvent('playerTakeDamage', {
  detail: { damage: 1, isBlocking: false }
}));
```

---

## **🎯 Expected Results Summary**

| Test | Input | Expected Visual | Expected Log |
|------|-------|----------------|--------------|
| **Help Menu** | Press `V` | On-screen overlay (left side) | Combat keybinds and current state |
| **Damage** | `Shift+V` or console | Health bar drops, turns color | "💔 Player: X/100 HP" |
| **Blocking** | Hold RMB + `Shift+V` | 75% damage reduction (1s limit) | "🛡️ Blocked! Damage reduced to X" |
| **Regeneration** | Wait 4s after damage | Green pulse, slow health increase | "💚 Health regeneration started" |
| **KO** | `Shift+Ctrl+V` | Instant respawn, full health | "💀 Player KO - respawning..." |
| **Health Reset** | `Alt+V` | Health bar to 100/100 | Health bar turns green |
| **Mutual Exclusivity** | Try LMB while blocking | Action blocked | "❌ Cannot attack while blocking" |
| **Mutual Exclusivity** | Try RMB while attacking | Action blocked | "❌ Cannot block while attacking" |
| **Killzone** | Fall off map | Instant respawn, full health | "✨ Respawned with full health" |
| **PvP Hit** | LMB (1s max) + enemy | Damage applied | "⚔️ PvP: X HP" |

---

## **🐛 Troubleshooting**

**Health bar not visible?**
- Check bottom-left corner of screen
- Press F12 → Console → Look for "💚 Health HUD initialized"

**V key help overlay not showing?**
- Check far left side, center height of screen
- Press F12 → Console → Look for "🧪 Testing Help HUD initialized"
- Try pressing V again to toggle off/on

**Damage commands not working?**
- Make sure you're in the game (not menu)  
- Check console for error messages
- Try using the on-screen help overlay (press V) instead

**PvP not working?**
- Verify `PVP_ENABLED: true` in combat config
- Check that enemy player has correct `userData.isPlayer: true`
- Confirm you're holding LMB while colliding

---

**🎉 This system is fully functional and ready for multiplayer integration on Day 5!** 