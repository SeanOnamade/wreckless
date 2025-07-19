import type { GameStateManager } from '../state/GameStateManager';
import { Network } from '../net';
import { setPlayerClass, type PlayerClass } from '../kits/classKit';

// Type definitions for better type safety
interface LobbyPlayerData {
  playerId: string;
  playerClass?: PlayerClass;
  isConnected: boolean;
  lastUpdated?: number;
  isHost?: boolean;
}

export class LobbyScreen {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private stateManager: GameStateManager;
  private updateInterval: number | null = null;
  private playersListElement: HTMLDivElement | null = null;
  private startButtonElement: HTMLButtonElement | null = null;
  private allPlayersData: Record<string, LobbyPlayerData> = {}; // Store all players' class selections
  private raceStarting: boolean = false; // Prevent duplicate race start requests
  private networkingTimeouts: number[] = []; // Track timeouts for cleanup
  private isDestroyed: boolean = false; // Track component destruction
  
  // Event listener references for cleanup
  private keydownHandler: (e: KeyboardEvent) => void;
  private lobbyClassUpdateHandler: (event: any) => void;
  private resetRaceStartingHandler: () => void;
  
  constructor(stateManager: GameStateManager) {
    this.stateManager = stateManager;
    
    // Initialize event handlers
    this.keydownHandler = this.handleKeydown.bind(this);
    this.lobbyClassUpdateHandler = this.handleLobbyClassUpdate.bind(this);
    this.resetRaceStartingHandler = this.handleResetRaceStarting.bind(this);
    
    this.container = this.createUI();
    this.setupEventListeners();
    console.log('🌐 LobbyScreen component created (placeholder)');
  }
  
  /**
   * Show the lobby screen
   */
  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
    console.log('🌐 LobbyScreen shown');
    
    // Exit pointer lock when menu shows
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    // Start updating lobby information
    this.startLobbyUpdates();
    
