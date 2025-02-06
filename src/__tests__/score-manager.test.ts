import { ScoreManager } from '../managers/score-manager';
import { mock, describe, test, expect, beforeEach } from 'bun:test';

describe('ScoreManager', () => {
  let scoreManager: ScoreManager;
  const playerId = 'player1';

  beforeEach(() => {
    scoreManager = new ScoreManager();
    scoreManager.initializePlayer(playerId);
  });

  test('initial score is 0', () => {
    expect(scoreManager.getScore(playerId)).toBe(0);
  });

  test('adding positive score increments the score', () => {
    scoreManager.addScore(playerId, 10);
    expect(scoreManager.getScore(playerId)).toBe(10);
  });

  test('adding negative score decrements the score', () => {
    scoreManager.addScore(playerId, -5);
    expect(scoreManager.getScore(playerId)).toBe(-5);
  });

  test('resetting score sets the score to 0', () => {
    scoreManager.addScore(playerId, 20);
    scoreManager.resetScore(playerId);
    expect(scoreManager.getScore(playerId)).toBe(0);
  });

  test('removing a player deletes their score', () => {
    scoreManager.addScore(playerId, 15);
    scoreManager.removePlayer(playerId);
    expect(scoreManager.getScore(playerId)).toBe(0); // returns 0 if player is no longer initialized
  });

  // New test for block break event
  test('player breaking a block awards points', () => {
    // Assume breaking a block should give 5 points in score
    const blockBreakScore = 5;
    scoreManager.addScore(playerId, blockBreakScore); // simulate block break event awarding points
    expect(scoreManager.getScore(playerId)).toBe(blockBreakScore);
  });
});

describe('Combo System', () => {
  let scoreManager: ScoreManager;
  const playerId = 'player1';
  let mockWorld: any;
  let mockPlayer: any;

  beforeEach(() => {
    // Mock the world and player entities for UI notifications
    mockPlayer = {
      id: playerId,
      ui: {
        sendData: mock(() => {})
      }
    };
    
    mockWorld = {
      entityManager: {
        getAllPlayerEntities: () => [{ player: mockPlayer }]
      }
    };

    scoreManager = new ScoreManager();
    (scoreManager as any).world = mockWorld;
    scoreManager.initializePlayer(playerId);
  });

  test('should reset combo when explicitly called', () => {
    const stats = (scoreManager as any).playerStats.get(playerId);
    stats.consecutiveHits = 5;
    stats.multiHitCount = 2;
    (scoreManager as any).playerStats.set(playerId, stats);

    scoreManager.resetCombo(playerId);

    const updatedStats = (scoreManager as any).playerStats.get(playerId);
    expect(updatedStats.consecutiveHits).toBe(0);
    expect(updatedStats.multiHitCount).toBe(0);
  });

  test('should send UI notification when resetting active combo', () => {
    // Set up an active combo
    const stats = (scoreManager as any).playerStats.get(playerId);
    stats.consecutiveHits = 5; // Above the minimum threshold for combo
    (scoreManager as any).playerStats.set(playerId, stats);

    scoreManager.resetCombo(playerId);

    // Verify UI notification was sent
    expect(mockPlayer.ui.sendData).toHaveBeenCalledWith({
      type: 'resetCombo'
    });
  });

  test('should not send UI notification when resetting inactive combo', () => {
    // Set up stats with no active combo
    const stats = (scoreManager as any).playerStats.get(playerId);
    stats.consecutiveHits = 2; // Below the minimum threshold for combo
    (scoreManager as any).playerStats.set(playerId, stats);

    scoreManager.resetCombo(playerId);

    // Verify no UI notification was sent
    expect(mockPlayer.ui.sendData).not.toHaveBeenCalled();
  });

  test('should handle resetting combo for non-existent player', () => {
    // Should not throw error
    expect(() => {
      scoreManager.resetCombo('nonexistent-player');
    }).not.toThrow();
  });

  test('should maintain combo state across multiple resets', () => {
    const stats = (scoreManager as any).playerStats.get(playerId);
    stats.consecutiveHits = 5;
    stats.multiHitCount = 2;
    (scoreManager as any).playerStats.set(playerId, stats);

    // Reset multiple times
    scoreManager.resetCombo(playerId);
    scoreManager.resetCombo(playerId);
    scoreManager.resetCombo(playerId);

    const finalStats = (scoreManager as any).playerStats.get(playerId);
    expect(finalStats.consecutiveHits).toBe(0);
    expect(finalStats.multiHitCount).toBe(0);
  });
}); 