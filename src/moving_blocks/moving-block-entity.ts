import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, World, RigidBodyType, BlockType } from 'hytopia';
import { ScoreManager } from '../managers/score-manager';
import { BlockMovementBehavior, DefaultBlockMovement, SineWaveMovement, StaticMovement } from './block-movement';
import { DESTRUCTION_PARTICLE_CONFIG } from '../config/particle-config';
import { BlockParticleEffects } from '../effects/block-particle-effects';


// Configuration for our Z-axis moving block
export const MOVING_BLOCK_CONFIG = {
  DEFAULT_SPEED: 10,
  DEFAULT_HEALTH: 5,
  DEFAULT_TEXTURE: 'blocks/void-sand.png',
  DEFAULT_HALF_EXTENTS: { x: 0.5, y: 2, z: 2 },
  MOVEMENT_BOUNDS: {
    min: { x: -5, y: 1, z: -15 },
    max: { x: 5, y: 1, z: 16 }
  },
  SPAWN_POSITION: { x: 0, y: 1, z: 0 },
  BREAK_SCORE: 5,  // Points awarded for breaking a block
  STATIC_TARGET: {
    TEXTURE: 'blocks/gold-ore.png',
    HALF_EXTENTS: { x: 0.8, y: 0.8, z: 0.8 }, // Balanced size for visibility and challenge
    HEIGHT_RANGE: { min: 3, max: 8 },  // Higher range for better visibility
    SCORE: 10, // More points for hitting target
    HEALTH: 1  // One-shot kill
  },
  VERTICAL_WAVE: {  // New configuration for vertical sine wave blocks
    TEXTURE: 'blocks/emerald-ore.png',
    HALF_EXTENTS: { x: 1, y: 1, z: 1 },
    DEFAULT_AMPLITUDE: 4,  // Reduced amplitude to prevent floor collision
    DEFAULT_FREQUENCY: 0.5,  // Slightly faster than horizontal sine wave
    HEIGHT_OFFSET: 10,  // Significantly increased base height
    SAFETY_MARGIN: 2,   // Extra space to prevent any collision
    SCORE_MULTIPLIER: 2,  // Double points for hitting this challenging target
    SPEED_MULTIPLIER: 0.7,  // Slightly slower forward movement for better visibility
    HEALTH: 1  // One-shot kill, like static targets
  },
  PARTICLE_CONFIG: {
    COUNT: 50,               
    SCALE: 0.15,            
    LIFETIME: 800,          
    SPREAD_RADIUS: 0.3,     
    SPEED: 0.15             
  }
};


export interface MovingBlockOptions extends EntityOptions {
  moveSpeed?: number;         // Speed at which the block moves (units per second)
  direction?: Vector3Like;    // Direction vector for movement
  movementBounds?: {         // Optional boundaries for movement
    min: Vector3Like;
    max: Vector3Like;
  };
  oscillate?: boolean;       // Whether the block should reverse direction at boundaries
  blockTextureUri?: string;  // The texture to use for the block
  blockHalfExtents?: Vector3Like; // The size of the block
  health?: number;           // Health of the block before breaking
  isBreakable?: boolean;     // Whether the block can be broken
  onBlockBroken?: () => void; // Optional callback to be triggered when the block is broken
  movementBehavior?: BlockMovementBehavior; // New: inject block-specific movement logic
}

export class MovingBlockEntity extends Entity {
  protected moveSpeed: number;
  protected direction: Vector3Like;
  protected initialPosition: Vector3Like;
  protected movementBounds?: { min: Vector3Like; max: Vector3Like };
  protected oscillate: boolean;
  private isReversed: boolean = false;
  private health: number;
  private isBreakable: boolean;
  private onBlockBroken?: () => void;
  private playerId?: string;  // Store the ID of player who last hit the block
  protected movementBehavior: BlockMovementBehavior;
  private particles: Entity[] = [];
  private particleEffects: BlockParticleEffects | null;

