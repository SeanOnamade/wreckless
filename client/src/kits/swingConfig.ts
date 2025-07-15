/**
 * SWING CONFIGURATION - All tunables for the new pendulum system
 * Based on "ADVANCED SWINGING in 9 MINUTES" and "SATISFYING movement" videos
 */

export const SWING = {
  // Distance and rope constraints
  maxDistance: 50,           // Max grapple range in meters (significantly increased for ceiling)
  maxRope: 55,              // Max rope length before auto-release (increased to match range)
  minRope: 3,               // Minimum rope length
  
  // Physics constants
  springFactor: 0.0,        // Using hard constraint, no spring
  elasticity: 0.35,         // Bounce factor for radial velocity reflection (increased for dynamic swinging)
  ropeSlack: 0.8,           // Allow 80cm overshoot before constraint kicks in (much smoother)
  
  // Air control forces (while swinging) - INCREASED for responsive movement shooter feel
  pullForce: 80,            // Force for Space key (reel in) - increased for snappy control
  lateralForce: 60,         // Force for A/D keys - increased for responsive air control
  forwardForce: 40,         // Force for W key - increased for momentum building
  
  // Rope length control
  shortenRate: 1.2,         // m/s rate for reeling in - slightly faster
  extendRate: 1.0,          // m/s rate for letting out
  
  // Speed management
  speedCapWhileSwinging: 120,  // Effectively uncapped for gameplay
  
  // Auto-release conditions
  maxSwingTime: 5.0,        // Auto-release after this many seconds of no input (much longer)
  autoReleaseDistance: 55,  // Auto-release if rope exceeds this length (matches maxRope)
  
  // Visual settings
  ropeColor: 0x8B4513,      // Brown rope color
  hookColor: 0xff4444,      // Red hook color
  predictionColor: 0x00ff00, // Green prediction sphere
  ropeSegments: 16,         // Detail for rope geometry
  
  // Debug settings
  enableDebugSphere: true,   // Show anchor point sphere
  debugLogFrequency: 0.02,   // Percentage of frames to log (reduce spam)
} as const;

// Export type for TypeScript safety
export type SwingConfig = typeof SWING; 