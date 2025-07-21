export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

export type SFXCategory = 'abilities' | 'movement' | 'ui' | 'environment' | 'combat';

// OPTIMIZED SFX VOLUME OVERRIDES (User-tested ideal values)
export const OPTIMIZED_SFX_VOLUMES: Record<string, number> = {
  // Movement SFX
  'movement/footstep_concrete.wav': 1.24,
  'movement/jump.wav': 0.36, // Optimized volume (was hardcoded at 0.4)
  'movement/land_hard.wav': 0.9,
  
  // Ability SFX  
  'abilities/blast_launch.wav': 0.32,
  'abilities/blink_teleport.wav': 0.46,
  'abilities/grapple_shoot.wav': 0.23,
  'abilities/grapple_latch.wav': 0.21,
  'abilities/ability_blocked.wav': 0.66,
  'abilities/ability_ready.wav': 0.70,
  
  // Combat SFX
  'combat/dummy_hit.wav': 0.50,
  'combat/speed_boost_gained.wav': 0.80,
  
  // UI SFX
  'ui/button_click.wav': 1.02,
  'ui/checkpoint_hit.wav': 0.68,
  
  // Environment SFX
  'environment/killzone_hit.wav': 0.13,
};

export class AudioManager {
  private static instance: AudioManager;
  private musicAudio: HTMLAudioElement | null = null;
  private ambientAudio: HTMLAudioElement | null = null;
  private sfxCache: Map<string, HTMLAudioElement> = new Map();
  private settings: AudioSettings;
  private isInitialized = false;

  // Speed-based ambient wind control (like windstreaks) - OPTIMIZED VALUES
  public currentSpeed = 0;
  public minSpeed = 20; // Speed at which wind starts being audible (user-tested)
  public maxSpeed = 30; // Speed at which wind reaches full volume (user-tested)
  public baseAmbientVolume = 5.0; // Volume when hitting min speed (user-tested, louder)
  public maxAmbientVolume = 8.0; // Max volume at high speed (user-tested, louder)

  // Storage key for persisting settings
  private static readonly STORAGE_KEY = 'wreckless_audio_settings';

