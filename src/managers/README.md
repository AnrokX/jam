# Player Projectile Manager

## Current Features

### Core Functionality
- Manages projectile state for each player individually
- Limits each player to 5 projectiles
- Handles projectile preview and trajectory visualization
- Proper cleanup when players leave the game

### Input Handling
- Right mouse button press: Creates and shows projectile preview
- Hold right mouse button: Updates trajectory preview
- Release right mouse button: Throws projectile and decrements count
- Prevents shooting when out of projectiles

### State Management
- Tracks remaining projectiles per player
- Maintains preview projectile state
- Handles input state to prevent duplicate actions
- Safe cleanup of resources on player disconnect

## Potential Future Enhancements

### Gameplay Features
1. **Projectile Types**
   ```typescript
   enum ProjectileType {
     NORMAL,
     EXPLOSIVE,
     BOUNCING,
     PIERCING
   }
   ```
   - Different damage values
   - Unique effects and behaviors
   - Type-specific cooldowns

2. **Ammo System**
   - Different ammo types
   - Ammo pickups in the world
   - Maximum ammo capacity
   - Reload mechanics

3. **Cooldown System**
   ```typescript
   interface ProjectileCooldown {
     lastThrowTime: number;
     cooldownDuration: number;
     isOnCooldown: boolean;
   }
   ```
   - Per-projectile type cooldowns
   - Visual feedback for cooldown state
   - Upgradeable cooldown reduction

### Technical Improvements
1. **Physics Enhancements**
   - Improved collision detection
   - Wind effects on trajectories
   - Gravity modifications
   - Ricochet mechanics

2. **Performance Optimizations**
   - Projectile pooling for better memory usage
   - Batch physics updates
   - Optimized trajectory calculations

3. **Network Optimizations**
   - Predictive projectile paths
   - Client-side prediction
   - Lag compensation

### Player Progression
1. **Upgrade System**
   - Increased ammo capacity
   - Faster reload times
   - Enhanced projectile effects
   - New projectile types unlocks

2. **Achievement System**
   - Track accurate shots
   - Count successful hits
   - Special achievements for trick shots
   - Combo system for rapid successful hits

### Game Modes
1. **Team-based Modes**
   - Shared team ammo pools
   - Team-specific projectile types
   - Strategic ammo management

2. **Special Events**
   - Infinite ammo periods
   - Special projectile types
   - Time-limited power-ups
   - Target practice modes

## Integration Points
- Can be extended with UI systems for visual feedback
- Can integrate with inventory systems
- Can connect to achievement systems
- Can be part of a larger combat system

## Best Practices for Extensions
1. Maintain separation of concerns
2. Keep the core manager focused on state management
3. Use events for communication with other systems
4. Consider performance implications of new features
5. Maintain type safety when extending functionality 