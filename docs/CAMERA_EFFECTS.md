# 📹 Camera Effects Design Document

## Overview

This document outlines recommended camera effects to enhance the fast-paced movement shooter experience in Wreckless. These effects should amplify the sense of speed, momentum, and impact while maintaining competitive viability and accessibility.

## 🎯 **Day 3 Sprint Priority Effects**

Based on current development needs, these effects are prioritized for immediate implementation:

### **Current Implemented Effects:**
- ✅ **Red flash** when falling into killzone
- ✅ **Green flash** when boosted by dummy

### **Day 3 Target Effects:**
- 🎯 **Dummy speed boost effects** - Wind soaring past effect + camera shake when hitting speed boost dummies
- 🎯 **General momentum camera feel** - Enhanced camera effects for higher speeds than walking
- 🎯 **Dummy pass-through shake** - Screen shake when moving through a dummy (combat feedback)
- 🎯 **Zoom blink effect** - Teleport feel with zoom in/out effect during blink

---

## 🎯 **Core Movement Camera Effects**

### **Speed-Based FOV (Field of View)**
- **🎯 DAY 3: General momentum camera feel** - Enhanced speed sensation (PRIORITY)
  - **Dynamic FOV increase** for speeds above walking (18+ m/s)
  - **Immediate feedback** when hitting dummy speed boosts
  - **Wind effect simulation** through FOV + shake combination
- **🎯 DAY 3: Dummy speed boost effects** - Wind soaring sensation (PRIORITY)
  - **Sharp FOV burst** when hitting speed boost dummy (+5-10° for 0.3s)
  - **Wind shake effect** - rapid small camera vibrations (±1°) during boost
  - **Combines with existing green flash** for full boost feedback
- **Dynamic FOV increase** as speed increases (90° → 110° at max speed)
- **Speed Thresholds:**
  - Base: 90° FOV at 0-20 m/s
  - Medium: 95° FOV at 20-50 m/s  
  - Fast: 100° FOV at 50-100 m/s
  - Maximum: 110° FOV at 100+ m/s
- **Smooth transitions** to avoid motion sickness (ease-in-out curves)
- **Different curves** for different movement types:
  - Grappling: More dramatic FOV changes
  - Running: Gradual FOV scaling
  - Rocket jumping: Sharp FOV burst on launch

### **Momentum-Based Camera Tilt**
- **Banking/tilting during sharp turns** at high speed
  - Maximum tilt: ±15° at top speeds
  - Tilt based on angular velocity and current speed
- **Roll effect during grapple swings** (like a pendulum)
  - Natural pendulum banking during rope swings
  - Enhanced roll when performing aerial maneuvers
- **Subtle lean into slides** when changing direction while sliding
  - 5-8° lean based on input direction

### **Landing Impact Effects**
- **Heavy screen shake** for high-speed landings from rocket jumps
  - Shake intensity scales with impact velocity
  - Base shake: 0.1-0.8 intensity based on fall speed
- **Brief downward camera dip** on hard landings (0.1-0.2 seconds)
- **Recovery bounce** that scales with impact velocity
  - Simulates player "settling" after high-speed impact

---

## ⚡ **Ability-Specific Effects**

### **Blast Jump Effects**
- **Anticipation dip** before launching
  - Brief 0.1s downward camera movement (~5°)
  - Builds tension before explosive launch
- **Launch recoil** - sharp upward camera snap during takeoff
  - Quick upward jerk (10-15°) over 0.2 seconds
  - Emphasizes explosive power of blast
- **Speed blur/streaks** during peak velocity phases
  - Post-processing effect at 75+ m/s
  - Directional motion blur in movement direction
- **Aerial wobble** - subtle random rotation during flight
  - Small random rotations (±2°) to feel less robotic
  - Frequency decreases as speed stabilizes

### **Grapple Swing Effects**
- **Hook connection snap** - quick camera jerk toward anchor point
  - Brief 0.1s movement toward grapple target
  - Emphasizes physical connection
- **Pendulum banking** - camera rolls left/right based on swing direction
  - Natural banking based on swing arc
  - Maximum roll: ±20° at peak swing speed
- **Rope tension effects** - slight camera pull toward anchor when rope tightens
  - Subtle forward lean when rope reaches full extension
  - Enhanced during reel-in (Space key)
- **Release catapult** - dramatic FOV burst when detaching at high speed
  - Quick FOV spike (+5-10°) for 0.3 seconds
  - Emphasizes momentum preservation

### **Blink Effects**
- **🎯 DAY 3: Zoom blink effect** - Enhanced teleport feel (PRIORITY)
  - **Zoom out** rapidly before teleport (FOV 90° → 70° over 0.1s)
  - **Zoom in** quickly after arrival (FOV 70° → 90° over 0.15s)  
  - Creates dramatic "warping through space" sensation
