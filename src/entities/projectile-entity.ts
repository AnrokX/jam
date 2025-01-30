import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, BlockType, World } from 'hytopia';

export interface ProjectileOptions extends EntityOptions {
    speed?: number;
    lifetime?: number;
    damage?: number;
}

export class ProjectileEntity extends Entity {
    private speed: number;
    private lifetime: number;
    private damage: number;
    private spawnTime: number;
    private static readonly MIN_SPAWN_DISTANCE = 1.0; // Minimum distance from blocks to spawn
    private static readonly SPAWN_CHECK_DIRECTIONS = [
        { x: 0, y: -1, z: 0 },  // Down
        { x: 0, y: 1, z: 0 },   // Up
        { x: 1, y: 0, z: 0 },   // Right
        { x: -1, y: 0, z: 0 },  // Left
        { x: 0, y: 0, z: 1 },   // Forward
        { x: 0, y: 0, z: -1 },  // Back
    ];

    constructor(options: ProjectileOptions) {
        super({
            ...options,
            name: options.name || 'Projectile',
            modelUri: options.modelUri || 'models/projectiles/energy-orb-projectile.gltf',
            modelScale: options.modelScale || 0.5
        });

        this.speed = options.speed ?? 5;
        this.lifetime = options.lifetime ?? 3000;
        this.damage = options.damage ?? 10;
        this.spawnTime = Date.now();
    }

    spawn(world: World, position: Vector3Like): void {
        // Adjust spawn position if too close to blocks
        const adjustedPosition = { ...position };
        
        // Only adjust if world has raycast capability
        if ('raycast' in world) {
            // Check in all directions for nearby blocks
            for (const direction of ProjectileEntity.SPAWN_CHECK_DIRECTIONS) {
                const raycastResult = (world as any).raycast(position, direction, 1.5);
                if (raycastResult && raycastResult.distance < ProjectileEntity.MIN_SPAWN_DISTANCE) {
                    // Move away from the block in the opposite direction
                    adjustedPosition.x += -direction.x * (ProjectileEntity.MIN_SPAWN_DISTANCE - raycastResult.distance);
                    adjustedPosition.y += -direction.y * (ProjectileEntity.MIN_SPAWN_DISTANCE - raycastResult.distance);
                    adjustedPosition.z += -direction.z * (ProjectileEntity.MIN_SPAWN_DISTANCE - raycastResult.distance);
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
            radius: 0.3,
            isSensor: false,
            mass: 0.5,
            collisionGroups: {
                belongsTo: [CollisionGroup.ENTITY],
                collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY]
            },
            bounciness: 0.6,
            friction: 0.8,
            onCollision: (other: Entity | BlockType, started: boolean) => {
                if (!started) return;
                
                // Prevent multiple collision handling for the same projectile
                if (!this.isSpawned) return;
                
                if (typeof other === 'number') {
                    // Block collision
                    const hitPosition = this.position;
                    console.log('Block hit at position:', hitPosition);
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
            this.rawRigidBody.lockRotations(true);
            this.rawRigidBody.setLinearDamping(0.1);
        }
    }

    override onTick = (entity: Entity, deltaTimeMs: number): void => {
        if (Date.now() - this.spawnTime > this.lifetime) {
            console.log('Projectile lifetime expired, despawning...');
            this.despawn();
        }
    }

    throw(direction: Vector3Like): void {
        if (!this.rawRigidBody) return;

        // Normalize direction properly
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (magnitude === 0) return;

        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Prevent throwing if looking too far down
        if (normalizedDir.y < -0.85) {
            console.log('Cannot throw while looking too far down');
            this.despawn();
            return;
        }

        // Add a slight upward arc and apply speed
        const impulse = {
            x: normalizedDir.x * this.speed,
            y: normalizedDir.y * this.speed + 1.0,
            z: normalizedDir.z * this.speed
        };
        
        console.log(`Throwing projectile with impulse: (${impulse.x.toFixed(2)}, ${impulse.y.toFixed(2)}, ${impulse.z.toFixed(2)})`);
        this.rawRigidBody.applyImpulse(impulse);
    }
} 
