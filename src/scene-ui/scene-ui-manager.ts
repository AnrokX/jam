import { World, Vector3Like, Player } from 'hytopia';

export class SceneUIManager {
  private static instance: SceneUIManager;
  private world: World;

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
    console.log('Showing hit notification with score:', score);
    
    player.ui.sendData({
      type: 'showHitNotification',
      data: {
        score: Math.round(score),
        position: worldPosition
      }
    });
  }

  public showBlockDestroyedNotification(worldPosition: Vector3Like, score: number, player: Player, spawnOrigin?: Vector3Like): void {
    console.log('Showing block destroyed notification with score:', score);
    
    // Ensure score is rounded and positive
    const roundedScore = Math.max(0, Math.round(score));
    
    // Calculate distance multiplier if spawn origin is available
    let distanceMultiplier = 1;
    if (worldPosition && spawnOrigin) {
      const dx = worldPosition.x - spawnOrigin.x;
      const dy = worldPosition.y - spawnOrigin.y;
      const dz = worldPosition.z - spawnOrigin.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      distanceMultiplier = 1 + Math.min(Math.pow(distance / 30, 1.1), 0.1);
    }
    
    // Calculate animation duration
    const duration = 500 + Math.min(
      roundedScore <= 30 
        ? Math.pow(roundedScore, 1.2) * 3 
        : Math.pow(roundedScore, 1.8) * 4
      * distanceMultiplier, 1200);
    
    // Calculate scale
    const scale = 1 + Math.min(
      roundedScore <= 30
        ? Math.pow(roundedScore / 80, 2.4)
        : Math.pow(roundedScore / 70, 2.4)
      * distanceMultiplier, 0.8);
    
    const verticalOffset = 1.5 + Math.min(Math.pow(roundedScore / 30, 1.4), 1.5);

    // Calculate color based on score
    const colorInfo = this.getScoreColor(roundedScore);
    
    // Create animation style
    const dynamicStyle = this.createDynamicStyle(roundedScore, scale, duration, colorInfo);

    // Send notification data to player's UI
    player.ui.sendData({
      type: 'showBlockDestroyedNotification',
      data: {
        score: roundedScore,
        position: worldPosition,
        style: dynamicStyle,
        verticalOffset,
        duration
      }
    });
  }

  public showComboNotification(consecutiveHits: number, comboBonus: number, player: Player): void {
    console.log('Showing combo notification:', { hits: consecutiveHits, bonus: comboBonus });
    
    player.ui.sendData({
      type: 'showCombo',
      data: {
        hits: consecutiveHits,
        bonus: comboBonus,
        text: this.getComboText(consecutiveHits)
      }
    });
  }

  private getComboText(hits: number): string {
    if (hits >= 10) return 'UNSTOPPABLE!';
    if (hits >= 7) return 'DOMINATING!';
    if (hits >= 5) return 'IMPRESSIVE!';
    if (hits >= 3) return 'NICE COMBO!';
    return '';
  }

  private getScoreColor(score: number): { main: string, glow: string, intensity: number } {
    const colors = [
      { score: 0, color: '#FFFFFF', glow: '#CCCCCC', intensity: 0.3 },
      { score: 15, color: '#FFFF00', glow: '#CCCC00', intensity: 0.6 },
      { score: 25, color: '#FFA500', glow: '#CC8400', intensity: 0.9 },
      { score: 50, color: '#FF0000', glow: '#CC0000', intensity: 1.2 },
      { score: 150, color: '#FF00FF', glow: '#FFFFFF', intensity: 1.5 }
    ];

    let lower = colors[0];
    let upper = colors[colors.length - 1];
    
    for (let i = 0; i < colors.length - 1; i++) {
      if (score >= colors[i].score && score < colors[i + 1].score) {
        lower = colors[i];
        upper = colors[i + 1];
        break;
      }
    }

    const range = upper.score - lower.score;
    const factor = range <= 0 ? 1 : (score - lower.score) / range;
    const intensity = lower.intensity + (upper.intensity - lower.intensity) * factor;

    return {
      main: this.interpolateHex(lower.color, upper.color, factor),
      glow: this.interpolateHex(lower.glow, upper.glow, factor),
      intensity
    };
  }

  private interpolateHex(hex1: string, hex2: string, factor: number): string {
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
  }

  private createDynamicStyle(score: number, scale: number, duration: number, colorInfo: { main: string, glow: string, intensity: number }): string {
    return `
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
      --score-value: ${score};
      --intensity: ${colorInfo.intensity};
    `;
  }

  public showDamageNumber(worldPosition: Vector3Like, damage: number, isCritical: boolean = false): void {
    console.log('Showing damage number:', { damage, position: worldPosition, isCritical });
    
    // Create notification data
    const notification = {
      type: 'showDamageNumber',
      data: {
        damage: Math.round(damage),
        position: worldPosition,
        isCritical,
        style: this.createDamageNumberStyle(damage, isCritical)
      }
    };

    // Broadcast to all players
    this.world.entityManager.getAllPlayerEntities().forEach(entity => {
      entity.player.ui.sendData(notification);
    });
  }

  private createDamageNumberStyle(damage: number, isCritical: boolean): string {
    const scale = isCritical ? 1.5 : 1 + Math.min(damage / 50, 0.5);
    const color = isCritical ? '#ff0000' : '#ff6b6b';
    const glow = isCritical ? '#ff0000' : '#ff4d4d';
    const duration = 800 + Math.min(damage * 10, 400);
    
    return `
      @keyframes damageNumber {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.5) translateY(0);
        }
        20% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(${scale}) translateY(-20px);
        }
        80% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(${scale}) translateY(-40px);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(${scale * 0.8}) translateY(-60px);
        }
      }
      animation: damageNumber ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      color: ${color};
      text-shadow: 0 0 10px ${glow};
      font-family: var(--display-font);
      font-size: ${24 * scale}px;
      font-weight: bold;
      ${isCritical ? 'filter: drop-shadow(0 0 5px #ff0000);' : ''}
    `;
  }

  public cleanup(): void {
    // No cleanup needed anymore as we're not storing any SceneUI instances
  }
} 