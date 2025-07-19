import type { RaceRoundSystem, ScoreEvent } from '../systems/RaceRoundSystem';
import { gameStateManager } from '../state/GameStateManager';
import { NetworkManager_Instance as Network } from '../net/Network';

// Constants for configuration
const VOTE_TIMEOUT_SECONDS = 30;
const DEFAULT_PLAYER_COUNT = 2;
const TRANSITION_DELAY_MS = 300;
const RESULT_DISPLAY_DELAY_MS = 1000;

// Type definitions
interface LeaderboardPlayer {
  rank: number;
  playerId: string;
  playerClass: string;
  score: number;
  events: any[]; // Keep as any[] since events structure varies
}

interface LeaderboardData {
  leaderboard: LeaderboardPlayer[];
  totalPlayers: number;
}

interface VoteState {
  anotherRound: number;
  backToMenu: number;
  totalPlayers: number;
  unanimous: boolean;
  decision?: 'anotherRound' | 'backToMenu';
}

export class RoundEndUI {
  private roundSystem: RaceRoundSystem;
  private overlay!: HTMLDivElement;
  private menuButton!: HTMLButtonElement;  // Day 6 Sprint: Return to menu button
  private anotherRoundButton!: HTMLButtonElement;  // Day 6 Sprint: Another round button for multiplayer
  private isVisible = false;
  private isDestroyed = false;
  private boundKeyHandler: (event: KeyboardEvent) => void;
  private boundMenuHandler: () => void;  // Day 6 Sprint: Menu button handler
  private boundAnotherRoundHandler: () => void;  // Day 6 Sprint: Another round button handler
  private boundVoteUpdateHandler: EventListener;  // Vote update handler (properly typed)
  private boundLeaderboardHandler: EventListener;  // Leaderboard update handler (properly typed)
  
  // Voting state
  private currentVoteState: VoteState | null = null;
  
  // Timeout for voting
  private voteTimeout: number | null = null;
  
  // Countdown timer
  private countdownInterval: number | null = null;
  private countdownElement: HTMLDivElement | null = null;
  private remainingTime: number = VOTE_TIMEOUT_SECONDS;
  
  // Leaderboard state
  private leaderboardData: LeaderboardData | null = null;
  private leaderboardContainer: HTMLDivElement | null = null;
  
  /**
   * Safe DOM manipulation helper
   */
  private safeAppendChild(parent: Element | null, child: Element | null): boolean {
    if (!parent || !child) {
      console.warn('🔧 RoundEndUI: Cannot append child - parent or child is null');
      return false;
    }
    try {
      parent.appendChild(child);
      return true;
    } catch (error) {
      console.error('🔧 RoundEndUI: Error appending child:', error);
      return false;
    }
  }
  
  /**
   * Safe element creation with error handling (currently unused but kept for future use)
   */
  // private _safeCreateElement(tag: string, styles?: string, content?: string): HTMLElement | null {
  //   try {
  //     const element = document.createElement(tag);
  //     if (styles) {
  //       element.style.cssText = styles;
  //     }
  //     if (content) {
  //       element.textContent = content;
  //     }
  //     return element;
  //   } catch (error) {
  //     console.error(`🔧 RoundEndUI: Error creating ${tag} element:`, error);
  //     return null;
  //   }
  // }
  
  constructor(roundSystem: RaceRoundSystem) {
    this.roundSystem = roundSystem;
    
    // Bind event handlers
    this.boundKeyHandler = this.handleKeyPress.bind(this);
    this.boundMenuHandler = this.handleMenuVote.bind(this);  // Day 6 Sprint: Bind menu vote handler
    this.boundAnotherRoundHandler = this.handleAnotherRoundVote.bind(this);  // Day 6 Sprint: Bind another round vote handler
    
    // Create wrapper functions for proper EventListener typing
    this.boundVoteUpdateHandler = (event: Event) => {
      this.handleVoteUpdate(event as CustomEvent);
    };
    this.boundLeaderboardHandler = (event: Event) => {
      this.handleLeaderboardUpdate(event as CustomEvent);
    };
    
    this.createOverlay();
    this.setupEventListeners();
  }
  