  constructor(options: MovingBlockOptions) {
    super({
      ...options,
      name: options.name || 'MovingBlock',
      blockTextureUri: options.blockTextureUri || MOVING_BLOCK_CONFIG.DEFAULT_TEXTURE,
      blockHalfExtents: options.blockHalfExtents || MOVING_BLOCK_CONFIG.DEFAULT_HALF_EXTENTS,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [{
          shape: ColliderShape.BLOCK,
          halfExtents: options.blockHalfExtents || MOVING_BLOCK_CONFIG.DEFAULT_HALF_EXTENTS,
          collisionGroups: {
            belongsTo: [CollisionGroup.BLOCK],
            collidesWith: [CollisionGroup.PLAYER, CollisionGroup.BLOCK, CollisionGroup.ENTITY]
          },
          onCollision: (other: Entity | BlockType, started: boolean) => {
            if (started && this.isBreakable && other instanceof Entity) {
              this.handleCollision(other);
            }
          }
        }]
      }
    });
    
    this.moveSpeed = options.moveSpeed ?? MOVING_BLOCK_CONFIG.DEFAULT_SPEED;
    this.direction = this.normalizeDirection(options.direction || { x: 0, y: 0, z: 1 });
    this.movementBounds = options.movementBounds || MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS;
    this.oscillate = options.oscillate ?? true;
    this.initialPosition = { x: 0, y: 0, z: 0 };
    this.health = options.health ?? MOVING_BLOCK_CONFIG.DEFAULT_HEALTH;
    this.isBreakable = options.isBreakable ?? true;
    this.onBlockBroken = options.onBlockBroken;
    this.movementBehavior = options.movementBehavior || new DefaultBlockMovement();
    this.particleEffects = null;
  }

  private normalizeDirection(dir: Vector3Like): Vector3Like {
    const magnitude = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (magnitude === 0) return { x: 0, y: 0, z: 1 }; // Default to moving along Z-axis
    return {
      x: dir.x / magnitude,
      y: dir.y / magnitude,
      z: dir.z / magnitude
    };
  }

  override spawn(world: World, position: Vector3Like): void {
    super.spawn(world, position);
    this.initialPosition = { ...position };
    this.particleEffects = BlockParticleEffects.getInstance(world);
  }

  private isWithinBounds(position: Vector3Like): boolean {
    if (!this.movementBounds) return true;

    // Add small epsilon to handle floating point precision
    const epsilon = 0.001;
    
    // Only check axes where we have movement bounds defined
    const checkX = Math.abs(this.movementBounds.max.x - this.movementBounds.min.x) > epsilon;
    const checkY = Math.abs(this.movementBounds.max.y - this.movementBounds.min.y) > epsilon;
    const checkZ = Math.abs(this.movementBounds.max.z - this.movementBounds.min.z) > epsilon;

    return (
      (!checkX || (position.x >= this.movementBounds.min.x - epsilon && 
                  position.x <= this.movementBounds.max.x + epsilon)) &&
      (!checkY || (position.y >= this.movementBounds.min.y - epsilon && 
                  position.y <= this.movementBounds.max.y + epsilon)) &&
      (!checkZ || (position.z >= this.movementBounds.min.z - epsilon && 
                  position.z <= this.movementBounds.max.z + epsilon))
    );
  }

  private reverseDirection(): void {
    this.direction.x *= -1;
    this.direction.y *= -1;
    this.direction.z *= -1;
    this.isReversed = !this.isReversed;
  }

  override onTick = (entity: Entity, deltaTimeMs: number): void => {
    // Delegate movement update to injected behavior
    this.movementBehavior.update(this, deltaTimeMs);
  }


  private handleCollision(other: Entity): void {
    // Check if the colliding entity is a projectile
    if (other.name.toLowerCase().includes('projectile')) {
      console.log('Projectile hit detected!');
      
      // Store the player ID from the projectile if available
      this.playerId = (other as any).playerId;
      console.log(`Projectile from player: ${this.playerId || 'Unknown'}`);
      
      this.takeDamage(1);
      
      // Despawn the projectile that hit us
      if (other.isSpawned) {
        other.despawn();
      }
    }
  }

  private takeDamage(amount: number): void {
    if (!this.isBreakable) return;

    this.health -= amount;
    console.log(`Block took damage! Health: ${this.health}`);
    
    if (this.health <= 0) {
      console.log('Block destroyed!');
      
      // Create destruction effect before despawning
      this.createDestructionEffect();
      
      if (this.onBlockBroken) {
        this.onBlockBroken();
      }
      
      this.despawn();
      return;
    }
    
    // Instead of changing opacity, change the block type based on health
    const blockTypes = [
      'blocks/void-sand.png',
      'blocks/infected-shadowrock.png',
      'blocks/dragons-stone.png',
      'blocks/diamond-ore.png',
      'blocks/clay.png'
    ];
    
    // Calculate which block type to use based on health
    const blockIndex = Math.floor((this.health / MOVING_BLOCK_CONFIG.DEFAULT_HEALTH) * (blockTypes.length - 1));
    const newBlockType = blockTypes[Math.max(0, Math.min(blockIndex, blockTypes.length - 1))];
    
    // Create a new block with the same properties but different texture
    const newBlock = new MovingBlockEntity({
      blockTextureUri: newBlockType,
      moveSpeed: this.moveSpeed,
      direction: this.direction,
      movementBounds: this.movementBounds,
      oscillate: this.oscillate,
      health: this.health,
      isBreakable: this.isBreakable,
      blockHalfExtents: this.blockHalfExtents,
      onBlockBroken: this.onBlockBroken  // Transfer the callback
    });

    // Transfer the player ID to the new block
    (newBlock as any).playerId = this.playerId;

    // Spawn the new block at the current position
    if (this.world) {
      newBlock.spawn(this.world, this.position);
    }

    // Despawn the old block
    this.despawn();
  }

  // --- Added getter and helper methods for movement behavior use ---

  public getDirection(): Vector3Like {
    return { ...this.direction }; // Return a copy to prevent direct modification
  }

  public getMoveSpeed(): number {
    return this.moveSpeed;
  }

  public isWithinMovementBounds(position: Vector3Like): boolean {
    return this.isWithinBounds(position);
  }

  public shouldOscillate(): boolean {
    return this.oscillate;
  }

  public reverseMovementDirection(): void {
    this.reverseDirection();
  }

  public resetToInitialPosition(): void {
    this.setPosition(this.initialPosition);
  }

  private getDebugInfo(): string {
    const halfExtents = this.blockHalfExtents || { x: 0, y: 0, z: 0 };
    return `MovingBlock Debug Info:
      ID: ${this.id}
      Position: x=${this.position.x.toFixed(2)}, y=${this.position.y.toFixed(2)}, z=${this.position.z.toFixed(2)}
      Direction: x=${this.direction.x.toFixed(2)}, y=${this.direction.y.toFixed(2)}, z=${this.direction.z.toFixed(2)}
      Speed: ${this.moveSpeed}
      Health: ${this.health}
      Is Breakable: ${this.isBreakable}
      Oscillating: ${this.oscillate}
      Is Reversed: ${this.isReversed}
      Movement Bounds: ${this.movementBounds ? 
        `\n        Min: x=${this.movementBounds.min.x}, y=${this.movementBounds.min.y}, z=${this.movementBounds.min.z}
        Max: x=${this.movementBounds.max.x}, y=${this.movementBounds.max.y}, z=${this.movementBounds.max.z}` 
        : 'None'}
      Last Hit By Player: ${this.playerId || 'None'}
      Texture: ${this.blockTextureUri || 'None'}
      Half Extents: x=${halfExtents.x}, y=${halfExtents.y}, z=${halfExtents.z}
      Is Spawned: ${this.isSpawned}`;
  }

  private createDestructionEffect(): void {
    if (!this.world || !this.blockTextureUri) return;
    this.particleEffects?.createDestructionEffect(this.world, this.position, this.blockTextureUri);
  }
}

