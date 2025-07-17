/**
 * Player Health System for PvP Combat
 * Handles health tracking, damage, blocking, auto-regeneration, and KO/respawn
 */

export class PlayerHealth {
  private currentHealth = 100;
  private maxHealth = 100;
  private lastDamageTime = 0;
  private regenActive = false;
  private regenInterval?: number;
  
  constructor() {
    // Listen for player damage events from HitVolume system
    window.addEventListener('playerTakeDamage', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { damage, isBlocking } = customEvent.detail;
      this.takeDamage(damage, isBlocking);
    });
    
    // Listen for ALL respawn events (combat KO, killzone, etc.)
    window.addEventListener('playerRespawn', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleRespawn(customEvent.detail.reason);
    });
    
    console.log('💚 Player Health System initialized (100/100 HP)');
  }

  /**
   * Apply damage to player with optional blocking reduction
   */
  takeDamage(damage: number, isBlocking = false): void {
    if (this.currentHealth <= 0) return;
    
    // Apply blocking damage reduction (75% reduction)
    if (isBlocking) {
      damage = Math.floor(damage * 0.25);
      console.log(`🛡️ Blocked! Damage reduced to ${damage}`);
      
      // Add to combat log
      window.dispatchEvent(new CustomEvent('combatLogMessage', {
        detail: { message: `🛡️ Blocked! Damage reduced to ${damage}` }
      }));
    }
    
    const healthBefore = this.currentHealth;
    this.currentHealth = Math.max(0, this.currentHealth - damage);
    this.lastDamageTime = Date.now();
    
    // Stop any active regeneration
    this.stopRegen();
    
    console.log(`💔 Player health: ${healthBefore} → ${this.currentHealth}/${this.maxHealth} HP (damage: ${damage})`);
    
    // Add to combat log
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: `💔 Player: ${this.currentHealth}/${this.maxHealth} HP` }
    }));
    
    // Dispatch health update event for UI
    window.dispatchEvent(new CustomEvent('playerHealthChanged', {
      detail: { current: this.currentHealth, max: this.maxHealth }
    }));
    
    // Check for KO with debugging
    if (this.currentHealth <= 0) {
      console.log(`💀 Health at ${this.currentHealth} - triggering KO...`);
      this.triggerKO();
    } else {
      console.log(`🩹 Health above 0 (${this.currentHealth}) - starting regen timer...`);
      // Start regen timer (4s delay as per PRD)
      setTimeout(() => this.startRegen(), 4000);
    }
  }

  /**
   * Handle player KO and trigger respawn
   */
  private triggerKO(): void {
    console.log('💀 Player KO - dispatching respawn event...');
    
    // Add to combat log
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: '💀 Player KO - respawning...' }
    }));
    
    // Dispatch existing respawn event that controller already handles
    // The handleRespawn method will reset health when the respawn event fires
    console.log('🔄 Dispatching playerRespawn event with reason: combat-ko');
    window.dispatchEvent(new CustomEvent('playerRespawn', {
      detail: { reason: 'combat-ko' }
    }));
    console.log('✅ playerRespawn event dispatched successfully');
  }

  /**
   * Handle respawn events from any source (combat KO, killzone, etc.)
   */
  private handleRespawn(reason: string): void {
    console.log(`✨ Player respawning due to: ${reason}`);
    
    // Always reset to full health on respawn regardless of reason
    this.currentHealth = this.maxHealth;
    this.stopRegen();
    this.lastDamageTime = 0;
    
    // Update UI
    window.dispatchEvent(new CustomEvent('playerHealthChanged', {
      detail: { current: this.currentHealth, max: this.maxHealth }
    }));
    
    // Add to combat log
    window.dispatchEvent(new CustomEvent('combatLogMessage', {
      detail: { message: `✨ Respawned with full health (${reason})` }
    }));
    
    console.log('✨ Player respawned with full health!');
  }

  /**
   * Start health regeneration (25 HP/s after 4s delay)
   */
  private startRegen(): void {
    // Check if enough time has passed since last damage
    if (Date.now() - this.lastDamageTime < 4000) return;
    
    if (this.currentHealth >= this.maxHealth) return;
    
    // Prevent multiple regeneration intervals
    if (this.regenInterval !== undefined) return;
    
    this.regenActive = true;
    console.log('💚 Health regeneration started (25 HP/s)');
    
    // Notify health HUD about regeneration state
    window.dispatchEvent(new CustomEvent('playerRegenStateChanged', {
      detail: { isRegenerating: true }
    }));
    
    // 25 HP/s = 1 HP per 40ms
    this.regenInterval = window.setInterval(() => {
      if (!this.regenActive || this.currentHealth >= this.maxHealth) {
        this.stopRegen();
        return;
      }
      
      this.currentHealth = Math.min(this.maxHealth, this.currentHealth + 1);
      
      // Update UI every few HP for performance
      if (this.currentHealth % 5 === 0 || this.currentHealth === this.maxHealth) {
        window.dispatchEvent(new CustomEvent('playerHealthChanged', {
          detail: { current: this.currentHealth, max: this.maxHealth }
        }));
      }
      
      // Log when fully healed
      if (this.currentHealth === this.maxHealth) {
        console.log('💚 Player health fully regenerated!');
        window.dispatchEvent(new CustomEvent('combatLogMessage', {
          detail: { message: '💚 Health fully regenerated!' }
        }));
      }
    }, 40);
  }

  /**
   * Stop health regeneration
   */
  private stopRegen(): void {
    if (this.regenInterval) {
      window.clearInterval(this.regenInterval);
      this.regenInterval = undefined;
    }
    this.regenActive = false;
    
    // Notify health HUD about regeneration state
    window.dispatchEvent(new CustomEvent('playerRegenStateChanged', {
      detail: { isRegenerating: false }
    }));
  }

  /**
   * Get current health status
   */
  getHealth() {
    return { 
      current: this.currentHealth, 
      max: this.maxHealth,
      isRegenerating: this.regenActive 
    };
  }

  /**
   * Force reset health (for round resets, etc.)
   */
  resetHealth(): void {
    this.currentHealth = this.maxHealth;
    this.stopRegen();
    this.lastDamageTime = 0;
    
    window.dispatchEvent(new CustomEvent('playerHealthChanged', {
      detail: { current: this.currentHealth, max: this.maxHealth }
    }));
    
    console.log('🔄 Player health reset to full');
  }

  /**
   * Cleanup when destroying the health system
   */
  destroy(): void {
    this.stopRegen();
  }
} 