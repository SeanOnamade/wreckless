import type { PlayerClass } from '../kits/classKit';
import { setPlayerClass } from '../kits/classKit';
import type { RaceRoundSystem } from '../systems/RaceRoundSystem';
import type { MultiplayerManager } from '../net/MultiplayerManager';
import { Network } from '../net';

export type GameState = 'initializing' | 'homescreen' | 'class-selection' | 'singleplayer' | 'lobby' | 'race' | 'leaderboard';
export type GameMode = 'singleplayer' | 'multiplayer';

export interface GameStateContext {
  selectedClass?: PlayerClass;
  gameMode?: GameMode;
  isOnline?: boolean;
  lobbyData?: any;
}

export class GameStateManager {
  private currentState: GameState = 'initializing';
  private context: GameStateContext = {};
  private stateChangeCallbacks: ((state: GameState, context: GameStateContext) => void)[] = [];
  
  // Integration with existing systems
  private roundSystem?: RaceRoundSystem;
  // private _multiplayerManager?: MultiplayerManager; // Reserved for future multiplayer features
  private physicsWorld?: any; // Will be set from main.ts
  private inputBlocked: boolean = false;
  
  // UI component references (will be set when components are created)
  private homeScreen?: any;
  private classSelection?: any;
  private lobbyScreen?: any;
  
  // Existing round UI components (to hide/show when needed)
  private roundStartUI?: any;
  // private _roundEndUI?: any; // Reserved for future UI integration
  
  constructor() {
    console.log('🎮 GameStateManager initialized');
    this.setupEventListeners();
  }
  
  /**
   * Initialize with existing game systems
   */
  public initialize(systems: {
    roundSystem?: RaceRoundSystem;
    multiplayerManager?: MultiplayerManager;
    physicsWorld?: any;
  }) {
    this.roundSystem = systems.roundSystem;
    // this._multiplayerManager = systems.multiplayerManager;
    this.physicsWorld = systems.physicsWorld;
    
    console.log('🔗 GameStateManager integrated with existing systems');
    
    // Set up round system callbacks for race flow
    if (this.roundSystem) {
      this.roundSystem.addCallbacks({
        onStateChange: (roundState) => {
          if (roundState === 'ended') {
            this.transitionTo('leaderboard');
          }
        },
        onRoundEnd: (finalScore, events) => {
          // Send final score to server for leaderboard (multiplayer only)
          if (this.context.gameMode === 'multiplayer') {
            console.log(`🏆 Race ended - sending score to server: ${finalScore} points`);
            // Network class handles connection checks internally
            Network.sendFinalScore(finalScore, events);
          }
        }
      });
    }
  }
  
  /**
   * Register UI components
   */
  public registerComponents(components: {
    homeScreen?: any;
    classSelection?: any;
    lobbyScreen?: any;
  }) {
    this.homeScreen = components.homeScreen;
    this.classSelection = components.classSelection;
    this.lobbyScreen = components.lobbyScreen;
    console.log('🔗 UI components registered with GameStateManager');
  }
  
  /**
   * Register existing round UI components for control
   */
  public registerRoundUIComponents(components: {
    roundStartUI?: any;
    roundEndUI?: any;
  }) {
    this.roundStartUI = components.roundStartUI;
    // this._roundEndUI = components.roundEndUI;
    console.log('🔗 Round UI components registered with GameStateManager');
  }
  
  /**
   * Get current state
   */
  public getCurrentState(): GameState {
    return this.currentState;
  }
  
  /**
   * Get current context
   */
  public getContext(): GameStateContext {
    return { ...this.context };
  }

  /**
   * Update context properties
   */
  public updateContext(updates: Partial<GameStateContext>): void {
    this.context = { ...this.context, ...updates };
  }
  
