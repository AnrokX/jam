import { World, Vector3Like } from 'hytopia';
import { MovingBlockManager, MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from './score-manager';
import { StatsScene } from '../scene-ui/stats-scene';

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
    };
}

interface SpawnPosition extends Vector3Like {
    moveSpeed?: number;
}

export class RoundManager {
    private currentRound: number = 0;
    private roundTimer: NodeJS.Timeout | null = null;
    private blockSpawnTimer: NodeJS.Timeout | null = null;
    private isRoundActive: boolean = false;
    private roundStartTime: number = 0;
    private lastUpdateTime: number = 0;
    private waitingForPlayers: boolean = false;
    private readonly REQUIRED_PLAYERS = 1;
    private checkPlayersInterval: NodeJS.Timeout | null = null;
    private statsScene: StatsScene;

    constructor(
        private world: World,
        private blockManager: MovingBlockManager,
        private scoreManager: ScoreManager
    ) {
        this.statsScene = StatsScene.getInstance(world, () => this.startNextRound());
    }

    private getPlayerCount(): number {
        return this.world.entityManager.getAllPlayerEntities().length;
    }

    private getRoundConfig(round: number): RoundConfig {
        // Tutorial round (Round 1)
        if (round === 1) {
            return {
                duration: 10000,  // 90 seconds for first round to give more time
                minBlockCount: 8,  // Start with fewer blocks
                maxBlockCount: 12, // Keep it manageable
                blockSpawnInterval: 1800, // Slower spawning (2 seconds)
                speedMultiplier: 0.7,  // Slower speed for learning
                blockTypes: {
                    normal: 0,      // No normal blocks in tutorial
                    sineWave: 0,    // No sine waves in tutorial
                    static: 1.0,    // static targets to learn aiming
                    verticalWave: 0  // No vertical waves in tutorial
                }
            };
        }
        
        if (round === 2) {
            return {
                duration: 20000,  // 75 seconds
                minBlockCount: 10,  // Slight increase from round 1
                maxBlockCount: 15,  // Slight increase from round 1
                blockSpawnInterval: 1800, // 1.8 seconds between spawns (slightly faster than round 1)
                speedMultiplier: 0.7,  // Keep the same speed as round 1
                blockTypes: {
                    normal: 0.1,      // Still no normal blocks
                    sineWave: 0,    // Still no sine waves
                    static: 0.9,    // 100% static targets with despawn timer
                    verticalWave: 0  // No vertical waves
                }
            };
        }
        
        // Early rounds (3)
        if (round === 3) {
            return {
                duration: 20000,  // 75 seconds
                minBlockCount: 12 + Math.floor(round * 2),
                maxBlockCount: 18 + Math.floor(round * 3),
                blockSpawnInterval: 1500,  // 1.5 seconds between spawns
                speedMultiplier: 0.8 + (round * 0.1),
                blockTypes: {
                    normal: Math.min(0.25, (round - 2) * 0.15),    // Slightly reduced to make room for sine waves
                    sineWave: 0.05,                                // 5% sine waves
                    static: Math.max(0.7, 1 - (round * 0.15)),     // Decrease static targets gradually
                    verticalWave: 0                                // No vertical waves yet
                }
            };
        }
        
        // Regular rounds (4+)
        return {
            duration: 20000,  // Back to 60 seconds
            minBlockCount: 15 + Math.floor(round * 2),
            maxBlockCount: 25 + Math.floor(round * 3),
            blockSpawnInterval: 1000,  // 1 second between spawns
            speedMultiplier: 1 + ((round - 3) * 0.1),  // Speed starts increasing from round 4
            blockTypes: {
                normal: Math.min(0.2, 0.3 + (round - 3) * 0.05), 
                sineWave: Math.min(0.1, 0.2 + (round - 3) * 0.05),   
                static: Math.max(0.6, 0.4 - (round - 3) * 0.05),     
                verticalWave: Math.min(0.1, (round - 3) * 0.05)      
            }
        };
    }

