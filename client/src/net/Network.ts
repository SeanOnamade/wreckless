import { io, Socket } from 'socket.io-client';

// Input state interface for clean data structure
interface InputState {
  movement: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
  };
  actions: {
    jump: boolean;        // Space key
    slide: boolean;       // Shift key
    ability: boolean;     // E key
  };
  mouse: {
    leftButton: boolean;
    rightButton: boolean;
    direction: { x: number; y: number }; // normalized mouse direction
  };
  camera: {
    yaw: number; // Camera Y-axis rotation for movement direction
    pitch?: number; // Optional, for future use
  };
  states: {
    isRocketJumping: boolean;  // Blast momentum state
    isSwinging: boolean;       // Grapple swing state
    isBlinkMomentum: boolean;  // Blink momentum state
    isSliding: boolean;        // Currently sliding
    currentAbility?: string;   // Current ability type: 'blast', 'grapple', 'blink'
  };
  timestamp: number;
}

// Server state interface (structure TBD, keeping flexible for now)
interface ServerState {
  players?: Record<string, any>;
  dummies?: Record<string, any>;
  timestamp?: number;
  [key: string]: any; // Allow flexible state structure
}

class NetworkManager {
  private socket: Socket | null = null;
  private isOnlineMode: boolean = false;
  private inputInterval: number | null = null;
  private positionInterval: number | null = null;
  private currentInput: InputState;
  private lastSentInput: InputState | null = null; // Track what we last sent to avoid spam
  private lastServerState: ServerState | null = null;
  private connectionStatus: string = 'disconnected';
  private lastHeartbeat: number = 0; // Used for position sync heartbeat
  private playerContextProvider: (() => { position: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, cameraDirection: { x: number, y: number, z: number } }) | null = null;
  
  // Dummy state management
  private dummyStateCallback: ((dummyStates: Record<string, any>) => void) | null = null;

  constructor() {
    // Initialize empty input state
    this.currentInput = {
      movement: { forward: false, backward: false, left: false, right: false },
      actions: { jump: false, slide: false, ability: false },
      mouse: { leftButton: false, rightButton: false, direction: { x: 0, y: 0 } },
      camera: { yaw: 0, pitch: 0 },
      states: { isRocketJumping: false, isSwinging: false, isBlinkMomentum: false, isSliding: false },
      timestamp: Date.now()
    };

    // Check if online mode is enabled
    this.isOnlineMode = window.location.hash.includes('#online');
    
    if (this.isOnlineMode) {
      console.log('🌐 Network: Online mode detected, initializing Socket.io connection...');
      this.initializeConnection();
    } else {
      console.log('🔌 Network: Offline mode - networking disabled');
    }
  }

