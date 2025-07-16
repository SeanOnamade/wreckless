/**
 * Combat Configuration
 * Central configuration for combat modes, hit detection, and damage parameters
 */

// Combat mode configuration (mutable for runtime switching)
export const COMBAT_MODE_CONFIG = {
  // Enable pass-through damage for dummies (vs manual click-to-hit)
  USE_PASSTHROUGH_FOR_DUMMIES: true,
  
  // Preserve manual combat for future PvP implementation
  USE_MANUAL_FOR_PLAYERS: true,
  
  // Debug mode for combat system development
  DEBUG_HIT_DETECTION: false,
  
  // Performance tuning
  MAX_HITS_PER_FRAME: 5, // Prevent spam-hitting same targets
  MIN_MOVEMENT_FOR_SWEEP: 0.1, // Minimum movement distance to trigger sweep (meters)
};

// HitVolume system parameters
export const HIT_VOLUME_CONFIG = {
  // Base capsule radius for hit detection (player shoulder width)
  HIT_CAPSULE_RADIUS: 0.6,
  
  // Capsule height (matches player capsule from physics.ts)
  HIT_CAPSULE_HEIGHT: 1.0,
  
  // Ability-specific multipliers
  BLINK_SWEEP_EXTRA: 1.1,    // 10% larger capsule for blink teleportation
  SWING_SWEEP_EXTRA: 1.2,    // 20% larger capsule for grapple swinging
  BLAST_SWEEP_EXTRA: 0.9,    // 10% smaller capsule for blast (more precise)
  
  // Performance optimization
  MAX_SWEEP_DISTANCE: 50.0,   // Maximum single-frame sweep distance (meters)
  SPATIAL_CULLING_RADIUS: 15.0, // Only check dummies within this radius
} as const;

// Dummy-specific configuration
export const DUMMY_COMBAT_CONFIG = {
  // Speed boost mechanics (matches DummyLoader values)
  DUMMY_SPEED_BOOST: 1.10,      // 10% speed increase
  DUMMY_BOOST_TIME: 0.7,        // 0.7 seconds base duration
  
  // Hit cooldown to prevent multiple hits per frame
  HIT_COOLDOWN_MS: 100,         // 100ms between hits on same dummy
  
  // Visual feedback
  DAMAGE_FLASH_DURATION: 150,   // Flash duration in ms
  SPEED_TEXT_DURATION: 2000,    // "+Speed" text display time
} as const;

// Pass-through damage modifiers
export const PASSTHROUGH_DAMAGE_CONFIG = {
  // Base damage multipliers for pass-through vs click-to-hit
  BASE_DAMAGE_MULTIPLIER: 1.0, // Same damage as click system
  
  // Movement-based damage scaling
  HIGH_VELOCITY_THRESHOLD: 15.0, // m/s - threshold for bonus damage
  HIGH_VELOCITY_MULTIPLIER: 1.2, // 20% bonus damage at high speed
  
  // Ability-specific pass-through modifiers
  BLINK_PATH_MULTIPLIER: 1.0,   // Blink maintains full damage
  SWING_PATH_MULTIPLIER: 1.1,   // Swing gets 10% bonus (encourages swinging combat)
  MOVEMENT_PATH_MULTIPLIER: 0.8, // Regular movement gets 80% damage (encourages abilities)
} as const;

// Debug and development settings
export const COMBAT_DEBUG_CONFIG = {
  // Visual debug indicators
  SHOW_HIT_CAPSULES: false,     // Render hit capsules as wireframes
  SHOW_SWEEP_PATHS: false,      // Render movement sweep paths
  SHOW_DAMAGE_NUMBERS: true,    // Show floating damage numbers
  
  // Console logging
  LOG_HIT_DETECTION: false,     // Log all hit detection attempts
  LOG_DAMAGE_CALCULATIONS: false, // Log damage calculation details
  LOG_PERFORMANCE_METRICS: false, // Log performance data
  
  // Testing utilities
  FORCE_COMBAT_MODE: null as 'passthrough' | 'manual' | null, // Override combat mode
  DISABLE_HIT_COOLDOWNS: false, // Allow rapid-fire hits for testing
} as const;

