import { World, Vector3Like } from 'hytopia';
import { MovingBlockManager, MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from './score-manager';
import { AudioManager } from './audio-manager';

export interface RoundConfig {
    duration: number;  // Duration in milliseconds
    minBlockCount: number;  // Minimum number of blocks in play
    maxBlockCount: number;  // Maximum number of blocks in play
    blockSpawnInterval: number;  // How often to spawn new blocks (ms)
    speedMultiplier: number;  // Speed multiplier for blocks
    blockTypes: {  // Probability weights for different block types
        normal: number;
        sineWave: number;
        static: number;
        verticalWave: number;
        popup: number;     // Pop-up targets that appear and disappear
        rising: number;    // Rising targets that move upward
        parabolic: number; // Targets that follow parabolic paths
        pendulum: number;  // Targets that swing like pendulums
    };
}

interface SpawnPosition extends Vector3Like {
    moveSpeed?: number;
}

export interface GameConfig {
    maxRounds: number;
}

interface GameEndStanding {
    playerId: string;
    placementPoints: number;
    wins: number;
    totalScore: number;
}

export class RoundManager {
    private currentRound: number = 0;
    private roundTimer: NodeJS.Timeout | null = null;
    private blockSpawnTimer: NodeJS.Timeout | null = null;
    private isRoundActive: boolean = false;
    private roundStartTime: number = 0;
    private lastUpdateTime: number = 0;
    private waitingForPlayers: boolean = false;
    private readonly REQUIRED_PLAYERS = 2;
    private checkPlayersInterval: NodeJS.Timeout | null = null;
    private readonly GAME_CONFIG: GameConfig = {
        maxRounds: 8
    };
    private gameInProgress: boolean = false;
    private roundTransitionPending: boolean = false;
    private readonly TRANSITION_DURATION: number = 5000; // Default 5 seconds

    constructor(
        private world: World,
        private blockManager: MovingBlockManager,
        private scoreManager: ScoreManager,
        transitionDuration?: number
    ) {
        if (transitionDuration !== undefined) {
            this.TRANSITION_DURATION = transitionDuration;
        }
    }

    private getPlayerCount(): number {
        return this.world.entityManager.getAllPlayerEntities().length;
    }

    private getRoundConfig(round: number): RoundConfig {
        // Tutorial round (Round 1) - Static targets only
        if (round === 1) {
            return {
                duration: 20000,  // 60 seconds
                minBlockCount: 8,
                maxBlockCount: 12,
                blockSpawnInterval: 1800, // 1.8 seconds between spawns
                speedMultiplier: 0.5,
                blockTypes: {
                    normal: 0,
                    sineWave: 0,
                    static: 1.0,    // 100% static targets for learning
                    verticalWave: 0,
                    popup: 0,
                    rising: 0,
                    parabolic: 0,
                    pendulum: 0
                }
            };
        }
        
        // Round 2 - Introduce normal blocks with some static
        if (round === 2) {
            return {
                duration: 20000,
                minBlockCount: 10,
                maxBlockCount: 15,
                blockSpawnInterval: 1500,
                speedMultiplier: 0.6,
                blockTypes: {
                    normal: 0.7,    // 70% normal blocks
                    sineWave: 0,
                    static: 0.3,    // 30% static for comfort
                    verticalWave: 0,
                    popup: 0,
                    rising: 0,
                    parabolic: 0,
                    pendulum: 0
                }
            };
        }
        
        // Round 3 - Sine Wave Focus
        if (round === 3) {
            return {
                duration: 20000,
                minBlockCount: 8,
                maxBlockCount: 12, // Fewer blocks as they're harder
                blockSpawnInterval: 1500,
                speedMultiplier: 0.65,
                blockTypes: {
                    normal: 0.1,
                    sineWave: 0.8,  // 80% sine wave focus
                    static: 0.1,
                    verticalWave: 0,
                    popup: 0,
                    rising: 0,
                    parabolic: 0,
                    pendulum: 0
                }
            };
        }

        // Round 4 - Vertical Wave & Pop-up Mix
        if (round === 4) {
            return {
                duration: 20000,
                minBlockCount: 8,
                maxBlockCount: 12,
                blockSpawnInterval: 1500,
                speedMultiplier: 0.7,
                blockTypes: {
                    normal: 0.1,
                    sineWave: 0.1,
                    static: 0.1,
                    verticalWave: 0.4, // 40% vertical wave
                    popup: 0.3,        // 30% popup introduction
                    rising: 0,
                    parabolic: 0,
                    pendulum: 0
                }
            };
        }

        // Round 5 - Rising & Parabolic Focus
        if (round === 5) {
            return {
                duration: 20000,
                minBlockCount: 7,
                maxBlockCount: 10, // Fewer blocks as they're complex
                blockSpawnInterval: 1800,
                speedMultiplier: 0.75,
                blockTypes: {
                    normal: 0.1,
                    sineWave: 0,
                    static: 0.1,
                    verticalWave: 0,
                    popup: 0,
                    rising: 0.4,     // 40% rising
                    parabolic: 0.4,  // 40% parabolic
                    pendulum: 0
                }
            };
        }

        // Round 6 - Pendulum Focus
        if (round === 6) {
            return {
                duration: 20000,
                minBlockCount: 6,
                maxBlockCount: 9, // Even fewer as pendulums are challenging
                blockSpawnInterval: 2000,
                speedMultiplier: 0.8,
                blockTypes: {
                    normal: 0.1,
                    sineWave: 0,
                    static: 0.1,
                    verticalWave: 0,
                    popup: 0,
                    rising: 0,
                    parabolic: 0,
                    pendulum: 0.8  // 80% pendulum focus
                }
            };
        }

        // Round 7 - Complex Mix (No static)
        if (round === 7) {
            return {
                duration: 20000,
                minBlockCount: 8,
                maxBlockCount: 12,
                blockSpawnInterval: 1500,
                speedMultiplier: 0.85,
                blockTypes: {
                    normal: 0.1,
                    sineWave: 0.2,
                    static: 0,
                    verticalWave: 0.2,
                    popup: 0.2,
                    rising: 0.1,
                    parabolic: 0.1,
                    pendulum: 0.1
                }
            };
        }

        // Round 8 - Final Challenge
        return {
            duration: 20000,
            minBlockCount: 10,
            maxBlockCount: 15,
            blockSpawnInterval: 1200,
            speedMultiplier: 0.9,
            blockTypes: {
                normal: 0.05,
                sineWave: 0.15,
                static: 0,
                verticalWave: 0.2,
                popup: 0.2,
                rising: 0.15,
                parabolic: 0.15,
                pendulum: 0.1
            }
        };
    }

    private startCountdown(): void {
        // Don't start countdown if in transition
        if (this.roundTransitionPending) return;

        let count = 5;
        
        const sendCount = () => {
            this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                playerEntity.player.ui.sendData({
                    type: 'countdown',
                    count: count === 0 ? 'GO!' : count
                });
            });
        };

        // Send initial count
        sendCount();

        // Set up countdown interval
        const countdownInterval = setInterval(() => {
            count--;
            
            if (count < 0) {
                clearInterval(countdownInterval);
                this.actuallyStartRound();
                return;
            }
            
            sendCount();
        }, 1000);
    }

    private actuallyStartRound(): void {
        // Don't start if a round is already active
        if (this.isRoundActive) {
            console.log('Attempted to start round while another is active');
            return;
        }

        this.currentRound++;
        this.isRoundActive = true;
        this.gameInProgress = true;
        this.roundStartTime = Date.now();
        this.lastUpdateTime = this.roundStartTime;

        const config = this.getRoundConfig(this.currentRound);
        console.log('Starting round with config:', config);

        // Clear any existing blocks before starting new round
        this.world.entityManager.getAllEntities()
            .filter(entity => entity.name.toLowerCase().includes('block'))
            .forEach(entity => entity.despawn());

        // Reset scores for the new round
        this.scoreManager.startNewRound();
        
        // Broadcast round start with full duration
        this.broadcastRoundInfo();

        // Start block spawning
        this.startBlockSpawning(config);

        // Set round timer
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
        }
        
        this.roundTimer = setTimeout(() => {
            console.log('Round timer completed');
            this.endRound();
        }, config.duration);
    }

    public startRound(): void {
        // Don't start if round is active or we're in transition
        if (this.isRoundActive || this.roundTransitionPending) return;

        // Add this check to prevent starting new rounds if we've hit the max
        if (this.currentRound >= this.GAME_CONFIG.maxRounds) {
            this.endGame();
            return;
        }

        const playerCount = this.getPlayerCount();
        
        // Only check for minimum players when starting a new game (not in progress)
        if (!this.gameInProgress && playerCount < this.REQUIRED_PLAYERS) {
            this.waitingForPlayers = true;
            this.broadcastWaitingForPlayers(playerCount);
            
            if (!this.checkPlayersInterval) {
                this.checkPlayersInterval = setInterval(() => {
                    const currentPlayers = this.getPlayerCount();
                    if (currentPlayers >= this.REQUIRED_PLAYERS) {
                        this.waitingForPlayers = false;
                        clearInterval(this.checkPlayersInterval!);
                        this.checkPlayersInterval = null;
                        this.startCountdown();
                    } else {
                        this.broadcastWaitingForPlayers(currentPlayers);
                    }
                }, 1000);
            }
            return;
        }
        
        // Start countdown to begin round
        this.startCountdown();
    }

    private startBlockSpawning(config: RoundConfig): void {
        // Calculate player scaling factor
        const playerCount = this.world.entityManager.getAllPlayerEntities().length;
        const additionalPlayers = Math.max(0, playerCount - 2); // Count players above 2
        const playerScaling = Math.min(1.0, additionalPlayers * 0.2); // 20% per player, max 100%
        
        // Scale block counts
        const scaledMaxBlocks = Math.floor(config.maxBlockCount * (1 + playerScaling));
        const scaledMinBlocks = Math.floor(config.minBlockCount * (1 + playerScaling));

        const spawnBlock = () => {
            if (!this.isRoundActive) return;

            const currentBlocks = this.blockManager.getBlockCount();
            
            // Determine how many blocks to spawn using scaled values
            const blocksNeeded = Math.min(
                scaledMaxBlocks - currentBlocks,
                // If 0-1 blocks left, spawn up to 4 at once
                // If below minimum, spawn up to 2 at once
                // If below 25% of max, spawn up to 3 at once
                currentBlocks <= 1 ? 4 :
                currentBlocks < scaledMinBlocks ? 2 : 
                currentBlocks < (scaledMaxBlocks * 0.25) ? 3 : 1
            );

            // Try to spawn multiple blocks if needed
            for(let i = 0; i < blocksNeeded; i++) {
                // Choose block type first
                const rand = Math.random();
                const total = Object.values(config.blockTypes).reduce((a, b) => a + b, 0);
                let sum = 0;
                let chosenType: keyof typeof config.blockTypes | null = null;

                for (const [type, weight] of Object.entries(config.blockTypes)) {
                    sum += weight / total;
                    if (rand <= sum && !chosenType) {
                        chosenType = type as keyof typeof config.blockTypes;
                    }
                }

                // Add spacing between spawns
                const existingBlocks = this.world.entityManager.getAllEntities()
                    .filter(entity => entity.name.toLowerCase().includes('block'));
                
                let attempts = 0;
                let spawnPosition: Vector3Like;
                const minSpacing = 2;
                const safetyMargin = MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.PLATFORM_SAFETY_MARGIN;

                do {
                    // Adjust spawn ranges based on block type
                    const isStaticBlock = chosenType === 'static';
                    const isVerticalWave = chosenType === 'verticalWave';

                    spawnPosition = {
                        x: (() => {
                            if (isStaticBlock) return Math.random() * 16 - 8; // Static: -8 to 8
                            // Moving blocks: Use movement bounds with safety margin
                            const movementBounds = MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS;
                            return movementBounds.min.x + safetyMargin + 
                                   Math.random() * (movementBounds.max.x - movementBounds.min.x - 2 * safetyMargin);
                        })(),
                        y: (() => {
                            if (isStaticBlock) return 1 + Math.random() * 7;  // Static: 1 to 8
                            if (isVerticalWave) return Math.min(MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET, 7);
                            // Moving blocks: Use movement bounds with safety margin
                            const movementBounds = MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS;
                            return movementBounds.min.y + safetyMargin + 
                                   Math.random() * (movementBounds.max.y - movementBounds.min.y - 2 * safetyMargin);
                        })(),
                        z: (() => {
                            if (isStaticBlock) return Math.random() * 24 - 12; // Static: -12 to 12
                            // Moving blocks: Use movement bounds with safety margin
                            const movementBounds = MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS;
                            return movementBounds.min.z + safetyMargin + 
                                   Math.random() * (movementBounds.max.z - movementBounds.min.z - 2 * safetyMargin);
                        })()
                    };

                    // Check distance from platforms
                    const rightPlatformDistance = Math.abs(spawnPosition.x - MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.RIGHT_PLATFORM_EDGE.X);
                    const isInRightPlatformZRange = spawnPosition.z >= MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.RIGHT_PLATFORM_EDGE.Z_MIN - safetyMargin && 
                                                  spawnPosition.z <= MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.RIGHT_PLATFORM_EDGE.Z_MAX + safetyMargin;
                    
                    const leftPlatformDistance = Math.abs(spawnPosition.x - MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.LEFT_PLATFORM_EDGE.X);
                    const isInLeftPlatformZRange = spawnPosition.z >= MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.LEFT_PLATFORM_EDGE.Z_MIN - safetyMargin && 
                                                 spawnPosition.z <= MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.LEFT_PLATFORM_EDGE.Z_MAX + safetyMargin;
                    
                    const isSafeFromRightPlatform = rightPlatformDistance >= safetyMargin || !isInRightPlatformZRange;
                    const isSafeFromLeftPlatform = leftPlatformDistance >= safetyMargin || !isInLeftPlatformZRange;
                    
                    // Check distance from all existing blocks
                    const isTooCloseToBlocks = existingBlocks.some(block => {
                        const dx = block.position.x - spawnPosition.x;
                        const dz = block.position.z - spawnPosition.z;
                        return Math.sqrt(dx * dx + dz * dz) < minSpacing;
                    });

                    // Break if position is safe from both platforms and other blocks
                    if (!isTooCloseToBlocks && isSafeFromRightPlatform && isSafeFromLeftPlatform) break;
                    
                    attempts++;
                } while (attempts < 10);

                // If we couldn't find a safe position after max attempts, use a default safe position
                if (attempts >= 10) {
                    spawnPosition = {
                        x: 0,
                        y: 3,
                        z: 0
                    };
                }

                // Calculate the base speed for this block
                const baseSpeed = 8 * config.speedMultiplier;

                // Spawn the chosen block type with appropriate spacing
                switch(chosenType) {
                    case 'normal':
                        this.blockManager.createZAxisBlock(spawnPosition);
                        break;
                    case 'sineWave':
                        // For sine wave blocks, we need to account for the amplitude in spawn position
                        const sineWaveAmplitude = 8; // Match the amplitude in MovingBlockEntity
                        const sineWaveSpawnPosition = {
                            ...spawnPosition,
                            // Restrict X spawn position to account for sine wave amplitude
                            x: Math.max(
                                Math.min(
                                    spawnPosition.x,
                                    MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.x - sineWaveAmplitude - safetyMargin
                                ),
                                MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.x + sineWaveAmplitude + safetyMargin
                            ),
                            // Fixed Y position for sine wave blocks
                            y: 4
                        };
                        
                        this.blockManager.createSineWaveBlock({
                            spawnPosition: sineWaveSpawnPosition,
                            moveSpeed: baseSpeed * 0.6, // Slower base speed for sine wave blocks
                            amplitude: sineWaveAmplitude, // Fixed amplitude to match MovingBlockEntity
                            frequency: 0.2 // Fixed frequency to match MovingBlockEntity
                        });
                        break;
                    case 'static':
                        this.blockManager.createStaticTarget({
                            x: spawnPosition.x,
                            y: spawnPosition.y,
                            z: spawnPosition.z
                        });
                        break;
                    case 'verticalWave':
                        this.blockManager.createVerticalWaveBlock({
                            spawnPosition: {
                                ...spawnPosition,
                                y: Math.min(MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET, 7)
                            },
                            moveSpeed: baseSpeed * 0.75
                        });
                        break;
                }
            }
        }

        // Initial spawn - spawn minimum blocks more quickly
        for (let i = 0; i < scaledMinBlocks; i++) {
            setTimeout(() => spawnBlock(), i * 1000);
        }

        // Regular spawn interval
        this.blockSpawnTimer = setInterval(spawnBlock, config.blockSpawnInterval);
    }

    public endRound(): void {
        console.log('Ending round:', this.currentRound);
        
        if (!this.isRoundActive) return;

        // Clear any existing timers first
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.blockSpawnTimer) {
            clearInterval(this.blockSpawnTimer);
            this.blockSpawnTimer = null;
        }

        this.isRoundActive = false;

        // Get round results with placements
        const { winnerId, placements } = this.scoreManager.handleRoundEnd();
        
        // Play victory sound if there's a winner
        if (winnerId && this.world) {
            const audioManager = AudioManager.getInstance(this.world);
            audioManager.playSoundEffect('audio/sfx/damage/blop1.mp3', 0.6);  // Slightly louder for round victory
        }
        
        // Broadcast updated scores and leaderboard
        this.scoreManager.broadcastScores(this.world);

        // Broadcast round end results with placement info
        this.broadcastRoundEnd(winnerId, placements);

        // Check if this was the final round
        if (this.currentRound >= this.GAME_CONFIG.maxRounds) {
            this.endGame();
            return;
        }

        // Set transition flag and schedule next round
        this.roundTransitionPending = true;
        console.log('Starting round transition period');
        setTimeout(() => {
            console.log('Round transition complete');
            this.roundTransitionPending = false;
            this.startRound();
        }, this.TRANSITION_DURATION);
    }

    public handlePlayerLeave(): void {
        const playerCount = this.getPlayerCount();
        
        // Only reset game if we're waiting for players to start and don't have enough
        if (!this.gameInProgress && playerCount < this.REQUIRED_PLAYERS) {
            this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                playerEntity.player.ui.sendData({
                    type: 'systemMessage',
                    message: 'Not enough players to start game...',
                    color: 'FF0000'
                });
            });
            this.resetGame();
        }
        // If game is in progress, continue with remaining players
    }

    private resetGame(): void {
        this.currentRound = 0;
        this.gameInProgress = false;
        this.scoreManager.resetAllStats();
        this.scoreManager.broadcastScores(this.world);
        
        // Check if we have enough players to start new game
        if (this.getPlayerCount() >= this.REQUIRED_PLAYERS) {
            this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                playerEntity.player.ui.sendData({
                    type: 'newGame',
                    message: 'New game starting...'
                });
            });
            
            setTimeout(() => {
                this.startRound();
            }, 5000);
        } else {
            this.waitingForPlayers = true;
            this.broadcastWaitingForPlayers(this.getPlayerCount());
        }
    }

    private broadcastRoundInfo(): void {
        const config = this.getRoundConfig(this.currentRound);
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.roundStartTime;
        const remainingTime = Math.max(0, config.duration - elapsedTime);
        
        const message = {
            type: 'roundUpdate',
            data: {
                round: this.currentRound,
                totalRounds: this.GAME_CONFIG.maxRounds,
                remainingRounds: this.getRemainingRounds(),
                duration: config.duration,
                timeRemaining: remainingTime
            }
        };

        for (const player of this.world.entityManager.getAllPlayerEntities()) {
            player.player.ui.sendData(message);
        }
    }

    private broadcastRoundEnd(winnerId: string | null, placements: Array<{ playerId: string, points: number }>): void {
        const message = {
            type: 'roundEnd',
            data: {
                round: this.currentRound,
                nextRoundIn: this.TRANSITION_DURATION,
                winnerId: winnerId,
                placements: placements
            }
        };

        for (const player of this.world.entityManager.getAllPlayerEntities()) {
            player.player.ui.sendData(message);
        }
    }

    private broadcastWaitingForPlayers(currentCount: number): void {
        const message = {
            type: 'waitingForPlayers',
            data: {
                current: currentCount,
                required: this.REQUIRED_PLAYERS,
                remaining: this.REQUIRED_PLAYERS - currentCount
            }
        };

        for (const player of this.world.entityManager.getAllPlayerEntities()) {
            player.player.ui.sendData(message);
        }
    }

    public getCurrentRound(): number {
        return this.currentRound;
    }

    public isActive(): boolean {
        return this.isRoundActive;
    }

    public isShootingAllowed(): boolean {
        return this.isRoundActive && !this.waitingForPlayers;
    }

    public isWaitingForPlayers(): boolean {
        return this.waitingForPlayers;
    }

    public cleanup(): void {
        if (this.checkPlayersInterval) {
            clearInterval(this.checkPlayersInterval);
            this.checkPlayersInterval = null;
        }
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.blockSpawnTimer) {
            clearInterval(this.blockSpawnTimer);
            this.blockSpawnTimer = null;
        }
        this.roundTransitionPending = false;
    }

    private endGame(): void {
        this.gameInProgress = false;
        const finalStandings: GameEndStanding[] = [];
        
        this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
            const playerId = playerEntity.player.id;
            finalStandings.push({
                playerId,
                placementPoints: this.scoreManager.getLeaderboardPoints(playerId),
                wins: this.scoreManager.getWins(playerId),
                totalScore: this.scoreManager.getScore(playerId)
            });
        });

        // Sort by placement points
        finalStandings.sort((a, b) => b.placementPoints - a.placementPoints);
        const gameWinner = finalStandings[0];
        
        // Clear any remaining blocks
        this.world.entityManager.getAllEntities()
            .filter(entity => entity.name.toLowerCase().includes('block'))
            .forEach(entity => entity.despawn());

        if (gameWinner) {
            // Broadcast game end to all players
            const message = {
                type: 'gameEnd',
                data: {
                    winner: gameWinner,
                    standings: finalStandings,
                    nextGameIn: 10000, // 10 seconds until next game
                    stats: {
                        totalRounds: this.GAME_CONFIG.maxRounds,
                        completedRounds: this.currentRound
                    }
                }
            };

            // Send game end message to all players
            this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                // Send game end data
                playerEntity.player.ui.sendData(message);
                
                // Send congratulatory message to winner
                if (playerEntity.player.id === gameWinner.playerId) {
                    playerEntity.player.ui.sendData({
                        type: 'systemMessage',
                        message: `🏆 Congratulations! You won the game with ${gameWinner.placementPoints} placement points!`,
                        color: 'FFD700' // Gold color
                    });
                }
            });

            // Send game end message to all players
            this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                playerEntity.player.ui.sendData({
                    type: 'systemMessage',
                    message: `Game Over! Player ${gameWinner.playerId} wins!`,
                    color: 'FFD700'
                });
            });
        }

        // Reset game after delay
        setTimeout(() => {
            this.resetGame();
        }, 10000);
    }

    // Add method to get remaining rounds
    public getRemainingRounds(): number {
        return this.GAME_CONFIG.maxRounds - this.currentRound;
    }
} 