export class MovingBlockManager {
  private blocks: MovingBlockEntity[] = [];

  constructor(
    private world: World,
    private scoreManager?: ScoreManager
  ) {}

  public getBlockCount(): number {
    // Filter out any despawned blocks
    this.blocks = this.blocks.filter(block => block.isSpawned);
    return this.blocks.length;
  }

  public createZAxisBlock(spawnPosition?: Vector3Like): MovingBlockEntity {
    // Clean up any despawned blocks first
    this.blocks = this.blocks.filter(block => block.isSpawned);

    const block = new MovingBlockEntity({
      onBlockBroken: () => {
        if (this.scoreManager && (block as any).playerId) {
          const playerId = (block as any).playerId;
          const score = MOVING_BLOCK_CONFIG.BREAK_SCORE;
          
          this.scoreManager.addScore(playerId, score);
          console.log(`Block broken by player ${playerId}! Awarded ${score} points`);
          
          // Broadcast updated scores
          this.scoreManager.broadcastScores(this.world);
          
          // Remove the block from our tracking array when broken
          this.removeBlock(block);
        } else {
          console.log('Block broken but no player ID found to award points');
        }
      }
    });
    
    block.spawn(this.world, spawnPosition || MOVING_BLOCK_CONFIG.SPAWN_POSITION);
    this.blocks.push(block);
    return block;
  }

