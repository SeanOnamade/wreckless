# Character Animation System Setup

This document explains how to integrate the new character animation system with your existing game.

## Files Created

1. **`CharacterAnimationManager.ts`** - Core animation loading and management
2. **`PlayerCharacterManager.ts`** - Integration with game state and player controller
3. **`/public/models/characters/README.md`** - File organization guide

## Integration Steps

### 1. Place Your FBX Files

Place your Mixamo FBX files in the appropriate directories with the naming convention:

```
client/public/models/characters/
├── swing/
│   ├── swing_idle.fbx
│   ├── swing_running.fbx
│   ├── swing_running_jump.fbx
│   ├── swing_falling.fbx
│   └── swing_swing.fbx
├── blink/
│   ├── blink_idle.fbx
│   ├── blink_running.fbx
│   ├── blink_running_jump.fbx
│   └── blink_falling.fbx
└── blast/
    ├── blast_idle.fbx
    ├── blast_running.fbx
    ├── blast_running_jump.fbx
    └── blast_falling.fbx
```

### 2. Install FBX Loader Dependencies

The FBX loader should already be available through Three.js, but ensure your project has the necessary dependencies:

```json
{
  "dependencies": {
    "three": "^0.158.0"
  }
}
```

### 3. Modify FirstPersonController

You need to expose some methods from `FirstPersonController` for the character manager to access player state:

```typescript
// Add these public getter methods to FirstPersonController class:

public getPosition(): THREE.Vector3 {
  const position = this.playerBody.translation();
  return new THREE.Vector3(position.x, position.y, position.z);
}

public getRotation(): THREE.Euler {
  return new THREE.Euler(this.pitch, this.yaw, 0);
}

public getIsGrounded(): boolean {
  return this.isGrounded;
}

public getIsMoving(): boolean {
  return Object.values(this.keys).some(pressed => pressed);
}

public getIsSwinging(): boolean {
  return this.isSwinging;
}

public getCurrentSpeed(): number {
  return this.currentSpeed;
}

// You may also need to expose additional state like isRocketJumping, etc.
```

### 4. Update PlayerCharacterManager

After adding the getters to FirstPersonController, update the placeholder methods in `PlayerCharacterManager.ts`:

```typescript
private getPlayerPosition(): THREE.Vector3 {
  return this.controller.getPosition();
}

private getPlayerRotation(): THREE.Euler {
  return this.controller.getRotation();
}

private getIsGrounded(): boolean {
  return this.controller.getIsGrounded();
}

private getIsMoving(): boolean {
  return this.controller.getIsMoving();
}

private getIsSwinging(): boolean {
  return this.controller.getIsSwinging();
}

private getCurrentSpeed(): number {
  return this.controller.getCurrentSpeed();
}
```

### 5. Integrate with Main Game Loop

In your `main.ts` or wherever the game loop is managed, add the character manager:

```typescript
import { PlayerCharacterManager } from './player/PlayerCharacterManager';

// After physics initialization
let playerCharacterManager: PlayerCharacterManager | null = null;

// In your physics setup function, after creating the FPS controller:
if (physicsWorld) {
  playerCharacterManager = new PlayerCharacterManager(scene, physicsWorld.fpsController);
  
  // Optionally preload all characters for faster switching
  try {
    await playerCharacterManager.preloadAllCharacters();
  } catch (error) {
    console.warn('Failed to preload characters, will load on demand:', error);
  }
}

// In your render loop, update the character manager:
function animate() {
  requestAnimationFrame(animate);
  
  if (physicsWorld && playerCharacterManager) {
    const deltaTime = clock.getDelta();
    physicsWorld.step(deltaTime);
    playerCharacterManager.update(deltaTime);
  }
  
  // ... rest of render loop
}
```

### 6. Connect to Class Selection

Modify your class selection system to trigger character changes. In your game state manager or class selection UI:

```typescript
// When a player selects a class, dispatch an event:
window.dispatchEvent(new CustomEvent('classChanged', {
  detail: { class: selectedClass }
}));
```

### 7. Connect to Ability System

To trigger special animations when abilities are used, dispatch events from your ability system:

```typescript
// In your ability usage code:
window.dispatchEvent(new CustomEvent('abilityUsed', {
  detail: { ability: 'swing' } // or 'blast', 'blink', etc.
}));
```

## Testing

1. **Test File Loading**: Start with just the swing character files to ensure FBX loading works
2. **Test Animation Switching**: Verify animations change based on movement state
3. **Test Class Switching**: Ensure character models change when switching classes
4. **Test Performance**: Monitor frame rate with animated characters

## Troubleshooting

### Common Issues:

1. **FBX Files Not Loading**
   - Check file paths and naming convention
   - Ensure FBX files are accessible from the web server
   - Check browser developer console for loading errors

2. **Animation Not Playing**
   - Verify FBX files contain animation data
   - Check that `mixer.update(deltaTime)` is called in render loop
   - Ensure animation actions are properly created

3. **Character Position Issues**
   - Adjust the Y offset in `updateCharacterPosition()`
   - Verify player position is being read correctly from physics body

4. **Performance Issues**
   - Consider using compressed FBX files
   - Implement LOD (Level of Detail) for distant players in multiplayer
   - Optimize animation update frequency if needed

## Next Steps

1. Place your swing character FBX files first
2. Add the FirstPersonController getter methods
3. Test with swing character before adding others
4. Gradually add blink and blast characters
5. Fine-tune animation transitions and character positioning

The system is designed to be extensible - you can easily add more animations or character classes by following the established patterns. 