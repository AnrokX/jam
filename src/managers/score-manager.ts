// The ScoreManager handles player scoring for block breaks and other game events

import { World } from 'hytopia';

export interface ScoreOptions {
  score: number;
}

export class ScoreManager {
  // Map to hold scores for each player by their ID
  private playerScores = new Map<string, number>();
  // Map to hold round scores separately
  private roundScores = new Map<string, number>();

  // Initialize a score entry for a player
  public initializePlayer(playerId: string): void {
    if (!this.playerScores.has(playerId)) {
      this.playerScores.set(playerId, 0);
      this.roundScores.set(playerId, 0);
    }
  }

  // Remove a player's score when they leave the game
  public removePlayer(playerId: string): void {
    this.playerScores.delete(playerId);
    this.roundScores.delete(playerId);
  }

  // Start a new round - reset round scores but keep total scores
  public startNewRound(): void {
    for (const playerId of this.roundScores.keys()) {
      this.roundScores.set(playerId, 0);
    }
  }

  // Increment (or decrement) player's score. This allows adding negative points (e.g. penalties).
  public addScore(playerId: string, points: number): void {
    if (!this.playerScores.has(playerId)) {
      this.initializePlayer(playerId);
    }
    
    // Update both total and round scores
    const currentTotalScore = this.playerScores.get(playerId) ?? 0;
    const currentRoundScore = this.roundScores.get(playerId) ?? 0;
    
    this.playerScores.set(playerId, currentTotalScore + points);
    this.roundScores.set(playerId, currentRoundScore + points);
    
    console.log(`Player ${playerId} scores updated - Total: ${this.playerScores.get(playerId)}, Round: ${this.roundScores.get(playerId)}`);
  }

  // Get the current total score for a player
  public getScore(playerId: string): number {
    return this.playerScores.get(playerId) ?? 0;
  }

  // Get the current round score for a player
  public getRoundScore(playerId: string): number {
    return this.roundScores.get(playerId) ?? 0;
  }

  // Reset all scores (both total and round) to zero
  public resetScore(playerId: string): void {
    this.playerScores.set(playerId, 0);
    this.roundScores.set(playerId, 0);
  }

  // Reset all players' scores
  public resetAllScores(): void {
    for (const playerId of this.playerScores.keys()) {
      this.resetScore(playerId);
    }
  }

  // Add this method to broadcast score updates
  public broadcastScores(world: World) {
    const scores = Array.from(world.entityManager.getAllPlayerEntities()).map(playerEntity => ({
      playerId: playerEntity.player.id,
      totalScore: this.getScore(playerEntity.player.id),
      roundScore: this.getRoundScore(playerEntity.player.id)
    }));

    world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      playerEntity.player.ui.sendData({
        type: 'updateScores',
        scores
      });
    });
  }
} 