- **Pre-blink focus** - brief FOV narrow before teleport
  - FOV reduces by 10° for 0.1 seconds before blink
  - Creates anticipation and focus
- **Displacement disorientation** - quick random rotation/shake after materializing
  - Brief random rotation (±5°) for 0.2 seconds
  - Simulates disorientation from teleportation
- **Reality "snap"** - brief visual distortion effect on arrival
  - Screen space distortion for 0.1 seconds
  - Could be chromatic aberration or wave effect

---

## 💥 **Combat & Impact Effects**

### **Enhanced Hit Feedback** (expand existing system)
Current system has screen shake for crits/bonus hits. Expand with:
- **🎯 DAY 3: Dummy pass-through shake** - Combat feedback (PRIORITY)
  - **Medium screen shake** when moving through a dummy (0.2-0.3 intensity)
  - **Brief duration** (0.1-0.15 seconds) to feel impactful but not disorienting
  - **Supplements existing green flash** for dummy speed boosts
- **Directional camera kick** based on hit direction
  - Camera recoil away from hit direction
  - Intensity based on damage dealt
- **Brief slow-motion** for critical hits (0.1-0.2 seconds)
  - Time dilation effect for maximum impact crits
  - Only for special combo hits (grapple crits, blink bonus)
- **Target lock-on smoothing** when approaching combat targets
  - Subtle camera magnetism toward nearby targets
  - Helps with pass-through combat system

### **Environmental Interaction**
- **Wall-running camera tilt** if wall mechanics added
  - 90° roll when running on walls
  - Smooth transitions between wall and floor
- **Near-miss shake** when barely avoiding obstacles at high speed
  - Proximity-based shake when passing close to geometry
  - Intensity scales with speed and proximity
- **Tunnel vision** when passing through tight spaces at speed
  - FOV reduction in narrow passages
  - Creates sense of focus and precision needed

---

## 🏃 **Movement State Transitions**

### **State Change Smoothing**
- **Slide entry** - smooth camera lowering with slight forward dip
  - Animate from 0.8m to 0.4m height over 0.2 seconds
  - Add 5° forward tilt during transition
- **Jump preparation** - subtle crouch before leap
  - Brief downward dip before jump velocity applied
  - Makes jumps feel more grounded and powerful
- **Air-to-ground transitions** - impact absorption camera movement
  - Camera "settles" after landing from high speeds
  - Dampened oscillation effect

### **Speed Thresholds**
- **Break sound barrier** effect at ~75 m/s
  - Visual distortion/chromatic aberration
  - Brief audio muffling effect
- **Terminal velocity** effects when falling at max speed (-50 m/s)
  - Dramatic downward FOV adjustment
  - Tunnel vision effect during high-speed falls
- **Momentum preservation** - camera "settles" when landing from high speeds
  - Gradual return to normal camera behavior
  - Maintains sense of carried momentum

---

## 🎮 **Quality of Life Enhancements**

### **Predictive Smoothing**
- **Look-ahead smoothing** for very fast movement
  - Camera slightly anticipates movement direction
  - Reduces nausea during rapid direction changes
- **Predictive banking** based on input direction at high speeds
  - Camera begins banking before sharp turns
  - Based on current input + momentum vector
- **Stabilization options** for players sensitive to motion
  - Reduced shake and tilt options
  - Simplified FOV scaling

### **Customizable Intensity**
Settings menu options:
- **Camera Effects Intensity**: 25%, 50%, 75%, 100%, 125%
- **Motion Sickness Reduction**: On/Off
- **Competition Mode**: Minimal effects for competitive play
- **Individual Effect Toggles**:
  - Speed FOV: On/Off
  - Camera Banking: On/Off  
  - Landing Effects: On/Off
  - Screen Shake: On/Off (expand current system)

---

## 🔧 **Implementation Strategy**

### **Day 3 Sprint: Immediate Priority**
🎯 **Target: Complete by end of Day 3**

1. **Zoom blink effect** - Teleport enhancement
   - Modify `kits/blink.ts` blink execution
   - Add FOV zoom out (90° → 70°) before teleport
   - Add FOV zoom in (70° → 90°) after teleport
   - Duration: 0.1s out, 0.15s in

2. **Dummy speed boost effects** - Wind soaring sensation
   - Integrate with existing dummy boost system
   - Add FOV burst (+5-10° for 0.3s) on dummy hit
   - Add wind shake effect (±1° rapid vibrations)
   - Combine with existing green flash

