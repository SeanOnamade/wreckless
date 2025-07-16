// Combat System Configuration
export const COMBAT_CONFIG = {
  // Hit System Configuration
  USE_PASSTHROUGH_FOR_DUMMIES: true, // Enable pass-through hits for dummy targets
  USE_MANUAL_COMBAT_FOR_PVP: true,    // Keep manual combat for player-vs-player
  
  // Hit Volume Settings
  HIT_CAPSULE_RADIUS: 0.6,    // Player shoulder width for hit detection
  BLINK_SWEEP_EXTRA: 1.1,     // Slightly fatter sweep for blink teleportation
  
  // Speed Boost Settings (for dummy hits)
  DUMMY_SPEED_BOOST: 1.10,     // +10% top speed boost
  DUMMY_BOOST_TIME: 0.7,       // Duration in seconds
  
  // Visual Feedback
  HIT_FLASH_DURATION: 0.1,     // White flash duration in seconds
  HIT_TEXT_COLOR: '#00e600',   // Green color for "+Speed" text
  HIT_TEXT_DURATION: 1.0,      // Text display duration in seconds
  
  // Performance Settings
  MAX_HITS_PER_FRAME: 5,       // Prevent performance issues with many simultaneous hits
  HIT_COOLDOWN_PER_DUMMY: 100, // Minimum ms between hits on same dummy
  
  // Debug Settings
  DEBUG_HIT_VOLUMES: false,    // Show debug visualization of hit volumes
  LOG_HIT_EVENTS: true         // Console log hit events for debugging
} as const;

export type CombatConfig = typeof COMBAT_CONFIG; 