  private constructor() {
    // Load settings from localStorage or use defaults
    this.settings = this.loadSettings();
    this.init();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize background music and ambient sounds
      await this.initializeMusic();
      await this.initializeAmbientSounds();
      this.isInitialized = true;
      console.log('🎵 AudioManager initialized successfully');
    } catch (error) {
      console.warn('🎵 AudioManager initialization failed:', error);
    }
  }

  private async initializeMusic(): Promise<void> {
    try {
      this.musicAudio = new Audio('/assets/audio/music/background_loop.mp3');
      this.musicAudio.loop = true;
      this.musicAudio.volume = this.settings.musicVolume;
      
      // Preload the music
      this.musicAudio.preload = 'auto';
      
      console.log('🎵 Background music initialized');
    } catch (error) {
      console.warn('🎵 Failed to initialize background music:', error);
    }
  }

  private async initializeAmbientSounds(): Promise<void> {
    try {
      this.ambientAudio = new Audio('/assets/audio/sfx/environment/ambient_wind.wav');
      this.ambientAudio.loop = true;
      
      // Set initial volume using speed-based calculation
      this.updateAmbientVolume();
      
      // Preload the ambient audio
      this.ambientAudio.preload = 'auto';
      

      
      console.log('🌬️ Ambient wind initialized');
    } catch (error) {
      console.warn('🌬️ Failed to initialize ambient wind:', error);
    }
  }

  /**
   * Start playing background music
   */
  public async playMusic(): Promise<void> {
    if (!this.musicAudio || !this.settings.musicEnabled) return;

    try {
      // Ensure audio context is resumed (required for autoplay policies)
      if (this.musicAudio.paused) {
        await this.musicAudio.play();
        console.log('🎵 Background music started');
      }
    } catch (error) {
      console.warn('🎵 Failed to play background music:', error);
    }
  }

  /**
   * Stop background music
   */
  public stopMusic(): void {
    if (this.musicAudio && !this.musicAudio.paused) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
      console.log('🎵 Background music stopped');
    }
  }

  /**
   * Pause background music
   */
  public pauseMusic(): void {
    if (this.musicAudio && !this.musicAudio.paused) {
      this.musicAudio.pause();
      console.log('🎵 Background music paused');
    }
  }

  /**
   * Resume background music
   */
  public resumeMusic(): void {
    if (this.musicAudio && this.musicAudio.paused && this.settings.musicEnabled) {
      this.musicAudio.play().catch(error => {
        console.warn('🎵 Failed to resume background music:', error);
      });
    }
  }

  /**
   * Start playing ambient sounds
   */
  public async playAmbient(): Promise<void> {
    if (!this.ambientAudio) {
      console.warn('🌬️ No ambient audio initialized');
      return;
    }
    
    if (!this.settings.sfxEnabled) {
      console.log('🌬️ SFX disabled, not starting ambient wind');
      return;
    }

    try {
      if (this.ambientAudio.paused) {
        await this.ambientAudio.play();
        console.log('🌬️ Ambient wind started');
      } else {
        console.log('🌬️ Ambient wind already playing');
      }
    } catch (error) {
      console.warn('🌬️ Failed to play ambient wind:', error);
    }
  }

  /**
   * Stop ambient sounds
   */
  public stopAmbient(): void {
    if (this.ambientAudio && !this.ambientAudio.paused) {
      this.ambientAudio.pause();
      this.ambientAudio.currentTime = 0;
      console.log('🌬️ Ambient wind stopped');
    }
  }

  /**
   * Pause ambient sounds
   */
  public pauseAmbient(): void {
    if (this.ambientAudio && !this.ambientAudio.paused) {
      this.ambientAudio.pause();
      console.log('🌬️ Ambient wind paused');
    }
  }

  /**
   * Resume ambient sounds
   */
  public resumeAmbient(): void {
    if (this.ambientAudio && this.ambientAudio.paused && this.settings.sfxEnabled) {
      this.ambientAudio.play().catch(error => {
        console.warn('🌬️ Failed to resume ambient wind:', error);
      });
    }
  }

  /**
   * Update current speed for speed-based ambient wind volume (like windstreaks)
   */
  public updateSpeed(speed: number): void {
    this.currentSpeed = speed;
    this.updateAmbientVolume();
  }

  /**
   * Update ambient wind volume based on current speed
   */
  private updateAmbientVolume(): void {
    if (!this.ambientAudio || !this.settings.sfxEnabled) return;

    // Only play wind when moving above minimum speed
    if (this.currentSpeed < this.minSpeed) {
      // Silent when below minimum speed (not moving fast enough)
      this.ambientAudio.volume = 0;
      return;
    }

    // Calculate volume based on speed (similar to windstreaks opacity logic)
    const speedAboveMin = Math.max(0, this.currentSpeed - this.minSpeed);
    const speedRange = this.maxSpeed - this.minSpeed;
    const speedRatio = Math.min(speedAboveMin / speedRange, 1.0);
    
    // Smooth curve for natural volume progression
    const speedVolumeFactor = speedRatio * speedRatio; // Quadratic ease-in
    
    // Calculate volume: starts from baseAmbientVolume at minSpeed, goes to maxAmbientVolume at maxSpeed
    const volumeRange = this.maxAmbientVolume - this.baseAmbientVolume;
    const targetVolume = this.baseAmbientVolume + (volumeRange * speedVolumeFactor);
    
    // Apply SFX volume setting
    const finalVolume = targetVolume * this.settings.sfxVolume;
    
    this.ambientAudio.volume = Math.max(0, Math.min(1, finalVolume));
    

  }

  /**
   * Play a sound effect
   */
  public async playSFX(category: SFXCategory, filename: string, volumeOverride?: number): Promise<void> {
    if (!this.settings.sfxEnabled) return;

    const key = `${category}/${filename}`;
    let audio = this.sfxCache.get(key);

    if (!audio) {
      try {
        audio = new Audio(`/assets/audio/sfx/${category}/${filename}`);
        audio.volume = this.settings.sfxVolume;
        this.sfxCache.set(key, audio);
      } catch (error) {
        console.warn(`🔊 Failed to load SFX: ${key}`, error);
        return;
      }
    }

    try {
      // Apply volume: priority order = volumeOverride > optimized defaults > base SFX volume
      let finalVolume: number;
      
      if (volumeOverride !== undefined) {
        // Explicit override provided
        finalVolume = Math.max(0, Math.min(2, volumeOverride)); // Allow up to 2x volume
      } else {
        // Use optimized volume if available, otherwise base SFX volume
        const optimizedVolume = OPTIMIZED_SFX_VOLUMES[key];
        if (optimizedVolume !== undefined) {
          finalVolume = optimizedVolume * this.settings.sfxVolume;
        } else {
          finalVolume = this.settings.sfxVolume;
        }
      }
      
      audio.volume = Math.max(0, Math.min(1, finalVolume));
      
      // Reset audio to beginning and play
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn(`🔊 Failed to play SFX: ${key}`, error);
    }
  }

  /**
   * Stop a specific sound effect
   */
  public stopSFX(category: SFXCategory, filename: string): void {
    const key = `${category}/${filename}`;
    const audio = this.sfxCache.get(key);
    
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Update music volume
   */
  public setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicAudio) {
      this.musicAudio.volume = this.settings.musicVolume;
    }
    this.saveSettings();
  }

  /**
   * Update SFX volume
   */
  public setSFXVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    
    // Update volume for all cached SFX
    this.sfxCache.forEach(audio => {
      audio.volume = this.settings.sfxVolume;
    });
    
    // Update ambient sound volume with speed-based calculation
    this.updateAmbientVolume();
    
    this.saveSettings();
  }

  /**
   * Toggle music on/off
   */
  public setMusicEnabled(enabled: boolean): void {
    this.settings.musicEnabled = enabled;
    
    if (enabled) {
      this.resumeMusic();
    } else {
      this.pauseMusic();
    }
    
    this.saveSettings();
  }

  /**
   * Toggle SFX on/off
   */
  public setSFXEnabled(enabled: boolean): void {
    this.settings.sfxEnabled = enabled;
    
    if (enabled) {
      this.resumeAmbient();
    } else {
      this.pauseAmbient();
    }
    
    this.saveSettings();
  }

  /**
   * Get current audio settings
   */
  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): AudioSettings {
    try {
      const stored = localStorage.getItem(AudioManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          musicVolume: parsed.musicVolume ?? 0.7,
          sfxVolume: parsed.sfxVolume ?? 0.55, // User-tested optimal value
          musicEnabled: parsed.musicEnabled ?? true,
          sfxEnabled: parsed.sfxEnabled ?? true,
        };
      }
    } catch (error) {
      console.warn('🎵 Failed to load audio settings:', error);
    }

    // Return default settings - OPTIMIZED VALUES
    return {
      musicVolume: 0.7,
      sfxVolume: 0.55, // User-tested optimal value
      musicEnabled: true,
      sfxEnabled: true,
    };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(AudioManager.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('🎵 Failed to save audio settings:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopMusic();
    
    // Stop and cleanup all SFX
    this.sfxCache.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.sfxCache.clear();

    if (this.musicAudio) {
      this.musicAudio.src = '';
      this.musicAudio = null;
    }

    this.isInitialized = false;
    console.log('🎵 AudioManager destroyed');
  }
} 