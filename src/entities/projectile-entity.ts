import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, BlockType, World } from 'hytopia';
import { RaycastHandler } from '../raycast/raycast-handler';
import { BlockParticleEffects } from '../effects/block-particle-effects';

export interface ProjectileOptions extends EntityOptions {
    speed?: number;
    lifetime?: number;
    damage?: number;
    raycastHandler?: RaycastHandler;
    playerId?: string;
}

export class ProjectileEntity extends Entity {
    // Physics constants adjusted to match TF2 grenade launcher
    public static readonly PHYSICS = {
        GRAVITY: 15.24,           // TF2's 800 HU/s² converted to m/s²
        DEFAULT_SPEED: 20.00,     // TF2's 1216 HU/s converted to m/s
        DEFAULT_LIFETIME: 2300,    // 2.3 seconds fuse timer
        DEFAULT_DAMAGE: 10,       // Typical TF2 grenade damage
        UPWARD_ARC: 1.0,          // Reduced to match TF2's arc
        COLLIDER_RADIUS: 0.2,     // Smaller radius for grenades
        MASS: 0.5,                // Increased mass for better physics
        BOUNCINESS: 0.65,         // TF2's grenade bounce factor
        FRICTION: 0.3,            // Lower friction for better rolling
        LINEAR_DAMPING: 0.05,     // Reduced damping for longer rolls
        MIN_SPAWN_DISTANCE: 1.0,
        TRAJECTORY_CHECK_DISTANCE: 2.0,
        MAX_DOWN_ANGLE: -0.85,
        SPEED_LOSS_PER_BOUNCE: 0.35,  // 35% speed loss per bounce
        SPAWN_HEIGHT_OFFSET: -1.0,  // Meters below eye level (adjust as needed)
        SPAWN_FORWARD_OFFSET: -0.5,  // Meters forward from player (adjust as needed)
    } as const;

    private speed: number;
    private lifetime: number;
    private damage: number;
    private spawnTime: number;
    private raycastHandler?: RaycastHandler;
    private static readonly SPAWN_CHECK_DIRECTIONS = [
        { x: 0, y: -1, z: 0 },  // Down
        { x: 0, y: 1, z: 0 },   // Up
        { x: 1, y: 0, z: 0 },   // Right
        { x: -1, y: 0, z: 0 },  // Left
        { x: 0, y: 0, z: 1 },   // Forward
        { x: 0, y: 0, z: -1 },  // Back
    ];
    public readonly playerId?: string;
    public onCollision?: (position: Vector3Like, blockTextureUri: string) => void;
    private spawnOrigin?: Vector3Like;

    constructor(options: ProjectileOptions) {
        super({
            ...options,
            name: options.name || 'Projectile',
            modelUri: options.modelUri || 'models/projectiles/bomb.gltf',
            modelScale: options.modelScale || 0.5
        });

        this.speed = options.speed ?? ProjectileEntity.PHYSICS.DEFAULT_SPEED;
        this.lifetime = options.lifetime ?? ProjectileEntity.PHYSICS.DEFAULT_LIFETIME;
        this.damage = options.damage ?? ProjectileEntity.PHYSICS.DEFAULT_DAMAGE;
        this.spawnTime = Date.now();
        this.raycastHandler = options.raycastHandler;
        this.playerId = options.playerId;
    }

    public validateTrajectory(direction: Vector3Like): boolean {
        if (!this.raycastHandler || !this.isSpawned) return true;

        // Normalize direction for accurate distance checking
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (magnitude === 0) return false;

        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Check if there's any immediate obstruction in the trajectory
        const raycastResult = this.raycastHandler.raycast(
            this.position,
            normalizedDir,
            ProjectileEntity.PHYSICS.TRAJECTORY_CHECK_DISTANCE,
            {
                filterExcludeRigidBody: this.rawRigidBody
            }
        );

        // If we hit something very close, the trajectory is not valid
        if (raycastResult && raycastResult.hitDistance < ProjectileEntity.PHYSICS.MIN_SPAWN_DISTANCE) {
            return false;
        }

        return true;
    }

