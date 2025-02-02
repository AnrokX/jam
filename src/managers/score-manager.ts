// The ScoreManager handles player scoring for block breaks and other game events

import { World } from 'hytopia';

export interface ScoreOptions {
  score: number;
}

interface PlayerStats {
  totalScore: number;
  roundScore: number;
  wins: number;
  playerNumber: number;
}

export class ScoreManager {
  // Map to hold scores and stats for each player by their ID
  private playerStats = new Map<string, PlayerStats>();
  private playerCount = 0;

  // Initialize a score entry for a player
  public initializePlayer(playerId: string): void {
    if (!this.playerStats.has(playerId)) {
      this.playerCount++;
      this.playerStats.set(playerId, {
        totalScore: 0,
        roundScore: 0,
        wins: 0,
        playerNumber: this.playerCount
      });
    }
  }

  // Remove a player's score when they leave the game
  public removePlayer(playerId: string): void {
    if (this.playerStats.has(playerId)) {
      this.playerCount--;
      this.playerStats.delete(playerId);
    }
  }

  // Start a new round - reset round scores but keep total scores and wins
  public startNewRound(): void {
    for (const [playerId, stats] of this.playerStats.entries()) {
      stats.roundScore = 0;
      this.playerStats.set(playerId, stats);
    }
  }

  // Add a win for the player with the highest score in the round
  public handleRoundEnd(): string | null {
    let highestScore = -1;
    let winnerId: string | null = null;

    // Find the player with the highest round score
    for (const [playerId, stats] of this.playerStats.entries()) {
      if (stats.roundScore > highestScore) {
        highestScore = stats.roundScore;
        winnerId = playerId;
      }
    }

    // Add a win for the winner
    if (winnerId) {
      const stats = this.playerStats.get(winnerId)!;
      stats.wins++;
      this.playerStats.set(winnerId, stats);
    }

    return winnerId;
  }

  // Increment (or decrement) player's score
  public addScore(playerId: string, points: number): void {
    if (!this.playerStats.has(playerId)) {
      this.initializePlayer(playerId);
    }
    
    const stats = this.playerStats.get(playerId)!;
    stats.totalScore += points;
    stats.roundScore += points;
    this.playerStats.set(playerId, stats);
    
    console.log(`Player ${playerId} scores updated - Total: ${stats.totalScore}, Round: ${stats.roundScore}, Wins: ${stats.wins}`);
  }

  // Get the current total score for a player
  public getScore(playerId: string): number {
    return this.playerStats.get(playerId)?.totalScore ?? 0;
  }

  // Get the current round score for a player
  public getRoundScore(playerId: string): number {
    return this.playerStats.get(playerId)?.roundScore ?? 0;
  }

  // Get wins for a player
  public getWins(playerId: string): number {
    return this.playerStats.get(playerId)?.wins ?? 0;
  }

  // Reset score for a player
  public resetScore(playerId: string): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats.totalScore = 0;
      stats.roundScore = 0;
      this.playerStats.set(playerId, stats);
    }
  }

  // Reset all players' scores
  public resetAllScores(): void {
    for (const playerId of this.playerStats.keys()) {
      this.resetScore(playerId);
    }
  }

  // Reset all stats including wins
  public resetAllStats(): void {
    for (const [playerId, stats] of this.playerStats.entries()) {
      stats.totalScore = 0;
      stats.roundScore = 0;
      stats.wins = 0;
      this.playerStats.set(playerId, stats);
    }
  }

  // Add this method to broadcast scores and leaderboard
  public broadcastScores(world: World) {
    const scores = Array.from(world.entityManager.getAllPlayerEntities()).map(playerEntity => ({
      playerId: playerEntity.player.id,
      totalScore: this.getScore(playerEntity.player.id),
      roundScore: this.getRoundScore(playerEntity.player.id)
    }));

    // Create leaderboard data
    const leaderboard = Array.from(this.playerStats.entries())
      .map(([playerId, stats]) => ({
        playerNumber: stats.playerNumber,
        wins: stats.wins,
        isWinning: this.isWinning(playerId)
      }))
      .sort((a, b) => b.wins - a.wins);

    world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      playerEntity.player.ui.sendData({
        type: 'updateScores',
        scores
      });
      
      playerEntity.player.ui.sendData({
        type: 'updateLeaderboard',
        leaderboard
      });
    });
  }

  private isWinning(playerId: string): boolean {
    const playerWins = this.getWins(playerId);
    return Array.from(this.playerStats.values())
      .every(stats => stats.wins <= playerWins);
  }
} 