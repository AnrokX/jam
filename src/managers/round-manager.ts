import { World, Vector3Like } from 'hytopia';
import { MovingBlockManager, MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from './score-manager';

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

    constructor(
        private world: World,
        private blockManager: MovingBlockManager,
        private scoreManager: ScoreManager
    ) {}

    private getPlayerCount(): number {
        return this.world.entityManager.getAllPlayerEntities().length;
    }

    private getRoundConfig(round: number): RoundConfig {
        // Tutorial round (Round 1)
        if (round === 1) {
            return {
                duration: 90000,  // 90 seconds for first round to give more time
                minBlockCount: 8,  // Start with fewer blocks
                maxBlockCount: 12, // Keep it manageable
                blockSpawnInterval: 2000, // Slower spawning (2 seconds)
                speedMultiplier: 0.7,  // Slower speed for learning
                blockTypes: {
                    normal: 0,      // No normal blocks in tutorial
                    sineWave: 0,    // No sine waves in tutorial
                    static: 1.0,    // static targets to learn aiming
                    verticalWave: 0  // No vertical waves in tutorial
                }
            };
        }
        
        // Round 2 - Static targets with despawn timer
        if (round === 2) {
            return {
                duration: 75000,  // 75 seconds
                minBlockCount: 10,  // Slight increase from round 1
                maxBlockCount: 15,  // Slight increase from round 1
                blockSpawnInterval: 1800, // 1.8 seconds between spawns (slightly faster than round 1)
                speedMultiplier: 0.7,  // Keep the same speed as round 1
                blockTypes: {
                    normal: 0,      // Still no normal blocks
                    sineWave: 0,    // Still no sine waves
                    static: 1.0,    // 100% static targets with despawn timer
                    verticalWave: 0  // No vertical waves
                }
            };
        }
        
        // Early rounds (3)
        if (round === 3) {
            return {
                duration: 75000,  // 75 seconds
                minBlockCount: 12 + Math.floor(round * 2),
                maxBlockCount: 18 + Math.floor(round * 3),
                blockSpawnInterval: 1500,  // 1.5 seconds between spawns
                speedMultiplier: 0.8 + (round * 0.1),
                blockTypes: {
                    normal: Math.min(0.3, (round - 2) * 0.15),     // Start introducing normal
                    sineWave: 0,    // No sine waves yet
                    static: Math.max(0.7, 1 - (round * 0.15)),     // Decrease static targets gradually
                    verticalWave: 0  // No vertical waves yet
                }
            };
        }
        
        // Regular rounds (4+)
        return {
            duration: 60000,  // Back to 60 seconds
            minBlockCount: 15 + Math.floor(round * 2),
            maxBlockCount: 25 + Math.floor(round * 3),
            blockSpawnInterval: 1000,  // 1 second between spawns
            speedMultiplier: 1 + ((round - 3) * 0.1),  // Speed starts increasing from round 4
            blockTypes: {
                normal: Math.min(0.35, 0.3 + (round - 3) * 0.05),      // Cap at 35%
                sineWave: Math.min(0.3, 0.2 + (round - 3) * 0.05),     // Cap at 30%
                static: Math.max(0.2, 0.4 - (round - 3) * 0.05),       // Minimum 20%
                verticalWave: Math.min(0.15, (round - 3) * 0.05)       // Start from round 4, cap at 15%
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
        const spawnBlock = () => {
            if (!this.isRoundActive) return;

            const currentBlocks = this.blockManager.getBlockCount();
            
            // Determine how many blocks to spawn
            const blocksNeeded = Math.min(
                config.maxBlockCount - currentBlocks,
                // If below minimum, spawn up to 2 at once to reach minimum faster
                // If below 25% of max, spawn up to 3 at once to recover quickly
                currentBlocks < config.minBlockCount ? 2 : 
                currentBlocks < (config.maxBlockCount * 0.25) ? 3 : 1
            );

            // Try to spawn multiple blocks if needed
            for(let i = 0; i < blocksNeeded; i++) {
                // Add spacing between spawns
                const existingBlocks = this.world.entityManager.getAllEntities()
                    .filter(entity => entity.name.toLowerCase().includes('block'));
                
                // Try to find a spawn position away from other blocks and platforms
                let attempts = 0;
                let spawnPosition: Vector3Like;
                const minSpacing = 2; // Reduced spacing to allow more blocks
                const safetyMargin = MOVING_BLOCK_CONFIG.PLATFORM_SAFETY.PLATFORM_SAFETY_MARGIN;

                do {
                    // Generate position within game bounds
                    spawnPosition = {
                        x: Math.random() * 16 - 8,  // Random x between -8 and 8 (wider spread)
                        y: 2 + Math.random() * 3,   // Random y between 2 and 5 (slightly higher)
                        z: Math.random() * 24 - 12  // Random z between -12 and 12 (wider spread)
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

                // Choose block type based on probabilities
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
        for (let i = 0; i < config.minBlockCount; i++) {
            setTimeout(() => spawnBlock(), i * 1000);
        }

        // Regular spawn interval
        this.blockSpawnTimer = setInterval(spawnBlock, config.blockSpawnInterval);
    }

    public endRound(): void {
        console.log('Ending round:', this.currentRound);
        
        if (!this.isRoundActive) return;

        this.isRoundActive = false;
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.blockSpawnTimer) {
            clearInterval(this.blockSpawnTimer);
            this.blockSpawnTimer = null;
        }

        // Check if we still have enough players
        if (this.getPlayerCount() < this.REQUIRED_PLAYERS) {
            this.resetGame();
            this.waitingForPlayers = true;
            this.broadcastWaitingForPlayers(this.getPlayerCount());
            return;
        }

        // Determine the winner of the round
        const winnerId = this.scoreManager.handleRoundEnd();
        
        // Broadcast updated scores and leaderboard
        this.scoreManager.broadcastScores(this.world);

        // Broadcast round end results with winner info
        this.broadcastRoundEnd(winnerId);

        // Start next round after a delay
        setTimeout(() => {
            this.startRound();
        }, 5000);  // 5 second delay between rounds
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
    }
} 