  /**
   * Transition to a new state
   */
  public transitionTo(newState: GameState, contextUpdates: Partial<GameStateContext> = {}) {
    const previousState = this.currentState;
    
    // Update context
    this.context = { ...this.context, ...contextUpdates };
    
    // Validate transition
    if (!this.isValidTransition(previousState, newState)) {
      console.warn(`🚫 Invalid state transition: ${previousState} → ${newState}`);
      return false;
    }
    
    console.log(`🔄 State transition: ${previousState} → ${newState}`, this.context);
    
    // Perform state-specific setup
    this.onStateEnter(newState);
    
    // Update current state
    this.currentState = newState;
    
    // Notify listeners
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(newState, this.context);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
    
    return true;
  }
  
  /**
   * Handle mode selection from homescreen
   */
  public selectMode(mode: GameMode) {
    if (this.currentState !== 'homescreen') {
      console.warn('Mode selection only available from homescreen');
      return;
    }
    
    this.context.gameMode = mode;
    this.context.isOnline = mode === 'multiplayer';
    
    if (mode === 'singleplayer') {
      // Singleplayer: go to class selection first
      this.transitionTo('class-selection', { gameMode: mode });
    } else {
      // Multiplayer: go directly to lobby (class selection happens there)
      this.joinLobby();
    }
  }
  
  /**
   * Handle class selection
   */
  public selectClass(playerClass: PlayerClass) {
    if (this.currentState !== 'class-selection') {
      console.warn('Class selection only available from class selection screen');
      return;
    }
    
    this.context.selectedClass = playerClass;
    
    // Set the class in the existing system
    setPlayerClass(playerClass);
    console.log(`🎯 Class selected: ${playerClass}`);
    
    // Transition based on game mode
    if (this.context.gameMode === 'singleplayer') {
      this.startSingleplayer();
    } else if (this.context.gameMode === 'multiplayer') {
      this.joinLobby();
    }
  }
  
  /**
   * Start singleplayer game
   */
  public startSingleplayer() {
    if (!this.context.selectedClass) {
      console.warn('Cannot start singleplayer without selected class');
      return;
    }
    
    console.log('🎮 Starting singleplayer game...');
    
    // Transition to race state
    this.transitionTo('race', { gameMode: 'singleplayer' });
    
    // Reset key states before starting race to prevent stuck keys
    if (this.physicsWorld?.fpsController) {
      this.physicsWorld.fpsController.resetKeyStates();
    }
    
    // Reset player to spawn position for fresh start
    window.dispatchEvent(new CustomEvent('resetToSpawn'));
    
    // Start the existing round system
    if (this.roundSystem) {
      this.roundSystem.startRound();
    } else {
      console.error('❌ Round system not available for singleplayer start');
    }
  }
  
  /**
   * Join multiplayer lobby
   */
  public joinLobby() {
    console.log('🌐 Joining multiplayer lobby...');
    
    // Always transition to lobby - let lobby screen handle offline messaging
    this.transitionTo('lobby', { gameMode: 'multiplayer' });
  }
  
  /**
   * Start multiplayer race (called from lobby)
   */
  public startMultiplayerRace() {
    if (this.currentState !== 'lobby') {
      console.warn('Can only start multiplayer race from lobby');
      return;
    }
    
    if (!this.context.selectedClass) {
      console.warn('Cannot start multiplayer race without selected class');
      console.log('🔍 DEBUG: Context state:', {
        selectedClass: this.context.selectedClass,
        gameMode: this.context.gameMode,
        fullContext: this.context
      });
      
      // Reset race starting flag in lobby to unblock UI
      window.dispatchEvent(new CustomEvent('resetRaceStarting'));
      return;
    }
    
    console.log('🏁 Starting multiplayer race...');
    
    // Reset key states before starting race to prevent stuck keys
    if (this.physicsWorld?.fpsController) {
      this.physicsWorld.fpsController.resetKeyStates();
    }
    
    // Reset player to spawn position for fresh start
    window.dispatchEvent(new CustomEvent('resetToSpawn'));
    
    this.transitionTo('race', { gameMode: 'multiplayer' });
    
    // Start the existing round system
    if (this.roundSystem) {
      this.roundSystem.startRound();
    }
  }
  
