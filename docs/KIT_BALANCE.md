# Kit Balance Analysis

## Overview

This document analyzes the balance between the three combat kits in the battle-race FPS, evaluating each kit across three key dimensions: **Difficulty to Use**, **Mobility Utility**, and **Melee Damage**. The goal is to ensure each kit has distinct strengths and meaningful trade-offs.

## Current Damage Values

### Base Damage
- **Blast:** 60 HP (consistent)
- **Grapple:** 25 HP (base) → 70 HP (velocity crit)
- **Blink:** 30 HP (base) → 50 HP (with timing bonus)

### Class Modifiers
- **Blast:** +25% range (4.5m total), consistent 60 HP damage, 120° cone
- **Grapple:** 360° sweep while swinging, velocity-based damage scaling, 3.6m range
- **Blink:** 120° cone (increased for generosity), +20 HP bonus within 0.8s of blink

### Hit Detection Improvements
- **Cone Angle:** Increased from 90° to 120° for more generous hits
- **Ray Count:** Increased from 5 to 7 primary rays + 5 horizontal spread rays
- **Coverage:** Better hit detection across the wider cone area

## Detailed Kit Analysis

### 🔥 **BLAST - "The Honest Bruiser"**

**Difficulty: B (Medium)**
- Point-and-click mechanics with 90° cone
- Requires positioning and range management
- Most accessible for new players
- Clear risk/reward with blast jump positioning

**Mobility: A (Excellent)**
- Best vertical traversal via rocket jumping
- AoE knockback affects multiple enemies
- Self-damage creates interesting risk/reward
- Excellent for both offense and escape

**Melee Damage: B+ (60 HP Consistent)**
- Reliable, predictable damage output
- Longest effective range (4.5m with +25% modifier)
- No execution requirements for full damage
- Strong baseline performance

**Overall Grade: A-**
- **Strengths:** Well-rounded, beginner-friendly, consistent performance
- **Weaknesses:** Lower skill ceiling, predictable patterns
- **Identity:** The reliable powerhouse

---

### 🪝 **GRAPPLE - "The Skill Ceiling"**

**Difficulty: A (Hardest)**
- Requires physics understanding and momentum management
- Complex velocity-based damage calculations
- Timing windows for optimal damage
- Highest mechanical skill requirements

**Mobility: A+ (Best)**
- Fastest theoretical traversal speed
- Infinite vertical ceiling with proper technique
- Complex rope physics enable advanced techniques
- Most creative movement options

**Melee Damage: A (25-70 HP Range)**
- Huge skill-based damage variance
- Velocity scaling rewards momentum mastery
- 360° sweep while swinging compensates for difficulty
- Highest potential damage output (70 HP)

**Overall Grade: A**
- **Strengths:** Highest skill ceiling, most rewarding for experts, best mobility
- **Weaknesses:** Steep learning curve, inconsistent for beginners
- **Identity:** The skill-expressive specialist

---

### ⚡ **BLINK - "The Precision Assassin"**

**Difficulty: B+ (Medium-High)**
- 0.8s timing window requires execution precision
- Positioning-dependent for maximum effectiveness
- Moderate mechanical requirements
- Tactical thinking over raw mechanics

**Mobility: B (Good)**
- Instant repositioning and escape options
- Limited by cooldown management
- Excellent for surprise attacks and escapes
- Good but not exceptional traversal speed

**Melee Damage: B (30-50 HP)**
- Moderate base damage with meaningful execution bonus
- Timing-based damage scaling (+20 HP for 0.8s window)
- Generous 120° cone sweep for easier hits
- Balanced risk/reward ratio

**Overall Grade: B+**
- **Strengths:** Tactical flexibility, precision-based gameplay, good damage ceiling
- **Weaknesses:** Cooldown dependency, moderate mobility utility
- **Identity:** The tactical precision striker

## Balance Assessment

### ✅ **Excellent Skill-Reward Scaling**

The damage system properly rewards skill investment:

- **Easy techniques = Lower damage**
  - Grapple low-speed: 25 HP
  - Blink base: 30 HP
  - Blast consistent: 60 HP

- **Skilled techniques = Higher damage**
  - Grapple velocity crit: 70 HP
  - Blink timing bonus: 50 HP
  - Blast remains consistent: 60 HP

### ✅ **Preserved Class Identity**

Each kit maintains distinct gameplay patterns:

- **Blast:** Consistent, accessible power with positioning emphasis
- **Grapple:** High-risk, high-reward with momentum mastery
- **Blink:** Precision timing with tactical positioning

### ✅ **No Dominant Strategy**

Each kit excels in different scenarios:

- **Blast** dominates in sustained combat and team fights
- **Grapple** excels in high-mobility engagements and skilled 1v1s
- **Blink** shines in surprise attacks and tactical positioning

### ✅ **Meaningful Trade-offs**

Players must choose between:

- **Consistency vs Skill Expression** (Blast vs Grapple)
- **Mobility vs Reliability** (Grapple vs Blast)
- **Tactical Precision vs Raw Power** (Blink vs others)

## Conclusion

The current kit balance represents an excellent design achievement. The system successfully:

1. **Rewards skill development** through damage scaling
2. **Maintains distinct playstyles** for each kit
3. **Avoids dominant strategies** through meaningful trade-offs
4. **Provides clear progression paths** for players of all skill levels

This balance framework supports both competitive integrity and player expression, making each kit viable while maintaining their unique identities and skill requirements.

### Recommendations

- **Maintain current damage values** - they're well-calibrated
- **Monitor grapple velocity thresholds** in competitive play
- **Consider adding visual feedback** for damage thresholds
- **Preserve the skill-reward relationship** in future updates

---

*Last Updated: After velocity system implementation and damage scaling adjustments* 