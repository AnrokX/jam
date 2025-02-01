import { MovingBlockEntity, MovingBlockOptions } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from '../managers/score-manager';
import { mock, describe, test, expect, beforeEach } from 'bun:test';

// Mock hytopia module
const mockEntity = class MockEntity {
  name: string;
  isSpawned: boolean = false;
  constructor(options: { name: string }) {
    this.name = options.name;
  }
  spawn() {}
  despawn = mock(() => {});
  setPosition() {}
  setOpacity() {}
};

// Create mock implementations
const mockWorld = class MockWorld {};

describe('MovingBlockEntity onBlockBroken callback integration', () => {
  const playerId = 'player1';
  let scoreManager: ScoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    scoreManager.initializePlayer(playerId);
  });

  test('should call onBlockBroken callback to add score when block is broken', () => {
    // Create the onBlockBroken callback to add 5 points to the player score
    const onBlockBrokenMock = mock(() => {
      scoreManager.addScore(playerId, 5);
    });

    // Create block options with a low health to trigger block break on one hit
    const blockOptions: MovingBlockOptions = {
      health: 1,
      isBreakable: true,
      onBlockBroken: onBlockBrokenMock
    };

    const fakeWorld = new mockWorld();
    const block = new MovingBlockEntity(blockOptions);
    block.spawn(fakeWorld as any, { x: 0, y: 0, z: 0 });

    // Create a fake projectile entity
    const fakeProjectile = new mockEntity({ name: 'Projectile' });
    fakeProjectile.isSpawned = true;

    // Simulate collision with the projectile
    (block as any).handleCollision(fakeProjectile);

    // Verify the callback was called and score was added
    expect(onBlockBrokenMock).toHaveBeenCalled();
    expect(scoreManager.getScore(playerId)).toBe(5);
  });
}); 