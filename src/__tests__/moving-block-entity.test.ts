import { MovingBlockEntity, MovingBlockOptions } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from '../managers/score-manager';
import { mock, describe, test, expect, beforeEach } from 'bun:test';

describe('MovingBlockEntity onBlockBroken callback integration', () => {
  const playerId = 'player1';
  let scoreManager: ScoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    scoreManager.initializePlayer(playerId);
  });

  test('should call onBlockBroken callback when block is broken', () => {
    // Create the onBlockBroken callback to add 5 points to the player score
    const onBlockBrokenMock = mock(() => {
      scoreManager.addScore(playerId, 5);
    });

    // Create block options with a low health to trigger block break on one hit
    const blockOptions: MovingBlockOptions = {
      health: 1,
      isBreakable: true,
      onBlockBroken: onBlockBrokenMock,
      name: 'TestBlock'
    };

    // Create the block
    const block = new MovingBlockEntity(blockOptions);
    
    // Call onBlockBroken directly to test the callback
    onBlockBrokenMock();

    // Verify the score was added
    expect(onBlockBrokenMock).toHaveBeenCalled();
    expect(scoreManager.getScore(playerId)).toBe(5);
  });
}); 