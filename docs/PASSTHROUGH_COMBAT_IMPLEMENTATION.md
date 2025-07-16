# Pass-Through Combat Implementation Plan

**Date**: 2025-01-17  
**Goal**: Switch to proximity/path-based hits for dummy targets while structuring code for future PvP manual-click restoration.

## Overview

Replace the current click-to-hit melee system with a pass-through damage system for PvE (dummies) while preserving the existing manual ray-fan swing logic for future PvP implementation.

## Current System Analysis

### Current Combat Flow
1. **Input**: LMB click triggers `meleeAttack` event in `controller.ts`
2. **Processing**: `MeleeCombat.performMelee()` in `combat/MeleeCombat.ts`
3. **Detection**: Ray-fan cone sweep with 5-7 rays at various angles
4. **Targets**: Works with `TargetDummy` and `RacingTargetDummy` via `MeleeTarget` interface
5. **Damage**: Class-specific damage values (blast: 60, grapple: 25-70, blink: 30-50)
6. **Effects**: Visual feedback, screen shake, hit flashes, speed boosts

### Key Files to Modify
- `client/src/combat/MeleeCombat.ts` - Main combat system
- `client/src/controller.ts` - Player movement and position tracking  
- `client/src/kits/blink.ts` - Blink teleportation path
- `client/src/kits/grapple.ts` - Swing movement path
- `client/src/physics.ts` - Rapier physics integration
- `client/src/main.ts` - System initialization

## Implementation Steps

### Phase 1: Configuration & Archive Setup
**Files**: `client/src/config/combat.ts` (new), `client/src/combat/MeleeCombat.ts`

1. **Create combat configuration file**
   - Central config for combat modes and parameters
   - `USE_PASSTHROUGH_FOR_DUMMIES = true`
   - Hit capsule radius and other HitVolume parameters

2. **Archive existing click-to-hit logic**
   - Wrap ray-fan cone sweep in `if (!CONFIG.USE_PASSTHROUGH_FOR_DUMMIES)` 
   - Add `if (target.isPlayer)` gates for future PvP preservation
   - Maintain all existing damage calculations and timing logic

### Phase 2: HitVolume System Creation
**Files**: `client/src/systems/HitVolume.ts` (new), physics integration

1. **Core HitVolume implementation**
   - `registerHitVolumes(controller: FirstPersonController, meleeCombat: MeleeCombat)`
   - Frame-by-frame capsule sweep: `prevPosition → currentPosition`
   - Blink capsule cast: `originPosition → teleportDestination`
   - Swing capsule sweep: continuous during grapple state

2. **Rapier physics integration**
   - Use `world.castShape()` for capsule sweeps
   - Filter for dummy colliders only (`userData.isDummy`)
   - Proper collision detection with player-sized capsule

3. **Damage application**
   - Reuse existing damage calculation from `MeleeCombat`
   - Maintain class-specific damage values and bonuses
   - Preserve speed boost mechanics for racing dummies

### Phase 3: Movement Integration
**Files**: `client/src/controller.ts`, `client/src/systems/HitVolume.ts`

1. **Player position tracking**
   - Store `prevPosition` and `currentPosition` each frame
   - Export getter methods for HitVolume system access
   - Ensure proper coordinate system consistency

2. **Frame-by-frame sweep registration**
   - Call `HitVolume.frameSweep()` during `controller.update()`
   - Only process when player has moved significantly
   - Respect combat cooldowns and ability states

### Phase 4: Ability Path Integration
**Files**: `client/src/kits/blink.ts`, `client/src/kits/grapple.ts`

1. **Blink path damage**
   - Capture blink origin position before teleport
   - Perform capsule cast from origin to destination
   - Apply blink damage values (30-50 HP) to hit dummies
   - Trigger speed boosts for racing dummies

2. **Swing path damage**
   - Hook into grapple update loop for continuous sweeps
   - Apply grapple damage values (25-70 HP based on velocity)
   - Maintain existing velocity-based damage scaling
   - Use slightly larger capsule for swing generosity

### Phase 5: Visual & Audio Feedback
**Files**: `client/src/combat/TargetDummy.ts`, visual feedback system

1. **Pass-through hit effects**
   - White flash on dummy when hit by pass-through
   - "+Speed" floating text for racing dummy boosts
   - Green wireframe range indicator during movement
   - Consistent with existing damage flash system