// Export combined configuration
export const COMBAT_CONFIG = {
  MODE: COMBAT_MODE_CONFIG,
  HIT_VOLUME: HIT_VOLUME_CONFIG,
  DUMMY: DUMMY_COMBAT_CONFIG,
  PASSTHROUGH_DAMAGE: PASSTHROUGH_DAMAGE_CONFIG,
  DEBUG: COMBAT_DEBUG_CONFIG,
} as const;

// Type exports for other files
export type CombatMode = 'passthrough' | 'manual';
export type HitVolumeType = 'movement' | 'blink' | 'swing' | 'blast';

// Utility functions
export function getCombatMode(): CombatMode {
  if (COMBAT_CONFIG.DEBUG.FORCE_COMBAT_MODE) {
    return COMBAT_CONFIG.DEBUG.FORCE_COMBAT_MODE;
  }
  return COMBAT_CONFIG.MODE.USE_PASSTHROUGH_FOR_DUMMIES ? 'passthrough' : 'manual';
}

export function getHitCapsuleRadius(type: HitVolumeType = 'movement'): number {
  const baseRadius = COMBAT_CONFIG.HIT_VOLUME.HIT_CAPSULE_RADIUS;
  
  switch (type) {
    case 'blink':
      return baseRadius * COMBAT_CONFIG.HIT_VOLUME.BLINK_SWEEP_EXTRA;
    case 'swing':
      return baseRadius * COMBAT_CONFIG.HIT_VOLUME.SWING_SWEEP_EXTRA;
    case 'blast':
      return baseRadius * COMBAT_CONFIG.HIT_VOLUME.BLAST_SWEEP_EXTRA;
    case 'movement':
    default:
      return baseRadius;
  }
}

export function getDamageMultiplier(type: HitVolumeType, velocity: number = 0): number {
  let baseMultiplier = COMBAT_CONFIG.PASSTHROUGH_DAMAGE.BASE_DAMAGE_MULTIPLIER;
  
  // Apply type-specific multipliers
  switch (type) {
    case 'blink':
      baseMultiplier *= COMBAT_CONFIG.PASSTHROUGH_DAMAGE.BLINK_PATH_MULTIPLIER;
      break;
    case 'swing':
      baseMultiplier *= COMBAT_CONFIG.PASSTHROUGH_DAMAGE.SWING_PATH_MULTIPLIER;
      break;
    case 'movement':
      baseMultiplier *= COMBAT_CONFIG.PASSTHROUGH_DAMAGE.MOVEMENT_PATH_MULTIPLIER;
      break;
  }
  
  // Apply velocity bonus
  if (velocity >= COMBAT_CONFIG.PASSTHROUGH_DAMAGE.HIGH_VELOCITY_THRESHOLD) {
    baseMultiplier *= COMBAT_CONFIG.PASSTHROUGH_DAMAGE.HIGH_VELOCITY_MULTIPLIER;
  }
  
  return baseMultiplier;
}

// Runtime mode switching functions
export function toggleCombatMode(): CombatMode {
  COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES = !COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES;
  const newMode = getCombatMode();
  
  console.log(`🔄 Combat mode switched to: ${newMode.toUpperCase()}`);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('combatModeChanged', {
    detail: { 
      mode: newMode,
      passthrough: COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES
    }
  }));
  
  return newMode;
}

export function setCombatMode(mode: CombatMode): void {
  const wasPassthrough = COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES;
  COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES = (mode === 'passthrough');
  
  if (wasPassthrough !== COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES) {
    console.log(`🔄 Combat mode set to: ${mode.toUpperCase()}`);
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('combatModeChanged', {
      detail: { 
        mode: mode,
        passthrough: COMBAT_MODE_CONFIG.USE_PASSTHROUGH_FOR_DUMMIES
      }
    }));
  }
} 