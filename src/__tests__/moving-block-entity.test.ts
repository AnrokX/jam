import { MovingBlockEntity, MovingBlockOptions } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from '../managers/score-manager';
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { ProjectileEntity } from '../entities/projectile-entity';

describe('MovingBlockEntity', () => {
  const playerId = 'player1';
  let scoreManager: ScoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    scoreManager.initializePlayer(playerId);
  });

  test('should award points when hit by a projectile and destroyed', () => {
    // Create a projectile with a player ID
    const projectile = new ProjectileEntity({
      name: 'TestProjectile',
      playerId: playerId
    });

    // Create block with scoring callback
    const block = new MovingBlockEntity({
      health: 1,  // One hit will destroy it
      isBreakable: true,
      onBlockBroken: () => {
        // Use the stored player ID from the block
        if ((block as any).playerId) {
          scoreManager.addScore((block as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods
    block.setOpacity = mock(() => {});
    block.despawn = mock(() => {});
    projectile.despawn = mock(() => {});
    
    // Simulate collision with projectile
    (block as any).handleCollision(projectile);

    // Verify score was awarded
    expect(scoreManager.getScore(playerId)).toBe(5);
  });

  test('should not award points if projectile has no player ID', () => {
    // Create a projectile without a player ID
    const projectile = new ProjectileEntity({
      name: 'TestProjectile'
      // No playerId set
    });

    // Create block with scoring callback
    const block = new MovingBlockEntity({
      health: 1,
      isBreakable: true,
      onBlockBroken: () => {
        // Use the stored player ID from the block
        if ((block as any).playerId) {
          scoreManager.addScore((block as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods
    block.setOpacity = mock(() => {});
    block.despawn = mock(() => {});
    projectile.despawn = mock(() => {});
    
    // Simulate collision with projectile
    (block as any).handleCollision(projectile);

    // Verify no score was awarded since there was no player ID
    expect(scoreManager.getScore(playerId)).toBe(0);
  });
}); 