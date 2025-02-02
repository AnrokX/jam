import { Entity, Vector3Like, RigidBodyType, ColliderShape, World } from 'hytopia';
import { DESTRUCTION_PARTICLE_CONFIG } from '../config/particle-config';

export class BlockParticleEffects {
  private activeParticles: Set<Entity> = new Set(); // Use Set for faster lookups/removal
  private particlePool: Entity[] = [];
  private static instance: BlockParticleEffects; // Singleton pattern

  // Singleton getter
  public static getInstance(): BlockParticleEffects {
    if (!BlockParticleEffects.instance) {
      BlockParticleEffects.instance = new BlockParticleEffects();
    }
    return BlockParticleEffects.instance;
  }

  private getParticleFromPool(world: World, blockTextureUri: string): Entity {
    let particle = this.particlePool.pop();
    
    if (!particle) {
      // Create new particle if pool is empty
      particle = new Entity({
        name: 'DestroyedBlockPiece',
        blockTextureUri,
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

      // If the engine supports setting sleep thresholds through the raw rigid body
      if (particle.rawRigidBody) {
        try {
          // Attempt to set sleep thresholds if the underlying physics engine supports it
          particle.rawRigidBody.setSleepThreshold?.(DESTRUCTION_PARTICLE_CONFIG.PHYSICS.SLEEP_THRESHOLD);
          particle.rawRigidBody.setAngularSleepThreshold?.(DESTRUCTION_PARTICLE_CONFIG.PHYSICS.ANGULAR_SLEEP_THRESHOLD);
        } catch (e) {
          // Silently fail if these methods aren't available
        }
      }
    }

    return particle;
  }

  private returnParticleToPool(particle: Entity): void {
    if (this.particlePool.length < DESTRUCTION_PARTICLE_CONFIG.POOLING.POOL_SIZE) {
      this.particlePool.push(particle);
    } else {
      particle.despawn();
    }
    this.activeParticles.delete(particle);
  }

  createDestructionEffect(world: World, position: Vector3Like, blockTextureUri: string): void {
    if (!world) return;

    // Pre-calculate some values to avoid repeated calculations
    const angleIncrement = (Math.PI * 2) / DESTRUCTION_PARTICLE_CONFIG.COUNT;
    const speed = DESTRUCTION_PARTICLE_CONFIG.SPEED * DESTRUCTION_PARTICLE_CONFIG.FORCES.EXPLOSION_MULTIPLIER;
    const spinForce = DESTRUCTION_PARTICLE_CONFIG.FORCES.SPIN_STRENGTH;

    // Batch creation to reduce overhead
    for (let i = 0; i < DESTRUCTION_PARTICLE_CONFIG.COUNT; i++) {
      const particle = this.getParticleFromPool(world, blockTextureUri);
      const angle = angleIncrement * i;

      // Calculate position with less random calls
      const offsetX = (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.RADIUS;
      const offsetY = (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.HEIGHT_VARIATION;
      const offsetZ = (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.RADIUS;

      particle.spawn(world, {
        x: position.x + offsetX,
        y: position.y + offsetY,
        z: position.z + offsetZ
      });

      this.activeParticles.add(particle);

      if (particle.rawRigidBody) {
        // Apply forces with fewer calculations
        const speedVariation = 0.8 + Math.random() * 0.4;
        particle.rawRigidBody.applyImpulse({
          x: Math.cos(angle) * speed * speedVariation,
          y: DESTRUCTION_PARTICLE_CONFIG.FORCES.UPWARD_MIN + 
             Math.random() * (DESTRUCTION_PARTICLE_CONFIG.FORCES.UPWARD_MAX - DESTRUCTION_PARTICLE_CONFIG.FORCES.UPWARD_MIN),
          z: Math.sin(angle) * speed * speedVariation
        });

        // Simplified spin calculation
        const spin = (Math.random() - 0.5) * spinForce;
        particle.rawRigidBody.applyTorqueImpulse({
          x: spin,
          y: spin,
          z: spin
        });
      }

      // Use a single timeout per batch of particles
      setTimeout(() => {
        if (particle.isSpawned) {
          this.returnParticleToPool(particle);
        }
      }, DESTRUCTION_PARTICLE_CONFIG.LIFETIME);
    }
  }

  // Clean up method for game shutdown or scene changes
  cleanup(): void {
    this.activeParticles.forEach(particle => {
      if (particle.isSpawned) {
        particle.despawn();
      }
    });
    this.activeParticles.clear();
    this.particlePool = [];
  }
} 