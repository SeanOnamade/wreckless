# **🎯 PvP Combat Micro-Plan: "Hold-to-Attack Player Combat Layer"**

**Date**: 2025-01-20  
**Goal**: Add local player-vs-player combat using hold-to-attack mechanics while preserving existing dummy combat systems.

---

## **Current State Analysis**

Your codebase is **perfectly positioned** for PvP combat:
- ✅ **HitVolume system** already does pass-through damage with sophisticated timing
- ✅ **Damage calculations** are complete with class bonuses (blast: 60, grapple: 25-70, blink: 30-50)  
- ✅ **Health system** exists via `takeDamage()` and `triggerKO()` methods
- ✅ **Respawn system** is robust with `controller.reset()` and checkpoint integration
- ✅ **Input system** already captures LMB/RMB in `controller.ts`

---

## **Combat Input Model**

### **Dummy Damage (Current)**
- **Input Required**: None (automatic pass-through via HitVolume system)
- **Trigger**: Player movement through dummy hit volume
- **System**: `HitVolume.performMovementSweep()` → automatic damage

### **PvP Damage (New)**  
- **Input Required**: Hold LMB (Left Mouse Button) for attack state
- **Optional**: Hold RMB (Right Mouse Button) for blocking 
- **Trigger**: Player holding LMB + movement through enemy player hit volume
- **System**: `HitVolume.checkIntersectionsAtPosition()` → check `isAttacking` state → damage if true

---

## **30-Minute Integration Plan**

| Step | Task | Implementation | Time |
|------|------|---------------|------|
| **1** | **Player Combat State** | Add `isAttacking`/`isBlocking` flags to `FirstPersonController` | 5 min |
| **2** | **Player as Target** | Tag player's `rigidBody.userData = { isPlayer: true }` | 2 min |
| **3** | **Player Health System** | Create `PlayerHealth` class using dummy health pattern | 8 min |
| **4** | **Extend HitVolume** | Add player detection to existing `checkIntersectionsAtPosition()` | 8 min |
| **5** | **Block Logic** | Add blocking check in damage application | 3 min |
| **6** | **HUD Integration** | Bind existing health UI to player health | 4 min |

---

## **Implementation Details**

### **Step 1: Player Combat State (5 min)**
```ts
// In controller.ts - add to FirstPersonController class
private combatState = {
  isAttacking: false,
  isBlocking: false
};

// In setupEventListeners() - modify existing mouse handlers:
document.addEventListener('mousedown', (e) => {
  if (!this.isPointerLocked) return;
  
  if (e.button === 0) { // LMB - Attack
    this.combatState.isAttacking = true;
    // Keep existing meleeAttack event for dummy targeting
    window.dispatchEvent(new CustomEvent('meleeAttack', {
      detail: { timestamp: Date.now() }
    }));
  } else if (e.button === 2) { // RMB - Block  
    this.combatState.isBlocking = true;
    console.log('🛡️ Blocking started');
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) this.combatState.isAttacking = false;
  if (e.button === 2) this.combatState.isBlocking = false;
});

// Add getter method
getCombatState() { return this.combatState; }
```

### **Step 2: Tag Player as Target (2 min)**
```ts
// In physics.ts - modify player creation:
const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(SPAWN_POS.x, SPAWN_POS.y, SPAWN_POS.z);
const playerBody = world.createRigidBody(playerBodyDesc);

// CRITICAL: Tag player for HitVolume detection
playerBody.userData = { 
  isPlayer: true, 
  id: 'localPlayer',
  type: 'Player'
};
```

### **Step 3: Player Health System (8 min)**
```ts
// New file: src/player/PlayerHealth.ts
export class PlayerHealth {
  private currentHealth = 100;
  private maxHealth = 100;
  private lastDamageTime = 0;
  private regenActive = false;

  takeDamage(damage: number, isBlocking = false): void {
    if (this.currentHealth <= 0) return;
    
    // Apply blocking damage reduction
    if (isBlocking) {
      damage = Math.floor(damage * 0.25); // 75% damage reduction
      console.log(`🛡️ Blocked! Damage reduced to ${damage}`);
    }
    
    this.currentHealth = Math.max(0, this.currentHealth - damage);
    this.lastDamageTime = Date.now();
    this.regenActive = false;
    
    console.log(`💔 Player health: ${this.currentHealth}/${this.maxHealth} HP`);
    
    if (this.currentHealth <= 0) {
      this.triggerKO();
    } else {
      // Start regen timer (4s delay)
      setTimeout(() => this.startRegen(), 4000);
    }
  }

  private triggerKO(): void {
    console.log('💀 Player KO - respawning...');
    // Dispatch existing respawn event that controller already handles
    window.dispatchEvent(new CustomEvent('playerRespawn', {
      detail: { reason: 'combat-ko' }
    }));
    this.currentHealth = this.maxHealth; // Reset on respawn
  }

  private startRegen(): void {
    if (Date.now() - this.lastDamageTime < 4000) return;
    this.regenActive = true;
    // 25 HP/s regen
    const regenInterval = setInterval(() => {
      if (!this.regenActive || this.currentHealth >= this.maxHealth) {
        clearInterval(regenInterval);
        return;
      }
      this.currentHealth = Math.min(this.maxHealth, this.currentHealth + 1);
    }, 40); // 25 HP/s = 1 HP per 40ms
  }

  getHealth() { return { current: this.currentHealth, max: this.maxHealth }; }
}
```

