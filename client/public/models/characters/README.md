# Character Animation Files

This directory contains the animated character models for each class in the game.

## Directory Structure

```
characters/
├── swing/          # Grapple class character files
├── blink/          # Blink class character files
├── blast/          # Blast class character files
└── README.md       # This file
```

## File Naming Convention

Each character directory should contain FBX files with the following naming pattern:
`{character}_{animation}.fbx`

### Required Files for Each Character:

**All Characters:**
- `{character}_idle.fbx` - Standing idle animation
- `{character}_running.fbx` - Running/moving animation
- `{character}_running_jump.fbx` - Jump animation while running
- `{character}_falling.fbx` - Falling/in-air animation

**Swing Character Only:**
- `swing_swing.fbx` - Special grappling/swinging animation

### Example File Structure:

```
swing/
├── swing_idle.fbx
├── swing_running.fbx
├── swing_running_jump.fbx
├── swing_falling.fbx
└── swing_swing.fbx

blink/
├── blink_idle.fbx
├── blink_running.fbx
├── blink_running_jump.fbx
└── blink_falling.fbx

blast/
├── blast_idle.fbx
├── blast_running.fbx
├── blast_running_jump.fbx
└── blast_falling.fbx
```

## Animation Requirements

- All FBX files should contain both the character model and the animation data
- Animations should be exported from Mixamo with consistent character rigs
- Ensure all animations loop properly (except jumping/falling which are one-shot)
- Recommended frame rates: 30 FPS
- Keep file sizes reasonable for web delivery

## Integration

The `CharacterAnimationManager` class automatically loads these files based on:
1. Character class name (blast, blink, grapple/swing)
2. Animation state (idle, running, running_jump, falling, swing)
3. File naming convention above

Character models are loaded dynamically when a player selects a class, with smooth transitions between animation states during gameplay.

## Notes

- The "grapple" class maps to "swing" character files for thematic consistency
- Missing animation files will cause loading errors - ensure all required files are present
- Animation blending uses 0.3 second fade transitions between states
- The idle animation plays by default when a character is first loaded 