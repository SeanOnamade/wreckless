# 🧪 Camera Effects Testing Guide

## Overview

This guide provides step-by-step instructions for testing all four Day 3 camera effects in Wreckless.

## 🚀 Quick Start

1. **Start the game**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:5173`
3. **Enter game**: Click to capture mouse, use WASD to move
4. **Check console**: Look for camera effects initialization logs

Expected console output:
```
📹 CameraEffectsManager: Camera reference set
📹 SpeedFovEffect: Initialized with FOV range 90 → 105
📹 BoostShakeEffect: Listening for speedBoostGranted events
📹 HitShakeEffect: Listening for passthroughHit events
📹 BlinkZoomEffect: Listening for blink ability events
📹 WindStreakEffect: Initialized with speed range 30-60 m/s
📹 Camera effects system initialized with 5 effects
```

---

## 🎯 Effect 1: Speed-Based FOV

**What it does:** FOV increases from 90° to 105° as speed increases from 18+ to 60+ m/s

### Test Steps:
1. **Start moving**: Use WASD to walk around (18 m/s base speed)
2. **Watch FOV**: Should remain at 90° during normal walking
3. **Get speed boost**: Hit a dummy or use blast jump to go faster
4. **Observe FOV increase**: FOV should smoothly increase as speed rises
5. **Check console logs**: Look for throttled debug messages (1% chance per frame):
   ```
   📹 SpeedFOV: speed=45.2 m/s, FOV=98.3°
   ```

### Expected Behavior:
- **0-18 m/s**: FOV stays at 90°
- **18-60 m/s**: FOV smoothly increases to 105°
- **60+ m/s**: FOV caps at 105°
- **Smooth transitions**: No jarring FOV changes

---

## 🎯 Effect 2: Dummy Speed Boost Effects

**What it does:** Wind shake + FOV burst when hitting speed boost dummies

### Test Steps:
1. **Find a dummy**: Look for target dummies around the track
2. **Approach and hit**: Run through a dummy (pass-through combat)
3. **Watch for effects**:
   - **Green flash** (existing effect)
   - **Wind shake**: Rapid small camera vibrations (±1°)
   - **FOV burst**: +8° FOV spike for 0.3 seconds
4. **Check console**: Look for boost effect logs:
   ```
   📹 BoostShake: Wind effect triggered! Speed 18→24 m/s
   ```

### Expected Behavior:
- **Immediate feedback**: Effects trigger instantly on dummy hit
- **Wind sensation**: Rapid high-frequency camera shake
- **FOV burst**: Quick zoom out then return to normal
- **Duration**: ~0.3 seconds total effect
- **Combines with green flash**: Works alongside existing effect

### Manual Testing:
You can also trigger manually in console:
```javascript
// Access the effect and trigger test
const effects = window.CameraEffects || CameraEffects;
// This requires the effect to be exposed - use normal dummy testing instead
```

---

## 🎯 Effect 3: Dummy Hit Shake

**What it does:** Micro-shake when hitting dummies (pass-through combat feedback)

### Test Steps:
1. **Find a dummy**: Target dummies around the track
2. **Run through dummy**: Use pass-through combat to hit dummy
3. **Watch for shake**: Brief random camera shake (0.1 seconds)
4. **Test different speeds**: Hit dummies at different speeds for varying intensity
5. **Check console**: Look for hit shake logs:
   ```
   📹 HitShake: Triggered for placed_dummy_1 (45 dmg, intensity=0.067)
   ```

### Expected Behavior:
- **Brief duration**: 0.1-0.15 seconds
- **Intensity scaling**: Higher damage = stronger shake
- **Speed scaling**: Faster hits = more intense shake
- **Random shake**: Not predictable patterns, feels natural
- **No interference**: Doesn't break other camera effects

---

## 🎯 Effect 4: Blink Zoom Effect

**What it does:** FOV zoom 90° → 70° → 90° during blink teleportation

### Test Steps:
1. **Switch to Blink class**: Use class selection to equip blink ability
2. **Perform blink**: Use blink ability (check keybinding - likely Q or E)
3. **Watch zoom sequence**:
   - **Phase 1**: Quick zoom out (90° → 70°) in 0.1s
   - **Phase 2**: Slower zoom in (70° → 90°) in 0.2s
4. **Test different scenarios**:
   - Blink on ground
   - Blink in air
   - Blink with obstacles
5. **Check console**: Look for blink zoom logs:
   ```
   📹 BlinkZoom: Teleport zoom effect triggered!
   ```

### Expected Behavior:
- **Only on successful blinks**: Failed blinks don't trigger effect
- **Dramatic zoom out**: Quick "pulling back" sensation
- **Smooth zoom in**: Gradual return to normal view
- **Total duration**: ~0.3 seconds
- **Natural timing**: Matches teleport animation

---

## 🎯 Effect 5: Wind Streak Overlay

**What it does:** Subtle wind streak visual overlay when speed exceeds 30 m/s

### Test Steps:
1. **Get to high speed**: Use blast jump, grapple, or dummy boosts to exceed 30 m/s
2. **Watch for overlay**: Wind streaks should gradually appear as speed increases
3. **Test opacity scaling**: 
   - At 30 m/s: Barely visible streaks
   - At 45 m/s: Moderate opacity  
   - At 60+ m/s: Full opacity streaks
4. **Test fade out**: Slow down below 30 m/s to see streaks fade away
5. **Check console**: Look for wind streak logs:
   ```
   📹 WindStreak: speed=45.2 m/s, opacity=0.350
   ```

### Expected Behavior:
- **Gradual appearance**: Smooth opacity transition, not sudden on/off
- **Speed responsive**: Opacity directly correlates with speed above 30 m/s
- **No performance impact**: Should not affect frame rate
- **Graceful asset handling**: Works even without windstreaks.png asset
- **Fullscreen overlay**: Covers entire viewport with centered streaks

### Asset Requirements:
- **Image file**: `/public/assets/windstreaks.png` 
- **Fallback behavior**: If image missing, overlay div still functions
- **CSS styling**: Uses `mix-blend-mode: screen` for natural blending

### Manual Testing:
You can test manually in console:
```javascript
// Set test opacity (0.0 to 1.0)
windStreakEffect.setTestOpacity(0.5)

