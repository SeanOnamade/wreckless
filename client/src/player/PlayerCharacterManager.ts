import * as THREE from 'three';
import { CharacterAnimationManager, type AnimationState } from './CharacterAnimationManager';
import type { PlayerClass } from '../kits/classKit';
import type { FirstPersonController } from '../controller';

interface PlayerMovementState {
  isGrounded: boolean;
  isMoving: boolean;
  isJumping: boolean;
  isFalling: boolean;
  isSwinging: boolean;
  speed: number;
}

export class PlayerCharacterManager {
  private animationManager: CharacterAnimationManager;
  private currentCharacter: THREE.Group | null = null;
  private currentClass: PlayerClass | null = null;
  private scene: THREE.Scene;
  
  // Animation state tracking
  private currentAnimationState: AnimationState = 'idle';

  constructor(scene: THREE.Scene, _controller: FirstPersonController) {
    this.scene = scene;
    // Controller parameter is stored but not currently used
    this.animationManager = new CharacterAnimationManager();
    
    // Listen for class changes
    this.setupEventListeners();
    
    console.log('🎭 PlayerCharacterManager initialized');
  }

  /**
   * Load and switch to a character class
   */
  public async switchCharacter(characterClass: PlayerClass): Promise<void> {
    try {
      console.log(`🔄 Switching to character: ${characterClass}`);
      
      // Remove current character from scene
      this.removeCurrentCharacter();
      
      // Load new character
      const character = await this.animationManager.loadCharacter(characterClass);
      
      // Add to scene
      this.scene.add(character.model);
      
      // Position character at player position
      this.updateCharacterPosition();
      
      // Store references
      this.currentCharacter = character.model;
      this.currentClass = characterClass;
      
      // Set initial animation state
      this.updateAnimationState();
      
      console.log(`✅ Character switched to: ${characterClass}`);
      
    } catch (error) {
      console.error(`❌ Failed to switch character to ${characterClass}:`, error);
      throw error;
    }
  }

  /**
   * Update character position and animation based on player state
   */
  public update(deltaTime: number): void {
    // Update animation mixer
    this.animationManager.update(deltaTime);
    
    if (!this.currentCharacter || !this.currentClass) {
      return;
    }
    
    // Update character position to match player physics body
    this.updateCharacterPosition();
    
    // Update character rotation to match player look direction
    this.updateCharacterRotation();
    
    // Update animation state based on movement
    this.updateAnimationState();
  }

  /**
   * Update character position to match physics body
   */
  private updateCharacterPosition(): void {
    if (!this.currentCharacter) return;
    
    // Get player position from controller (you may need to expose this method)
    const playerPosition = this.getPlayerPosition();
    
    // Offset character slightly below the camera to represent the body
    this.currentCharacter.position.copy(playerPosition);
    this.currentCharacter.position.y -= 1.5; // Adjust based on character height
  }

  /**
   * Update character rotation to face movement direction
   */
  private updateCharacterRotation(): void {
    if (!this.currentCharacter) return;
    
    // Get player's look direction
    const playerRotation = this.getPlayerRotation();
    
    // Only update Y rotation (yaw) to keep character upright
    this.currentCharacter.rotation.y = playerRotation.y;
  }

  /**
   * Update animation state based on player movement
   */
  private updateAnimationState(): void {
    if (!this.currentClass) return;
    
    const movementState = this.getCurrentMovementState();
    const newAnimationState = this.determineAnimationState(movementState);
    
    // Only change animation if state has changed
    if (newAnimationState !== this.currentAnimationState) {
      this.animationManager.setAnimationState(this.currentClass, newAnimationState);
      this.currentAnimationState = newAnimationState;
    }
    
    // this._lastMovementState = movementState; // This line was removed
  }

  /**
   * Determine what animation state should be playing
   */
  private determineAnimationState(state: PlayerMovementState): AnimationState {
    // Priority order: swing > jumping/falling > running > idle
    
    // Special swing animation for grapple class
    if (state.isSwinging && this.currentClass === 'grapple') {
      return 'swing';
    }
    
    // Airborne states
    if (!state.isGrounded) {
      if (state.isFalling) {
        return 'falling';
      } else if (state.isJumping) {
        return 'running_jump';
      }
    }
    
    // Ground movement
    if (state.isMoving && state.speed > 1.0) {
      return 'running';
    }
    
    // Default to idle
    return 'idle';
  }

