# Wind Streaks Asset

## Required Asset: `windstreaks2.gif`

**Location:** `/client/public/assets/windstreaks2.gif`

### Asset Specifications:
- **Format:** Animated GIF with transparency support
- **Recommended Size:** 1920x1080 (or higher resolution)
- **Style:** Animated radial speed lines emanating from center
- **Animation:** Continuous loop for dynamic motion effect
- **Transparency:** Semi-transparent white streaks on transparent background
- **Blend Mode:** Designed for `screen` blend mode overlay

### Visual Design:
The animated wind streaks represent speed and motion with:
- **Radial streaks** emanating from center outward (perfect for speed sensation)
- **Continuous animation** creating natural motion effect
- **Varying opacity** to create depth and movement
- **Subtle coloring** (white/light blue) to avoid overwhelming the game view
- **Dynamic pattern** that looks good at different opacity levels (0-100%)

### Implementation Notes:
- Used by `WindStreakEffect.ts` as a fullscreen HTML overlay
- Appears when player speed exceeds 18 m/s (walking speed)
- Fades from 0% to 100% opacity as speed increases from 18-60 m/s
- **Dual motion system**: GIF animation + code-based shake for maximum dynamism
- Applied with `mix-blend-mode: screen` for natural blending
- Can be easily replaced or updated without code changes

### Graceful Fallback:
The effect will gracefully handle missing assets:
- No console errors if GIF file is missing
- Overlay div still functions (can be styled with CSS for testing)
- Easy to swap GIF files without code changes

### Alternative CSS Fallback:
For testing without the GIF asset, you can temporarily use CSS radial gradients:
```css
background: radial-gradient(circle, 
  transparent 50%, 
  rgba(255,255,255,0.1) 60%, 
  rgba(255,255,255,0.3) 80%, 
  transparent 90%
);
```

Replace this placeholder when the actual windstreaks2.gif asset is ready. 