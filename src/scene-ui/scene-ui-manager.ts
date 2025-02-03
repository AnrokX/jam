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
    console.log('Showing block destroyed notification with score:', score); // Debug log
    console.log('Score type:', typeof score);
    console.log('Score value before rounding:', score);
    
    // Ensure score is rounded and positive
    const roundedScore = Math.max(0, Math.round(score));
    console.log('Final rounded score:', roundedScore);
    
    // Create a new SceneUI instance for the block destroyed notification
    const destroyNotification = new SceneUI({
      templateId: 'block-destroyed-notification',
      state: { 
        score: roundedScore,
        text: 'Block Destroyed!'
      },
      position: worldPosition,
      offset: { x: 0, y: 1.5, z: 0 } // Increased offset for better visibility
    });

    // Log the notification state
    console.log('Notification state:', destroyNotification.state);

    // Load the SceneUI into the world
    destroyNotification.load(this.world);
    console.log('Block destroyed notification loaded with state:', destroyNotification.state); // Debug log

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
    }, 1500);
  }

  public cleanup(): void {
    // Clean up all active notifications
    this.hitNotifications.forEach(notification => {
      notification.unload();
    });
    this.hitNotifications.clear();
  }
} 