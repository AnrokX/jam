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
            min: { 
                x: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.SPAWN_BOUNDS.LATERAL.MIN,
                y: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.START_Y, 
                z: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.SPAWN_BOUNDS.FORWARD.MIN
            },
            max: { 
                x: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.SPAWN_BOUNDS.LATERAL.MAX,
                y: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.START_Y, 
                z: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.SPAWN_BOUNDS.FORWARD.MAX
            }
        };
    }

    private get pendulumSpawnBounds(): { min: Vector3Like, max: Vector3Like } {
        return {
            min: { 
                x: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.SPAWN_BOUNDS.LATERAL.MIN,
                y: 0, // Y is determined by pivot point and length
                z: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.SPAWN_BOUNDS.FORWARD.MIN
            },
            max: { 
                x: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.SPAWN_BOUNDS.LATERAL.MAX,
                y: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.PIVOT_HEIGHT,
                z: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.SPAWN_BOUNDS.FORWARD.MAX
            }
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

    private getRandomPendulumPosition(): Vector3Like {
        const bounds = this.pendulumSpawnBounds;
        const pivotX = Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x;
        const pivotZ = Math.random() * (bounds.max.z - bounds.min.z) + bounds.min.z;
        
        return {
            x: pivotX,
            y: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.PIVOT_HEIGHT,
            z: pivotZ
        };
    }

    // Block spawning methods
    public spawnTestBlocks(speedMultiplier: number = 1): void {
        if (this.DEBUG_ENABLED) {
            // Remove debug log
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
        this.spawnPendulumTarget(speedMultiplier);

        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }
    }

    public clearAllBlocks(): void {
        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }

        const removedCount = this.world.entityManager.getAllEntities()
            .filter(entity => entity.name.toLowerCase().includes('block'))
            .map(entity => {
                entity.despawn();
                return entity;
            }).length;

        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }
    }

    public spawnStaticTarget(): void {
        const pos = this.getRandomPosition();
        pos.y = 2 + Math.random() * 4; // Higher range for static targets

        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }

        this.blockManager.createStaticTarget(pos);
    }

    public spawnSineWaveBlock(speedMultiplier: number = 1): void {
        const pos = this.getRandomPositionWithinBounds(this.sineWaveSpawnBounds);
        
        if (this.DEBUG_ENABLED) {
            // Remove debug log
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
            // Remove debug log
        }

        this.blockManager.createVerticalWaveBlock({
            spawnPosition,
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier * MOVING_BLOCK_CONFIG.VERTICAL_WAVE.SPEED_MULTIPLIER
        });
    }

    public spawnRegularBlock(): void {
        const pos = this.getRandomPositionWithinBounds(this.sineWaveSpawnBounds);

        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }

        this.blockManager.createZAxisBlock(pos);
    }

    public spawnPopUpTarget(speedMultiplier: number = 1): void {
        const pos = this.getRandomPopUpPosition();

        if (this.DEBUG_ENABLED) {
            // Remove debug log
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
            // Remove debug log
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
        
        // Ensure minimum forward distance and proper direction
        const forwardDistance = endPos.z - startPos.z;
        if (forwardDistance < MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.MIN_TRAVEL_DISTANCE) {
            // Adjust end position to ensure minimum distance while staying in bounds
            endPos.z = Math.min(
                startPos.z + MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.MIN_TRAVEL_DISTANCE,
                MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.SPAWN_BOUNDS.FORWARD.MAX
            );
        }

        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }

        this.blockManager.createParabolicTarget({
            startPoint: startPos,
            endPoint: endPos,
            maxHeight: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.MAX_HEIGHT,
            duration: MOVING_BLOCK_CONFIG.PARABOLIC_TARGET.DURATION / speedMultiplier
        });
    }

    public spawnPendulumTarget(speedMultiplier: number = 1): void {
        const pivotPoint = this.getRandomPendulumPosition();

        if (this.DEBUG_ENABLED) {
            // Remove debug log
        }

        this.blockManager.createPendulumTarget({
            pivotPoint,
            length: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.LENGTH,
            amplitude: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.AMPLITUDE,
            frequency: MOVING_BLOCK_CONFIG.PENDULUM_TARGET.FREQUENCY * speedMultiplier
        });
    }

    // Helper methods for block validation
    public isValidSpawnPosition(position: Vector3Like, type: 'static' | 'sine' | 'vertical' | 'regular' | 'popup' | 'rising' | 'parabolic' | 'pendulum'): boolean {
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
            case 'pendulum':
                return this.isWithinBounds(position, this.pendulumSpawnBounds);
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