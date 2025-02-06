import { ScoreManager } from '../managers/score-manager';
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('Round-based Scoring', () => {
  let scoreManager: ScoreManager;
  const player1Id = 'player1';
  const player2Id = 'player2';
  const player3Id = 'player3';

  beforeEach(() => {
    scoreManager = new ScoreManager();
    // Initialize multiple players for testing
    scoreManager.initializePlayer(player1Id);
    scoreManager.initializePlayer(player2Id);
    scoreManager.initializePlayer(player3Id);
  });

  test('should track round scores separately from total scores', () => {
    scoreManager.addScore(player1Id, 10);
    expect(scoreManager.getScore(player1Id)).toBe(10);
    expect(scoreManager.getRoundScore(player1Id)).toBe(10);

    // Start new round should reset round score but keep total
    scoreManager.startNewRound();
    expect(scoreManager.getScore(player1Id)).toBe(0); // Total score resets at start of round
    expect(scoreManager.getRoundScore(player1Id)).toBe(0);
  });

  test('should handle round end with correct placements', () => {
    // Add different scores for each player
    scoreManager.addScore(player1Id, 30);
    scoreManager.addScore(player2Id, 20);
    scoreManager.addScore(player3Id, 10);

    const { winnerId, placements } = scoreManager.handleRoundEnd();

    // Check winner
    expect(winnerId).toBe(player1Id);

    // Check placements (3 players, so points should be 3,2,1)
    expect(placements).toHaveLength(3);
    expect(placements[0]).toEqual({ playerId: player1Id, points: 3 });
    expect(placements[1]).toEqual({ playerId: player2Id, points: 2 });
    expect(placements[2]).toEqual({ playerId: player3Id, points: 1 });
  });

  test('should accumulate placement points across rounds', () => {
    // Round 1
    scoreManager.addScore(player1Id, 30);
    scoreManager.addScore(player2Id, 20);
    scoreManager.addScore(player3Id, 10);
    scoreManager.handleRoundEnd();

    // Round 2 - different order
    scoreManager.startNewRound();
    scoreManager.addScore(player2Id, 40);
    scoreManager.addScore(player3Id, 30);
    scoreManager.addScore(player1Id, 20);
    const { placements } = scoreManager.handleRoundEnd();

    // Player 1: 3 + 1 = 4 points
    // Player 2: 2 + 3 = 5 points
    // Player 3: 1 + 2 = 3 points
    const player1Stats = (scoreManager as any).playerStats.get(player1Id);
    const player2Stats = (scoreManager as any).playerStats.get(player2Id);
    const player3Stats = (scoreManager as any).playerStats.get(player3Id);

    expect(player1Stats.placementPoints).toBe(4);
    expect(player2Stats.placementPoints).toBe(5);
    expect(player3Stats.placementPoints).toBe(3);
  });

  test('should track wins correctly', () => {
    // Round 1 - Player 1 wins
    scoreManager.addScore(player1Id, 30);
    scoreManager.addScore(player2Id, 20);
    scoreManager.handleRoundEnd();

    // Round 2 - Player 1 wins again
    scoreManager.startNewRound();
    scoreManager.addScore(player1Id, 40);
    scoreManager.addScore(player2Id, 30);
    scoreManager.handleRoundEnd();

    expect(scoreManager.getWins(player1Id)).toBe(2);
    expect(scoreManager.getWins(player2Id)).toBe(0);
  });

  test('should reset all stats including wins and placement points', () => {
    // Add some scores and end round
    scoreManager.addScore(player1Id, 30);
    scoreManager.addScore(player2Id, 20);
    scoreManager.handleRoundEnd();

    // Reset all stats
    scoreManager.resetAllStats();

    // Check everything is reset
    expect(scoreManager.getScore(player1Id)).toBe(0);
    expect(scoreManager.getRoundScore(player1Id)).toBe(0);
    expect(scoreManager.getWins(player1Id)).toBe(0);
    
    const player1Stats = (scoreManager as any).playerStats.get(player1Id);
    expect(player1Stats.placementPoints).toBe(0);
    expect(player1Stats.consecutiveHits).toBe(0);
    expect(player1Stats.multiHitCount).toBe(0);
  });

  test('should handle ties in round scoring correctly', () => {
    // Create a tie between player1 and player2
    scoreManager.addScore(player1Id, 20);
    scoreManager.addScore(player2Id, 20);
    scoreManager.addScore(player3Id, 10);

    const { winnerId, placements } = scoreManager.handleRoundEnd();

    // First player in should win the tie
    expect(winnerId).toBe(player1Id);
    
    // Both tied players should get the higher placement points
    expect(placements[0].points).toBe(3); // player1
    expect(placements[1].points).toBe(3); // player2
    expect(placements[2].points).toBe(1); // player3
  });

  test('should maintain round continuity when players leave and rejoin', () => {
    // Start with initial players
    scoreManager.addScore(player1Id, 30);
    scoreManager.addScore(player2Id, 20);
    const round1Result = scoreManager.handleRoundEnd();
    expect(round1Result.winnerId).toBe(player1Id);

    // Start new round
    scoreManager.startNewRound();
    
    // Simulate player2 leaving (remove their stats)
    scoreManager.removePlayer(player2Id);
    
    // Add scores for remaining player
    scoreManager.addScore(player1Id, 25);
    const round2Result = scoreManager.handleRoundEnd();
    expect(round2Result.winnerId).toBe(player1Id);

    // Start another round
    scoreManager.startNewRound();
    
    // Simulate player2 rejoining
    scoreManager.initializePlayer(player2Id);
    
    // Add scores in new order
    scoreManager.addScore(player2Id, 40);
    scoreManager.addScore(player1Id, 30);
    const round3Result = scoreManager.handleRoundEnd();
    
    // Check that player2's rejoin didn't affect round counting
    expect(round3Result.winnerId).toBe(player2Id);
    expect(scoreManager.getWins(player1Id)).toBe(2); // Should have won rounds 1 and 2
    expect(scoreManager.getWins(player2Id)).toBe(1); // Should have won round 3
  });
}); 