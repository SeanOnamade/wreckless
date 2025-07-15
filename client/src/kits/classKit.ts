export type PlayerClass = 'blast' | 'grapple' | 'blink';

export interface AbilityState {
  cooldownTime: number;
  lastUsed: number;
  isReady: boolean;
}

export interface ClassKit {
  className: PlayerClass;
  ability: AbilityState;
  // Future: melee ability state can go here
}

export interface AbilityConfig {
  cooldownDuration: number; // in milliseconds
  name: string;
  description: string;
}

// Ability configurations for each class
export const ABILITY_CONFIGS: Record<PlayerClass, AbilityConfig> = {
  blast: {
    cooldownDuration: 3000, // 3 seconds
    name: 'Blast Jump',
    description: 'Radial impulse that launches you and nearby players'
  },
  grapple: {
    cooldownDuration: 4000, // 4 seconds
    name: 'Grapple Swing',
    description: 'Shoot a grappling hook to swing from anchor points'
  },
  blink: {
    cooldownDuration: 2500, // 2.5 seconds
    name: 'Blink Dash',
    description: 'Teleport forward with brief invincibility frames'
  }
};

/**
 * Creates a new class kit for a player
 */
export function createClassKit(className: PlayerClass): ClassKit {
  return {
    className,
    ability: {
      cooldownTime: ABILITY_CONFIGS[className].cooldownDuration,
      lastUsed: 0,
      isReady: true
    }
  };
}

/**
 * Updates the ability state after use
 */
export function useAbility(kit: ClassKit): boolean {
  const now = Date.now();
  
  if (!kit.ability.isReady) {
    return false; // Still on cooldown
  }
  
  kit.ability.lastUsed = now;
  kit.ability.isReady = false;
  
  return true;
}

/**
 * Updates the cooldown state - call this regularly in game loop
 */
export function updateCooldown(kit: ClassKit): void {
  if (kit.ability.isReady) return;
  
  const now = Date.now();
  const timeSinceUse = now - kit.ability.lastUsed;
  
  if (timeSinceUse >= kit.ability.cooldownTime) {
    kit.ability.isReady = true;
  }
}

/**
 * Gets the remaining cooldown time in milliseconds
 */
export function getRemainingCooldown(kit: ClassKit): number {
  if (kit.ability.isReady) return 0;
  
  const now = Date.now();
  const timeSinceUse = now - kit.ability.lastUsed;
  const remaining = kit.ability.cooldownTime - timeSinceUse;
  
  return Math.max(0, remaining);
}

/**
 * Gets the cooldown progress as a percentage (0-1)
 */
export function getCooldownProgress(kit: ClassKit): number {
  if (kit.ability.isReady) return 1;
  
  const remaining = getRemainingCooldown(kit);
  const progress = 1 - (remaining / kit.ability.cooldownTime);
  
  return Math.max(0, Math.min(1, progress));
}

// Global player kit state (local-only for now)
let currentPlayerKit: ClassKit = createClassKit('blast'); // Default to blast

export function setPlayerClass(className: PlayerClass): void {
  currentPlayerKit = createClassKit(className);
  
  // Dispatch custom event for class change
  window.dispatchEvent(new CustomEvent('playerClassChanged', {
    detail: { className, kit: currentPlayerKit }
  }));
}

export function getCurrentPlayerKit(): ClassKit {
  return currentPlayerKit;
}

export function updateCurrentPlayerKit(): void {
  updateCooldown(currentPlayerKit);
} 