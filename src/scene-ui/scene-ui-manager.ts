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
      offset: { x: 0, y: 0.5, z: 0 } // Add a small offset to prevent z-fighting
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

  public showBlockDestroyedNotification(worldPosition: Vector3Like, score: number, player: Player): void {
    console.log('Showing block destroyed notification with score:', score);
    
    // Ensure score is rounded and positive
    const roundedScore = Math.max(0, Math.round(score));
    
    // Dynamic color calculation based on score
    const getScoreColor = (score: number): { main: string, glow: string, intensity: number } => {
      // Base colors for spectrum
      const colors = [
        { score: 0, color: '#888888', glow: '#444444', intensity: 0.2 },    // Gray
        { score: 10, color: '#39ff14', glow: '#2fb40e', intensity: 0.4 },   // Matrix green
        { score: 20, color: '#00ffff', glow: '#00cccc', intensity: 0.6 },   // Cyan
        { score: 35, color: '#ff3366', glow: '#cc295f', intensity: 0.8 },   // Pink
        { score: 50, color: '#ff9933', glow: '#cc7a29', intensity: 1.0 },   // Orange
        { score: 75, color: '#ff1717', glow: '#cc1313', intensity: 1.2 }    // Red
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

    // Calculate dynamic properties based on score
    const colorInfo = getScoreColor(roundedScore);
    const duration = 1000 + Math.min(roundedScore * 20, 2000); // 1-3 seconds based on score
    const scale = 1 + Math.min(roundedScore * 0.02, 1); // 1-2x scale based on score
    const verticalOffset = 1.5 + Math.min(roundedScore * 0.01, 1.5); // 1.5-3 units based on score
    
    // Log feedback details for debugging
    console.log('Block destroyed feedback -', {
      score: roundedScore,
      color: colorInfo,
      duration,
      scale: scale.toFixed(2),
      verticalOffset: verticalOffset.toFixed(2)
    });

    // Create dynamic CSS for the animation
    const dynamicStyle = `
      animation: scoreAnimation ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
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
      offset: { x: 0, y: verticalOffset, z: 0 }
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