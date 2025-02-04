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
    
    // Calculate dynamic duration based on score tier
    const getDuration = (score: number): number => {
      if (score >= 100) return 3000;      // Legendary
      if (score >= 75) return 2500;       // Epic
      if (score >= 50) return 2000;       // Rare
      if (score >= 25) return 1500;       // Uncommon
      return 1000;                        // Basic
    };
    
    // Calculate dynamic scale based on score tier
    const getScale = (score: number): number => {
      const baseScale = 1.0;
      if (score >= 100) return baseScale * 2.0;     // Legendary
      if (score >= 75) return baseScale * 1.75;     // Epic
      if (score >= 50) return baseScale * 1.5;      // Rare
      if (score >= 25) return baseScale * 1.25;     // Uncommon
      return baseScale;                             // Basic
    };
    
    // Determine score class and effects based on value
    const getScoreClass = (score: number): string => {
      if (score >= 100) return 'score-legendary';
      if (score >= 75) return 'score-epic';
      if (score >= 50) return 'score-rare';
      if (score >= 25) return 'score-uncommon';
      return 'score-basic';
    };
    
    const duration = getDuration(roundedScore);
    const scale = getScale(roundedScore);
    const scoreClass = getScoreClass(roundedScore);
    
    // Calculate vertical offset based on score
    const verticalOffset = Math.min(3, 1.5 + (roundedScore / 100)); // Caps at 3 units
    
    // Log feedback details for debugging
    console.log('Block destroyed feedback -', {
      class: scoreClass,
      duration,
      scale: scale.toFixed(2),
      verticalOffset: verticalOffset.toFixed(2)
    });

    // Create a new SceneUI instance for the block destroyed notification
    const destroyNotification = new SceneUI({
      templateId: 'block-destroyed-notification',
      state: { 
        score: roundedScore,
        class: scoreClass,
        style: `
          animation: scoreAnimation ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          font-size: ${scale * 48}px;
          --score-value: ${roundedScore};
          --vertical-offset: ${verticalOffset};
        `
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