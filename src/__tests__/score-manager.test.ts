import { ScoreManager } from '../managers/score-manager';

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
}); 