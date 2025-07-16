# 🏁 Speeds & Cooldowns Reference

## 🏃‍♂️ Movement Speeds

### Base Movement
- **Base Speed**: `18.0 m/s` (normal walking/running)
- **Slide Speed**: `24.0 m/s` (while holding Shift)
- **Jump Velocity**: `12.0 m/s` (vertical jump force)
- **Max Speed**: `150.0 m/s` (cap for rocket jumping)
- **Swing Max Speed**: `120.0 m/s` (cap while grappling)

### Movement Physics
- **Acceleration**: `25.0 m/s²` (how fast we accelerate)
- **Deceleration**: `8.0 m/s` (how fast we stop)
- **Slide Acceleration**: `37.5 m/s²` (acceleration × 1.5 while sliding)
- **Slide Deceleration**: `4.0 m/s` (deceleration × 0.5 while sliding)

### Air Control & Gravity
- **Air Control Factor**: `0.2` (20% control while rocket jumping)
- **Base Gravity**: `20.0 m/s²` (normal falling)
- **Rocket Jump Gravity**: `28.0 m/s²` (stronger gravity for blast jumps)
- **Swing Gravity**: `18.0 m/s²` (lighter gravity while swinging)
- **Terminal Velocity**: `-50.0 m/s` (maximum falling speed)

---

## ⏱️ Ability Cooldowns

### Class Abilities
- **Blast Jump**: `3.0 seconds` (3000ms)
- **Grapple Swing**: `1.2 seconds` (1200ms)*
- **Blink Dash**: `2.5 seconds` (2500ms)

*\*Note: Grapple has special logic - no cooldown until swing is actually released*

### Grapple Swing Specifics
- **Max Grapple Distance**: `50.0 m` (range)
- **Max Rope Length**: `55.0 m` (before auto-release)
- **Min Rope Length**: `3.0 m`
- **Max Swing Time**: `5.0 seconds` (auto-release timer)
- **Rope Shorten Rate**: `1.2 m/s` (Space key reel-in)
- **Rope Extend Rate**: `1.0 m/s` (letting out)

### Blast Jump Specifics
- **Blast Radius**: `4.0 m`
- **Base Impulse**: `36.0` (force coefficient)
- **Self Boost Multiplier**: `2.5x` (when hitting yourself)
- **Airborne Bonus**: `2.0x` (extra force when not grounded)
- **Powerful Blast Threshold**: `25.0 m/s` (natural blasts above this use full speed)
- **Minimum Blast Speed**: `25.0 m/s` (guaranteed speed boost for all blasts)
- **Rocket Jump State**: Always triggered for TF2-style blasts (consistent behavior)

### Blink Dash Specifics
- **Blink Distance**: `10.0 m` (teleport range, increased from 8m)
- **Forward Impulse**: `3.0` (momentum after teleport for smooth traversal)
- **Momentum Speed**: `35.0 m/s` (capped forward speed after blink)
- **Momentum Preservation**: Uses rocket jump system to prevent 18 m/s speed capping
- **Vertical Boost**: `3.0 m` (when holding Space)
- **Safety Buffer**: `0.5 m` (collision prevention)

---

## 🛡️ Combat & Defense Timings

### Defense Mechanics
- **Quick-Block Lockout**: `0.5 seconds` (after releasing RMB)
- **Parry Window**: `0.15 seconds` (timing window for perfect parry)
- **Parry Cooldown**: `1.0 second` (stretch goal)
- **Attacker Stagger**: `0.4 seconds` (when parried)

### Damage Values
- **Blast Damage**: `60 HP`
- **Blink Damage**: `50 HP`
- **Grapple Damage**: `40 HP`
- **KO Threshold**: `100 HP` → respawn

---

## ❤️ Health & Regeneration

### Auto-Regeneration
- **Regen Delay**: `4.0 seconds` (after last damage taken)
- **Regen Rate**: `25 HP/s` (until 100 HP)
- **Max Health**: `100 HP`

### Blink-Specific Health Effects
- **I-Frames Duration**: `0.1 seconds` (100ms invincibility)
- **Regen Disable**: `1.0 second` (no healing after blink)
- **Damage Window**: `0.5 seconds` (bonus damage if you melee after blink)
- **Blink Bonus Damage**: `+20 HP` (if swing ≤0.5s after blink)

---

## 🎯 Track & Checkpoint Bonuses

### Speed Buffs
- **Momentum Pad Buff**: `4.0 seconds` (+10% speed from Checkpoint A)
- **KO Speed Buff**: `5.0 seconds` (+30% speed after being KO'd, decays linearly)
- **Slipstream**: Active while >10m behind (+15% speed until gap <5m)

### Respawn & Penalties
- **Respawn Time**: `≈5 seconds` (checkpoint travel time loss)
- **Killzone Detection**: `0.8 m` below track (immediate respawn)
- **Void Threshold**: `1.5 m` below track (void detection)
- **Safe Min Height**: `2.0 m` (minimum safe blink height)

---

## 🎮 Input & Control Timings

### Mouse Sensitivity
- **Mouse Sensitivity**: `0.002` (look sensitivity multiplier)

### Camera Heights
- **Standing Camera**: `0.8 m` (normal first-person height)
- **Sliding Camera**: `0.4 m` (crouched height while sliding)

### Killzone Detection
- **Time in Void**: `3.0 seconds` (maximum time below track before respawn)

---

## 🔧 Configuration Files

- **Movement Speeds**: `client/src/controller.ts` (lines 17-28)
- **Ability Cooldowns**: `client/src/kits/classKit.ts` (lines 20-37)
- **Grapple Config**: `client/src/kits/swingConfig.ts`
- **Blast Config**: `client/src/kits/blast.ts` (lines 5-11)
- **Blink Config**: `client/src/kits/blink.ts` (lines 30-40)

---

## 🎯 Balancing Notes

### Design Targets (from PRD)
- **Base Speed Target**: `≈8 m/s` (PRD spec, currently 18 m/s for movement shooter feel)
- **Traversal Time Target**: `30-35 seconds` (Checkpoint A → Finish)
- **Equal Traversal**: All three classes should complete laps in similar time

### Current Tuning Philosophy
- **Movement Shooter Feel**: Higher speeds than traditional FPS for dynamic gameplay
- **Momentum Preservation**: Rocket jumping maintains speed while airborne
- **Class Balance**: Each mobility type optimized for different track sections
- **Skill Expression**: Higher speeds reward mastery while remaining accessible
- **Consistent Blast Power**: All blasts trigger rocket jump state for reliable track speed

---

*Last Updated: Day 2 Sprint - Mobility & Traversal Parity* 