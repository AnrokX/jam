// The ScoreManager handles player scoring for block breaks and other game events

import { World, Vector3Like, Entity } from 'hytopia';
import { MovingBlockEntity } from '../moving_blocks/moving-block-entity';
import { ProjectileEntity } from '../entities/projectile-entity';

export interface ScoreOptions {
  score: number;
}

interface PlayerStats {
  totalScore: number;
  roundScore: number;
  wins: number;
  playerNumber: number;
  consecutiveHits: number;  // Track combo counter
  multiHitCount: number;    // Track multi-hit counter
  lastHitTime: number;      // Track timing for combo system
}

export class ScoreManager extends Entity {
  private static readonly SCORING_CONFIG = {
    COMBO_TIMEOUT_MS: 3000,         // Reduced combo window to 3 seconds for faster-paced gameplay
    TIME_DECAY_FACTOR: 15.0,        // More forgiving time decay to account for faster shots
    BASE_SCORE_MULTIPLIER: 1.5,     // Keep base multiplier the same
    MIN_SCORE: 1,                   // Minimum score remains the same
    
    // Movement multipliers with higher rewards for moving targets
    BASE_MOVEMENT_MULTIPLIER: 0.8,   // Keep static target baseline
    SINE_WAVE_MULTIPLIER: 2.5,      // Keep movement bonuses the same
    VERTICAL_WAVE_MULTIPLIER: 3.0,   // as they're well balanced
    POPUP_MULTIPLIER: 3.5,          // for the different
    RISING_MULTIPLIER: 4.0,         // movement types
    PARABOLIC_MULTIPLIER: 4.5,      // and difficulty levels
    
    // Adjusted combo system for faster gameplay
    MAX_COMBO_BONUS: 0.6,           // Slightly increased max combo bonus to reward skill
    MAX_MULTI_HIT_BONUS: 0.4,       // Slightly reduced multi-hit to balance faster shots
  };

  // Map to hold scores and stats for each player by their ID
  private playerStats = new Map<string, PlayerStats>();
  private playerCount = 0;

  constructor() {
    super({
      name: 'ScoreManager',
      blockTextureUri: 'blocks/air.png',  // Use an invisible block texture
      blockHalfExtents: { x: 0.001, y: 0.001, z: 0.001 }  // Make it tiny
    });
  }

  override spawn(world: World, position: Vector3Like): void {
    // Position it far away where it won't be visible
    super.spawn(world, { x: 0, y: -1000, z: 0 });
  }

