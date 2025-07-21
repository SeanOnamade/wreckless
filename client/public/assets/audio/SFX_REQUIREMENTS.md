# 🔊 WRECKLESS SFX Requirements

**Complete list of sound effects needed for WRECKLESS game**  
*Organized by actual implementation priority*

---

## 🎯 **PHASE 1: Core Implementation** *(User's Selected Priority)*

### **🚀 Abilities** *(4 files)*
```
sfx/abilities/blast_launch.wav          # Blast projectile firing

sfx/abilities/blink_teleport.wav        # Teleportation whoosh sound

sfx/abilities/grapple_shoot.wav         # Hook shooting out
sfx/abilities/grapple_latch.wav         # Hook connecting to surface

sfx/abilities/ability_blocked.wav       # Any ability blocked/failed
```

### **⚔️ Combat** *(1 file)*
```
sfx/combat/dummy_ko.wav                 # Dummy being destroyed/broken
```

### **🎮 UI/Race** *(2 files)*
```
sfx/ui/button_click.wav                 # Button selection
sfx/ui/checkpoint_hit.wav               # Checkpoint reached
```

### **🏃 Movement** *(3 files)*
```
sfx/movement/footstep_concrete.wav      # Footsteps on surfaces
sfx/movement/jump.wav                   # Jump sound
sfx/movement/land_hard.wav              # Landing sound
```

### **🌍 Environment** *(1 file)*
```
sfx/environment/ambient_wind.wav        # Background wind (looping)
```

**PHASE 1 TOTAL: 11 files**

---

## 🎯 **PHASE 2: Essential Additions** *(User Selected)*

### **Core Gameplay Feedback** *(1 file)*
```
sfx/combat/speed_boost_gained.wav       # Speed boost activated (key feedback!)
```

**PHASE 2 TOTAL: 1 file**

---

## 🎯 **PHASE 3: Polish & Enhancement** *(Future)*

### **Extended Abilities** *(4 files)*
```
sfx/abilities/blink_arrive.wav          # Arrival at destination
sfx/abilities/grapple_release.wav       # Hook releasing/detaching
sfx/abilities/grapple_miss.wav          # Hook missing target
sfx/abilities/blast_charge.wav          # Blast ability charging up
```

### **Enhanced Combat** *(6 files)*
```
sfx/combat/melee_hit_flesh.wav          # Hit sound when hitting dummy
sfx/combat/hit_crit.wav                 # Critical hit sound (grapple)
sfx/combat/hit_bonus.wav                # Bonus damage sound (blink)
sfx/combat/speed_boost_ended.wav        # Speed boost expired
sfx/combat/melee_swing.wav              # Melee attack swing
sfx/combat/melee_miss.wav               # Attack missing target
```

### **UI Polish** *(7 files)*
```
sfx/ui/menu_open.wav                    # Menu opening
sfx/ui/menu_close.wav                   # Menu closing
sfx/ui/race_countdown_tick.wav          # Race countdown timer
sfx/ui/race_start.wav                   # Race start sound
sfx/ui/lap_complete.wav                 # Lap completion
sfx/ui/error.wav                        # Error/invalid action
sfx/ui/notification.wav                 # General notification
```

### **Movement Polish** *(5 files)*
```
sfx/movement/slide_start.wav            # Slide activation
sfx/movement/wind_rush.wav              # High-speed movement
sfx/movement/land_soft.wav              # Soft landing
sfx/movement/footstep_metal.wav         # Footsteps on metal
sfx/movement/slide_loop.wav             # Sliding sound (looping)
```

**PHASE 3 TOTAL: 21 files**

---

## 📊 **IMPLEMENTATION SUMMARY**

| **Phase** | **Files** | **Priority** | **Focus** |
|-----------|-----------|--------------|-----------|
| **Phase 1** | 11 | Essential | User's selected core sounds |
| **Phase 2** | 1 | High | Essential reward feedback |
| **Phase 3** | 21 | Medium | Polish & full experience |
| **TOTAL** | **33** | | Reduced and focused on essentials |

---

## ✅ **Final Implementation Plan:**

**Phase 1 + 2 = 12 sounds total** for the core experience:

- **11 Core sounds** (abilities, UI, combat, footsteps, ambient)  
- **1 Essential addition** (speed boost gained)

This covers all the critical feedback loops:
- 🚀 **Ability feedback** - Launch, impact, cooldowns ✅ (ability_blocked wired)
- ⚔️ **Combat rewards** - Dummy break + speed boost gained ✅ (speed_boost_gained wired)
- 🏃 **Movement feel** - Footsteps, jumping, landing ✅ (all implemented)
- 🎮 **Navigation** - Button clicks, checkpoints ✅ (all implemented)
- 🌬️ **Atmosphere** - Ambient wind ✅ (ambient_wind wired)

Perfect balance of essential feedback without bloat!

---

## 🔧 **WIRING STATUS:**

✅ **FULLY WIRED (8/11 sounds):**
- blast_launch.wav
- blink_teleport.wav  
- grapple_shoot.wav
- grapple_latch.wav
- button_click.wav
- checkpoint_hit.wav
- dummy_hit.wav
- footstep_concrete.wav
- jump.wav
- land_hard.wav

⚡ **WIRED & READY (3/3 priority sounds):**
- ✅ ability_blocked.wav - *Triggers on cooldown attempts*
- ✅ speed_boost_gained.wav - *Triggers when hitting dummies*  
- ✅ ambient_wind.wav - *Auto-plays on game start, controlled by SFX volume*

🎯 **FULLY OPTIMIZED:** All SFX volumes have been user-tested and optimized!

---

## 🎚️ **OPTIMIZED VOLUME SETTINGS:**

**📊 Master Settings:**
- Master SFX Volume: 0.55 (down from 0.8 default)
- Wind Base Volume: 0.76 (audible when stationary)  
- Wind Max Volume: 1.0 (dramatic at high speeds)
- Wind Speed Range: 20-30 m/s (narrow, responsive)

**🔊 Individual SFX Volumes:**
- **Footsteps:** 1.24x (louder, more present)
- **Jump:** 0.44x (reduced, less intrusive)
- **Landing:** 1.03x (clear impact feedback)
- **Blast Launch:** 0.32x (toned down explosion)
- **Blink Teleport:** 0.46x (subtle whoosh)
- **Grapple Shoot/Latch:** 0.23x/0.21x (quiet hook sounds)
- **Ability Blocked:** 0.66x (clear but not harsh)
- **Ability Ready:** 1.05x (satisfying ready sound)
- **Dummy Hit:** 0.60x (solid impact)
- **Speed Boost:** 1.04x (rewarding boost sound)
- **Button Click:** 1.02x (crisp UI feedback)
- **Checkpoint Hit:** 0.74x (clear progress sound)

## 🔊 **NEWLY ADDED:**

### 🌍 **Environment SFX:**
- ✅ killzone_hit.wav - *Plays when player touches killzone/out-of-bounds areas*

**🎯 MISSING AUDIO FILES:** Just need the actual .wav files created for the 4 wired sounds! 