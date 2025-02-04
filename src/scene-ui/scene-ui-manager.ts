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
    console.log('Score type:', typeof score);
    console.log('Score value before rounding:', score);
    
    // Ensure score is rounded and positive
    const roundedScore = Math.max(0, Math.round(score));
    console.log('Final rounded score:', roundedScore);
    
    // Calculate dynamic duration and scale based on score
    const baseDuration = 1500; // Base duration in ms
    const durationMultiplier = Math.min(2, 1 + (roundedScore / 100)); // Cap at 2x duration
    const duration = Math.round(baseDuration * durationMultiplier);
    
    // Scale factor increases with score but is capped
    const baseScale = 1.5;
    const scaleMultiplier = Math.min(1.5, 1 + (roundedScore / 200)); // Cap at 1.5x scale
    const scale = baseScale * scaleMultiplier;
    
    // Determine score class based on value
    let scoreClass = 'score-low';
    if (roundedScore >= 75) {
      scoreClass = 'score-epic';
    } else if (roundedScore >= 50) {
      scoreClass = 'score-high';
    } else if (roundedScore >= 25) {
      scoreClass = 'score-medium';
    }
    
    // Log feedback details for debugging
    console.log('Block destroyed feedback -', {
      class: scoreClass,
      duration: duration,
      scale: scale.toFixed(2)
    });

    // Create a new SceneUI instance for the block destroyed notification
    const destroyNotification = new SceneUI({
      templateId: 'block-destroyed-notification',
      state: { 
        score: roundedScore,
        class: scoreClass,
        style: `animation: scoreAnimation ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) forwards; font-size: ${scale * 48}px;`
      },
      position: worldPosition,
      offset: { x: 0, y: 1.5, z: 0 }
    });

    // Log the notification state
    console.log('Notification state:', destroyNotification.state);

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
    }, duration + 100); // Add small buffer to ensure animation completes
  }

  public cleanup(): void {
    // Clean up all active notifications
    this.hitNotifications.forEach(notification => {
      notification.unload();
    });
    this.hitNotifications.clear();
  }
} 