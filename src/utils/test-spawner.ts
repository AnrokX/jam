import { World, Vector3Like } from 'hytopia';
import { MovingBlockManager, MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';

export class TestBlockSpawner {
    private readonly DEBUG_ENABLED = false;

    constructor(private world: World, private blockManager: MovingBlockManager) {}

    // Getter methods for configuration
    private get defaultSpawnBounds(): { min: Vector3Like, max: Vector3Like } {
        return {
            min: { x: -8, y: 2, z: -12 },
            max: { x: 8, y: 5, z: 12 }
        };
    }

    private get sineWaveSpawnBounds(): { min: Vector3Like, max: Vector3Like } {
        return {
            min: { x: -5, y: MOVING_BLOCK_CONFIG.SPAWN_POSITION.y, z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z },
            max: { x: 5, y: MOVING_BLOCK_CONFIG.SPAWN_POSITION.y, z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z }
        };
    }

    private get popUpSpawnBounds(): { min: Vector3Like, max: Vector3Like } {
        return {
            min: { x: -5, y: MOVING_BLOCK_CONFIG.POPUP_TARGET.START_Y, z: -10 },
            max: { x: 5, y: MOVING_BLOCK_CONFIG.POPUP_TARGET.START_Y, z: 10 }
        };
    }

    private get risingSpawnBounds(): { min: Vector3Like, max: Vector3Like } {
        return {
            min: { x: -5, y: MOVING_BLOCK_CONFIG.RISING_TARGET.START_Y, z: -10 },
            max: { x: 5, y: MOVING_BLOCK_CONFIG.RISING_TARGET.START_Y, z: 10 }
        };
    }

    private get parabolicSpawnBounds(): { min: Vector3Like, max: Vector3Like } {
        return {
            min: { x: -5, y: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.START_Y, z: -15 },
            max: { x: 5, y: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.START_Y, z: 15 }
        };
    }

    // Helper methods for position generation
    private getRandomPosition(): Vector3Like {
        const bounds = this.defaultSpawnBounds;
        return this.getRandomPositionWithinBounds(bounds);
    }

    private getRandomPositionWithinBounds(bounds: {min: Vector3Like, max: Vector3Like}): Vector3Like {
        return {
            x: Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
            y: Math.random() * (bounds.max.y - bounds.min.y) + bounds.min.y,
            z: Math.random() * (bounds.max.z - bounds.min.z) + bounds.min.z,
        };
    }

    private getRandomPopUpPosition(): Vector3Like {
        const bounds = this.popUpSpawnBounds;
        return {
            x: Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
            y: bounds.min.y, // Fixed Y position for pop-up targets
            z: Math.random() * (bounds.max.z - bounds.min.z) + bounds.min.z
        };
    }

    private getRandomRisingPosition(): Vector3Like {
        const bounds = this.risingSpawnBounds;
        return {
            x: Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
            y: bounds.min.y, // Fixed Y position for rising targets
            z: Math.random() * (bounds.max.z - bounds.min.z) + bounds.min.z
        };
    }

    private getRandomParabolicPosition(): Vector3Like {
        const bounds = this.parabolicSpawnBounds;
        return {
            x: Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
            y: bounds.min.y, // Fixed Y position for parabolic targets
            z: Math.random() * (bounds.max.z - bounds.min.z) + bounds.min.z
        };
    }

    // Block spawning methods
    public spawnTestBlocks(speedMultiplier: number = 1): void {
        if (this.DEBUG_ENABLED) {
            console.log('Spawning test blocks with speed multiplier:', speedMultiplier);
        }

        // Clear existing blocks first
        this.clearAllBlocks();

        // Spawn one of each type
        this.spawnStaticTarget();
        this.spawnSineWaveBlock(speedMultiplier);
        this.spawnVerticalWaveBlock(speedMultiplier);
        this.spawnRegularBlock();
        this.spawnPopUpTarget(speedMultiplier);
        this.spawnRisingTarget(speedMultiplier);
        this.spawnParabolicTarget(speedMultiplier);

        if (this.DEBUG_ENABLED) {
            console.log('All test blocks spawned successfully');
        }
    }

    public clearAllBlocks(): void {
        if (this.DEBUG_ENABLED) {
            console.log('Clearing all blocks...');
        }

        const removedCount = this.world.entityManager.getAllEntities()
            .filter(entity => entity.name.toLowerCase().includes('block'))
            .map(entity => {
                entity.despawn();
                return entity;
            }).length;

        if (this.DEBUG_ENABLED) {
            console.log(`Cleared ${removedCount} blocks`);
        }
    }

    public spawnStaticTarget(): void {
        const pos = this.getRandomPosition();
        pos.y = 2 + Math.random() * 4; // Higher range for static targets

        if (this.DEBUG_ENABLED) {
            console.log('Spawning static target at:', pos);
        }

        this.blockManager.createStaticTarget(pos);
    }

    public spawnSineWaveBlock(speedMultiplier: number = 1): void {
        const pos = this.getRandomPositionWithinBounds(this.sineWaveSpawnBounds);
        
        if (this.DEBUG_ENABLED) {
            console.log('Spawning sine wave block at:', pos);
        }

        this.blockManager.createSineWaveBlock({
            spawnPosition: pos,
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier,
            amplitude: 2 + Math.random() * 2
        });
    }

    public spawnVerticalWaveBlock(speedMultiplier: number = 1): void {
        const pos = this.getRandomPosition();
        const spawnPosition = {
            ...pos,
            y: Math.min(MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET, 7)
        };

        if (this.DEBUG_ENABLED) {
            console.log('Spawning vertical wave block at:', spawnPosition);
        }

        this.blockManager.createVerticalWaveBlock({
            spawnPosition,
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier * MOVING_BLOCK_CONFIG.VERTICAL_WAVE.SPEED_MULTIPLIER
        });
    }

    public spawnRegularBlock(): void {
        const pos = this.getRandomPositionWithinBounds(this.sineWaveSpawnBounds);

        if (this.DEBUG_ENABLED) {
            console.log('Spawning regular block at:', pos);
        }

        this.blockManager.createZAxisBlock(pos);
    }

    public spawnPopUpTarget(speedMultiplier: number = 1): void {
        const pos = this.getRandomPopUpPosition();

        if (this.DEBUG_ENABLED) {
            console.log('Spawning pop-up target at:', pos);
        }

        this.blockManager.createPopUpTarget({
            spawnPosition: pos,
            startY: MOVING_BLOCK_CONFIG.POPUP_TARGET.START_Y,
            topY: MOVING_BLOCK_CONFIG.POPUP_TARGET.TOP_Y,
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier * MOVING_BLOCK_CONFIG.POPUP_TARGET.SPEED_MULTIPLIER
        });
    }

    public spawnRisingTarget(speedMultiplier: number = 1): void {
        const pos = this.getRandomRisingPosition();

        if (this.DEBUG_ENABLED) {
            console.log('Spawning rising target at:', pos);
        }

        this.blockManager.createRisingTarget({
            spawnPosition: pos,
            startY: MOVING_BLOCK_CONFIG.RISING_TARGET.START_Y,
            firstStopY: MOVING_BLOCK_CONFIG.RISING_TARGET.FIRST_STOP_Y,
            finalY: MOVING_BLOCK_CONFIG.RISING_TARGET.FINAL_Y,
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier * MOVING_BLOCK_CONFIG.RISING_TARGET.SPEED_MULTIPLIER,
            pauseDuration: MOVING_BLOCK_CONFIG.RISING_TARGET.PAUSE_DURATION
        });
    }

    public spawnParabolicTarget(speedMultiplier: number = 1): void {
        const startPos = this.getRandomParabolicPosition();
        const endPos = this.getRandomParabolicPosition();
        endPos.z = Math.max(endPos.z, startPos.z + 10); // Ensure it moves forward

        if (this.DEBUG_ENABLED) {
            console.log('Spawning parabolic target with:', {
                startPos,
                endPos,
                speedMultiplier
            });
        }

        this.blockManager.createParabolicTarget({
            startPoint: startPos,
            endPoint: endPos,
            maxHeight: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.MAX_HEIGHT,
            duration: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.DURATION / speedMultiplier // Adjust duration based on speed multiplier
        });
    }

    // Helper methods for block validation
    public isValidSpawnPosition(position: Vector3Like, type: 'static' | 'sine' | 'vertical' | 'regular' | 'popup' | 'rising' | 'parabolic'): boolean {
        switch (type) {
            case 'static':
                return position.y >= 2 && position.y <= 6;
            case 'sine':
                return this.isWithinBounds(position, this.sineWaveSpawnBounds);
            case 'vertical':
                return position.y <= MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET;
            case 'regular':
                return this.isWithinBounds(position, this.sineWaveSpawnBounds);
            case 'popup':
                return this.isWithinBounds(position, this.popUpSpawnBounds);
            case 'rising':
                return this.isWithinBounds(position, this.risingSpawnBounds);
            case 'parabolic':
                return this.isWithinBounds(position, this.parabolicSpawnBounds);
            default:
                return false;
        }
    }

    private isWithinBounds(position: Vector3Like, bounds: { min: Vector3Like, max: Vector3Like }): boolean {
        return (
            position.x >= bounds.min.x && position.x <= bounds.max.x &&
            position.y >= bounds.min.y && position.y <= bounds.max.y &&
            position.z >= bounds.min.z && position.z <= bounds.max.z
        );
    }
} 