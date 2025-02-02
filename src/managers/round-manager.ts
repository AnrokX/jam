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
    private readonly REQUIRED_PLAYERS = 2;
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
        // Base configuration that scales with round number
        return {
            duration: 60000,  // Fixed 60 seconds for each round
            minBlockCount: 4 + Math.floor(round * 0.5),  // Start with more blocks
            maxBlockCount: 8 + Math.floor(round * 0.7),  // Higher maximum
            blockSpawnInterval: Math.max(2500 - (round * 200), 1000),  // Faster spawns: 2.5s initially
            speedMultiplier: 1 + (round * 0.1),  // Keep the same speed progression
            blockTypes: {
                // Start with 100% static blocks, gradually introduce others after round 1
                normal: Math.max(0, (round - 1) * 0.1),     // No normal blocks in round 1
                sineWave: Math.max(0, (round - 1) * 0.05),  // No sine waves in round 1
                static: Math.max(1 - (round * 0.1), 0.4),   // 100% in round 1, minimum 40% later
                verticalWave: Math.max(0, (round - 1) * 0.05) // No vertical waves in round 1
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
            if (currentBlocks < config.maxBlockCount) {
                // Add spacing between spawns
                const existingBlocks = this.world.entityManager.getAllEntities()
                    .filter(entity => entity.name.toLowerCase().includes('block'));
                
                // Try to find a spawn position away from other blocks
                let attempts = 0;
                let spawnPosition: Vector3Like;
                const minSpacing = 3; // Minimum units between blocks

                do {
                    spawnPosition = {
                        x: Math.random() * 16 - 8,  // Random x between -8 and 8 (wider spread)
                        y: 2 + Math.random() * 3,   // Random y between 2 and 5 (slightly higher)
                        z: Math.random() * 24 - 12  // Random z between -12 and 12 (wider spread)
                    };

                    // Check distance from all existing blocks
                    const isTooClose = existingBlocks.some(block => {
                        const dx = block.position.x - spawnPosition.x;
                        const dz = block.position.z - spawnPosition.z;
                        return Math.sqrt(dx * dx + dz * dz) < minSpacing;
                    });

                    if (!isTooClose) break;
                    attempts++;
                } while (attempts < 5); // Try up to 5 times to find a good position

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
                        // For static targets, use the current spawn position but with controlled height
                        this.blockManager.createStaticTarget({
                            x: spawnPosition.x,
                            y: 2 + Math.random() * 3, // Keep static targets between y=2 and y=5
                            z: spawnPosition.z
                        });
                        break;
                    case 'verticalWave':
                        this.blockManager.createVerticalWaveBlock({
                            spawnPosition: {
                                ...spawnPosition,
                                y: Math.min(MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET, 6) // Cap the height slightly higher
                            },
                            moveSpeed: baseSpeed * 0.75
                        });
                        break;
                }
            }
        };

        // Initial spawn - only spawn minimum required blocks
        for (let i = 0; i < config.minBlockCount; i++) {
            setTimeout(() => spawnBlock(), i * 1000); // Stagger initial spawns by 1 second each
        }

        // Set up periodic spawning
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