import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, World, RigidBodyType, BlockType } from 'hytopia';
import { ScoreManager } from '../managers/score-manager';
import { BlockMovementBehavior, DefaultBlockMovement } from './block-movement';
import { DESTRUCTION_PARTICLE_CONFIG } from '../config/particle-config';


// Configuration for our Z-axis moving block
const MOVING_BLOCK_CONFIG = {
  DEFAULT_SPEED: 10,
  DEFAULT_HEALTH: 5,
  DEFAULT_TEXTURE: 'blocks/void-sand.png',
  DEFAULT_HALF_EXTENTS: { x: 0.5, y: 2, z: 2 },
  MOVEMENT_BOUNDS: {
    min: { x: 0, y: 1, z: -15 },
    max: { x: 0, y: 1, z: 16 }
  },
  SPAWN_POSITION: { x: 0, y: 1, z: 0 },
  BREAK_SCORE: 5,  // Points awarded for breaking a block
  PARTICLE_CONFIG: {
    COUNT: 50,               // Number of particles
    SCALE: 0.15,            // Small blocks
    LIFETIME: 800,          // Shorter lifetime since we won't fade
    SPREAD_RADIUS: 0.3,     // Initial spread from hit point
    SPEED: 0.15             // Movement speed
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
  private movementBehavior: BlockMovementBehavior;
  private particles: Entity[] = [];

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

  private createHitEffect(hitPosition: Vector3Like): void {
    if (!this.world) return;

    // Create particles in a circular pattern
    for (let i = 0; i < MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.COUNT; i++) {
      const angle = (i / MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.COUNT) * Math.PI * 2;
      const radius = MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SPREAD_RADIUS;

      // Create a small block entity using the same texture as the parent block
      const particle = new Entity({
        name: 'HitParticle',
        blockTextureUri: this.blockTextureUri,
        blockHalfExtents: {
          x: MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SCALE,
          y: MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SCALE,
          z: MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SCALE
        },
        rigidBodyOptions: {
          type: RigidBodyType.DYNAMIC,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: {
              x: MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SCALE,
              y: MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SCALE,
              z: MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SCALE
            },
            mass: 0.1,
            friction: 0.2,
            bounciness: 0.3
          }]
        }
      });

      // Calculate spawn position with some randomization
      const particlePosition = {
        x: hitPosition.x + Math.cos(angle) * radius * (0.8 + Math.random() * 0.4),
        y: hitPosition.y + Math.random() * 0.2,
        z: hitPosition.z + Math.sin(angle) * radius * (0.8 + Math.random() * 0.4)
      };

      particle.spawn(this.world, particlePosition);
      this.particles.push(particle);

      // Apply initial impulse for movement
      if (particle.rawRigidBody) {
        const speed = MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SPEED * (0.8 + Math.random() * 0.4);
        particle.rawRigidBody.applyImpulse({
          x: Math.cos(angle) * speed,
          y: 0.2 + Math.random() * 0.3, // Upward bias
          z: Math.sin(angle) * speed
        });

        // Add some spin
        particle.rawRigidBody.applyTorqueImpulse({
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
          z: (Math.random() - 0.5) * 0.1
        });
      }

      // Clean up after lifetime
      setTimeout(() => {
        if (particle.isSpawned) {
          particle.despawn();
        }
        this.particles = this.particles.filter(p => p !== particle);
      }, MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.LIFETIME);
    }
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
    return this.direction;
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

  public getDebugInfo(): string {
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
      `\n      Min: x=${this.movementBounds.min.x}, y=${this.movementBounds.min.y}, z=${this.movementBounds.min.z}
      Max: x=${this.movementBounds.max.x}, y=${this.movementBounds.max.y}, z=${this.movementBounds.max.z}` 
      : 'None'}
    Last Hit By Player: ${this.playerId || 'None'}
    Texture: ${this.blockTextureUri}
    Half Extents: x=${this.blockHalfExtents.x}, y=${this.blockHalfExtents.y}, z=${this.blockHalfExtents.z}
    Is Spawned: ${this.isSpawned}`;

  private createDestructionEffect(): void {
    if (!this.world) return;

    // Create particles in a more explosive pattern
    for (let i = 0; i < DESTRUCTION_PARTICLE_CONFIG.COUNT; i++) {
      const angle = (i / DESTRUCTION_PARTICLE_CONFIG.COUNT) * Math.PI * 2;

      // Create block pieces using the current block's texture
      const particle = new Entity({
        name: 'DestroyedBlockPiece',
        blockTextureUri: this.blockTextureUri,
        blockHalfExtents: {
          x: DESTRUCTION_PARTICLE_CONFIG.SCALE,
          y: DESTRUCTION_PARTICLE_CONFIG.SCALE,
          z: DESTRUCTION_PARTICLE_CONFIG.SCALE
        },
        rigidBodyOptions: {
          type: RigidBodyType.DYNAMIC,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: {
              x: DESTRUCTION_PARTICLE_CONFIG.SCALE,
              y: DESTRUCTION_PARTICLE_CONFIG.SCALE,
              z: DESTRUCTION_PARTICLE_CONFIG.SCALE
            },
            mass: DESTRUCTION_PARTICLE_CONFIG.PHYSICS.MASS,
            friction: DESTRUCTION_PARTICLE_CONFIG.PHYSICS.FRICTION,
            bounciness: DESTRUCTION_PARTICLE_CONFIG.PHYSICS.BOUNCINESS
          }]
        }
      });

      // Spawn around the block's position with configured randomization
      const particlePosition = {
        x: this.position.x + (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.RADIUS,
        y: this.position.y + (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.HEIGHT_VARIATION,
        z: this.position.z + (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.RADIUS
      };

      particle.spawn(this.world, particlePosition);
      this.particles.push(particle);

      // Apply configured forces
      if (particle.rawRigidBody) {
        const speed = DESTRUCTION_PARTICLE_CONFIG.SPEED * DESTRUCTION_PARTICLE_CONFIG.FORCES.EXPLOSION_MULTIPLIER;
        particle.rawRigidBody.applyImpulse({
          x: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
          y: DESTRUCTION_PARTICLE_CONFIG.FORCES.UPWARD_MIN + 
             Math.random() * (DESTRUCTION_PARTICLE_CONFIG.FORCES.UPWARD_MAX - DESTRUCTION_PARTICLE_CONFIG.FORCES.UPWARD_MIN),
          z: Math.sin(angle) * speed * (0.8 + Math.random() * 0.4)
        });

        // Add configured spin
        const spinForce = DESTRUCTION_PARTICLE_CONFIG.FORCES.SPIN_STRENGTH;
        particle.rawRigidBody.applyTorqueImpulse({
          x: (Math.random() - 0.5) * spinForce,
          y: (Math.random() - 0.5) * spinForce,
          z: (Math.random() - 0.5) * spinForce
        });
      }

      // Clean up after configured lifetime
      setTimeout(() => {
        if (particle.isSpawned) {
          particle.despawn();
        }
        this.particles = this.particles.filter(p => p !== particle);
      }, DESTRUCTION_PARTICLE_CONFIG.LIFETIME);
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

  public removeBlock(block: MovingBlockEntity): void {
    const index = this.blocks.indexOf(block);
    if (index !== -1) {
      this.blocks.splice(index, 1);
    }
  }
}