  // Initialize a score entry for a player
  public initializePlayer(playerId: string): void {
    if (!this.playerStats.has(playerId)) {
      this.playerCount++;
      this.playerStats.set(playerId, {
        totalScore: 0,
        roundScore: 0,
        wins: 0,
        playerNumber: this.playerCount,
        consecutiveHits: 0,
        multiHitCount: 0,
        lastHitTime: 0
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

  // Calculate Euclidean distance between two points
  private calculateDistance(point1: Vector3Like, point2: Vector3Like): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = point2.z - point1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Calculate average of target's half-extents (S)
  private calculateAverageSize(halfExtents: Vector3Like): number {
    // Get the full dimensions by multiplying by 2 (since these are half-extents)
    const fullWidth = Math.max(halfExtents.x * 2, 2); // Minimum size of 2 for standard blocks
    const fullHeight = Math.max(halfExtents.y * 2, 2);
    const fullDepth = Math.max(halfExtents.z * 2, 2);
    
    // Calculate the average dimension, considering the actual block formation
    return (fullWidth + fullHeight + fullDepth) / 3;
  }

  // Get movement multiplier based on block type
  private getMovementMultiplier(block: MovingBlockEntity): number {
    const behaviorType = block.getMovementBehaviorType();
    console.log(`Determining multiplier for behavior type: ${behaviorType}`);
    
    switch (behaviorType) {
      case 'SineWaveMovement':
        return ScoreManager.SCORING_CONFIG.SINE_WAVE_MULTIPLIER;
      case 'VerticalWaveMovement':
        return ScoreManager.SCORING_CONFIG.VERTICAL_WAVE_MULTIPLIER;
      case 'PopUpMovement':
        return ScoreManager.SCORING_CONFIG.POPUP_MULTIPLIER;
      case 'RisingMovement':
        return ScoreManager.SCORING_CONFIG.RISING_MULTIPLIER;
      case 'ParabolicMovement':
        return ScoreManager.SCORING_CONFIG.PARABOLIC_MULTIPLIER;
      default:
        return ScoreManager.SCORING_CONFIG.BASE_MOVEMENT_MULTIPLIER;
    }
  }

  // Update combo and multi-hit counters
  private updateHitCounters(playerId: string): void {
    const stats = this.playerStats.get(playerId);
    if (!stats) return;

    const currentTime = Date.now();
    
    // Check if within combo window
    if (currentTime - stats.lastHitTime <= ScoreManager.SCORING_CONFIG.COMBO_TIMEOUT_MS) {
      stats.consecutiveHits++;
      stats.multiHitCount++;
    } else {
      // Reset counters if combo timeout has passed
      stats.consecutiveHits = 1;
      stats.multiHitCount = 1;
    }
    
    stats.lastHitTime = currentTime;
    this.playerStats.set(playerId, stats);
    
    // Update combo bonus calculation
    const comboBonus = Math.min(
      (stats.consecutiveHits - 1) * 0.15,  // Reduced per-hit bonus (was 0.2)
      ScoreManager.SCORING_CONFIG.MAX_COMBO_BONUS
    );
    
    const multiHitBonus = Math.min(
      (stats.multiHitCount - 1) * 0.1,     // Reduced per-hit bonus (was 0.2)
      ScoreManager.SCORING_CONFIG.MAX_MULTI_HIT_BONUS
    );
    
    console.log(`Player ${playerId} hit counters updated:`, {
      consecutiveHits: stats.consecutiveHits,
      multiHitCount: stats.multiHitCount,
      comboTimeRemaining: ScoreManager.SCORING_CONFIG.COMBO_TIMEOUT_MS - (currentTime - stats.lastHitTime),
      currentComboBonus: comboBonus.toFixed(2),
      currentMultiHitBonus: multiHitBonus.toFixed(2)
    });
  }

  // Calculate the dynamic score for a grenade hit
  public calculateGrenadeTargetScore(
    projectile: ProjectileEntity,
    block: MovingBlockEntity,
    impactPoint: Vector3Like,
    playerId: string
  ): number {
    const spawnOrigin = projectile.getSpawnOrigin();
    if (!spawnOrigin) {
      console.warn('No spawn origin found for projectile, using default score');
      return ScoreManager.SCORING_CONFIG.MIN_SCORE;
    }

    // Calculate distance (D)
    const distance = this.calculateDistance(spawnOrigin, impactPoint);
    console.log('🎯 Distance Analysis:', {
      spawnPoint: spawnOrigin,
      impactPoint,
      distance: distance.toFixed(2),
      explanation: 'Higher distance should increase score'
    });

    // Calculate size factor (S)
    const averageSize = this.calculateAverageSize(block.getBlockDimensions());
    console.log('📏 Size Analysis:', {
      blockDimensions: block.getBlockDimensions(),
      averageSize: averageSize.toFixed(2),
      distanceToSizeRatio: (distance / averageSize).toFixed(2),
      explanation: 'Smaller targets should give higher scores'
    });

    // Get movement multiplier (M)
    const movementMultiplier = this.getMovementMultiplier(block);
    console.log('🔄 Movement Analysis:', {
      behaviorType: block.getMovementBehaviorType(),
      multiplier: movementMultiplier,
      explanation: `Using ${movementMultiplier}x multiplier based on movement pattern`
    });

    // Calculate time factor (T)
    const elapsedTime = (Date.now() - block.getSpawnTime()) / 1000; // Convert to seconds
    const timeFactor = ScoreManager.SCORING_CONFIG.TIME_DECAY_FACTOR / (elapsedTime + ScoreManager.SCORING_CONFIG.TIME_DECAY_FACTOR);
    console.log('⏱️ Time Analysis:', {
      elapsedSeconds: elapsedTime.toFixed(2),
      decayFactor: ScoreManager.SCORING_CONFIG.TIME_DECAY_FACTOR,
      timeFactor: timeFactor.toFixed(4),
      explanation: 'Time factor decreases score for older targets'
    });

    // Get combo (C) and multi-hit (H) bonuses
    const stats = this.playerStats.get(playerId);
    if (!stats) {
      console.warn('No stats found for player, initializing new stats');
      this.initializePlayer(playerId);
    }
    
    this.updateHitCounters(playerId);
    const updatedStats = this.playerStats.get(playerId)!;
    
    const comboBonus = Math.min(
      (updatedStats.consecutiveHits - 1) * 0.15,
      ScoreManager.SCORING_CONFIG.MAX_COMBO_BONUS
    );
    
    const multiHitBonus = Math.min(
      (updatedStats.multiHitCount - 1) * 0.1,
      ScoreManager.SCORING_CONFIG.MAX_MULTI_HIT_BONUS
    );

    console.log('🔄 Combo Analysis:', {
      consecutiveHits: updatedStats.consecutiveHits,
      maxComboBonus: ScoreManager.SCORING_CONFIG.MAX_COMBO_BONUS,
      actualComboBonus: comboBonus.toFixed(2),
      explanation: `${updatedStats.consecutiveHits} consecutive hits = ${comboBonus.toFixed(2)}x bonus`
    });

    console.log('🎯 Multi-Hit Analysis:', {
      multiHitCount: updatedStats.multiHitCount,
      maxMultiHitBonus: ScoreManager.SCORING_CONFIG.MAX_MULTI_HIT_BONUS,
      actualMultiHitBonus: multiHitBonus.toFixed(2),
      explanation: `${updatedStats.multiHitCount} hits on target = ${multiHitBonus.toFixed(2)}x bonus`
    });

    // Calculate base score components
    const distanceSizeFactor = distance / averageSize;
    const baseScore = distanceSizeFactor * 
                     movementMultiplier * 
                     timeFactor * 
                     ScoreManager.SCORING_CONFIG.BASE_SCORE_MULTIPLIER;
                     
    const bonusMultiplier = 1 + comboBonus + multiHitBonus;
    const finalScore = Math.max(
      ScoreManager.SCORING_CONFIG.MIN_SCORE,
      Math.round(baseScore * bonusMultiplier)
    );

    console.log('💯 Final Score Breakdown:', {
      components: {
        distanceSizeFactor: distanceSizeFactor.toFixed(2),
        movementMultiplier: movementMultiplier.toFixed(2),
        timeFactor: timeFactor.toFixed(2),
        baseMultiplier: ScoreManager.SCORING_CONFIG.BASE_SCORE_MULTIPLIER,
        bonusMultiplier: bonusMultiplier.toFixed(2)
      },
      calculations: {
        baseScore: baseScore.toFixed(2),
        afterBonuses: (baseScore * bonusMultiplier).toFixed(2),
        finalScore: finalScore
      },
      formula: 'Score = ((D/S * M * timeFactor * BASE_MULTIPLIER) * (1 + C + H))'
    });

    return finalScore;
  }
} 