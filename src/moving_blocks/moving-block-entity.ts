import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, World, RigidBodyType, BlockType } from 'hytopia';
import { ScoreManager } from '../managers/score-manager';

// Configuration for our Z-axis moving block
const MOVING_BLOCK_CONFIG = {
  DEFAULT_SPEED: 1,
  DEFAULT_HEALTH: 5,
  DEFAULT_TEXTURE: 'blocks/void-sand.png',
  DEFAULT_HALF_EXTENTS: { x: 0.5, y: 2, z: 2 },
  MOVEMENT_BOUNDS: {
    min: { x: 0, y: 1, z: -15 },
    max: { x: 0, y: 1, z: 16 }
  },
  SPAWN_POSITION: { x: 0, y: 1, z: 0 },
  BREAK_SCORE: 5  // Points awarded for breaking a block
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
}

export class MovingBlockEntity extends Entity {
  private moveSpeed: number;
  private direction: Vector3Like;
  private initialPosition: Vector3Like;
  private movementBounds?: { min: Vector3Like; max: Vector3Like };
  private oscillate: boolean;
  private isReversed: boolean = false;
  private health: number;
  private isBreakable: boolean;
  private onBlockBroken?: () => void;
  private playerId?: string;  // Store the ID of player who last hit the block

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
  }

  private isWithinBounds(position: Vector3Like): boolean {
    if (!this.movementBounds) return true;

    return (
      position.x >= this.movementBounds.min.x &&
      position.x <= this.movementBounds.max.x &&
      position.y >= this.movementBounds.min.y &&
      position.y <= this.movementBounds.max.y &&
      position.z >= this.movementBounds.min.z &&
      position.z <= this.movementBounds.max.z
    );
  }

  private reverseDirection(): void {
    this.direction.x *= -1;
    this.direction.y *= -1;
    this.direction.z *= -1;
    this.isReversed = !this.isReversed;
  }

  override onTick = (entity: Entity, deltaTimeMs: number): void => {
    const deltaSeconds = deltaTimeMs / 1000;
    
    // Calculate new position
    const newPosition = {
      x: this.position.x + this.direction.x * this.moveSpeed * deltaSeconds,
      y: this.position.y + this.direction.y * this.moveSpeed * deltaSeconds,
      z: this.position.z + this.direction.z * this.moveSpeed * deltaSeconds
    };

    // Check if the new position would be within bounds
    if (!this.isWithinBounds(newPosition)) {
      if (this.oscillate) {
        this.reverseDirection();
      } else {
        // Reset to initial position if not oscillating
        this.setPosition(this.initialPosition);
        return;
      }
    }

    // Update the position
    this.setPosition(newPosition);
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
    
    // Visual feedback - make the block more transparent as it takes damage
    const opacity = Math.max(0.3, this.health / MOVING_BLOCK_CONFIG.DEFAULT_HEALTH);
    this.setOpacity(opacity);

    if (this.health <= 0) {
      console.log('Block destroyed!');
      if (this.onBlockBroken) {
        this.onBlockBroken();
      }
      // TODO: Add particle effects or break animation
      this.despawn();
    }
  }
}

export class MovingBlockManager {
  private blocks: MovingBlockEntity[] = [];

  constructor(
    private world: World,
    private scoreManager?: ScoreManager
  ) {}

  public getBlockCount(): number {
    return this.blocks.length;
  }

  public createZAxisBlock(spawnPosition?: Vector3Like): MovingBlockEntity {
    const block = new MovingBlockEntity({
      onBlockBroken: () => {
        if (this.scoreManager && (block as any).playerId) {
          const playerId = (block as any).playerId;
          const score = MOVING_BLOCK_CONFIG.BREAK_SCORE;
          
          this.scoreManager.addScore(playerId, score);
          console.log(`Block broken by player ${playerId}! Awarded ${score} points`);
          
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

  public removeBlock(block: MovingBlockEntity): void {
    const index = this.blocks.indexOf(block);
    if (index !== -1) {
      block.despawn();
      this.blocks.splice(index, 1);
    }
  }

  public removeAllBlocks(): void {
    this.blocks.forEach(block => block.despawn());
    this.blocks = [];
  }
}