  /**
   * Return to homescreen (from leaderboard or manual request)
   */
  public returnToHome() {
    console.log('🏠 Returning to homescreen...');
    
    // Reset context
    this.context = {};
    
    // Reset existing game systems
    if (this.roundSystem) {
      this.roundSystem.resetRound();
    }
    
    // Dispatch reset events for existing systems
    window.dispatchEvent(new CustomEvent('roundReset'));
    window.dispatchEvent(new CustomEvent('resetPlayerPosition'));
    window.dispatchEvent(new CustomEvent('clearCombatLog'));
    window.dispatchEvent(new CustomEvent('resetAllDummies'));
    
    this.transitionTo('homescreen');
  }
  
  /**
   * Return to multiplayer lobby for another round (preserves selectedClass)
   */
  public returnToLobby() {
    console.log('🌐 Returning to multiplayer lobby...');
    
    // Preserve selectedClass when returning to lobby for another round
    const preservedClass = this.context.selectedClass;
    
    // Reset context but preserve class selection
    this.context = { 
      selectedClass: preservedClass,
      gameMode: 'multiplayer' 
    };
    
    // Reset existing game systems
    if (this.roundSystem) {
      this.roundSystem.resetRound();
    }
    
    // Dispatch reset events for existing systems
    window.dispatchEvent(new CustomEvent('roundReset'));
    window.dispatchEvent(new CustomEvent('resetPlayerPosition'));
    window.dispatchEvent(new CustomEvent('clearCombatLog'));
    window.dispatchEvent(new CustomEvent('resetAllDummies'));
    
    this.transitionTo('lobby', { gameMode: 'multiplayer' });
  }
  
  /**
   * Add state change listener
   */
  public onStateChange(callback: (state: GameState, context: GameStateContext) => void) {
    this.stateChangeCallbacks.push(callback);
  }
  
  /**
   * Block player input during menus
   */
  private blockInput(): void {
    this.inputBlocked = true;
    
    // Exit pointer lock to allow menu interaction
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    // Reset key states to prevent stuck keys when transitioning to menus
    if (this.physicsWorld?.fpsController) {
      this.physicsWorld.fpsController.resetKeyStates();
    }
    
    // Set global flag that the controller can check
    (window as any).gameInputBlocked = true;
    
    console.log('🔒 Input blocked for menu state');
  }
  
  /**
   * Unblock player input during gameplay
   */
  private unblockInput(): void {
    this.inputBlocked = false;
    
    // Reset key states to ensure clean start when entering gameplay
    if (this.physicsWorld?.fpsController) {
      this.physicsWorld.fpsController.resetKeyStates();
    }
    
    // Clear global flag
    (window as any).gameInputBlocked = false;
    
    console.log('🔓 Input unblocked for gameplay');
  }
  
  /**
   * Check if input is currently blocked
   */
  public isInputBlocked(): boolean {
    return this.inputBlocked;
  }
  
