import { World, Vector3Like, Player, SceneUI } from 'hytopia';

export class SceneUIManager {
  private static instance: SceneUIManager;
  private world: World;
  private hitNotifications: Map<number, SceneUI> = new Map();
  private nextNotificationId: number = 0;

  private constructor(world: World) {
    this.world = world;
  }

  public static getInstance(world: World): SceneUIManager {
    if (!SceneUIManager.instance) {
      SceneUIManager.instance = new SceneUIManager(world);
    }
    return SceneUIManager.instance;
  }

  public showHitNotification(worldPosition: Vector3Like, score: number, player: Player): void {
    console.log('Showing hit notification with score:', score); // Debug log
    
    // Create a new SceneUI instance for the hit notification
    const hitNotification = new SceneUI({
      templateId: 'hit-notification',
      state: { score: Math.round(score) },
      position: worldPosition,
      offset: { x: 0, y: 0.5, z: 0 },
      viewDistance: 200 // Add this to increase view distance
    });

    // Load the SceneUI into the world
    hitNotification.load(this.world);
    console.log('Hit notification loaded with state:', hitNotification.state); // Debug log

    // Store the notification with a unique ID
    const notificationId = this.nextNotificationId++;
    this.hitNotifications.set(notificationId, hitNotification);

    // Remove the notification after animation
    setTimeout(() => {
      const notification = this.hitNotifications.get(notificationId);
      if (notification) {
        notification.unload();
        this.hitNotifications.delete(notificationId);
      }
    }, 1000);
  }

  public showBlockDestroyedNotification(worldPosition: Vector3Like, score: number, player: Player, spawnOrigin?: Vector3Like): void {
    console.log('Showing block destroyed notification with score:', score);
    
    // Ensure score is rounded and positive
    const roundedScore = Math.max(0, Math.round(score));
    
    // Get distance multiplier if spawn origin is available
    let distanceMultiplier = 1;
    if (this.world && worldPosition && spawnOrigin) {
      const dx = worldPosition.x - spawnOrigin.x;
      const dy = worldPosition.y - spawnOrigin.y;
      const dz = worldPosition.z - spawnOrigin.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Reduced from 0.3 to 0.1 max bonus (1.1x max instead of 1.3x)
      distanceMultiplier = 1 + Math.min(Math.pow(distance / 30, 1.1), 0.1);
    }
    
    // Balanced duration with moderate curve for mid-range scores
    const duration = 500 + Math.min(
      roundedScore <= 30 
        ? Math.pow(roundedScore, 1.2) * 3 
        : Math.pow(roundedScore, 1.8) * 4
      * distanceMultiplier, 1200); 
    
    // Much more conservative scale for all scores
    const scale = 1 + Math.min(
      roundedScore <= 30
        ? Math.pow(roundedScore / 80, 2.4)   // More conservative scaling for normal scores
        : Math.pow(roundedScore / 70, 2.4)   // More conservative scaling for high scores
      * distanceMultiplier, 0.8);              // Reduced max scale from 2 to 1.8
    
    const verticalOffset = 1.5 + Math.min(Math.pow(roundedScore / 30, 1.4), 1.5); // Reduced from 2.5 to 1.5

    // Dynamic color calculation based on score
    const getScoreColor = (score: number): { main: string, glow: string, intensity: number } => {
      // Base colors for spectrum
      const colors = [
        { score: 0, color: '#FFFFFF', glow: '#CCCCCC', intensity: 0.3 },    // White
        { score: 15, color: '#FFFF00', glow: '#CCCC00', intensity: 0.6 },   // Yellow
        { score: 25, color: '#FFA500', glow: '#CC8400', intensity: 0.9 },   // Orange
        { score: 50, color: '#FF0000', glow: '#CC0000', intensity: 1.2 },   // Red
        { score: 150, color: '#FF00FF', glow: '#FFFFFF', intensity: 1.5 }    // Purple with white glow
      ];

      // Find the two colors to interpolate between
      let lower = colors[0];
      let upper = colors[colors.length - 1];
      
      for (let i = 0; i < colors.length - 1; i++) {
        if (score >= colors[i].score && score < colors[i + 1].score) {
          lower = colors[i];
          upper = colors[i + 1];
          break;
        }
      }

      // Calculate interpolation factor
      const range = upper.score - lower.score;
      const factor = range <= 0 ? 1 : (score - lower.score) / range;

      // Interpolate color components
      const interpolateHex = (hex1: string, hex2: string, factor: number) => {
        const r1 = parseInt(hex1.slice(1, 3), 16);
        const g1 = parseInt(hex1.slice(3, 5), 16);
        const b1 = parseInt(hex1.slice(5, 7), 16);
        const r2 = parseInt(hex2.slice(1, 3), 16);
        const g2 = parseInt(hex2.slice(3, 5), 16);
        const b2 = parseInt(hex2.slice(5, 7), 16);

        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);

        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
      };

      const intensity = lower.intensity + (upper.intensity - lower.intensity) * factor;
      
      return {
        main: interpolateHex(lower.color, upper.color, factor),
        glow: interpolateHex(lower.glow, upper.glow, factor),
        intensity
      };
    };

