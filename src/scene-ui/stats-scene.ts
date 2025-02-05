import { PlayerEntity, World, SceneUI } from 'hytopia';

export interface PlayerRoundStats {
  playerId: string;
  playerNumber: number;
  roundScore: number;
  totalScore: number;
  consecutiveHits: number;
  multiHitCount: number;
  wins: number;
}

export interface RoundSummary {
  roundNumber: number;
  duration: number;
  players: PlayerRoundStats[];
  highestScore: number;
  mostConsecutiveHits: number;
  mostMultiHits: number;
}

export class StatsScene {
  private static readonly SCENE_DURATION = 10000; // 10 seconds
  private world: World;
  private onSceneComplete: () => void;

  // If you do need one StatsScene per player, remove the static instance
  // and manage multiple StatsScene objects yourself. Otherwise, keep it static
  // but do not store a single SceneUI across all players.
  private constructor(world: World, onSceneComplete: () => void) {
    this.world = world;
    this.onSceneComplete = onSceneComplete;
  }

  public static getInstance(world: World, onSceneComplete: () => void): StatsScene {
    return new StatsScene(world, onSceneComplete);
  }

  public show(playerEntity: PlayerEntity, roundSummary: RoundSummary): void {
    // Create a fresh SceneUI for each player so that each has the correct attached entity
    const sceneUI = new SceneUI({
      templateId: 'stats-scene', // must match your UI registration
      attachedToEntity: playerEntity, // attach to PlayerEntity
      position: playerEntity.position, // Add current position
      offset: { x: 0, y: 2, z: 0 }, // position above the player
    });

    sceneUI.load(this.world);

    // Sort players by round score
    const sortedPlayers = [...roundSummary.players].sort((a, b) => b.roundScore - a.roundScore);

    // Find this player's stats and rank
    const playerStats = sortedPlayers.find(p => p.playerId === playerEntity.player.id);
    const playerRank = sortedPlayers.findIndex(p => p.playerId === playerEntity.player.id) + 1;

    // Update SceneUI state
    sceneUI.setState({
      roundNumber: roundSummary.roundNumber,
      playerStats: {
        ...playerStats,
        rank: playerRank,
      },
      leaderboard: sortedPlayers.map(p => ({
        playerNumber: p.playerNumber,
        roundScore: p.roundScore,
        totalScore: p.totalScore,
        wins: p.wins,
      })),
      roundHighlights: {
        highestScore: roundSummary.highestScore,
        mostConsecutiveHits: roundSummary.mostConsecutiveHits,
        mostMultiHits: roundSummary.mostMultiHits,
      },
      timeUntilNextRound: Math.floor(StatsScene.SCENE_DURATION / 1000),
    });

    // Start a countdown for the next round
    let timeLeft = Math.floor(StatsScene.SCENE_DURATION / 1000);
    const timer = setInterval(() => {
      timeLeft--;

      // Update the UI timer
      playerEntity.player.ui.sendData({
        type: 'updateStatsTimer',
        timeLeft,
      });

      if (timeLeft <= 0) {
        clearInterval(timer);

        // Tell the client to hide stats
        playerEntity.player.ui.sendData({
          type: 'hideStatsScene',
        });

        // Unload this player's stats UI
        sceneUI.unload();

        // Trigger the scene-complete callback (move to next round, etc.)
        this.onSceneComplete();
      }
    }, 1000);
  }
} 