  private initializeConnection(): void {
    if (!this.isOnlineMode) return;

    // Determine server URL - use localhost:3000 for development, production URL for deployment
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000'  // Correct: Server runs on 3000 locally
      : 'https://wreckless-multiplayer.fly.dev'; // Production URL (update after deployment)

    console.log(`🔗 Network: Connecting to ${serverUrl}...`);
    
    this.connectionStatus = 'connecting';
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
    });

    this.setupSocketListeners();
    this.startInputLoop();
    this.setupAbilityNetworking(); // Move here after socket is created
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connectionStatus = 'connected';
      console.log('✅ Network: Connected to server (ID:', this.socket?.id, ')');
      this.startPositionSync(); // Start sending position updates
    });

    this.socket.on('disconnect', () => {
      this.connectionStatus = 'disconnected';
      console.log('❌ Network: Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      this.connectionStatus = 'disconnected';
      console.error('🚫 Network: Connection error:', error);
    });

    // Listen for server state updates
    this.socket.on('state', (state: ServerState) => {
      this.lastServerState = state;
      
      // Process dummy state updates
      this.processDummyStates(state.dummies);
      
      // Debug log (can be removed later)
      // console.log('📦 Network: Received state update:', state);
    });

    // Listen for any other events (extensible)
    this.socket.onAny((eventName, ...args) => {
      if (eventName !== 'state') { // Don't log state events to avoid spam
        console.log(`📨 Network: Received '${eventName}' event:`, args);
      }
    });
  }

  private startInputLoop(): void {
    if (!this.socket || this.inputInterval) return;

    // Send input at 30Hz (every ~33ms) - but only when there are changes
    this.inputInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.currentInput.timestamp = Date.now();
        
        // Only send if there are meaningful changes (avoid spam)
        if (this.shouldSendInput()) {
          this.socket.emit('input', this.currentInput);
          this.lastSentInput = JSON.parse(JSON.stringify(this.currentInput)); // Deep copy
          // Reduced logging for better performance
        }
      }
    }, 1000 / 30); // 30Hz
  }

  private shouldSendInput(): boolean {
    if (!this.lastSentInput) return true; // First time sending
    
    const current = this.currentInput;
    const last = this.lastSentInput;
    
    // Check for changes in actions (compare individual properties)
    if (current.actions.jump !== last.actions.jump ||
        current.actions.slide !== last.actions.slide ||
        current.actions.ability !== last.actions.ability) {
      return true;
    }
    
    // Check for changes in states (compare individual properties)
    if (current.states.isRocketJumping !== last.states.isRocketJumping ||
        current.states.isSwinging !== last.states.isSwinging ||
        current.states.isBlinkMomentum !== last.states.isBlinkMomentum ||
        current.states.isSliding !== last.states.isSliding ||
        current.states.currentAbility !== last.states.currentAbility) {
      return true;
    }
    
    // Check for changes in movement (compare individual properties)
    if (current.movement.forward !== last.movement.forward ||
        current.movement.backward !== last.movement.backward ||
        current.movement.left !== last.movement.left ||
        current.movement.right !== last.movement.right) {
      return true;
    }
    
    // Check for significant camera changes (more than 5 degrees)
    const yawDiff = Math.abs(current.camera.yaw - last.camera.yaw);
    if (yawDiff > 0.087) { // 5 degrees in radians
      return true;
    }
    
    return false; // No significant changes
  }

  private startPositionSync(): void {
    if (!this.socket || this.positionInterval) return;

    let lastPosition = { x: 0, y: 0, z: 0 };
    let lastVelocity = { x: 0, y: 0, z: 0 };
    let syncCount = 0;
    let hasLoggedStart = false;
    
    console.log('🔄 Starting position sync at 20Hz with heartbeat...');
    
    // Send position updates at 20Hz (every 50ms) - reduced frequency for less lag
    this.positionInterval = setInterval(() => {
      if (!this.socket?.connected) return;
      
      if (!this.playerContextProvider) {
        if (syncCount === 0) {
          console.warn('⚠️ Position sync waiting for playerContextProvider...');
          syncCount++; // Prevent spam
        }
        return;
      }
      
              // Debug: Only log first successful sync
        if (!hasLoggedStart) {
          console.log(`🔍 Position sync started successfully`);
          hasLoggedStart = true;
        }
      
      if (this.socket?.connected && this.playerContextProvider) {
        try {
          const context = this.playerContextProvider();
          
          // Only send if position or velocity changed significantly
          const positionChanged = 
            Math.abs(context.position.x - lastPosition.x) > 0.01 ||
            Math.abs(context.position.y - lastPosition.y) > 0.01 ||
            Math.abs(context.position.z - lastPosition.z) > 0.01;
            
          const velocityChanged = 
            Math.abs(context.velocity.x - lastVelocity.x) > 0.1 ||
            Math.abs(context.velocity.y - lastVelocity.y) > 0.1 ||
            Math.abs(context.velocity.z - lastVelocity.z) > 0.1;
          
          // Send heartbeat every 5 seconds to keep player alive on server
          const now = Date.now();
          const needsHeartbeat = now - this.lastHeartbeat > 5000; // 5 second heartbeat
          
          if (positionChanged || velocityChanged || needsHeartbeat) {
            const positionUpdate = {
              position: context.position,
              velocity: context.velocity,
              cameraYaw: Math.atan2(context.cameraDirection.x, context.cameraDirection.z),
              timestamp: Date.now()
            };

            this.socket.emit('position', positionUpdate);
            syncCount++;
            this.lastHeartbeat = now; // Update heartbeat timestamp
            
            // Only log heartbeats and significant movement
            if (needsHeartbeat && syncCount % 20 === 0) {
              console.log(`💓 Heartbeat: Player alive on server`);
            }
            
            // Debug log every 20 sends (once per second at 20Hz)
            if (syncCount % 20 === 0) {
              console.log(`📍 Position sync: ${syncCount} updates sent, current pos: (${context.position.x.toFixed(1)}, ${context.position.y.toFixed(1)}, ${context.position.z.toFixed(1)})`);
            }
            
            // Update last sent values
            lastPosition = { ...context.position };
            lastVelocity = { ...context.velocity };
            
            // Debug log for significant movement
            if (Math.abs(context.velocity.x) > 5 || Math.abs(context.velocity.y) > 5 || Math.abs(context.velocity.z) > 5) {
              console.log('📍 Fast movement:', {
                pos: `(${context.position.x.toFixed(1)}, ${context.position.y.toFixed(1)}, ${context.position.z.toFixed(1)})`,
                vel: `(${context.velocity.x.toFixed(1)}, ${context.velocity.y.toFixed(1)}, ${context.velocity.z.toFixed(1)})`
              });
            }
          } // Removed spammy skip logs
        } catch (error) {
          console.warn('Position sync failed:', error);
        }
      }
    }, 1000 / 20); // 20Hz position updates (reduced from 25Hz)
  }

  // Public methods to update input state (to be called by game systems later)
  public updateMovementInput(forward: boolean, backward: boolean, left: boolean, right: boolean): void {
    if (!this.isOnlineMode) return;
    
    this.currentInput.movement = { forward, backward, left, right };
  }

  public updateMouseInput(leftButton: boolean, rightButton: boolean, direction: { x: number; y: number }): void {
    if (!this.isOnlineMode) return;
    
    this.currentInput.mouse = { leftButton, rightButton, direction };
  }

  public updateCameraInput(yaw: number, pitch?: number): void {
    if (!this.isOnlineMode) return;
    
    this.currentInput.camera = { yaw, pitch };
  }

  public updateActionInput(jump: boolean, slide: boolean, ability: boolean): void {
    if (!this.isOnlineMode) return;
    
    this.currentInput.actions = { jump, slide, ability };
  }

  public updateStateInput(isRocketJumping: boolean, isSwinging: boolean, isBlinkMomentum: boolean, isSliding: boolean, currentAbility?: string): void {
    if (!this.isOnlineMode) return;
    
    this.currentInput.states = { isRocketJumping, isSwinging, isBlinkMomentum, isSliding, currentAbility };
  }

  // Store player context accessors
  public setPlayerContextProvider(provider: () => { position: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, cameraDirection: { x: number, y: number, z: number } }): void {
    this.playerContextProvider = provider;
  }

  private setupAbilityNetworking(): void {
    // Listen for local ability activations to network them
    window.addEventListener('abilityActivated', (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Get current player context from provider
      let position = { x: 0, y: 0, z: 0 };
      let cameraDirection = { x: 0, y: 0, z: 1 };
      
      if (this.playerContextProvider) {
        try {
          const context = this.playerContextProvider();
          position = context.position;
          cameraDirection = context.cameraDirection;
        } catch (error) {
          console.warn('Failed to get player context for ability networking:', error);
        }
      }
      
      this.networkAbilityActivation(
        detail.className,
        position,
        cameraDirection,
        detail
      );
    });

    // Listen for blast impulse events to send position corrections
    window.addEventListener('blastSelfImpulse', (_: Event) => {
      console.log('🚀 Blast impulse event detected, scheduling position correction...');
      // Schedule position correction after physics has applied the impulse
      setTimeout(() => {
        this.sendPositionCorrectionFromProvider('blast-impulse');
      }, 50); // Small delay to let physics settle
    });

    // Listen for swing state changes for position corrections  
    window.addEventListener('swingStateChanged', (_: Event) => {
      console.log('🪝 Swing state change detected, scheduling position correction...');
      setTimeout(() => {
        this.sendPositionCorrectionFromProvider('grapple-swing');
      }, 50);
    });

    // Listen for blink teleportation
    window.addEventListener('abilityUsed', (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.ability === 'blink') {
        console.log('⚡ Blink ability used, scheduling position correction...');
        setTimeout(() => {
          this.sendPositionCorrectionFromProvider('blink-teleport');
        }, 50);
      }
    });

    // Listen for networked ability events from other players
    if (this.socket) {
      this.socket.on('abilityActivation', (abilityEvent: any) => {
        console.log(`🌟 RECEIVED REMOTE ABILITY: ${abilityEvent.abilityType}`, abilityEvent);
        
        // Dispatch event to trigger the ability effect for remote player
        window.dispatchEvent(new CustomEvent('remoteAbilityActivation', {
          detail: abilityEvent
        }));
      });
    }
  }

  private sendPositionCorrectionFromProvider(reason: string): void {
    if (!this.playerContextProvider) {
      console.warn(`Cannot send position correction for ${reason}: no context provider`);
      return;
    }
    
    try {
      const context = this.playerContextProvider();
      this.sendPositionCorrection(context.position, context.velocity, reason);
      console.log(`✅ Position correction sent for ${reason}`);
    } catch (error) {
      console.error('❌ Failed to send position correction:', error);
    }
  }

  public networkAbilityActivation(abilityType: string, position: { x: number, y: number, z: number }, cameraDirection: { x: number, y: number, z: number }, additionalData?: any): void {
    if (!this.isOnlineMode || !this.socket?.connected) return;
    
    const abilityEvent = {
      type: 'abilityActivation',
      abilityType,
      position,
      cameraDirection,
      timestamp: Date.now(),
      playerId: this.socket.id,
      additionalData
    };
    
    this.socket.emit('abilityActivation', abilityEvent);
    console.log(`🌟 NETWORKED ABILITY: ${abilityType}`, abilityEvent);
  }

  public sendPositionCorrection(position: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, reason: string): void {
    if (!this.isOnlineMode || !this.socket?.connected) return;
    
    const correction = {
      position,
      velocity,
      reason,
      timestamp: Date.now()
    };
    
    this.socket.emit('positionCorrection', correction);
    console.log(`📍 POSITION CORRECTION: ${reason}`, correction);
  }

  // Send dummy damage to server for processing
  public sendDummyDamage(dummyId: string, damage: number): void {
    if (!this.isOnlineMode || !this.socket?.connected) {
      console.warn('❌ Cannot send dummy damage: not connected');
      return;
    }

    const damageData = {
      dummyId,
      damage,
      timestamp: Date.now()
    };

    this.socket.emit('dummyDamage', damageData);
    console.log(`🎯 DUMMY DAMAGE SENT: ${dummyId} -${damage} HP`);
  }

  // Public getters for game systems to access network data
  public getLastServerState(): ServerState | null {
    return this.lastServerState;
  }

  public getConnectionStatus(): string {
    return this.connectionStatus;
  }

  public isOnline(): boolean {
    return this.isOnlineMode && this.connectionStatus === 'connected';
  }

  public isNetworkingEnabled(): boolean {
    return this.isOnlineMode;
  }

  // Clean shutdown
  public disconnect(): void {
    if (this.inputInterval) {
      clearInterval(this.inputInterval);
      this.inputInterval = null;
    }

    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }

    if (this.socket) {
      console.log('🔌 Network: Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionStatus = 'disconnected';
  }

  // Debug helper to manually inspect network state
  public getDebugInfo(): object {
    return {
      isOnlineMode: this.isOnlineMode,
      connectionStatus: this.connectionStatus,
      socketId: this.socket?.id || null,
      lastInput: this.currentInput,
      lastServerState: this.lastServerState,
      socketConnected: this.socket?.connected || false,
      hasPlayerContextProvider: !!this.playerContextProvider,
      positionSyncActive: !!this.positionInterval,
      inputSyncActive: !!this.inputInterval,
      playerCount: this.lastServerState?.players ? Object.keys(this.lastServerState.players).length : 0,
      serverPlayers: this.lastServerState?.players
    };
  }

  // Enhanced debugging for multiplayer issues
  public debugMultiplayer(): object {
    const info = this.getDebugInfo() as any;
    console.log('🔍 MULTIPLAYER DEBUG INFO:');
    console.log('================================');
    console.log('📡 Connection Status:', info.socketConnected ? '✅ Connected' : '❌ Disconnected');
    console.log('🆔 Socket ID:', info.socketId);
    console.log('👥 Players in last server state:', info.playerCount);
    
    if (info.serverPlayers) {
      console.log('🎮 Server Players:');
      for (const [id, player] of Object.entries(info.serverPlayers)) {
        const p = player as any;
        console.log(`  ${id.slice(-4)}: pos(${p.position?.x.toFixed(1)}, ${p.position?.y.toFixed(1)}, ${p.position?.z.toFixed(1)}) vel(${p.velocity?.x.toFixed(1)}, ${p.velocity?.y.toFixed(1)}, ${p.velocity?.z.toFixed(1)})`);
      }
    }
    
    console.log('📥 Current Input:', {
      actions: info.lastInput?.actions,
      states: info.lastInput?.states,
      movement: info.lastInput?.movement,
      cameraYaw: info.lastInput?.camera?.yaw?.toFixed(2)
    });
    
    console.log('🔄 Would send input now?', !this.lastSentInput || this.shouldSendInput());
    console.log('================================');
    
    return info;
  }

  // Request intensive debugging from server
  public requestServerDebug(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('🔍 Requesting intensive debug from server...');
      
      // Set up one-time listener for response
      this.socket.once('intensiveDebugResponse', (debugInfo) => {
        console.log('📡 RECEIVED SERVER DEBUG INFO:');
        console.log('=' .repeat(50));
        
        console.log('🖥️ Server Info:', debugInfo.serverInfo);
        console.log('👥 Player Details:', debugInfo.playerDetails);
        console.log('🔌 Socket Details:', debugInfo.socketDetails);
        
        // Check for issues
        const issues = [];
        if (debugInfo.serverInfo.connectedSockets !== debugInfo.serverInfo.playersInGameLogic) {
          issues.push('Socket/Player count mismatch');
        }
        
        for (const [id, player] of Object.entries(debugInfo.playerDetails)) {
          if ((player as any).isStale) {
            issues.push(`Player ${id} is stale`);
          }
        }
        
        if (issues.length > 0) {
          console.log('⚠️ ISSUES FOUND:', issues);
        } else {
          console.log('✅ No issues detected');
        }
        
        resolve(debugInfo);
      });
      
      // Send request
      this.socket.emit('intensiveDebug');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Server debug request timed out'));
      }, 5000);
    });
  }

  // Test method to manually trigger position correction
  public testPositionCorrection(): void {
    console.log('🧪 Testing position correction system...');
    
    if (!this.isOnlineMode) {
      console.log('❌ Cannot test: networking disabled');
      return;
    }
    
    if (!this.socket?.connected) {
      console.log('❌ Cannot test: socket not connected');
      return;
    }
    
    if (!this.playerContextProvider) {
      console.log('❌ Cannot test: no player context provider');
      return;
    }
    
    try {
      const context = this.playerContextProvider();
      console.log('✅ Player context:', context);
      
      this.sendPositionCorrection(
        context.position, 
        context.velocity, 
        'manual-test'
      );
      
      console.log('✅ Test position correction sent');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Test method for position sync system
  public testPositionSync(): void {
    console.log('🧪 Testing position sync system...');
    
    if (!this.isOnlineMode) {
      console.log('❌ Cannot test: networking disabled');
      return;
    }
    
    if (!this.socket?.connected) {
      console.log('❌ Cannot test: socket not connected');
      return;
    }
    
    if (!this.playerContextProvider) {
      console.log('❌ Cannot test: no player context provider');
      return;
    }
    
    if (!this.positionInterval) {
      console.log('❌ Position sync not active - starting it...');
      this.startPositionSync();
      return;
    }
    
    console.log('✅ Position sync is active at 20Hz');
    console.log(`✅ Input sync is ${this.inputInterval ? 'active' : 'inactive'} at 30Hz (change-based)`);
    
    try {
      const context = this.playerContextProvider();
      console.log('✅ Current player state:', {
        position: context.position,
        velocity: context.velocity,
        cameraDirection: context.cameraDirection
      });
    } catch (error) {
      console.error('❌ Failed to get player context:', error);
    }
  }

  // Network performance monitoring
  public getNetworkStats(): object {
    return {
      isOnline: this.isOnline(),
      connectionStatus: this.connectionStatus,
      positionSyncActive: !!this.positionInterval,
      inputSyncActive: !!this.inputInterval,
      lastSentInput: this.lastSentInput ? {
        actions: this.lastSentInput.actions,
        states: this.lastSentInput.states,
        movement: this.lastSentInput.movement
      } : null,
      currentInput: {
        actions: this.currentInput.actions,
        states: this.currentInput.states,
        movement: this.currentInput.movement
      }
    };
  }

  // Process dummy state updates from server
  private processDummyStates(dummies: Record<string, any> | undefined): void {
    if (dummies && this.dummyStateCallback) {
      this.dummyStateCallback(dummies);
    }
  }

  // Register a callback to process dummy state updates
  public registerDummyStateCallback(callback: (dummyStates: Record<string, any>) => void): void {
    this.dummyStateCallback = callback;
  }
}

// Export singleton instance
export const NetworkManager_Instance = new NetworkManager();

// Export types for use in other files
export type { InputState, ServerState }; 