2. **Player feedback**
   - HUD indicator for pass-through hits
   - Combat log entries: `"[hit] dummy_3 pass-thru for 40 HP (blink)"`
   - Screen effects for critical path damage
   - Audio cues for successful hits

### Phase 6: UI & Debug Integration
**Files**: `client/src/ui.ts`, debug systems

1. **Debug UI updates**
   - Add HitVolume status indicators
   - Show active combat mode (Passthrough/Manual)
   - Real-time hit detection visualization
   - Performance metrics for capsule sweeps

2. **Combat logging enhancement**
   - Detailed pass-through hit information
   - Ability-specific damage logging
   - Speed boost confirmation messages
   - Hit detection debugging tools

### Phase 7: Configuration & Testing
**Files**: Configuration, testing utilities

1. **Tunable parameters**
   - `HIT_CAPSULE_RADIUS = 0.6` (player shoulder width)
   - `BLINK_SWEEP_EXTRA = 1.1` (10% larger for blink)
   - `DUMMY_SPEED_BOOST = 1.10` (10% speed increase)
   - `DUMMY_BOOST_TIME = 0.7` (boost duration)

2. **Testing framework**
   - Toggle between combat modes for comparison
   - Performance benchmarking for capsule sweeps
   - Dummy hit accuracy validation
   - Edge case testing (high speed, multiple hits)

## Technical Considerations

### Performance Optimization
- **Spatial partitioning**: Only check dummies within reasonable distance
- **Frame rate limiting**: Cap capsule sweep frequency if needed
- **Collision filtering**: Exclude non-dummy entities from checks
- **Batched operations**: Group multiple hits in single frame

### Edge Cases & Safety
- **Multiple hits**: Prevent same dummy from being hit multiple times per frame
- **High velocity**: Handle extreme speeds without breaking physics
- **Collision boundaries**: Ensure capsule sweeps don't penetrate geometry
- **State consistency**: Maintain combat cooldowns across mode switches

### Future PvP Integration
- **Clean separation**: Keep manual and automatic hit detection isolated
- **Player identification**: Robust `isPlayer` vs `isDummy` detection
- **Mode switching**: Runtime toggle between combat modes
- **Balance preservation**: Identical damage values across modes

## Success Criteria

### Functional Requirements
- ✅ Dummies take damage when player moves through them
- ✅ Blink teleportation damages dummies in path
- ✅ Swing movement damages dummies continuously
- ✅ All existing damage values and timing preserved
- ✅ Speed boost mechanics work identically
- ✅ Visual feedback matches quality of click system

### Technical Requirements
- ✅ No performance degradation from capsule sweeps
- ✅ Clean code separation for future PvP restoration
- ✅ Existing combat balance completely preserved
- ✅ Robust collision detection with proper filtering
- ✅ Compatible with all current abilities and mechanics

### User Experience Requirements
- ✅ Intuitive pass-through combat feels natural
- ✅ Clear visual feedback for all hits
- ✅ Responsive damage application and effects
- ✅ Maintains game's high-speed racing flow
- ✅ Debug tools for development and tuning

## Implementation Timeline

1. **Phase 1-2**: Core architecture and HitVolume system (2-3 hours)
2. **Phase 3-4**: Movement and ability integration (2-3 hours)  
3. **Phase 5**: Visual feedback and polish (1-2 hours)
4. **Phase 6-7**: UI integration and testing (1-2 hours)

**Total Estimated Time**: 6-10 hours of focused development

## Post-Implementation Tasks

### Documentation Updates
- Update `THREE_JS_RAPIER_INTEGRATION.md` with HitVolume system
- Add pass-through combat section to main README
- Document configuration options and tuning parameters
- Create troubleshooting guide for common issues

### Performance Monitoring
- Profile capsule sweep performance under various conditions
- Monitor frame rate impact during high-speed movement
- Validate memory usage with continuous hit detection
- Benchmark against original click-to-hit system

### Balance Validation
- Confirm identical damage output between modes
- Validate speed boost timing and effectiveness
- Test edge cases with extreme player velocities
- Ensure combat cooldowns work consistently

---

**Next Steps**: Review this plan, then begin implementation with Phase 1 (Configuration & Archive Setup). 