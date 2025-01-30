import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, BlockType, World } from 'hytopia';
import { RaycastHandler } from '../raycast/raycast-handler';

export interface ProjectileOptions extends EntityOptions {
    speed?: number;
    lifetime?: number;
    damage?: number;
    raycastHandler?: RaycastHandler;
    enablePreview?: boolean;
}

interface TrajectoryPoint {
    position: Vector3Like;
    isCollision: boolean;
    hitDistance?: number;
}

export class ProjectileEntity extends Entity {
    private speed: number;
    private lifetime: number;
    private damage: number;
    private spawnTime: number;
    private raycastHandler?: RaycastHandler;
    private enablePreview: boolean;
    private static readonly MIN_SPAWN_DISTANCE = 1.0; // Minimum distance from blocks to spawn
    private static readonly TRAJECTORY_CHECK_DISTANCE = 2.0; // Distance to check ahead
    private static readonly SPAWN_CHECK_DIRECTIONS = [
        { x: 0, y: -1, z: 0 },  // Down
        { x: 0, y: 1, z: 0 },   // Up
        { x: 1, y: 0, z: 0 },   // Right
        { x: -1, y: 0, z: 0 },  // Left
        { x: 0, y: 0, z: 1 },   // Forward
        { x: 0, y: 0, z: -1 },  // Back
    ];
    private static readonly GRAVITY = 9.81;
    private static readonly TRAJECTORY_STEPS = 10;
    private static readonly TIME_STEP = 0.1; // 100ms per step
    private static readonly TRAJECTORY_MARKER_URI = 'models/projectiles/energy-orb-projectile.gltf';
    private trajectoryMarkers: Entity[] = [];

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
        this.raycastHandler = options.raycastHandler;
        this.enablePreview = options.enablePreview ?? true;
    }

    private validateTrajectory(direction: Vector3Like): boolean {
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
            ProjectileEntity.TRAJECTORY_CHECK_DISTANCE,
            {
                filterExcludeRigidBody: this.rawRigidBody
            }
        );

        // If we hit something very close, the trajectory is not valid
        if (raycastResult && raycastResult.hitDistance < ProjectileEntity.MIN_SPAWN_DISTANCE) {
            console.log('Trajectory blocked at distance:', raycastResult.hitDistance);
            return false;
        }

        return true;
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

        // Validate trajectory before throwing
        if (!this.validateTrajectory(normalizedDir)) {
            console.log('Invalid trajectory, cannot throw');
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

    /**
     * Predicts the trajectory of the projectile and returns an array of points
     * along with collision information.
     */
    predictTrajectory(direction: Vector3Like): TrajectoryPoint[] {
        if (!this.raycastHandler || !this.isSpawned) return [];

        const points: TrajectoryPoint[] = [];
        let currentPos = { ...this.position };
        
        // Calculate initial velocity based on direction and speed
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (magnitude === 0) return points;

        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Initial velocity including the upward arc
        let velocity = {
            x: normalizedDir.x * this.speed,
            y: normalizedDir.y * this.speed + 1.0, // Same upward arc as in throw()
            z: normalizedDir.z * this.speed
        };

        // Predict trajectory points
        for (let i = 0; i < ProjectileEntity.TRAJECTORY_STEPS; i++) {
            // Calculate next position based on current velocity
            const nextPos = {
                x: currentPos.x + velocity.x * ProjectileEntity.TIME_STEP,
                y: currentPos.y + velocity.y * ProjectileEntity.TIME_STEP,
                z: currentPos.z + velocity.z * ProjectileEntity.TIME_STEP
            };

            // Calculate direction to next point
            const dirToNext = {
                x: nextPos.x - currentPos.x,
                y: nextPos.y - currentPos.y,
                z: nextPos.z - currentPos.z
            };

            // Get the distance to the next point
            const distance = Math.sqrt(
                dirToNext.x * dirToNext.x +
                dirToNext.y * dirToNext.y +
                dirToNext.z * dirToNext.z
            );

            // Normalize direction
            if (distance > 0) {
                dirToNext.x /= distance;
                dirToNext.y /= distance;
                dirToNext.z /= distance;
            }

            // Check for collisions along the path
            const raycastResult = this.raycastHandler.raycast(
                currentPos,
                dirToNext,
                distance,
                { filterExcludeRigidBody: this.rawRigidBody }
            );

            if (raycastResult) {
                // Collision detected
                points.push({
                    position: raycastResult.hitPoint,
                    isCollision: true,
                    hitDistance: raycastResult.hitDistance
                });
                break;
            } else {
                // No collision, add the point
                points.push({
                    position: { ...currentPos },
                    isCollision: false
                });
            }

            // Update position and velocity for next iteration
            currentPos = nextPos;
            // Apply gravity to Y velocity
            velocity.y -= ProjectileEntity.GRAVITY * ProjectileEntity.TIME_STEP;
        }

        return points;
    }

    /**
     * Cleans up all trajectory markers
     */
    public clearTrajectoryMarkers(): void {
        this.trajectoryMarkers.forEach(marker => {
            if (marker.isSpawned) {
                marker.despawn();
            }
        });
        this.trajectoryMarkers = [];
    }

    /**
     * Shows visual preview of the predicted trajectory if enabled
     */
    showTrajectoryPreview(direction: Vector3Like): void {
        if (!this.enablePreview || !this.world || !this.raycastHandler) return;

        // Clear any existing trajectory markers
        this.clearTrajectoryMarkers();

        const points = this.predictTrajectory(direction);
        
        // Find the collision point
        const collisionPoint = points.find(point => point.isCollision);
        if (collisionPoint) {
            // Only create/update a single marker at the predicted impact point
            if (this.trajectoryMarkers.length === 0) {
                const marker = new Entity({
                    name: 'ImpactMarker',
                    modelUri: 'models/projectiles/energy-orb-projectile.gltf',
                    modelScale: 0.3,
                    opacity: 0.7
                });
                this.trajectoryMarkers.push(marker);
                marker.spawn(this.world, collisionPoint.position);
            } else {
                // Update existing marker position
                const marker = this.trajectoryMarkers[0];
                if (marker.isSpawned) {
                    marker.setPosition(collisionPoint.position);
                }
            }
        } else {
            // No collision point found, clear any existing markers
            this.clearTrajectoryMarkers();
        }
    }

    // Override despawn to ensure we clean up trajectory markers
    override despawn(): void {
        this.clearTrajectoryMarkers();
        super.despawn();
    }
} 