    // Request current lobby state when joining
    if (Network.isNetworkingEnabled()) {
      // Track timeouts for proper cleanup
      const testTimeout = window.setTimeout(() => {
        if (!this.isDestroyed) {
          console.log('🧪 Testing basic networking...');
          Network.testConnection();
          const requestTimeout = window.setTimeout(() => {
            if (!this.isDestroyed) {
              Network.requestLobbyState();
            }
          }, 1000);
          this.networkingTimeouts.push(requestTimeout);
        }
      }, 1000);
      this.networkingTimeouts.push(testTimeout);
    }
  }
  
  /**
   * Hide the lobby screen
   */
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    console.log('🌐 LobbyScreen hidden');
    
    // Stop updating lobby information
    this.stopLobbyUpdates();
    
    // Reset lobby state when leaving
    this.resetLobbyState();
  }
  
  /**
   * Reset lobby state to clean defaults
   */
  private resetLobbyState(): void {
    // Reset race starting flag
    this.raceStarting = false;
    
    // Reset start button text 
    if (this.startButtonElement) {
      this.startButtonElement.textContent = '🏁 START RACE';
    }
    
    // Clear player data
    this.allPlayersData = {};
    
    console.log('🔄 Lobby state reset to defaults');
  }
  
  /**
   * Check if lobby screen is visible
   */
  public isOpen(): boolean {
    return this.isVisible;
  }
  
  /**
   * Destroy the lobby screen and clean up resources
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    this.hide();
    this.stopLobbyUpdates();
    
    // Clear all networking timeouts
    this.networkingTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.networkingTimeouts = [];
    
    // Remove event listeners
    document.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('lobbyClassUpdate', this.lobbyClassUpdateHandler);
    window.removeEventListener('resetRaceStarting', this.resetRaceStartingHandler);
    
    // Remove DOM element
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    console.log('🧹 LobbyScreen destroyed and cleaned up');
  }
  
  /**
   * Create the functional lobby screen UI
   */
  private createUI(): HTMLDivElement {
    // Main container (fullscreen overlay)
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, 
        rgba(0, 17, 34, 0.95) 0%, 
        rgba(0, 34, 68, 0.92) 50%, 
        rgba(0, 17, 34, 0.95) 100%);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2100;
      font-family: monospace;
      color: white;
      backdrop-filter: blur(10px);
    `;
    
    // Main content area
    const content = document.createElement('div');
    content.style.cssText = `
      background: rgba(0, 17, 34, 0.95);
      padding: 60px 80px;
      border-radius: 15px;
      border: 3px solid #FF0080;
      text-align: center;
      max-width: 600px;
      min-width: 500px;
      box-shadow: 0 0 30px rgba(255, 0, 128, 0.3);
      position: relative;
    `;
    
    // Title
    const title = document.createElement('h1');
    title.style.cssText = `
      margin: 0 0 15px 0;
      color: #FF0080;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
      letter-spacing: 2px;
    `;
    title.textContent = 'MULTIPLAYER LOBBY';
    
    // Connection status
    const status = document.createElement('p');
    status.id = 'lobby-status';
    status.style.cssText = `
      margin: 0 0 20px 0;
      color: #00E6FF;
      font-size: 16px;
      font-weight: normal;
      text-shadow: 0 0 10px rgba(0, 230, 255, 0.5);
    `;
    
    // Class selection section
    const classSelectionSection = document.createElement('div');
    classSelectionSection.id = 'class-selection-section';
    classSelectionSection.style.cssText = `
      margin: 20px 0;
      padding: 20px;
      background: rgba(0, 230, 255, 0.1);
      border: 1px solid #00E6FF;
      border-radius: 8px;
    `;
    
    // This will be populated by updateLobbyInfo
    this.createClassSelectionUI(classSelectionSection);
    
    // Players list
    this.playersListElement = document.createElement('div');
    this.playersListElement.style.cssText = `
      margin: 20px 0;
      padding: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      min-height: 120px;
    `;
    
    // Start race button (for host)
    this.startButtonElement = this.createButton('🏁 START RACE', '#00FF00', '#000000');
    this.startButtonElement.style.display = 'none'; // Hidden by default
    this.startButtonElement.addEventListener('click', () => {
      this.handleStartRace();
    });
    
    // Back button
    const backButton = this.createButton('🏠 BACK TO MENU', '#666666', 'white');
    backButton.addEventListener('click', () => {
      this.handleBackClick();
    });
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-top: 30px;
      flex-wrap: wrap;
    `;
    buttonContainer.appendChild(this.startButtonElement);
    buttonContainer.appendChild(backButton);
    
    // Assemble the UI
    content.appendChild(title);
    content.appendChild(status);
    content.appendChild(classSelectionSection);
    content.appendChild(this.playersListElement);
    content.appendChild(buttonContainer);
    
    container.appendChild(content);
    document.body.appendChild(container);
    
    return container;
  }
  
  /**
   * Create a styled button
   */
  private createButton(text: string, bgColor: string, textColor: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.style.cssText = `
      background: ${bgColor};
      color: ${textColor};
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
      font-size: 14px;
      letter-spacing: 1px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    button.textContent = text;
    
    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
      
      if (bgColor === '#00E6FF') {
        button.style.boxShadow += ', 0 0 20px rgba(0, 230, 255, 0.4)';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    });
    
    return button;
  }
  
  /**
   * Handle back button click
   */
  private handleBackClick(): void {
    console.log('🏠 Returning to homescreen from lobby');
    this.stateManager.transitionTo('homescreen');
  }
  
  /**
   * Handle keydown events
   */
  private handleKeydown(_e: KeyboardEvent): void {
    if (!this.isVisible) return;
    
    // Quick actions (none currently)
  }
  
  /**
   * Handle lobby class update events
   */
  private handleLobbyClassUpdate(event: any): void {
    const data = event.detail;
    console.log('🎯 Received lobbyClassUpdate event with', Object.keys(data.allPlayers).length, 'players');
    this.allPlayersData = data.allPlayers;
    this.updatePlayersDisplay();
  }
  
  /**
   * Handle race starting flag reset
   */
  private handleResetRaceStarting(): void {
    console.log('🔄 Resetting race starting flag due to error');
    this.raceStarting = false;
    
    // Reset button text back to original
    if (this.startButtonElement) {
      this.startButtonElement.textContent = '🏁 START RACE';
    }
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Handle keyboard shortcuts
    document.addEventListener('keydown', this.keydownHandler);

    // Listen for class updates from other players
    window.addEventListener('lobbyClassUpdate', this.lobbyClassUpdateHandler);
    
    // Listen for race starting flag reset
    window.addEventListener('resetRaceStarting', this.resetRaceStartingHandler);
  }
  
  /**
   * Start lobby updates loop
   */
  private startLobbyUpdates(): void {
    if (this.updateInterval) return;
    
    // Update lobby every 500ms
    this.updateInterval = setInterval(() => {
      this.updateLobbyInfo();
    }, 500);
    
    // Initial update
    this.updateLobbyInfo();
  }
  
  /**
   * Stop lobby updates loop
   */
  private stopLobbyUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Update lobby information display
   */
  private updateLobbyInfo(): void {
    if (!this.isVisible || !this.playersListElement) return;
    
    const statusElement = document.getElementById('lobby-status');
    
    // Check if networking is enabled
    if (!Network.isNetworkingEnabled()) {
      if (statusElement) {
        statusElement.textContent = '⚠️ Multiplayer requires #online URL (e.g. localhost:5173/#online)';
        statusElement.style.color = '#FFB000';
      }
      
      this.playersListElement.innerHTML = `
        <div style="color: #FFB000; font-size: 16px; font-weight: bold; margin-bottom: 10px;">
          🌐 Offline Mode
        </div>
        <div style="color: #cccccc; font-size: 14px; line-height: 1.5;">
          To access multiplayer lobbies, add <strong>#online</strong> to your URL and reload the page:<br>
          <span style="color: #00E6FF;">http://localhost:5173/#online</span>
        </div>
      `;
      
      if (this.startButtonElement) {
        this.startButtonElement.style.display = 'none';
      }
      return;
    }
    
    // Get network status and player data
    const isConnected = Network.isOnline();
    const serverState = Network.getLastServerState();
    // const _debugInfo = Network.getDebugInfo() as any;
    
    // Update connection status
    if (statusElement) {
      if (isConnected && serverState) {
        const playerCount = serverState.players ? Object.keys(serverState.players).length : 0;
        statusElement.textContent = `✅ Connected to server (${playerCount} player${playerCount !== 1 ? 's' : ''})`;
        statusElement.style.color = '#00FF00';
      } else if (Network.getConnectionStatus() === 'connecting') {
        statusElement.textContent = '🔄 Connecting to server...';
        statusElement.style.color = '#FFB000';
      } else {
        statusElement.textContent = '❌ Disconnected from server';
        statusElement.style.color = '#FF4444';
      }
    }
    
    // If we have synchronized class data, use that instead of network data
    if (Object.keys(this.allPlayersData).length > 0) {
      this.updatePlayersDisplay(); // Use class-synchronized data
    } else {
      // Fallback to network data if no class data yet
      if (serverState?.players) {
        // const _players = Object.entries(serverState.players);
        
        this.playersListElement.innerHTML = `
          <div style="color: #888888; font-size: 16px; text-align: center; padding: 20px 0;">
            🔄 Waiting for player data...
          </div>
        `;
      } else {
        this.playersListElement.innerHTML = `
          <div style="color: #888888; font-size: 16px; text-align: center; padding: 40px 0;">
            🔄 Loading lobby...
          </div>
        `;
      }
      
      if (this.startButtonElement) {
        this.startButtonElement.style.display = 'none';
      }
    }
  }
  
  /**
   * Create class selection UI
   */
  private createClassSelectionUI(container: HTMLDivElement): void {
    container.innerHTML = `
      <div style="color: #00E6FF; font-size: 16px; font-weight: bold; margin-bottom: 15px; text-align: center;">
        🎯 Choose Your Class
      </div>
      <div id="class-buttons" style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px;">
        <button id="class-blast" class="class-btn" style="
          background: linear-gradient(45deg, #ff6600, #ff8800);
          color: white;
          border: 2px solid rgba(255, 136, 0, 0.5);
          border-radius: 8px;
          padding: 8px 15px;
          cursor: pointer;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s ease;
        ">🚀 BLAST</button>
        <button id="class-grapple" class="class-btn" style="
          background: linear-gradient(45deg, #00aa00, #00cc00);
          color: white;
          border: 2px solid rgba(0, 204, 0, 0.5);
          border-radius: 8px;
          padding: 8px 15px;
          cursor: pointer;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s ease;
        ">🪝 GRAPPLE</button>
        <button id="class-blink" class="class-btn" style="
          background: linear-gradient(45deg, #4444ff, #6666ff);
          color: white;
          border: 2px solid rgba(102, 102, 255, 0.5);
          border-radius: 8px;
          padding: 8px 15px;
          cursor: pointer;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s ease;
        ">⚡ BLINK</button>
      </div>
      <div id="class-status" style="text-align: center; color: #888; font-size: 14px;">
        Select a class to continue
      </div>
    `;
    
    // Add event listeners for class buttons
    const blastBtn = container.querySelector('#class-blast') as HTMLButtonElement;
    const grappleBtn = container.querySelector('#class-grapple') as HTMLButtonElement;
    const blinkBtn = container.querySelector('#class-blink') as HTMLButtonElement;
    
    blastBtn?.addEventListener('click', () => this.selectClass('blast'));
    grappleBtn?.addEventListener('click', () => this.selectClass('grapple'));
    blinkBtn?.addEventListener('click', () => this.selectClass('blink'));
  }
  
  /**
   * Handle class selection
   */
  private selectClass(playerClass: PlayerClass): void {
    console.log(`🎯 Class selected in lobby: ${playerClass}`);
    
    // Update GameStateManager context
    this.stateManager.updateContext({ selectedClass: playerClass });
    
    // Debug: Verify context was updated
    const currentContext = this.stateManager.getContext();
    console.log('🔍 DEBUG: Context after class selection:', {
      selectedClass: currentContext.selectedClass,
      gameMode: currentContext.gameMode
    });
    
    // Also update the global class system
    setPlayerClass(playerClass);
    
    // Update UI to show selection
    this.updateClassSelectionDisplay(playerClass);
    
    // Send class selection to server (if networking enabled)
    if (Network.isNetworkingEnabled()) {
      Network.sendClassSelection(playerClass);
    }
  }
  
  /**
   * Update class selection display
   */
  private updateClassSelectionDisplay(selectedClass: PlayerClass): void {
    const statusElement = document.getElementById('class-status');
    if (statusElement) {
      statusElement.innerHTML = `
        <span style="color: #00FF00;">✅ Selected: </span>
        <span style="color: #fff; font-weight: bold; text-transform: uppercase;">${selectedClass}</span>
      `;
    }
    
    // Highlight selected button
    const buttons = document.querySelectorAll('.class-btn');
    buttons.forEach(btn => {
      const button = btn as HTMLButtonElement;
      button.style.opacity = '0.6';
      button.style.transform = 'scale(0.95)';
    });
    
    const selectedBtn = document.getElementById(`class-${selectedClass}`) as HTMLButtonElement;
    if (selectedBtn) {
      selectedBtn.style.opacity = '1';
      selectedBtn.style.transform = 'scale(1.05)';
      selectedBtn.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.5)';
    }
  }

  /**
   * Update players display with class selections
   */
  private updatePlayersDisplay(): void {
    if (!this.playersListElement || !this.isVisible) return;

    const playerCount = Object.keys(this.allPlayersData).length;
    let playersHtml = `
      <div style="color: #6432C8; font-size: 14px; font-weight: bold; margin-bottom: 10px;">
        👥 Players in Lobby (${playerCount})
      </div>
    `;

    // Display each player with their class
    Object.values(this.allPlayersData).forEach((player: any) => {
      const classDisplay = player.playerClass 
        ? `<span style="color: #00FF00;">✅ ${player.playerClass.toUpperCase()}</span>`
        : `<span style="color: #888;">❌ No class selected</span>`;
      
      const hostBadge = player.isHost ? `<span style="color: #FFD700;">👑 Host</span>` : '';
      
      playersHtml += `
        <div style="
          background: rgba(0, 230, 255, 0.1);
          border: 1px solid #00E6FF;
          border-radius: 6px;
          padding: 8px;
          margin: 5px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="color: #00E6FF;">Player ${player.id} ${hostBadge}</span>
          <span>${classDisplay}</span>
        </div>
      `;
    });

    this.playersListElement.innerHTML = playersHtml;

    // Update START button availability
    this.updateStartButtonAvailability();
  }

  /**
   * Update START button availability based on all players having classes
   */
  private updateStartButtonAvailability(): void {
    if (!this.startButtonElement) return;

    const allPlayers = Object.values(this.allPlayersData);
    const allHaveClasses = allPlayers.length > 0 && allPlayers.every((player: any) => player.playerClass);
    const debugInfo = Network.getDebugInfo() as any;
    const mySocketId = debugInfo?.socketId?.slice(-4);
    const isHost = mySocketId && this.allPlayersData[mySocketId]?.isHost;

    if (allHaveClasses && isHost) {
      this.startButtonElement.style.display = 'inline-block';
      this.startButtonElement.disabled = false;
      this.startButtonElement.style.opacity = '1';
    } else {
      this.startButtonElement.style.display = isHost ? 'inline-block' : 'none';
      this.startButtonElement.disabled = !allHaveClasses;
      this.startButtonElement.style.opacity = allHaveClasses ? '1' : '0.5';
    }
  }

  /**
   * Handle start race button
   */
  private handleStartRace(): void {
    // Prevent multiple simultaneous race start requests
    if (this.raceStarting) {
      console.log('🚫 Race start already in progress, ignoring duplicate request');
      return;
    }
    
    console.log('🏁 Host starting multiplayer race...');
    
    // Check if all players have selected classes
    const allPlayers = Object.values(this.allPlayersData);
    const playerCount = allPlayers.length;
    const playersWithClasses = allPlayers.filter((player: any) => player.playerClass).length;
    
    console.log(`🏁 Class validation: ${playersWithClasses}/${playerCount} players have classes`);
    
    if (playerCount === 0) {
      console.warn('Cannot start race - no players in lobby');
      return;
    }
    
    if (playersWithClasses < playerCount) {
      console.warn(`Cannot start race - only ${playersWithClasses}/${playerCount} players have selected classes`);
      return;
    }
    
    // Set flag to prevent duplicate requests
    this.raceStarting = true;
    
    // Disable the start button to prevent multiple clicks
    if (this.startButtonElement) {
      this.startButtonElement.disabled = true;
      this.startButtonElement.textContent = 'STARTING...';
    }
    
    // Send race start event to server (will broadcast to all clients)
    if (Network.isNetworkingEnabled()) {
      console.log('📡 Broadcasting race start to all players...');
      Network.sendRaceStart();
    } else {
      // Fallback for offline mode (shouldn't happen in lobby, but just in case)
      console.warn('Cannot start multiplayer race - networking not enabled');
      this.raceStarting = false; // Reset flag on error
    }
  }
  
} 