// Get current effect status
windStreakEffect.getEffectInfo()
```

---

## 🐛 Debug Information

### Console Commands
All effects can be debugged via console:

```javascript
// Check all registered effects
CameraEffects.getEffectsInfo()

// Disable/enable specific effects
CameraEffects.setEffectEnabled('SpeedFov', false)
CameraEffects.setEffectEnabled('BoostShake', true)

// Emergency disable all effects (competition mode)
CameraEffects.disableAllEffects()

// Re-enable all effects
CameraEffects.enableAllEffects()
```

### Effect Status Methods
Each effect has status methods for debugging:

```javascript
// Speed FOV status (if exposed)
speedFovEffect.getFovInfo()

// Boost shake status
boostShakeEffect.getEffectStatus()

// Hit shake status  
hitShakeEffect.getShakeStatus()

// Blink zoom status
blinkZoomEffect.getZoomStatus()
```

---

## 🚨 Troubleshooting

### No Effects Working
1. **Check console for errors**: Look for camera effects initialization
2. **Verify camera reference**: Should see "Camera reference set" log
3. **Check event listeners**: Each effect should log "Listening for..." message

### Speed FOV Not Working
1. **Check movement**: Must move faster than 18 m/s (walking speed)
2. **Check speed access**: Verify physicsWorld.fpsController.getCurrentSpeed() works
3. **Look for debug logs**: SpeedFOV debug messages (1% chance per frame)

### Boost Effects Not Working  
1. **Check dummy hits**: Make sure dummies are triggering `speedBoostGranted` events
2. **Verify existing green flash**: If green flash works, boost shake should too
3. **Check event names**: Ensure events match expected names

### Hit Shake Not Working
1. **Verify pass-through combat**: Make sure `passthroughHit` events fire
2. **Check combat mode**: Ensure combat system is active
3. **Look for hit registration**: Should see hit logs in combat system

### Blink Zoom Not Working
1. **Check blink class**: Make sure blink ability is equipped and functional
2. **Verify successful blinks**: Effect only triggers on successful teleports
3. **Check event format**: Ensure `abilityUsed` events have correct structure

---

## ✅ Success Criteria

### All Effects Working:
- [ ] Speed FOV smoothly scales with movement speed
- [ ] Dummy boost creates wind shake + FOV burst
- [ ] Dummy hits create brief camera shake
- [ ] Blink teleports have zoom out/in effect
- [ ] Wind streaks appear at high speeds (30+ m/s)
- [ ] No performance impact during normal gameplay
- [ ] No conflicts between multiple effects
- [ ] Console shows proper initialization and effect logs

### Performance Verified:
- [ ] Smooth 60 FPS during all effects
- [ ] No noticeable lag when effects trigger
- [ ] Effects can be disabled for competition mode
- [ ] Memory usage remains stable

---

## 🎮 Quick Test Sequence

**6-Minute Full Test:**

1. **Start game** → Check console for initialization
2. **Move around** → Verify speed FOV at different speeds  
3. **Hit dummy** → Check boost shake + wind effect
4. **Hit dummy again** → Verify hit shake feedback
5. **Switch to blink** → Test zoom effect on teleport
6. **Get high speed** → Test wind streaks at 30+ m/s
7. **Test combinations** → Use multiple effects together
8. **Check performance** → Ensure smooth gameplay throughout

**Expected Result:** All five effects work smoothly, provide enhanced game feel, and can be disabled if needed.

---

*Day 3 Camera Effects - Enhancing movement shooter feel through immediate visual feedback* 