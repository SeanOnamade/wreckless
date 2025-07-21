# WRECKLESS Audio System

This document outlines the audio file structure and recommended sound effects for the WRECKLESS game.

## 📁 File Structure

```
client/public/assets/audio/
├── music/
│   └── background_loop.mp3        # Main background music (looping)
└── sfx/
    ├── abilities/                 # Class ability sound effects
    ├── movement/                  # Player movement sounds
    ├── ui/                        # User interface sounds
    ├── environment/               # Environment/world sounds  
    └── combat/                    # Combat and impact sounds
```

## 🎵 Music Files

### Required Music Files:
- **`music/background_loop.mp3`** - Main background music track that loops continuously

*Place your looping MP3 music file in the `music/` folder with the exact filename `background_loop.mp3`*

## 🔊 Recommended Sound Effects (SFX)

### 🚀 Abilities (`sfx/abilities/`)
**Blast Kit:**
- `blast_charge.wav` - Ability charging sound
- `blast_launch.wav` - Blast jump activation
- `blast_explosion.wav` - Explosion impact sound
- `blast_cooldown.wav` - Ability ready notification

**Blink Kit:**
- `blink_charge.wav` - Teleport charging
- `blink_teleport.wav` - Teleportation whoosh
- `blink_arrive.wav` - Arrival sound
- `blink_cooldown.wav` - Ability ready notification

**Grapple (Swing) Kit:**
- `grapple_shoot.wav` - Hook shooting sound
- `grapple_latch.wav` - Hook connecting to surface
- `grapple_swing.wav` - Swinging through air
- `grapple_release.wav` - Hook releasing
- `grapple_cooldown.wav` - Ability ready notification

### 🏃 Movement (`sfx/movement/`)
- `footstep_concrete.wav` - Footsteps on hard surfaces
- `footstep_metal.wav` - Footsteps on metal surfaces
- `jump.wav` - Jump sound
- `land_soft.wav` - Soft landing
- `land_hard.wav` - Hard impact landing
- `slide_start.wav` - Slide activation
- `slide_loop.wav` - Sliding loop sound
- `slide_end.wav` - Slide ending
- `wind_rush.wav` - High-speed movement wind

### 🎮 UI (`sfx/ui/`)
- `button_hover.wav` - Button hover sound
- `button_click.wav` - Button click/selection
- `menu_open.wav` - Menu opening
- `menu_close.wav` - Menu closing
- `notification.wav` - General notification sound
- `error.wav` - Error/invalid action sound
- `checkpoint_hit.wav` - Checkpoint reached sound
- `lap_complete.wav` - Lap completion fanfare
- `countdown_tick.wav` - Race countdown timer
- `race_start.wav` - Race start sound

### 🌍 Environment (`sfx/environment/`)
- `ambient_wind.wav` - Background wind ambience
- `metal_clang.wav` - Metal structure sounds
- `machinery_hum.wav` - Industrial machinery
- `checkpoint_ring.wav` - Checkpoint ring activation
- `boost_pad.wav` - Speed boost pad activation
- `energy_hum.wav` - Energy field ambience

### ⚔️ Combat (`sfx/combat/`)
- `melee_swing.wav` - Melee attack swing
- `melee_hit_flesh.wav` - Successful hit on target
- `melee_hit_metal.wav` - Hit on metal/armor
- `melee_miss.wav` - Attack missing target
- `dummy_hit.wav` - Hitting practice dummy
- `dummy_destroy.wav` - Destroying target dummy
- `health_damage.wav` - Taking damage
- `health_critical.wav` - Critical health warning
- `ko_sound.wav` - Knockout/elimination sound

## 🎚️ Audio Settings

The AudioManager supports:
- **Music Volume**: 0-100% (default: 70%)
- **SFX Volume**: 0-100% (default: 80%)
- **Music Toggle**: Enable/disable background music
- **SFX Toggle**: Enable/disable sound effects

Settings are automatically saved to localStorage and persist between sessions.

## 🔧 Implementation Usage

### Playing Background Music:
```typescript
const audioManager = AudioManager.getInstance();
await audioManager.playMusic(); // Starts looping background music
```

### Playing Sound Effects:
```typescript
// Play ability sound
audioManager.playSFX('abilities', 'blast_launch.wav');

// Play movement sound  
audioManager.playSFX('movement', 'jump.wav');

// Play UI sound
audioManager.playSFX('ui', 'button_click.wav');

// Play combat sound
audioManager.playSFX('combat', 'melee_hit_flesh.wav');

// Play environment sound
audioManager.playSFX('environment', 'checkpoint_ring.wav');
```

### Volume Control:
```typescript
audioManager.setMusicVolume(0.5);  // 50% music volume
audioManager.setSFXVolume(0.8);    // 80% SFX volume
audioManager.setMusicEnabled(false); // Disable music
audioManager.setSFXEnabled(true);    // Enable SFX
```

## 📝 Notes

- All audio files should be in common web formats (MP3, WAV, OGG)
- Keep file sizes reasonable for web delivery
- Consider using compressed audio formats for music
- SFX files should be short and punchy for responsive gameplay
- Test audio levels across different devices and browsers
- Consider providing fallback audio formats for browser compatibility

## 🎵 Audio Integration Points

The audio system integrates with:
- **Settings Screen**: Volume controls and enable/disable toggles
- **Ability System**: Automatic SFX playback for class abilities  
- **Movement System**: Footsteps and movement sounds
- **Combat System**: Melee attack and hit sounds
- **UI System**: Button clicks and menu interactions
- **Race System**: Checkpoints, laps, and race events 