// The ScoreManager handles player scoring for block breaks and other game events

import { Player } from 'hytopia';

export interface ScoreOptions {
  score: number;
}

export class ScoreManager {
  // Map to hold scores for each player by their ID
  private playerScores = new Map<string, number>();

  // Initialize a score entry for a player
  public initializePlayer(playerId: string): void {
    if (!this.playerScores.has(playerId)) {
      this.playerScores.set(playerId, 0);
    }
  }

  // Remove a player's score when they leave the game
  public removePlayer(playerId: string): void {
    this.playerScores.delete(playerId);
  }

  // Increment (or decrement) player's score. This allows adding negative points (e.g. penalties).
  public addScore(playerId: string, points: number): void {
    if (!this.playerScores.has(playerId)) {
      this.initializePlayer(playerId);
    }
    const currentScore = this.playerScores.get(playerId) ?? 0;
    this.playerScores.set(playerId, currentScore + points);
  }

  // Get the current score for a player. Returns 0 if the player is not initialized.
  public getScore(playerId: string): number {
    return this.playerScores.get(playerId) ?? 0;
  }

  // Reset the player's score to zero (e.g., for a new game or specific events)
  public resetScore(playerId: string): void {
    this.playerScores.set(playerId, 0);
  }
} 