  public createSineWaveBlock(options: {
    spawnPosition?: Vector3Like;
    amplitude?: number;
    frequency?: number;
    baseAxis?: 'x' | 'y' | 'z';
    waveAxis?: 'x' | 'y' | 'z';
    moveSpeed?: number;
    blockTextureUri?: string;
  } = {}): MovingBlockEntity {
    // Clean up any despawned blocks first
    this.blocks = this.blocks.filter(block => block.isSpawned);

    const block = new MovingBlockEntity({
      moveSpeed: options.moveSpeed ?? MOVING_BLOCK_CONFIG.DEFAULT_SPEED * 0.8,
      blockTextureUri: options.blockTextureUri ?? 'blocks/diamond-ore.png', // Changed to more visible texture
      blockHalfExtents: { x: 1, y: 1, z: 1 }, // Made the block more cubic and visible
      movementBehavior: new SineWaveMovement({
        amplitude: options.amplitude ?? 4,
        frequency: options.frequency ?? 0.5,
        baseAxis: options.baseAxis ?? 'z',
        waveAxis: options.waveAxis ?? 'x'
      }),
      // Wider movement bounds for sine wave pattern
      movementBounds: {
        min: { 
          x: -5,  // Allow more horizontal space for wave pattern
          y: 1,
          z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z
        },
        max: {
          x: 5,   // Allow more horizontal space for wave pattern
          y: 1,
          z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z
        }
      },
      onBlockBroken: () => {
        if (this.scoreManager && (block as any).playerId) {
          const playerId = (block as any).playerId;
          // Give more points for hitting this more challenging target
          const score = MOVING_BLOCK_CONFIG.BREAK_SCORE * 1.5;
          
          this.scoreManager.addScore(playerId, score);
          console.log(`Sine wave block broken by player ${playerId}! Awarded ${score} points`);
          
          this.scoreManager.broadcastScores(this.world);
          this.removeBlock(block);
        }
      }
    });
    
    // Ensure we have a valid spawn position
    const spawnPosition = options.spawnPosition || { ...MOVING_BLOCK_CONFIG.SPAWN_POSITION, z: -5 };
    console.log('Spawning sine wave block at:', spawnPosition);
    
    block.spawn(this.world, spawnPosition);
    this.blocks.push(block);
    
    return block;
  }

  public createStaticTarget(spawnPosition?: Vector3Like): MovingBlockEntity {
    // Clean up any despawned blocks first
    this.blocks = this.blocks.filter(block => block.isSpawned);

    // Generate random height if not specified
    const randomHeight = MOVING_BLOCK_CONFIG.STATIC_TARGET.HEIGHT_RANGE.min + 
      Math.random() * (MOVING_BLOCK_CONFIG.STATIC_TARGET.HEIGHT_RANGE.max - 
                      MOVING_BLOCK_CONFIG.STATIC_TARGET.HEIGHT_RANGE.min);

    const finalSpawnPosition = spawnPosition || {
      x: Math.random() * 10 - 5, // Random x between -5 and 5
      y: randomHeight,
      z: Math.random() * 20 - 10 // Random z between -10 and 10
    };

    const block = new MovingBlockEntity({
      blockTextureUri: MOVING_BLOCK_CONFIG.STATIC_TARGET.TEXTURE,
      blockHalfExtents: MOVING_BLOCK_CONFIG.STATIC_TARGET.HALF_EXTENTS,
      health: MOVING_BLOCK_CONFIG.STATIC_TARGET.HEALTH,
      movementBehavior: new StaticMovement(),
      // Wide bounds to allow spawning anywhere in the play area
      movementBounds: {
        min: { 
          x: -5,
          y: MOVING_BLOCK_CONFIG.STATIC_TARGET.HEIGHT_RANGE.min,
          z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z
        },
        max: {
          x: 5,
          y: MOVING_BLOCK_CONFIG.STATIC_TARGET.HEIGHT_RANGE.max,
          z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z
        }
      },
      onBlockBroken: () => {
        if (this.scoreManager && (block as any).playerId) {
          const playerId = (block as any).playerId;
          const score = MOVING_BLOCK_CONFIG.STATIC_TARGET.SCORE;
          
          this.scoreManager.addScore(playerId, score);
          console.log(`Static target broken by player ${playerId}! Awarded ${score} points`);
          
          this.scoreManager.broadcastScores(this.world);
          this.removeBlock(block);
        }
      }
    });
    
    console.log('Spawning static target at:', finalSpawnPosition);
    block.spawn(this.world, finalSpawnPosition);
    this.blocks.push(block);

    return block;
  }