    // Calculate dynamic properties based on score and distance
    const colorInfo = getScoreColor(roundedScore);
    
    // Log feedback details for debugging
    console.log('Block destroyed feedback -', {
      score: roundedScore,
      color: colorInfo,
      duration,
      scale: scale.toFixed(2),
      verticalOffset: verticalOffset.toFixed(2),
      distanceMultiplier: distanceMultiplier.toFixed(2)
    });

    // Create dynamic CSS for the animation
    const dynamicStyle = `
      @keyframes scoreAnimation {
        0% {
          opacity: 0;
          transform: translateY(0) scale(0.2);
        }
        15% {
          opacity: 1;
          transform: translateY(-${8 * scale}px) scale(${scale * 0.9});
        }
        30% {
          opacity: 1;
          transform: translateY(-${20 * scale}px) scale(${scale});
        }
        60% {
          opacity: 1;
          transform: translateY(-${35 * scale}px) scale(${scale});
        }
        85% {
          opacity: 0.5;
          transform: translateY(-${45 * scale}px) scale(${scale * 0.9});
        }
        100% {
          opacity: 0;
          transform: translateY(-${50 * scale}px) scale(${scale * 0.8});
        }
      }
      animation: scoreAnimation ${duration}ms ease-out forwards;
      will-change: transform, opacity;
      transform: translateZ(0);
      font-size: ${scale * 48}px;
      color: ${colorInfo.main};
      text-shadow: 0 0 ${5 + colorInfo.intensity * 15}px ${colorInfo.glow};
      --score-value: ${roundedScore};
      --intensity: ${colorInfo.intensity};
    `;

    // Create a new SceneUI instance for the block destroyed notification
    const destroyNotification = new SceneUI({
      templateId: 'block-destroyed-notification',
      state: { 
        score: roundedScore,
        style: dynamicStyle
      },
      position: worldPosition,
      offset: { x: 0, y: verticalOffset, z: 0 },
      viewDistance: 200 // Add this to increase view distance (in world units)
    });

    // Load the SceneUI into the world
    destroyNotification.load(this.world);

    // Store the notification with a unique ID
    const notificationId = this.nextNotificationId++;
    this.hitNotifications.set(notificationId, destroyNotification);

    // Remove the notification after animation
    setTimeout(() => {
      const notification = this.hitNotifications.get(notificationId);
      if (notification) {
        notification.unload();
        this.hitNotifications.delete(notificationId);
      }
    }, duration + 100);
  }

  public cleanup(): void {
    // Clean up all active notifications
    this.hitNotifications.forEach(notification => {
      notification.unload();
    });
    this.hitNotifications.clear();
  }
} 