  private createOverlay(finalScore?: number, events?: ScoreEvent[]): void {
    // Create full-screen overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 30% 20%, rgba(255, 215, 0, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 70% 80%, rgba(0, 255, 136, 0.1) 0%, transparent 50%),
        linear-gradient(135deg, rgba(0, 0, 20, 0.95) 0%, rgba(20, 10, 0, 0.95) 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-family: 'Courier New', monospace;
      color: white;
      transition: opacity 0.5s ease-out, transform 0.5s ease-out;
      backdrop-filter: blur(10px);
    `;
    
    // Create main content container
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      text-align: center;
      background: linear-gradient(135deg, rgba(20, 15, 0, 0.95), rgba(40, 20, 0, 0.9));
      padding: 50px 70px;
      border-radius: 20px;
      border: 3px solid rgba(255, 215, 0, 0.6);
      box-shadow: 
        0 0 50px rgba(255, 215, 0, 0.3),
        0 0 100px rgba(255, 215, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      max-width: 600px;
      min-width: 500px;
      backdrop-filter: blur(20px);
    `;
    
    // Create "Round Complete" title
    const title = document.createElement('h1');
    title.style.cssText = `
      font-size: 42px;
      font-weight: bold;
      margin: 0 0 15px 0;
      color: #ffd700;
      text-shadow: 
        0 0 30px rgba(255, 215, 0, 0.8),
        0 0 60px rgba(255, 215, 0, 0.4),
        0 0 90px rgba(255, 215, 0, 0.2);
      animation: endTitleGlow 2s ease-in-out infinite alternate;
    `;
    title.textContent = 'ROUND COMPLETE!';
    
    // Create final score display
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      font-size: 36px;
      font-weight: bold;
      margin: 20px 0 30px 0;
      color: #00ff88;
      text-shadow: 
        0 0 20px rgba(0, 255, 136, 0.8),
        0 0 40px rgba(0, 255, 136, 0.4);
    `;
    scoreContainer.innerHTML = `Final Score: <span id="finalScore">${finalScore || 0}</span> pts`;
    
    // Create score breakdown container
    const breakdownContainer = document.createElement('div');
    breakdownContainer.id = 'scoreBreakdown';
    breakdownContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0 30px 0;
      font-size: 16px;
      line-height: 1.5;
    `;
    
    // Populate breakdown if events provided
    if (events) {
      this.populateScoreBreakdown(breakdownContainer, events);
    }
    
    // Create buttons - different for multiplayer vs singleplayer
    const isMultiplayer = gameStateManager.getContext().gameMode === 'multiplayer';
    
    // Create button container for proper layout
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-top: 15px;
      flex-wrap: wrap;
    `;
    
    // Common button styles
    const buttonStyles = `
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: bold;
      padding: 12px 20px;
      color: white;
      border: 2px solid;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      min-width: 160px;
    `;
    
    if (isMultiplayer) {
      // Create "Another Round" button for multiplayer
      this.anotherRoundButton = document.createElement('button');
      this.anotherRoundButton.style.cssText = buttonStyles + `
        background: linear-gradient(45deg, #00C851, #00A83F);
        border-color: rgba(0, 200, 81, 0.5);
        box-shadow: 
          0 0 15px rgba(0, 200, 81, 0.3),
          0 4px 10px rgba(0, 0, 0, 0.3);
      `;
      this.anotherRoundButton.textContent = '🔄 ANOTHER ROUND';
      this.anotherRoundButton.addEventListener('click', this.boundAnotherRoundHandler);
      
      // Add hover effect for another round button
      this.anotherRoundButton.addEventListener('mouseenter', () => {
        this.anotherRoundButton.style.transform = 'scale(1.05)';
        this.anotherRoundButton.style.boxShadow = `
          0 0 20px rgba(0, 200, 81, 0.5),
          0 6px 15px rgba(0, 0, 0, 0.4)`;
        this.anotherRoundButton.style.background = 'linear-gradient(45deg, #00E65F, #00C851)';
      });
      this.anotherRoundButton.addEventListener('mouseleave', () => {
        this.anotherRoundButton.style.transform = 'scale(1)';
        this.anotherRoundButton.style.boxShadow = `
          0 0 15px rgba(0, 200, 81, 0.3),
          0 4px 10px rgba(0, 0, 0, 0.3)`;
        this.anotherRoundButton.style.background = 'linear-gradient(45deg, #00C851, #00A83F)';
      });
      
      this.safeAppendChild(buttonContainer, this.anotherRoundButton);
    }
    
    // Create return to menu button (always present)
    this.menuButton = document.createElement('button');
    this.menuButton.style.cssText = buttonStyles + `
      background: linear-gradient(45deg, #666666, #888888);
      border-color: rgba(136, 136, 136, 0.5);
      box-shadow: 
        0 0 15px rgba(136, 136, 136, 0.3),
        0 4px 10px rgba(0, 0, 0, 0.3);
    `;
    this.menuButton.textContent = '🏠 BACK TO MENU';
    this.menuButton.addEventListener('click', this.boundMenuHandler);
    
    // Add hover effect for menu button
    this.menuButton.addEventListener('mouseenter', () => {
      this.menuButton.style.transform = 'scale(1.05)';
      this.menuButton.style.boxShadow = `
        0 0 20px rgba(136, 136, 136, 0.5),
        0 6px 15px rgba(0, 0, 0, 0.4)`;
      this.menuButton.style.background = 'linear-gradient(45deg, #777777, #999999)';
    });
    this.menuButton.addEventListener('mouseleave', () => {
      this.menuButton.style.transform = 'scale(1)';
      this.menuButton.style.boxShadow = `
        0 0 15px rgba(136, 136, 136, 0.3),
        0 4px 10px rgba(0, 0, 0, 0.3)`;
      this.menuButton.style.background = 'linear-gradient(45deg, #666666, #888888)';
    });
    
    this.safeAppendChild(buttonContainer, this.menuButton);
    
    // Create countdown timer (for multiplayer only)
    const gameMode = gameStateManager.getContext().gameMode;
    if (gameMode === 'multiplayer' && Network.isNetworkingEnabled()) {
      this.countdownElement = document.createElement('div');
      this.countdownElement.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        margin: 15px 0;
        color: #ffaa00;
        text-shadow: 0 0 10px rgba(255, 170, 0, 0.8);
        text-align: center;
        animation: countdownPulse 1s ease-in-out infinite alternate;
      `;
      this.countdownElement.textContent = `⏰ Time remaining: ${this.remainingTime}s`;
    }

    // Create leaderboard container for multiplayer
    if (gameStateManager.getContext().gameMode === 'multiplayer') {
      this.leaderboardContainer = document.createElement('div');
      this.leaderboardContainer.style.cssText = `
        margin: 20px 0;
        padding: 15px;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(255, 215, 0, 0.1));
        border-radius: 15px;
        border: 2px solid rgba(255, 215, 0, 0.3);
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
      `;
      
      // Initial message while waiting for leaderboard
      this.leaderboardContainer.innerHTML = `
        <div style="
          text-align: center;
          color: #ffd700;
          font-size: 18px;
          opacity: 0.7;
        ">⏳ Waiting for other players...</div>
      `;
    }

    // Assemble the overlay with safety checks
    this.safeAppendChild(contentContainer, title);
    if (this.countdownElement) {
      this.safeAppendChild(contentContainer, this.countdownElement);
    }
    this.safeAppendChild(contentContainer, scoreContainer);
    this.safeAppendChild(contentContainer, breakdownContainer);
    if (this.leaderboardContainer) {
      this.safeAppendChild(contentContainer, this.leaderboardContainer);
    }
    this.safeAppendChild(contentContainer, buttonContainer);
    this.safeAppendChild(this.overlay, contentContainer);
    
    // Safely append to document body
    if (document.body) {
      this.safeAppendChild(document.body, this.overlay);
    } else {
      console.error('🔧 RoundEndUI: Cannot append overlay - document.body is null');
    }
    
    // Add CSS animations
    if (!document.querySelector('#roundEndAnimations')) {
      const style = document.createElement('style');
      style.id = 'roundEndAnimations';
      style.textContent = `
        @keyframes endTitleGlow {
          0% { 
            text-shadow: 
              0 0 30px rgba(255, 215, 0, 0.8),
              0 0 60px rgba(255, 215, 0, 0.4),
              0 0 90px rgba(255, 215, 0, 0.2);
          }
          100% { 
            text-shadow: 
              0 0 40px rgba(255, 215, 0, 1),
              0 0 80px rgba(255, 215, 0, 0.6),
              0 0 120px rgba(255, 215, 0, 0.3);
          }
        }
        @keyframes countdownPulse {
          0% { 
            color: #ffaa00;
            text-shadow: 0 0 10px rgba(255, 170, 0, 0.8);
            transform: scale(1);
          }
          100% { 
            color: #ff6600;
            text-shadow: 0 0 15px rgba(255, 102, 0, 1);
            transform: scale(1.05);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  private setupEventListeners(): void {
    // Listen for round end
    this.roundSystem.setCallbacks({
      onRoundEnd: (finalScore, events) => {
        this.show(finalScore, events);
      }
    });
  }
  
  private handleKeyPress(event: KeyboardEvent): void {
    // Day 6 Sprint: Add menu shortcut
    if (event.code === 'KeyM' && this.isVisible) {
      event.preventDefault();
      this.returnToMenu();
    }
  }
  
  // Day 6 Sprint: Return to menu functionality
  private returnToMenu(): void {
    if (!this.isVisible || this.isDestroyed) return;
    
    this.hide();
    
    // Small delay before transitioning to allow UI to hide
    setTimeout(() => {
      if (!this.isDestroyed) {
        try {
          gameStateManager.returnToHome();
        } catch (error) {
          console.error('Error returning to menu:', error);
        }
      }
    }, 300);
  }
  
  // Day 6 Sprint: Another round functionality for multiplayer (DEPRECATED - now uses voting)
  private anotherRound(): void {
    if (!this.isVisible || this.isDestroyed) return;
    
    this.hide();
    
    // Small delay before transitioning to allow UI to hide
    setTimeout(() => {
      if (!this.isDestroyed) {
        try {
          gameStateManager.returnToLobby();
        } catch (error) {
          console.error('Error returning to lobby:', error);
        }
      }
    }, 300);
  }

  // Day 6 Sprint: Vote for another round (NEW VOTING SYSTEM)
  private handleAnotherRoundVote(): void {
    if (!this.isVisible || this.isDestroyed) return;
    
    console.log('🗳️ Player voted for ANOTHER ROUND');
    
    // Check if this is multiplayer
    const isMultiplayer = gameStateManager.getContext().gameMode === 'multiplayer';
    
    if (isMultiplayer && Network.isNetworkingEnabled()) {
      // Send vote to server
      Network.voteAnotherRound();
    } else {
      // Single player - go directly to lobby
      this.anotherRound();
    }
  }

  // Day 6 Sprint: Vote for back to menu (NEW VOTING SYSTEM)
  private handleMenuVote(): void {
    if (!this.isVisible || this.isDestroyed) return;
    
    console.log('🗳️ Player voted for BACK TO MENU');
    
    // Check if this is multiplayer
    const isMultiplayer = gameStateManager.getContext().gameMode === 'multiplayer';
    
    if (isMultiplayer && Network.isNetworkingEnabled()) {
      // Send vote to server
      Network.voteBackToMenu();
    } else {
      // Single player - go directly to menu
      this.returnToMenu();
    }
  }

  // Handle vote updates from server
  private handleVoteUpdate(event: CustomEvent): void {
    if (!this.isVisible || this.isDestroyed) return;
    
    const voteState = event.detail;
    console.log('🗳️ RoundEndUI: Processing vote update:', voteState);
    
    this.currentVoteState = voteState;
    this.updateVoteDisplay();
    
    // If unanimous decision reached, transition automatically
    if (voteState.unanimous && voteState.decision) {
      console.log(`🎉 Unanimous decision: ${voteState.decision}`);
      
      // Clear vote timeout since decision is reached
      if (this.voteTimeout) {
        clearTimeout(this.voteTimeout);
        this.voteTimeout = null;
        console.log('⏰ Vote timeout cleared - unanimous decision reached');
      }
      
      // Stop countdown display
      this.stopCountdown();
      
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.hide();
          
          setTimeout(() => {
            if (!this.isDestroyed) {
              if (voteState.decision === 'anotherRound') {
                try {
                  gameStateManager.returnToLobby();
                } catch (error) {
                  console.error('Error returning to lobby:', error);
                }
              } else if (voteState.decision === 'backToMenu') {
                try {
                  gameStateManager.returnToHome();
                } catch (error) {
                  console.error('Error returning to menu:', error);
                }
              }
            }
          }, TRANSITION_DELAY_MS);
        }
             }, RESULT_DISPLAY_DELAY_MS); // Display result before transitioning
     }
   }

  // Handle leaderboard updates from server
  private handleLeaderboardUpdate(event: CustomEvent): void {
    if (!this.isVisible || this.isDestroyed) return;
    
    const data = event.detail;
    console.log('🏆 RoundEndUI: Processing leaderboard update:', data);
    
    this.leaderboardData = data;
    this.updateLeaderboardDisplay();
  }

  // Update leaderboard display
  private updateLeaderboardDisplay(): void {
    if (!this.leaderboardData || !this.leaderboardContainer) return;
    
    const { leaderboard } = this.leaderboardData;
    
    let leaderboardHTML = `
      <div style="
        font-size: 24px;
        font-weight: bold;
        color: #ffd700;
        text-align: center;
        margin: 20px 0 15px 0;
        text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
      ">🏆 LEADERBOARD 🏆</div>
    `;
    
    leaderboard.forEach((player: LeaderboardPlayer, index: number) => {
      const isLocalPlayer = false; // TODO: Check if this is the local player
      const rankColor = index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#ffffff';
      const bgColor = isLocalPlayer ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)';
      
      leaderboardHTML += `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          margin: 5px 0;
          background: ${bgColor};
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          ${isLocalPlayer ? 'box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);' : ''}
        ">
          <div style="
            font-size: 18px;
            font-weight: bold;
            color: ${rankColor};
            min-width: 40px;
          ">#${player.rank}</div>
          <div style="
            flex: 1;
            margin: 0 15px;
            text-align: left;
          ">
            <div style="font-size: 16px; font-weight: bold;">${player.playerId}</div>
            <div style="font-size: 12px; color: #aaa; text-transform: capitalize;">${player.playerClass}</div>
          </div>
          <div style="
            font-size: 18px;
            font-weight: bold;
            color: #ffd700;
          ">${player.score} pts</div>
        </div>
      `;
    });
    
    this.leaderboardContainer.innerHTML = leaderboardHTML;
    console.log('🏆 Leaderboard display updated');
  }

  // Start countdown timer
  private startCountdown(): void {
    if (!this.countdownElement) return;
    
    this.remainingTime = VOTE_TIMEOUT_SECONDS;
    this.updateCountdownDisplay();
    
    this.countdownInterval = window.setInterval(() => {
      this.remainingTime--;
      this.updateCountdownDisplay();
      
      // Change color as time runs out
      if (this.remainingTime <= 10 && this.countdownElement) {
        this.countdownElement.style.color = '#ff4444';
        this.countdownElement.style.textShadow = '0 0 15px rgba(255, 68, 68, 1)';
      } else if (this.remainingTime <= 5 && this.countdownElement) {
        this.countdownElement.style.color = '#ff0000';
        this.countdownElement.style.textShadow = '0 0 20px rgba(255, 0, 0, 1)';
        this.countdownElement.style.animation = 'countdownPulse 0.5s ease-in-out infinite alternate';
      }
      
      if (this.remainingTime <= 0) {
        this.stopCountdown();
      }
    }, 1000);
  }
  
  // Update countdown display
  private updateCountdownDisplay(): void {
    if (!this.countdownElement) return;
    
    this.countdownElement.textContent = `⏰ Time remaining: ${this.remainingTime}s`;
  }
  
  // Stop countdown timer
  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  // Update button text to show vote counts
  private updateVoteDisplay(): void {
    if (!this.currentVoteState) return;
    
    const { anotherRound, backToMenu, totalPlayers, unanimous, decision } = this.currentVoteState;
    
    // Update another round button if it exists
    if (this.anotherRoundButton) {
      if (unanimous && decision === 'anotherRound') {
        this.anotherRoundButton.textContent = '✅ ANOTHER ROUND - STARTING...';
        this.anotherRoundButton.style.background = 'linear-gradient(45deg, #00FF00, #00CC00)';
      } else {
        this.anotherRoundButton.textContent = `🔄 ANOTHER ROUND (${anotherRound}/${totalPlayers})`;
      }
    }
    
    // Update menu button
    if (this.menuButton) {
      if (unanimous && decision === 'backToMenu') {
        this.menuButton.textContent = '✅ BACK TO MENU - GOING...';
        this.menuButton.style.background = 'linear-gradient(45deg, #888888, #AAAAAA)';
      } else {
        this.menuButton.textContent = `🏠 BACK TO MENU (${backToMenu}/${totalPlayers})`;
      }
    }
    
    console.log(`🗳️ Vote display updated: Another Round (${anotherRound}/${totalPlayers}), Back to Menu (${backToMenu}/${totalPlayers})`);
  }
  
  private show(finalScore: number, events: ScoreEvent[]): void {
    if (this.isVisible || this.isDestroyed) return;
    
    this.isVisible = true;
    
    // Create fresh overlay content each time to ensure event listeners work
    this.createOverlay(finalScore, events);
    
    // Set ARIA attributes for accessibility
    this.overlay.setAttribute('aria-hidden', 'false');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'round-end-title');
    
    // Show overlay with animation
    this.overlay.style.display = 'flex';
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'scale(0.9)';
    
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.overlay.style.transform = 'scale(1)';
    });
    
    // Add keyboard listener
    document.addEventListener('keydown', this.boundKeyHandler);
    
    // Add vote update listener for multiplayer
    window.addEventListener('postRaceVoteUpdate', this.boundVoteUpdateHandler);
    
    // Add leaderboard update listener for multiplayer
    window.addEventListener('leaderboardUpdate', this.boundLeaderboardHandler);
    
    // Initialize vote display for multiplayer
    const currentGameMode = gameStateManager.getContext().gameMode;
    if (currentGameMode === 'multiplayer' && Network.isNetworkingEnabled()) {
      // Initialize with 0 votes to show the count format
      this.currentVoteState = {
        anotherRound: 0,
        backToMenu: 0,
        totalPlayers: DEFAULT_PLAYER_COUNT, // Will be updated by server
        unanimous: false
      };
      this.updateVoteDisplay();
    }
    
    // Start vote timeout for multiplayer (30 seconds)
    if (currentGameMode === 'multiplayer' && Network.isNetworkingEnabled()) {
      this.voteTimeout = window.setTimeout(() => {
        console.log('⏰ Vote timeout reached - defaulting to BACK TO MENU');
        
        if (!this.isDestroyed && this.isVisible) {
          // Automatically vote for back to menu
          Network.voteBackToMenu();
          
          // Show timeout message
          if (this.menuButton) {
            this.menuButton.textContent = '⏰ TIME UP - RETURNING TO MENU...';
            this.menuButton.style.background = 'linear-gradient(45deg, #FF6B6B, #FF4444)';
          }
          
          // Force transition after short delay
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.hide();
              setTimeout(() => {
                if (!this.isDestroyed) {
                  try {
                    gameStateManager.returnToHome();
                  } catch (error) {
                    console.error('Error returning to menu after timeout:', error);
                  }
                }
              }, 300);
            }
          }, 2000);
        }
      }, 30000); // 30 seconds
      
      console.log('⏰ Vote timeout started: 30 seconds until auto-return to menu');
      
      // Start countdown display
      this.startCountdown();
    }
    
    // Focus the appropriate button after a short delay
    setTimeout(() => {
      if (!this.isDestroyed) {
        // For multiplayer, focus on "Another Round" button, otherwise menu button
        const isMultiplayer = gameStateManager.getContext().gameMode === 'multiplayer';
        if (isMultiplayer && this.anotherRoundButton) {
          this.anotherRoundButton.focus();
        } else if (this.menuButton) {
          this.menuButton.focus();
        }
      }
    }, 100);
    
    // Play celebration animation
    this.playResultAnimation(finalScore);
  }
  
  private hide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    
    // Animate out
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, 500);
    
    // Remove event listeners
    document.removeEventListener('keydown', this.boundKeyHandler);
    window.removeEventListener('postRaceVoteUpdate', this.boundVoteUpdateHandler);
    window.removeEventListener('leaderboardUpdate', this.boundLeaderboardHandler);
    
    // Clear vote timeout
    if (this.voteTimeout) {
      clearTimeout(this.voteTimeout);
      this.voteTimeout = null;
    }
    
    // Stop countdown
      this.stopCountdown();
    
    // Reset vote state
    this.currentVoteState = null;
  }
  
  private populateScoreBreakdown(container: HTMLDivElement, events: ScoreEvent[]): void {
    if (!container) return;
    
    // Count events by type
    const breakdown = {
      dummyKO: { count: 0, points: 0 },
      checkpoint: { count: 0, points: 0 },
      lap: { count: 0, points: 0 }
    };
    
    events.forEach(event => {
      breakdown[event.type].count++;
      breakdown[event.type].points += event.points;
    });
    
    // Generate breakdown HTML
    const breakdownHTML = `
      <div style="font-size: 18px; color: #ffff00; margin-bottom: 15px; font-weight: bold;">Score Breakdown:</div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Dummy Hits:</span>
        <span>${breakdown.dummyKO.count}x = <strong style="color: #00ff00;">${breakdown.dummyKO.points} pts</strong></span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Checkpoints:</span>
        <span>${breakdown.checkpoint.count}x = <strong style="color: #00ff00;">${breakdown.checkpoint.points} pts</strong></span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
        <span>Laps:</span>
        <span>${breakdown.lap.count}x = <strong style="color: #00ff00;">${breakdown.lap.points} pts</strong></span>
      </div>
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.3); padding-top: 10px; font-size: 16px; color: #cccccc;">
        Total Events: ${events.length}
      </div>
    `;
    
    container.innerHTML = breakdownHTML;
  }
  
  private playResultAnimation(finalScore: number): void {
    // Create floating score particles
    const particleCount = Math.min(10, Math.floor(finalScore / 10) + 3);
    
    for (let i = 0; i < particleCount; i++) {
      setTimeout(() => {
        this.createScoreParticle();
      }, i * 100);
    }
    
    // Rank message based on score
    let rankMessage = '';
    let rankColor = '#cccccc';
    
    if (finalScore >= 200) {
      rankMessage = '🏆 LEGENDARY RACER!';
      rankColor = '#ffd700';
    } else if (finalScore >= 150) {
      rankMessage = '🥇 CHAMPION!';
      rankColor = '#00ff00';
    } else if (finalScore >= 100) {
      rankMessage = '🥈 SKILLED DRIVER!';
      rankColor = '#c0c0c0';
    } else if (finalScore >= 50) {
      rankMessage = '🥉 ROOKIE RACER!';
      rankColor = '#cd7f32';
    } else {
      rankMessage = '🚗 KEEP PRACTICING!';
      rankColor = '#ffffff';
    }
    
    // Show rank message
    setTimeout(() => {
      const rankElement = document.createElement('div');
      rankElement.style.cssText = `
        font-size: 24px;
        font-weight: bold;
        color: ${rankColor};
        text-shadow: 0 0 10px ${rankColor}50;
        margin: 15px 0;
        animation: glow 2s ease-in-out infinite alternate;
      `;
      rankElement.textContent = rankMessage;
      
      // Add glow animation
      if (!document.querySelector('#glowAnimation')) {
        const style = document.createElement('style');
        style.id = 'glowAnimation';
        style.textContent = `
          @keyframes glow {
            from { text-shadow: 0 0 10px ${rankColor}50; }
            to { text-shadow: 0 0 20px ${rankColor}80, 0 0 30px ${rankColor}40; }
          }
        `;
        document.head.appendChild(style);
      }
      
      const contentContainer = this.overlay?.querySelector('div > div');
      if (contentContainer && rankElement) {
        // Find the button container (direct child of contentContainer)
        const buttonContainer = contentContainer.querySelector('div');
        if (buttonContainer) {
          try {
            contentContainer.insertBefore(rankElement, buttonContainer);
          } catch (error) {
            console.error('🔧 RoundEndUI: Error inserting rank element:', error);
            this.safeAppendChild(contentContainer, rankElement);
          }
        } else {
          // Fallback: safely append to contentContainer
          this.safeAppendChild(contentContainer, rankElement);
        }
      } else {
        console.warn('🔧 RoundEndUI: Cannot insert rank element - contentContainer or rankElement is null');
      }
    }, 800);
  }
  
  private createScoreParticle(): void {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      font-size: 20px;
      font-weight: bold;
      color: #ffd700;
      pointer-events: none;
      z-index: 2001;
      animation: floatUp 3s ease-out forwards;
    `;
    
    // Random starting position around the score
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
    const startY = window.innerHeight / 2 + (Math.random() - 0.5) * 100;
    
    particle.style.left = startX + 'px';
    particle.style.top = startY + 'px';
    
    // Random particle content
    const particles = ['✨', '⭐', '🌟', '💫', '🏆', '🎯'];
    particle.textContent = particles[Math.floor(Math.random() * particles.length)];
    
    // Add float animation if not already added
    if (!document.querySelector('#floatUpAnimation')) {
      const style = document.createElement('style');
      style.id = 'floatUpAnimation';
      style.textContent = `
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(0.5);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.safeAppendChild(document.body, particle);
    
    // Remove particle after animation
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 3000);
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.isVisible = false;
    
    try {
      // Remove event listeners
      document.removeEventListener('keydown', this.boundKeyHandler);
      window.removeEventListener('postRaceVoteUpdate', this.boundVoteUpdateHandler);
      window.removeEventListener('leaderboardUpdate', this.boundLeaderboardHandler);
      
      // Clear vote timeout
      if (this.voteTimeout) {
        clearTimeout(this.voteTimeout);
        this.voteTimeout = null;
      }
      
      // Stop countdown
      this.stopCountdown();
      
      // Remove DOM elements
      if (this.overlay?.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      
      // Clean up CSS animations
      const animationStyle = document.querySelector('#roundEndAnimations');
      if (animationStyle?.parentNode) {
        animationStyle.parentNode.removeChild(animationStyle);
      }
      
      // Clean up any floating particles that might still exist
      const particles = document.querySelectorAll('[style*="z-index: 2001"]');
      particles.forEach(particle => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
      
      // Clear any pending restart timeouts
      // This.restartTimeouts.forEach(timeout => clearTimeout(timeout)); // REMOVED
      // this.restartTimeouts = []; // REMOVED
    } catch (error) {
      console.error('Error cleaning up RoundEndUI:', error);
    }
    
    console.log('🧹 RoundEndUI destroyed and cleaned up');
  }
} 