### **Step 4: Extend HitVolume for Players (8 min)**
```ts
// In HitVolume.ts - modify checkIntersectionsAtPosition():
private checkIntersectionsAtPosition(/*...existing params*/) {
  // ... existing dummy logic ...

  // ADD PLAYER DETECTION:
  this.world.intersectionsWithShape(testPos, testRot, testShape, (collider) => {
    const userData = collider.parent()?.userData as any;
    
    // Check for player colliders (exclude self)
    if (userData?.isPlayer && userData.id !== 'localPlayer') {
      // PvP hit detected - check if local player is attacking
      const localCombatState = this.controller.getCombatState();
      if (localCombatState.isAttacking) {
        this.processPlayerHit(userData.id, hitType, sweepDistance);
      }
    }
    
    // ... existing dummy logic continues unchanged ...
  });
}

private processPlayerHit(playerId: string, hitType: HitVolumeType, sweepDistance: number): void {
  // Same cooldown logic as dummies...
  const damageResult = this.calculateDamage(); // Reuse existing logic
  
  // Dispatch to player health system
  window.dispatchEvent(new CustomEvent('playerTakeDamage', {
    detail: { 
      damage: damageResult.damage,
      isBlocking: false // TODO: Get from target player's combat state
    }
  }));
}
```

### **Step 5: Block Logic (3 min)**
```ts
// Handled in PlayerHealth.takeDamage() method above
// 75% damage reduction when isBlocking = true
```

### **Step 6: HUD Integration (4 min)**  
```ts
// In ui.ts - add to DebugUI class:
private playerHealthElement?: HTMLDivElement;

// In createCombatInfo():
this.playerHealthElement = document.createElement('div');
this.playerHealthElement.textContent = 'Player: 100/100 HP';
this.playerHealthElement.style.color = '#66ff66';
combatInfo.appendChild(this.playerHealthElement);

// Add update method:
updatePlayerHealth(health: { current: number; max: number }): void {
  if (this.playerHealthElement) {
    this.playerHealthElement.textContent = `Player: ${health.current}/${health.max} HP`;
    const percentage = (health.current / health.max) * 100;
    this.playerHealthElement.style.color = 
      percentage > 75 ? '#66ff66' : 
      percentage > 25 ? '#ffff66' : '#ff6666';
  }
}
```

---

## **Safety & Compatibility**

1. **PVP_ENABLED Flag**: Wrap all player-vs-player logic in config flag
2. **Preserve Dummy System**: All dummy targeting remains unchanged  
3. **Reuse Existing Systems**: No refactoring of core systems
4. **Fallback Graceful**: If PvP disabled, everything works as today

---

## **Test Verification (2 min)**

1. **Dummy Combat (No LMB)**: Run through dummy → dummy takes damage, player doesn't
2. **PvP Combat (Hold LMB)**: Hold LMB → run through second player → target takes damage
3. **Blocking Test**: Target holds RMB → repeat collision → 75% damage reduction  
4. **KO Test**: Drop player HP to 0 → instant respawn at checkpoint

---

## **Result**

- ✅ **Player vs Player** hold-to-attack/block combat  
- ✅ **Dummy combat** unchanged (automatic pass-through)
- ✅ **All damage/health/respawn** mechanics reused perfectly
- ✅ **Ready for multiplayer** sync on Day 5

---

## **Key Design Decision**

**Input Separation**: 
- **Dummies** = No input required (automatic pass-through damage)
- **Players** = Hold LMB required (intentional PvP combat)

This prevents accidental PvP damage while preserving the fluid dummy interaction system that's already working perfectly. 