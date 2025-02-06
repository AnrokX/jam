import { Entity, EntityOptions, Vector3Like, ColliderShape, CollisionGroup, BlockType, World } from 'hytopia';
import { RaycastHandler } from '../raycast/raycast-handler';
import { BlockParticleEffects } from '../effects/block-particle-effects';

// Add debug logging prefix
const DEBUG_PREFIX = '[ProjectileEntity]';

export interface ProjectileOptions extends EntityOptions {
    speed?: number;
    lifetime?: number;
    damage?: number;
    raycastHandler?: RaycastHandler;
    enablePreview?: boolean;
    playerId?: string;
}

interface TrajectoryPoint {
    position: Vector3Like;
    isCollision: boolean;
    hitDistance?: number;
}

export class ProjectileEntity extends Entity {
    // Physics constants adjusted to match TF2 grenade launcher
    private static readonly PHYSICS = {
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

    // Trajectory preview constants
    private static readonly PREVIEW = {
        TRAJECTORY_STEPS: 10,
        TIME_STEP: 0.1,
        MARKER_URI: 'models/projectiles/bomb.gltf',
        MARKER_SCALE: 0.3,
        MARKER_OPACITY: 0.7
    } as const;

    // Add after the PHYSICS constant
    private static readonly CRITICAL_LIMITS = {
        MAX_SCALE: 2.0,           // Maximum allowed scale multiplier
        MIN_SCALE: 0.1,           // Minimum allowed scale multiplier
        MAX_POSITION_CHANGE: 50,  // Maximum units of movement per tick
        MAX_LIFETIME: 5000,       // Maximum lifetime in ms
        SCALE_CHANGE_THRESHOLD: 0.1, // Maximum allowed scale change per tick
    } as const;

    // Store original options
    private readonly originalOptions: ProjectileOptions;

    private speed: number;
    private lifetime: number;
    private damage: number;
    private spawnTime: number;
    private raycastHandler?: RaycastHandler;
    private enablePreview: boolean;
    private static readonly SPAWN_CHECK_DIRECTIONS = [
        { x: 0, y: -1, z: 0 },  // Down
        { x: 0, y: 1, z: 0 },   // Up
        { x: 1, y: 0, z: 0 },   // Right
        { x: -1, y: 0, z: 0 },  // Left
        { x: 0, y: 0, z: 1 },   // Forward
        { x: 0, y: 0, z: -1 },  // Back
    ];
    private trajectoryMarkers: Entity[] = [];
    public readonly playerId?: string;
    public onCollision?: (position: Vector3Like, blockTextureUri: string) => void;
    private spawnOrigin?: Vector3Like;

    // Add debug state tracking
    private debugId: string;
    private debugSpawnTime: number;
    private debugLastPosition?: Vector3Like;
    private debugLastScale?: number;

    constructor(options: ProjectileOptions) {
        super({
            ...options,
            name: options.name || 'Projectile',
            modelUri: options.modelUri || ProjectileEntity.PREVIEW.MARKER_URI,
            modelScale: options.modelScale || 0.5
        });

        // Store options for later use
        this.originalOptions = { ...options };
        
        // Initialize debug tracking
        this.debugId = `proj_${Math.random().toString(36).substr(2, 9)}`;
        this.debugSpawnTime = Date.now();
        console.log(`${DEBUG_PREFIX} Created projectile ${this.debugId} for player ${this.playerId}`);
        
        this.speed = options.speed ?? ProjectileEntity.PHYSICS.DEFAULT_SPEED;
        this.lifetime = options.lifetime ?? ProjectileEntity.PHYSICS.DEFAULT_LIFETIME;
        this.damage = options.damage ?? ProjectileEntity.PHYSICS.DEFAULT_DAMAGE;
        this.spawnTime = Date.now();
        this.raycastHandler = options.raycastHandler;
        this.enablePreview = options.enablePreview ?? true;
        this.playerId = options.playerId;

        // Add scale validation
        if (options.modelScale) {
            if (options.modelScale > ProjectileEntity.CRITICAL_LIMITS.MAX_SCALE || 
                options.modelScale < ProjectileEntity.CRITICAL_LIMITS.MIN_SCALE) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Invalid initial scale ${options.modelScale} for projectile ${this.debugId}`);
                options.modelScale = 0.5; // Reset to default
            }
        }

        // Add strict lifetime limit
        if (this.lifetime > ProjectileEntity.CRITICAL_LIMITS.MAX_LIFETIME) {
            console.warn(`${DEBUG_PREFIX} Clamping lifetime from ${this.lifetime} to ${ProjectileEntity.CRITICAL_LIMITS.MAX_LIFETIME}ms`);
            this.lifetime = ProjectileEntity.CRITICAL_LIMITS.MAX_LIFETIME;
        }
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
        console.log(`${DEBUG_PREFIX} Spawning projectile ${this.debugId} at`, position);
        
        // Track initial state
        this.debugLastPosition = { ...position };
        this.debugLastScale = this.modelScale;

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

        // After spawn, verify entity state
        if (this.isSpawned) {
            const currentPos = this.position;
            const currentScale = this.modelScale;
            
            // Check for anomalies
            if (currentPos && this.debugLastPosition) {
                const distance = Math.sqrt(
                    Math.pow(currentPos.x - this.debugLastPosition.x, 2) +
                    Math.pow(currentPos.y - this.debugLastPosition.y, 2) +
                    Math.pow(currentPos.z - this.debugLastPosition.z, 2)
                );
                
                if (distance > 100) { // If teleported more than 100 units
                    console.error(`${DEBUG_PREFIX} CRITICAL: Projectile ${this.debugId} had anomalous spawn position!`);
                    console.error(`Expected: `, this.debugLastPosition);
                    console.error(`Actual: `, currentPos);
                    this.despawn();
                    return;
                }
            }

            if (currentScale && this.debugLastScale && 
                (currentScale > this.debugLastScale * 2 || currentScale < this.debugLastScale * 0.5)) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Projectile ${this.debugId} had anomalous scale!`);
                console.error(`Expected: ${this.debugLastScale}, Actual: ${currentScale}`);
                this.despawn();
                return;
            }
        }
    }

    override onTick = (entity: Entity, deltaTimeMs: number): void => {
        // Add critical state validation at start of tick
        if (!this.validateEntityState()) {
            console.error(`${DEBUG_PREFIX} CRITICAL: Entity ${this.debugId} failed state validation, despawning`);
            this.despawn();
            return;
        }

        // Track position changes
        if (this.position) {
            if (this.debugLastPosition) {
                const distance = Math.sqrt(
                    Math.pow(this.position.x - this.debugLastPosition.x, 2) +
                    Math.pow(this.position.y - this.debugLastPosition.y, 2) +
                    Math.pow(this.position.z - this.debugLastPosition.z, 2)
                );
                
                // Check for sudden teleports
                if (distance > 50) { // If moved more than 50 units in one tick
                    console.error(`${DEBUG_PREFIX} CRITICAL: Projectile ${this.debugId} teleported!`);
                    console.error(`From:`, this.debugLastPosition);
                    console.error(`To:`, this.position);
                    this.despawn();
                    return;
                }
            }
            this.debugLastPosition = { ...this.position };
        }

        // Check for scale anomalies
        if (this.modelScale && this.debugLastScale) {
            if (this.modelScale > this.debugLastScale * 2 || this.modelScale < this.debugLastScale * 0.5) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Projectile ${this.debugId} scale anomaly!`);
                console.error(`Previous: ${this.debugLastScale}, Current: ${this.modelScale}`);
                this.despawn();
                return;
            }
            this.debugLastScale = this.modelScale;
        }

        // Check lifetime
        if (Date.now() - this.spawnTime > this.lifetime) {
            console.log(`${DEBUG_PREFIX} Projectile ${this.debugId} reached end of lifetime`);
            this.explode();
            this.despawn();
        }
    }

    private validateEntityState(): boolean {
        // Check if entity still exists and is spawned
        if (!this.isSpawned || !this.world) {
            console.error(`${DEBUG_PREFIX} Entity ${this.debugId} validation failed: Not spawned or no world`);
            return false;
        }

        // Validate scale
        if (this.modelScale) {
            if (this.modelScale > ProjectileEntity.CRITICAL_LIMITS.MAX_SCALE || 
                this.modelScale < ProjectileEntity.CRITICAL_LIMITS.MIN_SCALE) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Scale validation failed for ${this.debugId}. Scale: ${this.modelScale}`);
                return false;
            }

            // Check for sudden scale changes
            if (this.debugLastScale && 
                Math.abs(this.modelScale - this.debugLastScale) > ProjectileEntity.CRITICAL_LIMITS.SCALE_CHANGE_THRESHOLD) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Sudden scale change for ${this.debugId}. Previous: ${this.debugLastScale}, Current: ${this.modelScale}`);
                return false;
            }
        }

        // Validate position
        if (this.position) {
            if (Math.abs(this.position.x) > 1000 || 
                Math.abs(this.position.y) > 1000 || 
                Math.abs(this.position.z) > 1000) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Position out of bounds for ${this.debugId}`, this.position);
                return false;
            }
        }

        return true;
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
        
        // Reduced torque multiplier by 66%
        const torque = {
            x: crossProduct.x * 0.14,  // Reduced from 1.0 to 0.33
            y: 0,
            z: crossProduct.z * 0.14   // Reduced from 1.0 to 0.33
        };
        this.rawRigidBody.applyTorqueImpulse(torque);
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
        for (let i = 0; i < ProjectileEntity.PREVIEW.TRAJECTORY_STEPS; i++) {
            // Calculate next position based on current velocity
            const nextPos = {
                x: currentPos.x + velocity.x * ProjectileEntity.PREVIEW.TIME_STEP,
                y: currentPos.y + velocity.y * ProjectileEntity.PREVIEW.TIME_STEP,
                z: currentPos.z + velocity.z * ProjectileEntity.PREVIEW.TIME_STEP
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
            velocity.y -= ProjectileEntity.PHYSICS.GRAVITY * ProjectileEntity.PREVIEW.TIME_STEP;
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
                    modelUri: ProjectileEntity.PREVIEW.MARKER_URI,
                    modelScale: ProjectileEntity.PREVIEW.MARKER_SCALE,
                    opacity: ProjectileEntity.PREVIEW.MARKER_OPACITY
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
        console.log(`${DEBUG_PREFIX} Despawning projectile ${this.debugId}`);
        
        // Log if taking too long to despawn
        const despawnTime = Date.now() - this.debugSpawnTime;
        if (despawnTime > this.lifetime + 1000) { // If lived 1s longer than should
            console.warn(`${DEBUG_PREFIX} Projectile ${this.debugId} lived ${despawnTime}ms (${despawnTime - this.lifetime}ms too long)`);
        }

        this.clearTrajectoryMarkers();
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
        // ... existing collision code ...
        
        if (this.onCollision && this.position && this.blockTextureUri) {
            this.onCollision(this.position, this.blockTextureUri);
        }
        
        this.onImpact(); // Call onImpact when collision occurs
        
        // ... rest of collision handling
    }

    // Add getter for spawn origin
    public getSpawnOrigin(): Vector3Like | undefined {
        return this.spawnOrigin ? { ...this.spawnOrigin } : undefined;
    }

    // Add public scale setter
    public setScale(scale: number): void {
        if (scale > ProjectileEntity.CRITICAL_LIMITS.MAX_SCALE || 
            scale < ProjectileEntity.CRITICAL_LIMITS.MIN_SCALE) {
            console.error(`${DEBUG_PREFIX} CRITICAL: Attempted to set invalid scale ${scale} for projectile ${this.debugId}`);
            return;
        }

        // Track scale change
        if (this.debugLastScale) {
            const scaleChange = Math.abs(scale - this.debugLastScale);
            if (scaleChange > ProjectileEntity.CRITICAL_LIMITS.SCALE_CHANGE_THRESHOLD) {
                console.error(`${DEBUG_PREFIX} CRITICAL: Scale change too large (${scaleChange}) for projectile ${this.debugId}`);
                return;
            }
        }

        // Set scale through the base Entity class
        if (this.isSpawned) {
            // Create a new Entity with the desired scale
            const scaledEntity = new Entity({
                ...this.originalOptions,
                modelScale: scale
            });
            
            // Copy the scaled entity's properties to this entity
            if (scaledEntity.modelScale) {
                Object.defineProperty(this, 'modelScale', {
                    value: scaledEntity.modelScale,
                    writable: false,
                    configurable: true
                });
            }
            
            this.debugLastScale = scale;
        } else {
            console.warn(`${DEBUG_PREFIX} Attempted to set scale on unspawned projectile ${this.debugId}`);
        }
    }
} 