  /**
   * Get current movement state from the controller
   */
  private getCurrentMovementState(): PlayerMovementState {
    // TODO: These methods need to be exposed from FirstPersonController
    // For now, using placeholder values - you'll need to add these getters
    return {
      isGrounded: this.getIsGrounded(),
      isMoving: this.getIsMoving(),
      isJumping: this.getIsJumping(),
      isFalling: this.getIsFalling(),
      isSwinging: this.getIsSwinging(),
      speed: this.getCurrentSpeed()
    };
  }

  /**
   * Remove current character from scene
   */
  private removeCurrentCharacter(): void {
    if (this.currentCharacter) {
      this.scene.remove(this.currentCharacter);
      this.currentCharacter = null;
      this.currentClass = null;
    }
  }

  /**
   * Setup event listeners for game state changes
   */
  private setupEventListeners(): void {
    // Listen for class changes from the game state
    window.addEventListener('classChanged', (event: Event) => {
      const customEvent = event as CustomEvent<{ class: PlayerClass }>;
      this.switchCharacter(customEvent.detail.class).catch(console.error);
    });
    
    // Listen for ability usage to trigger special animations
    window.addEventListener('abilityUsed', (event: Event) => {
      const customEvent = event as CustomEvent<{ ability: string }>;
      this.handleAbilityAnimation(customEvent.detail.ability);
    });
  }

  /**
   * Handle special animations for ability usage
   */
  private handleAbilityAnimation(ability: string): void {
    if (!this.currentClass) return;
    
    // Trigger special animations based on ability
    switch (ability) {
      case 'swing':
        if (this.currentClass === 'grapple') {
          this.animationManager.setAnimationState(this.currentClass, 'swing');
          this.currentAnimationState = 'swing';
        }
        break;
      // Add other ability-specific animations as needed
    }
  }

  /**
   * Preload all character animations for smooth switching
   */
  public async preloadAllCharacters(): Promise<void> {
    try {
      await this.animationManager.preloadAllCharacters();
      console.log('✅ All character animations preloaded');
    } catch (error) {
      console.error('❌ Failed to preload characters:', error);
      throw error;
    }
  }

  // TODO: These methods need to be added to FirstPersonController
  // or accessed through a different interface
  
  private getPlayerPosition(): THREE.Vector3 {
    // Placeholder - needs to be implemented to get actual player position
    // from the physics body in FirstPersonController
    return new THREE.Vector3(0, 0, 0);
  }

  private getPlayerRotation(): THREE.Euler {
    // Placeholder - needs to get camera rotation from FirstPersonController
    return new THREE.Euler(0, 0, 0);
  }

  private getIsGrounded(): boolean {
    // Placeholder - needs to access isGrounded from FirstPersonController
    return true;
  }

  private getIsMoving(): boolean {
    // Placeholder - needs to check if player is moving
    return false;
  }

  private getIsJumping(): boolean {
    // Placeholder - needs to check if player is jumping
    return false;
  }

  private getIsFalling(): boolean {
    // Placeholder - needs to check if player is falling
    return false;
  }

  private getIsSwinging(): boolean {
    // Placeholder - needs to access swing state from FirstPersonController
    return false;
  }

  private getCurrentSpeed(): number {
    // Placeholder - needs to get current movement speed
    return 0;
  }

  /**
   * Get the current character model for external access
   */
  public getCurrentCharacterModel(): THREE.Group | null {
    return this.currentCharacter;
  }

  /**
   * Get the current character class
   */
  public getCurrentClass(): PlayerClass | null {
    return this.currentClass;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.removeCurrentCharacter();
    this.animationManager.dispose();
    
    // Remove event listeners (would need to store bound handlers for proper cleanup)
    // window.removeEventListener('classChanged', ...);
    // window.removeEventListener('abilityUsed', ...);
    
    console.log('🧹 PlayerCharacterManager disposed');
  }
} 