  public createVerticalWaveBlock(options: {
    spawnPosition?: Vector3Like;
    amplitude?: number;
    frequency?: number;
    moveSpeed?: number;
    blockTextureUri?: string;
  } = {}): MovingBlockEntity {
    // Clean up any despawned blocks first
    this.blocks = this.blocks.filter(block => block.isSpawned);

    const amplitude = options.amplitude ?? MOVING_BLOCK_CONFIG.VERTICAL_WAVE.DEFAULT_AMPLITUDE;
    const heightOffset = MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEIGHT_OFFSET;
    const safetyMargin = MOVING_BLOCK_CONFIG.VERTICAL_WAVE.SAFETY_MARGIN;

    // Set a fixed Y value for spawning so that the Y movement is not restricted in the bounds.
    const fixedY = heightOffset + safetyMargin;

    const block = new MovingBlockEntity({
      moveSpeed: options.moveSpeed ?? MOVING_BLOCK_CONFIG.DEFAULT_SPEED * MOVING_BLOCK_CONFIG.VERTICAL_WAVE.SPEED_MULTIPLIER,
      blockTextureUri: options.blockTextureUri ?? MOVING_BLOCK_CONFIG.VERTICAL_WAVE.TEXTURE,
      blockHalfExtents: MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HALF_EXTENTS,
      health: MOVING_BLOCK_CONFIG.VERTICAL_WAVE.HEALTH,  // Set health to 1
      movementBehavior: new SineWaveMovement({
        amplitude: amplitude,
        frequency: options.frequency ?? MOVING_BLOCK_CONFIG.VERTICAL_WAVE.DEFAULT_FREQUENCY,
        baseAxis: 'z',  // Move forward along Z axis
        waveAxis: 'y'   // Oscillate on Y axis
      }),
      // Modified movement bounds: we fix Y to let the sine function determine vertical movement.
      movementBounds: {
        min: { 
          x: -5,
          y: fixedY,
          z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.min.z
        },
        max: {
          x: 5,
          y: fixedY,
          z: MOVING_BLOCK_CONFIG.MOVEMENT_BOUNDS.max.z
        }
      },
      onBlockBroken: () => {
        if (this.scoreManager && (block as any).playerId) {
          const playerId = (block as any).playerId;
          const score = MOVING_BLOCK_CONFIG.BREAK_SCORE * MOVING_BLOCK_CONFIG.VERTICAL_WAVE.SCORE_MULTIPLIER;
          
          this.scoreManager.addScore(playerId, score);
          console.log(`Vertical wave block broken by player ${playerId}! Awarded ${score} points`);
          
          this.scoreManager.broadcastScores(this.world);
          this.removeBlock(block);
        }
      }
    });
    
    // Calculate spawn position with appropriate height offset and safety margin
    const spawnPosition = options.spawnPosition || {
      ...MOVING_BLOCK_CONFIG.SPAWN_POSITION,
      y: fixedY,  // Use the fixed Y value for spawn
      z: -5
    };
    
    console.log('Spawning vertical wave block at:', spawnPosition);
    block.spawn(this.world, spawnPosition);
    this.blocks.push(block);
    
    return block;
  }

  public removeBlock(block: MovingBlockEntity): void {
    const index = this.blocks.indexOf(block);
    if (index !== -1) {
      this.blocks.splice(index, 1);
    }
  }
}