    spawn(world: World, position: Vector3Like): void {
        // Store spawn origin before any position adjustments
        this.spawnOrigin = { ...position };

        // Get the player's look direction (assuming it's passed in the options)
        const lookDir = this.rotation || { x: 0, y: 0, z: 1 };
        
        // Adjust spawn position to be lower and slightly forward
        const adjustedPosition = { 
            x: position.x + (lookDir.x * ProjectileEntity.PHYSICS.SPAWN_FORWARD_OFFSET),
            y: position.y + ProjectileEntity.PHYSICS.SPAWN_HEIGHT_OFFSET,
            z: position.z + (lookDir.z * ProjectileEntity.PHYSICS.SPAWN_FORWARD_OFFSET)
        };
        
        // Only adjust if world has raycast capability
        if ('raycast' in world) {
            // Check in all directions for nearby blocks
            for (const direction of ProjectileEntity.SPAWN_CHECK_DIRECTIONS) {
                const raycastResult = (world as any).raycast(adjustedPosition, direction, 1.5);
                if (raycastResult && raycastResult.distance < ProjectileEntity.PHYSICS.MIN_SPAWN_DISTANCE) {
                    // Move away from the block in the opposite direction
                    adjustedPosition.x += -direction.x * (ProjectileEntity.PHYSICS.MIN_SPAWN_DISTANCE - raycastResult.distance);
                    adjustedPosition.y += -direction.y * (ProjectileEntity.PHYSICS.MIN_SPAWN_DISTANCE - raycastResult.distance);
                    adjustedPosition.z += -direction.z * (ProjectileEntity.PHYSICS.MIN_SPAWN_DISTANCE - raycastResult.distance);
                }
            }
        }

        super.spawn(world, adjustedPosition);

        if (!this.isSpawned) {
            throw new Error('ProjectileEntity.spawn(): Entity failed to spawn!');
        }

        // Configure collider for solid physics interaction
        this.createAndAddChildCollider({
            shape: ColliderShape.BALL,
            radius: ProjectileEntity.PHYSICS.COLLIDER_RADIUS,
            isSensor: false,
            mass: ProjectileEntity.PHYSICS.MASS,
            collisionGroups: {
                belongsTo: [CollisionGroup.ENTITY],
                collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY]
            },
            bounciness: ProjectileEntity.PHYSICS.BOUNCINESS,
            friction: ProjectileEntity.PHYSICS.FRICTION,
            onCollision: (other: Entity | BlockType, started: boolean) => {
                if (!started) return;
                
                // Prevent multiple collision handling for the same projectile
                if (!this.isSpawned) return;
                
                if (typeof other === 'number') {
                    // Block collision
                    const hitPosition = this.position;
                    this.despawn();
                } else if (other instanceof ProjectileEntity) {
                    // Projectile-projectile collision - let physics handle the bouncing
                    // No need to despawn, just let them bounce naturally
                    if (this.rawRigidBody && other.rawRigidBody) {
                        // Apply a small damping on collision to prevent endless bouncing
                        this.rawRigidBody.setLinearDamping(0.3);
                        other.rawRigidBody.setLinearDamping(0.3);
                    }
                }
            }
        });

        if (this.rawRigidBody) {
            this.rawRigidBody.enableCcd(true);
            this.rawRigidBody.setLinearDamping(ProjectileEntity.PHYSICS.LINEAR_DAMPING);
            this.rawRigidBody.setAngularDamping(0.3);
            
            // Add initial rotation to make sides face the player
            // Rotate 90 degrees around the Z axis
            const initialRotation = {
                x: 0,
                y: 0,
                z: 0.7071068,  // Changed from Y to Z axis rotation
                w: 0.7071068
            };
            this.rawRigidBody.setRotation(initialRotation);
        }
    }

    override onTick = (entity: Entity, deltaTimeMs: number): void => {
        if (Date.now() - this.spawnTime > this.lifetime) {
            this.explode();
            this.despawn();
        }
    }

    throw(direction: Vector3Like): void {
        if (!this.rawRigidBody || !this.isSpawned) return;

        // Normalize direction properly
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (magnitude === 0) return;

        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Prevent throwing if looking too far down
        if (normalizedDir.y < ProjectileEntity.PHYSICS.MAX_DOWN_ANGLE) {
            this.despawn();
            return;
        }

        // Validate trajectory before throwing
        if (!this.validateTrajectory(normalizedDir)) {
            this.despawn();
            return;
        }

        const impulse = {
            x: normalizedDir.x * this.speed,
            y: normalizedDir.y * this.speed + ProjectileEntity.PHYSICS.UPWARD_ARC,
            z: normalizedDir.z * this.speed
        };
        
        this.rawRigidBody.applyImpulse(impulse);
        
        // Calculate the perpendicular axis for forward rolling motion
        const crossProduct = {
            x: -normalizedDir.z,
            y: 0,
            z: normalizedDir.x
        };
        
        // Apply torque for rotation
        const torque = {
            x: crossProduct.x * 0.14,
            y: 0,
            z: crossProduct.z * 0.14
        };
        
        this.rawRigidBody.applyTorqueImpulse(torque);
    }

    override despawn(): void {
        super.despawn();
    }

    private explode(): void {
        if (!this.isSpawned) return;
        // Additional explosion logic can be added here
        // Such as damage, particle effects, or knockback
    }

    private onImpact(): void {
        if (!this.world) return;
        
        const particleSystem = BlockParticleEffects.getInstance(this.world);
        
        if (this.position && this.blockTextureUri) {
            particleSystem.createDestructionEffect(
                this.world,
                this.position,
                this.blockTextureUri
            );
        }
    }

    protected handleCollision(other: Entity): void {
        if (this.onCollision && this.position && this.blockTextureUri) {
            this.onCollision(this.position, this.blockTextureUri);
        }
        
        this.onImpact();
    }

    public getSpawnOrigin(): Vector3Like | undefined {
        return this.spawnOrigin ? { ...this.spawnOrigin } : undefined;
    }
} 