  /**
   * Validate if a state transition is allowed
   */
  private isValidTransition(from: GameState, to: GameState): boolean {
    const validTransitions: Record<GameState, GameState[]> = {
      'initializing': ['homescreen'],
      'homescreen': ['class-selection', 'lobby'], // Allow direct multiplayer lobby access
      'class-selection': ['singleplayer', 'lobby', 'homescreen', 'race'], // Allow direct race start
      'singleplayer': ['race'],
      'lobby': ['race', 'homescreen'],
      'race': ['leaderboard', 'homescreen'], // Allow quitting race to main menu
      'leaderboard': ['homescreen', 'lobby'] // Can return to lobby for another round
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
  
  /**
   * Handle entering a new state
   */
  private onStateEnter(state: GameState) {
    switch (state) {
      case 'initializing':
        // Hide all UI during initialization
        this.hideAllUI();
        this.blockInput(); // Block input during initialization
        console.log('🔄 GameStateManager: Initializing...');
        break;
        
      case 'homescreen':
        this.hideAllUI();
        this.blockInput(); // Block player movement in menu
        this.homeScreen?.show();
        console.log('🏠 GameStateManager: Homescreen state entered, UI should be visible');
        break;
        
      case 'class-selection':
        this.hideAllUI();
        this.blockInput(); // Block player movement in menu
        this.classSelection?.show();
        break;
        
      case 'lobby':
        this.hideAllUI();
        this.blockInput(); // Block player movement in menu
        this.lobbyScreen?.show();
        break;
        
      case 'race':
        this.hideAllUI();
        this.unblockInput(); // Enable player movement for gameplay
        this.showGameUI();
        // Don't show round start UI here - let the round system handle it naturally
        break;
        
      case 'leaderboard':
        this.blockInput(); // Block movement during leaderboard
        // Game UI stays visible, leaderboard overlays
        break;
    }
  }
  
  /**
   * Hide all menu UI components
   */
  private hideAllUI() {
    this.homeScreen?.hide();
    this.classSelection?.hide();
    this.lobbyScreen?.hide();
    
    // Also hide existing round UI when showing menu screens
    if (this.roundStartUI?.hide) {
      this.roundStartUI.hide();
      console.log('🏠 GameStateManager: Hiding RoundStartUI');
    }
  }
  
  /**
   * Show game UI (existing HUD components)
   */
  private showGameUI() {
    // Game HUD components are already initialized and self-managing
    // Just ensure they're visible
    console.log('🎮 Game UI active - existing HUD components managing themselves');
  }
  
  /**
   * Setup event listeners for integration with existing systems
   */
  private setupEventListeners() {
    // Listen for ESC key to handle menu transitions (except during race where GameMenu handles it)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentState !== 'race') {
        this.handleEscapeKey();
      }
    });
    
    // Listen for game reset events (kept for other potential uses)
    window.addEventListener('game-reset', () => {
      if (this.currentState === 'race') {
        this.returnToHome();
      }
    });
    
    // Listen for return to home events from pause menu
    window.addEventListener('return-to-home', () => {
      if (this.currentState === 'race') {
        this.returnToHome();
      }
    });
    
    // Listen for main menu requests from pause menu (clean transition)
    window.addEventListener('main-menu-requested', () => {
      if (this.currentState === 'race') {
        console.log('🏠 Main menu requested from pause menu');
        
        // Reset context
        this.context = {};
        
        // Reset game state WITHOUT triggering round system restart UI
        if (this.roundSystem) {
          this.roundSystem.resetStateOnly(); // Clean reset without UI triggers
        }
        
        // Reset key states when returning to main menu
        if (this.physicsWorld?.fpsController) {
          this.physicsWorld.fpsController.resetKeyStates();
        }
        
        window.dispatchEvent(new CustomEvent('roundReset'));
        window.dispatchEvent(new CustomEvent('resetToSpawn')); // Reset to spawn, not checkpoint
        window.dispatchEvent(new CustomEvent('clearCombatLog'));
        window.dispatchEvent(new CustomEvent('resetAllDummies'));
        
        // Clean transition to homescreen
        this.transitionTo('homescreen');
      }
    });

    // Listen for multiplayer race start events from networking
    window.addEventListener('multiplayerRaceStart', () => {
      if (this.currentState === 'lobby') {
        console.log('🏁 Multiplayer race start received - transitioning all players to race');
        this.startMultiplayerRace();
      }
    });
  }
  
  /**
   * Handle ESC key based on current state
   */
  private handleEscapeKey() {
    switch (this.currentState) {
      case 'class-selection':
      case 'lobby':
        this.returnToHome();
        break;
        
      case 'race':
        // Don't handle ESC during race - let the GameMenu pause system handle it
        return;
        
      case 'leaderboard':
        this.returnToHome();
        break;
        
      // homescreen: do nothing (already at top level)
    }
  }
  
  /**
   * Cleanup
   */
  public destroy() {
    this.stateChangeCallbacks = [];
    console.log('🧹 GameStateManager destroyed');
  }
}

// Singleton instance
export const gameStateManager = new GameStateManager(); 