    private startCountdown(): void {
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
        this.currentRound++;
        this.isRoundActive = true;
        this.roundStartTime = Date.now();
        this.lastUpdateTime = this.roundStartTime;

        const config = this.getRoundConfig(this.currentRound);
        console.log('Starting round with config:', config);

        // Clear any existing blocks before starting new round
        this.world.entityManager.getAllEntities()
            .filter(entity => entity.name.toLowerCase().includes('block'))
            .forEach(entity => entity.despawn());

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
        if (this.isRoundActive) return;

        const playerCount = this.getPlayerCount();
        if (playerCount < this.REQUIRED_PLAYERS) {
            this.waitingForPlayers = true;
            this.broadcastWaitingForPlayers(playerCount);
            
            // Start checking for players if not already checking
            if (!this.checkPlayersInterval) {
                this.checkPlayersInterval = setInterval(() => {
                    const currentPlayers = this.getPlayerCount();
                    if (currentPlayers >= this.REQUIRED_PLAYERS) {
                        this.waitingForPlayers = false;
                        clearInterval(this.checkPlayersInterval!);
                        this.checkPlayersInterval = null;
                        // Start countdown instead of round directly
                        this.startCountdown();
                    } else {
                        this.broadcastWaitingForPlayers(currentPlayers);
                    }
                }, 1000); // Check every second
            }
            return;
        }
        
        // If we already have enough players, start countdown
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
                            // Moving blocks: Much wider range, with platform proximity
                            const nearPlatform = Math.random() < 0.3;  // 30% chance to spawn near platform
                            if (nearPlatform) {
                                return Math.random() < 0.5 ? -20 - Math.random() * 8 : 20 + Math.random() * 8;
                            }
                            return Math.random() * 48 - 24;  // Much wider range: -24 to 24
                        })(),
                        y: (() => {
                            if (isStaticBlock) return 1 + Math.random() * 7;  // Static: 1 to 8
                            if (isVerticalWave) return Math.min(MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET, 7);
                            // Moving blocks: Much more extreme height variance
                            const heightType = Math.random();
                            if (heightType < 0.3) return 1 + Math.random() * 4;    // 30% low (1-5)
                            if (heightType < 0.7) return 6 + Math.random() * 8;    // 40% mid (6-14)
                            return 15 + Math.random() * 10;  // 30% very high (15-25)
                        })(),
                        z: (() => {
                            if (isStaticBlock) return Math.random() * 24 - 12; // Static: -12 to 12
                            // Moving blocks: Much more extreme depth variance
                            const depthType = Math.random();
                            if (depthType < 0.3) return Math.random() * 20 - 10;   // 30% middle (-10 to 10)
                            if (depthType < 0.6) return -30 + Math.random() * 10;  // 30% very far back (-30 to -20)
                            return 20 + Math.random() * 10;  // 40% much closer (20 to 30)
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
                        this.blockManager.createSineWaveBlock({
                            spawnPosition,
                            moveSpeed: baseSpeed,
                            amplitude: 2 + Math.random() * 2
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
        if (!this.isRoundActive) return;
        
        this.isRoundActive = false;
        console.log('Ending round...');

        // Clear timers
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.blockSpawnTimer) {
            clearTimeout(this.blockSpawnTimer);
            this.blockSpawnTimer = null;
        }

        // Get winner and update scores
        const winnerId = this.scoreManager.handleRoundEnd();
        
        // Prepare round summary
        const players = Array.from(this.world.entityManager.getAllPlayerEntities()).map(playerEntity => {
            const playerId = playerEntity.player.id;
            return {
                playerId,
                playerNumber: this.scoreManager.getPlayerNumber(playerId),
                roundScore: this.scoreManager.getRoundScore(playerId),
                totalScore: this.scoreManager.getScore(playerId),
                consecutiveHits: this.scoreManager.getConsecutiveHits(playerId),
                multiHitCount: this.scoreManager.getMultiHitCount(playerId),
                wins: this.scoreManager.getWins(playerId)
            };
        });

        const roundSummary = {
            roundNumber: this.currentRound,
            duration: Date.now() - this.roundStartTime,
            players,
            highestScore: Math.max(...players.map(p => p.roundScore)),
            mostConsecutiveHits: Math.max(...players.map(p => p.consecutiveHits)),
            mostMultiHits: Math.max(...players.map(p => p.multiHitCount))
        };

        // Show stats scene for each player
        this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
            this.statsScene.show(playerEntity, roundSummary);
        });

        // Broadcast round end
        this.broadcastRoundEnd(winnerId);
    }

    private startNextRound(): void {
        // Reset scores for new round
        this.scoreManager.startNewRound();
        
        // Start countdown for next round
        this.startCountdown();
    }

    public handlePlayerLeave(): void {
        // If we don't have enough players and a round is active, end it
        if (this.isRoundActive && this.getPlayerCount() < this.REQUIRED_PLAYERS) {
            // Send message to all players using UI data
            this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                playerEntity.player.ui.sendData({
                    type: 'systemMessage',
                    message: 'Not enough players, ending round...',
                    color: 'FF0000'
                });
            });
            this.endRound();
        }
    }

    private resetGame(): void {
        this.currentRound = 0;
        // Reset all player stats including wins
        this.scoreManager.resetAllStats();
        this.scoreManager.broadcastScores(this.world);
        
        // Start from round 1 after a delay
        setTimeout(() => {
            this.startRound();
        }, 5000);
    }

    private broadcastRoundInfo(): void {
        const config = this.getRoundConfig(this.currentRound);
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.roundStartTime;
        const remainingTime = Math.max(0, config.duration - elapsedTime);
        
        console.log('Broadcasting round info:', {
            round: this.currentRound,
            duration: config.duration,
            remainingTime: remainingTime
        });

        const message = {
            type: 'roundUpdate',
            data: {
                round: this.currentRound,
                duration: config.duration,
                timeRemaining: remainingTime
            }
        };

        for (const player of this.world.entityManager.getAllPlayerEntities()) {
            player.player.ui.sendData(message);
        }
    }

    private broadcastRoundEnd(winnerId: string | null): void {
        const message = {
            type: 'roundEnd',
            data: {
                round: this.currentRound,
                nextRoundIn: 5000,
                winnerId: winnerId
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

    public isWaitingForPlayers(): boolean {
        return this.waitingForPlayers;
    }

    public cleanup(): void {
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.blockSpawnTimer) {
            clearTimeout(this.blockSpawnTimer);
            this.blockSpawnTimer = null;
        }
        if (this.checkPlayersInterval) {
            clearInterval(this.checkPlayersInterval);
            this.checkPlayersInterval = null;
        }
        this.statsScene.cleanup();
    }
} 