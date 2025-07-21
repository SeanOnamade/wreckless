# Rapier Physics Engine Crash Prevention

## 🚨 **Root Causes Identified:**

After 6 minutes of gameplay, multiple issues compound to cause **"recursive use of an object detected"** crashes:

### **1. Animation Frame Memory Leak**
- Each dummy hit creates 2-4 `requestAnimationFrame` callbacks
- Over 6 minutes = hundreds of animation frames running simultaneously
- Memory pressure eventually interferes with physics timing

### **2. Collision Detection During Physics Step**
- `contactPairsWith()` calls in projectile collision detection
- `intersectionsWithShape()` calls in HitVolume system  
- Both happen during `physicsWorld.step()` = recursive access

### **3. Multiple Animation Loops**
- Main animation loop
- AbilityManager update loop
- Character loader deferred operations
- Visual effects animations

## 🛡️ **Prevention Measures Implemented:**

### **A. Animation Frame Limits (CRITICAL)**
- Limit max concurrent animation frames per dummy
- Add animation frame cleanup on dummy destruction  
- Use animation frame pooling to prevent buildup

### **B. Collision Detection Isolation**
- Move all Rapier collision queries outside physics step
- Use deferred collision checks with `setTimeout`
- Batch collision detection to reduce frequency

### **C. Animation Loop Coordination**  
- Centralize animation frame management
- Prevent multiple conflicting `requestAnimationFrame` loops
- Add performance monitoring for animation frame count

### **D. Memory Management**
- Dispose animation frames on object destruction
- Clear collision detection caches periodically
- Monitor and limit total active animations

## 🔧 **Implementation Priority:**

1. **IMMEDIATE**: Fix animation frame buildup in TargetDummy
2. **IMMEDIATE**: Defer collision detection calls  
3. **HIGH**: Centralize animation frame management
4. **MEDIUM**: Add performance monitoring

## 🧪 **Testing:**
- Should be able to play 10+ minutes without crashes
- Monitor animation frame count in dev tools
- Verify no Rapier calls during physics step 