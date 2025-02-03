import { World, Vector3Like } from 'hytopia';
import { MovingBlockManager, MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';

export class TestBlockSpawner {
    constructor(private world: World, private blockManager: MovingBlockManager) {}

    private getRandomPosition(): Vector3Like {
        return {
            x: Math.random() * 16 - 8,  // Random x between -8 and 8
            y: 2 + Math.random() * 3,   // Random y between 2 and 5
            z: Math.random() * 24 - 12  // Random z between -12 and 12
        };
    }

    private getRandomPositionWithinBounds(bounds: {min: Vector3Like, max: Vector3Like}): Vector3Like {
        return {
            x: Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
            y: Math.random() * (bounds.max.y - bounds.min.y) + bounds.min.y,
            z: Math.random() * (bounds.max.z - bounds.min.z) + bounds.min.z,
        };
    }

    /**
     * Spawns one of each block type for testing purposes
     * @param speedMultiplier Optional speed multiplier for moving blocks
     */
    public spawnTestBlocks(speedMultiplier: number = 1): void {
        // Clear existing blocks first
        this.world.entityManager.getAllEntities()
            .filter(entity => entity.name.toLowerCase().includes('block'))
            .forEach(entity => entity.despawn());

        // Spawn one of each type
        this.spawnStaticTarget();
        this.spawnSineWaveBlock(speedMultiplier);
        this.spawnVerticalWaveBlock(speedMultiplier);
        this.spawnRegularBlock();
    }

    /**
     * Spawn a static target block
     */
    public spawnStaticTarget(): void {
        const pos = this.getRandomPosition();
        this.blockManager.createStaticTarget({
            x: pos.x,
            y: 2 + Math.random() * 4, // Higher range for static targets
            z: pos.z
        });
    }

    /**
     * Spawn a sine wave block
     */
    public spawnSineWaveBlock(speedMultiplier: number = 1): void {
        // Generate a spawn position within the sine wave block's movement bounds.
        // The bounds for sine wave blocks are set to have x in [-5, 5],
        // y fixed at MOVING_BLOCK_CONFIG.SPAWN_POSITION.y (i.e. 1),
        // and z between MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z and MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z.
        const pos = this.getRandomPositionWithinBounds({
            min: { x: -5, y: MOVING_BLOCK_CONFIG.SPAWN_POSITION.y, z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z },
            max: { x: 5, y: MOVING_BLOCK_CONFIG.SPAWN_POSITION.y, z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z }
        });
        
        this.blockManager.createSineWaveBlock({
            spawnPosition: pos,
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier,
            amplitude: 2 + Math.random() * 2
        });
    }

    /**
     * Spawn a vertical wave block
     */
    public spawnVerticalWaveBlock(speedMultiplier: number = 1): void {
        const pos = this.getRandomPosition();
        this.blockManager.createVerticalWaveBlock({
            spawnPosition: {
                ...pos,
                y: Math.min(MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET, 7)
            },
            moveSpeed: MOVING_BLOCK_CONFIG.DEFAULT_SPEED * speedMultiplier * MOVING_BLOCK_CONFIG.VERTICAL_WAVE.SPEED_MULTIPLIER
        });
    }

    /**
     * Spawn a regular Z-axis block
     */
    public spawnRegularBlock(): void {
        // Ensure we spawn within the movement bounds defined in the config.
        const pos = this.getRandomPositionWithinBounds({
            min: { x: -5, y: MOVING_BLOCK_CONFIG.SPAWN_POSITION.y, z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z },
            max: { x: 5, y: MOVING_BLOCK_CONFIG.SPAWN_POSITION.y, z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z }
        });
        this.blockManager.createZAxisBlock(pos);
    }
} 