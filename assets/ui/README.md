# Projectile Counter UI

A modern, animated UI component that displays the player's projectile count with visual feedback and animations.

## Features

### Visual Elements
- Modern glassmorphism design with blur effects and gradient overlays
- Dynamic projectile icon with glow effects
- Ambient particle system in the background
- Responsive counter with smooth transitions
- Color-coded feedback for low ammo states

### Animations
1. **Count Change Animation**
   - Smooth pulse effect when the count updates
   - Scale transform with ease-out timing
   - Duration: 0.5s

2. **Low Ammo State**
   - Red gradient background
   - Red glow effect on the projectile icon
   - Color transition with 0.3s ease

3. **No Ammo Feedback**
   - Dynamic shake animation when attempting to shoot with no ammo
   - Combined translation and rotation effects
   - 0.5s duration with custom easing
   - Triggers only on shoot attempt, not continuously

4. **Particle System**
   - Continuous ambient particles in the background
   - Random movement patterns
   - Fade-out effect
   - Creates new particles every 200ms

## Implementation Details

### Modified Files

1. `assets/ui/index.html`
   - Main UI implementation
   - CSS styles and animations
   - Event handling and DOM manipulation
   - Particle system implementation

2. `src/managers/player-projectile-manager.ts`
   - Added UI event triggering for no-ammo attempts
   - Modified `handleProjectileInput` to accept player object
   - Integrated UI feedback with game logic

3. `index.ts`
   - Updated projectile manager initialization
   - Added player object to handleProjectileInput calls
   - Configured UI update events

### Communication Flow

1. Game State → UI Updates
   - `updateProjectileCount` event: Updates counter value
   - `attemptShootNoAmmo` event: Triggers shake animation

2. Visual Feedback States
   - Normal state: Green projectile icon
   - Low ammo (≤2): Red warning state
   - No ammo + shoot attempt: Shake animation

### CSS Animations

```css
// Shake Animation
@keyframes shake {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  10%, 90% { transform: translate3d(-2px, 1px, 0) rotate(-1deg); }
  20%, 80% { transform: translate3d(3px, -1px, 0) rotate(1deg); }
  30%, 50%, 70% { transform: translate3d(-4px, 2px, 0) rotate(-2deg); }
  40%, 60% { transform: translate3d(4px, -2px, 0) rotate(2deg); }
}

// Pulse Animation
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

## Performance Considerations

- Used `transform` and `opacity` for animations to leverage GPU acceleration
- Implemented `backface-visibility: hidden` and `perspective: 1000px` for smoother animations
- Particle system auto-removes elements after animation
- Efficient DOM updates with class toggling
- Debounced animations with proper cleanup

## Future Improvements

Potential enhancements that could be added:
- Sound effects for low ammo and no-ammo states
- Customizable color schemes
- Additional animation variations
- Projectile type indicators
- Ammo pickup animations

## Important Points

1. **File Structure**
   - UI files must be placed in the `assets/ui` directory
   - Main entry point must be named `index.html`
   - Do NOT include `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags

2. **Loading the UI**
   ```typescript
   // Must load the UI before sending any data
   player.ui.load('ui/index.html');
   ```

3. **Server-to-UI Communication**
   ```typescript
   // Send data from server to UI
   player.ui.sendData({
     type: 'updateProjectileCount',
     count: number
   });
   ```

4. **UI-to-Server Communication**
   ```javascript
   // Receive data in UI from server
   hytopia.onData(data => {
     if (data.type === 'updateProjectileCount') {
       // Handle the update
     }
   });
   ```

### Message Format

The UI expects messages in the following format:
```typescript
{
  type: 'updateProjectileCount',
  count: number  // The number of projectiles remaining
}
```

### CSS Considerations

- Use `position: absolute` for overlay positioning
- Avoid using viewport units (vh/vw) as they may not work as expected
- Use rgba/transparency for better visual integration
- Consider using `backdrop-filter` for blur effects (when supported)

### Best Practices

1. Always load the UI before sending any data to it
2. Use consistent message types between server and UI
3. Keep the UI file lightweight and focused
4. Handle edge cases (e.g., negative counts, missing data)
5. Use clear class names to avoid conflicts
6. Implement smooth transitions for better UX

### Common Issues

1. **UI Not Showing**
   - Ensure UI is loaded before sending data
   - Check for HTML tag restrictions
   - Verify file path is correct relative to assets directory

2. **Updates Not Working**
   - Verify message type matches exactly
   - Check that selectors match HTML structure
   - Ensure DOM is ready before attaching listeners

3. **Visual Glitches**
   - Test with different resolutions
   - Avoid fixed pixel values for critical measurements
   - Use flexbox/grid for better layout stability

## Example Usage

```typescript
// Server-side (index.ts)
world.onPlayerJoin = player => {
  // Load UI first
  player.ui.load('ui/index.html');
  
  // Then send initial data
  player.ui.sendData({
    type: 'updateProjectileCount',
    count: initialCount
  });
};
``` 