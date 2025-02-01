import { MovingBlockEntity, MovingBlockOptions } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from '../managers/score-manager';
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { ProjectileEntity } from '../entities/projectile-entity';

describe('MovingBlockEntity', () => {
  const player1Id = 'player1';
  const player2Id = 'player2';
  let scoreManager: ScoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    scoreManager.initializePlayer(player1Id);
    scoreManager.initializePlayer(player2Id);
  });

  test('should award points when hit by a projectile and destroyed', () => {
    // Create a projectile with a player ID
    const projectile = new ProjectileEntity({
      name: 'TestProjectile',
      playerId: player1Id
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
    expect(scoreManager.getScore(player1Id)).toBe(5);
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
    expect(scoreManager.getScore(player1Id)).toBe(0);
  });

  test('should award points to the player who gets the last hit', () => {
    // Create projectiles for both players
    const player1Projectile = new ProjectileEntity({
      name: 'Player1Projectile',
      playerId: player1Id
    });

    const player2Projectile = new ProjectileEntity({
      name: 'Player2Projectile',
      playerId: player2Id
    });

    // Create block with 2 health so it takes multiple hits
    const block = new MovingBlockEntity({
      health: 2,
      isBreakable: true,
      onBlockBroken: () => {
        if ((block as any).playerId) {
          scoreManager.addScore((block as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods
    block.setOpacity = mock(() => {});
    block.despawn = mock(() => {});
    player1Projectile.despawn = mock(() => {});
    player2Projectile.despawn = mock(() => {});
    
    // Player 1 hits first but doesn't destroy
    (block as any).handleCollision(player1Projectile);
    
    // Player 2 gets the killing blow
    (block as any).handleCollision(player2Projectile);

    // Verify only player 2 got points
    expect(scoreManager.getScore(player1Id)).toBe(0);
    expect(scoreManager.getScore(player2Id)).toBe(5);
  });

  test('should track scores separately for multiple players breaking different blocks', () => {
    // Create projectiles for both players
    const player1Projectile = new ProjectileEntity({
      name: 'Player1Projectile',
      playerId: player1Id
    });

    const player2Projectile = new ProjectileEntity({
      name: 'Player2Projectile',
      playerId: player2Id
    });

    // Create two blocks
    const block1 = new MovingBlockEntity({
      health: 1,
      isBreakable: true,
      onBlockBroken: () => {
        if ((block1 as any).playerId) {
          scoreManager.addScore((block1 as any).playerId, 5);
        }
      }
    });

    const block2 = new MovingBlockEntity({
      health: 1,
      isBreakable: true,
      onBlockBroken: () => {
        if ((block2 as any).playerId) {
          scoreManager.addScore((block2 as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods for both blocks and projectiles
    block1.setOpacity = mock(() => {});
    block1.despawn = mock(() => {});
    block2.setOpacity = mock(() => {});
    block2.despawn = mock(() => {});
    player1Projectile.despawn = mock(() => {});
    player2Projectile.despawn = mock(() => {});
    
    // Player 1 breaks first block
    (block1 as any).handleCollision(player1Projectile);
    
    // Player 2 breaks second block
    (block2 as any).handleCollision(player2Projectile);

    // Verify both players got points for their respective blocks
    expect(scoreManager.getScore(player1Id)).toBe(5);
    expect(scoreManager.getScore(player2Id)).toBe(5);
  });

  test('should handle rapid hits from multiple players', () => {
    // Create projectiles for both players
    const player1Projectile = new ProjectileEntity({
      name: 'Player1Projectile',
      playerId: player1Id
    });

    const player2Projectile = new ProjectileEntity({
      name: 'Player2Projectile',
      playerId: player2Id
    });

    // Create block with higher health
    const block = new MovingBlockEntity({
      health: 3,
      isBreakable: true,
      onBlockBroken: () => {
        if ((block as any).playerId) {
          scoreManager.addScore((block as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods
    block.setOpacity = mock(() => {});
    block.despawn = mock(() => {});
    player1Projectile.despawn = mock(() => {});
    player2Projectile.despawn = mock(() => {});
    
    // Simulate rapid hits alternating between players
    (block as any).handleCollision(player1Projectile); // Health: 2
    (block as any).handleCollision(player2Projectile); // Health: 1
    (block as any).handleCollision(player1Projectile); // Health: 0 - Player 1 gets the kill

    // Verify only the player who got the last hit gets points
    expect(scoreManager.getScore(player1Id)).toBe(5);
    expect(scoreManager.getScore(player2Id)).toBe(0);
  });

  test('should maintain player ID when block transforms', () => {
    // Create a projectile with a player ID
    const projectile = new ProjectileEntity({
      name: 'TestProjectile',
      playerId: player1Id
    });

    // Create block with scoring callback and higher health
    const block = new MovingBlockEntity({
      health: 3,  // Multiple hits needed to destroy
      isBreakable: true,
      onBlockBroken: () => {
        if ((block as any).playerId) {
          scoreManager.addScore((block as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods
    block.setOpacity = mock(() => {});
    block.despawn = mock(() => {});
    projectile.despawn = mock(() => {});
    
    // Mock isSpawned to true so handleCollision works
    (block as any).isSpawned = true;
    
    // Simulate first hit - should transform block but not destroy
    (block as any).handleCollision(projectile);
    
    // Verify block stored the player ID
    expect((block as any).playerId).toBe(player1Id);
    
    // Create second projectile from different player
    const projectile2 = new ProjectileEntity({
      name: 'TestProjectile2',
      playerId: player2Id
    });
    projectile2.despawn = mock(() => {});

    // Simulate second hit from different player
    (block as any).handleCollision(projectile2);
    
    // Verify player ID was updated to the new player
    expect((block as any).playerId).toBe(player2Id);

    // Simulate final hit to destroy block
    (block as any).handleCollision(projectile2);

    // Verify points were awarded to the last player who hit it
    expect(scoreManager.getScore(player1Id)).toBe(0);
    expect(scoreManager.getScore(player2Id)).toBe(5);
  });

  test('should handle block transformation without breaking score tracking', () => {
    const block = new MovingBlockEntity({
      health: 2,
      isBreakable: true,
      onBlockBroken: () => {
        if ((block as any).playerId) {
          scoreManager.addScore((block as any).playerId, 5);
        }
      }
    });
    
    // Mock required methods
    block.setOpacity = mock(() => {});
    block.despawn = mock(() => {});
    
    // Mock isSpawned to true so handleCollision works
    (block as any).isSpawned = true;

    // Create and hit with first projectile
    const projectile1 = new ProjectileEntity({
      name: 'TestProjectile1',
      playerId: player1Id
    });
    projectile1.despawn = mock(() => {});
    
    // First hit should transform but not destroy
    (block as any).handleCollision(projectile1);
    expect(scoreManager.getScore(player1Id)).toBe(0); // No points yet
    
    // Second hit should destroy and award points
    (block as any).handleCollision(projectile1);
    expect(scoreManager.getScore(player1Id)).toBe(5); // Points awarded
  });
}); 