3. **General momentum camera feel** - Speed above walking
   - Enhance existing speed-based FOV in `FirstPersonController`
   - Trigger enhanced effects at 18+ m/s (above walking speed)
   - Smooth scaling for immediate speed feedback

4. **Dummy pass-through shake** - Combat feedback
   - Expand existing screen shake system in `main.ts`
   - Add medium shake (0.2-0.3 intensity) for dummy hits
   - Brief duration (0.1-0.15s) to supplement green flash

### **Phase 1: Core Feel (High Impact)**
1. **Speed-based FOV scaling** (Enhanced from Day 3 work)
   - Build on Day 3 momentum camera feel
   - Extend to full speed range (0-150 m/s)
   - Smooth interpolation with configurable curves

2. **Landing impact effects**
   - Expand existing screen shake system in `main.ts`
   - Add impact detection in controller
   - Scale effects based on velocity before landing

3. **Enhanced blast jump camera snap**
   - Add to blast jump abilities in `kits/blast.ts`
   - Camera recoil on launch
   - FOV burst during flight

### **Phase 2: Ability Polish (Medium Impact)**
4. **Grapple swing banking**
   - Integrate with grapple physics in `kits/grapple.ts`
   - Calculate banking from swing velocity
   - Smooth transitions between swing states

5. **Momentum-based camera tilt**
   - Add to movement calculation in controller
   - Tilt based on angular velocity at speed
   - Configurable maximum tilt angles

6. **Blink disorientation effects**
   - Add to blink execution in `kits/blink.ts`
   - Pre/post teleport camera effects
   - Brief disorientation simulation

### **Phase 3: Advanced Features (Polish)**
7. **State transition smoothing**
   - Enhance slide transitions
   - Jump anticipation effects
   - Air-to-ground impact absorption

8. **Environmental awareness effects**
   - Near-miss detection system
   - Tunnel vision in tight spaces
   - Speed-based environmental reactions

9. **Customization options**
   - Settings UI integration
   - Effect intensity sliders
   - Accessibility options

---

## 📁 **Technical Implementation Notes**

### **File Modifications Required**
- `client/src/controller.ts`: Core movement effects, FOV scaling, camera banking
- `client/src/main.ts`: Expand visual feedback system beyond current screen shake
- `client/src/kits/blast.ts`: Blast jump camera effects
- `client/src/kits/grapple.ts`: Grapple swing banking and connection effects  
- `client/src/kits/blink.ts`: Blink disorientation and focus effects
- New file: `client/src/camera/CameraEffects.ts`: Centralized effect management

### **Performance Considerations**
- **Smooth interpolation** using requestAnimationFrame timing
- **Effect pooling** for frequently triggered effects
- **Configurable quality levels** for different hardware
- **Avoid expensive operations** in main render loop

### **Integration with Existing Systems**
- **Extend current screen shake** system rather than replace
- **Work with existing camera controller** in FirstPersonController
- **Respect pointer lock** and mouse sensitivity settings
- **Maintain competitive integrity** with disable options

---

## 🎯 **Design Goals**

### **Primary Objectives**
- **Enhance sense of speed** and momentum
- **Amplify ability impact** and feedback
- **Improve spatial awareness** during fast movement
- **Maintain competitive viability** with customization options

### **Secondary Objectives**  
- **Reduce motion sickness** through predictive smoothing
- **Increase immersion** through environmental awareness
- **Support accessibility** with configurable intensity
- **Enable competitive play** with minimal effect modes

### **Success Metrics**
- Player reports increased sense of speed and momentum
- Improved ability feedback and satisfaction
- Maintained competitive integrity
- Positive accessibility feedback from motion-sensitive players

---

## 📋 **Day 3 Quick Reference**

### **Files to Modify:**
- `client/src/kits/blink.ts` - Add zoom blink effect
- `client/src/controller.ts` - Enhance speed-based camera feel  
- `client/src/main.ts` - Expand screen shake system for dummy hits
- Integration with existing dummy boost system

### **Effect Parameters:**
- **Blink zoom**: 90° → 70° → 90° (0.1s out, 0.15s in)
- **Dummy boost FOV**: +5-10° burst for 0.3s
- **Wind shake**: ±1° rapid vibrations during boost
- **Pass-through shake**: 0.2-0.3 intensity for 0.1-0.15s
- **Speed threshold**: Enhanced effects at 18+ m/s

### **Integration Points:**
- Build on existing green flash for dummy boosts
- Extend current screen shake system (don't replace)
- Work with existing red flash for killzone
- Respect current speed calculation in FirstPersonController

---

*Camera effects should feel **impactful but not disorienting** - enhancing the core movement shooter experience while remaining accessible and competitive.* 