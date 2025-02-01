import { Entity, Vector3Like, RigidBodyType, ColliderShape, World } from 'hytopia';
import { MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';
import { DESTRUCTION_PARTICLE_CONFIG } from '../config/particle-config';

export class BlockParticleEffects {
  private particles: Entity[] = [];

  createHitEffect(world: World, hitPosition: Vector3Like, blockTextureUri: string): void {
    if (!world) return;

    // Create particles in a circular pattern
    for (let i = 0; i < MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.COUNT; i++) {
      const angle = (i / MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.COUNT) * Math.PI * 2;
      const radius = MOVING_BLOCK_CONFIG.PARTICLE_CONFIG.SPREAD_RADIUS;

      // Create a small block entity using the same texture as the parent block
      const particle = new Entity({
        name: 'HitParticle',
        blockTextureUri: blockTextureUri,
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

      particle.spawn(world, particlePosition);
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

  createDestructionEffect(world: World, position: Vector3Like, blockTextureUri: string): void {
    if (!world) return;

    // Create particles in a more explosive pattern
    for (let i = 0; i < DESTRUCTION_PARTICLE_CONFIG.COUNT; i++) {
      const angle = (i / DESTRUCTION_PARTICLE_CONFIG.COUNT) * Math.PI * 2;

      // Create block pieces using the current block's texture
      const particle = new Entity({
        name: 'DestroyedBlockPiece',
        blockTextureUri: blockTextureUri,
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
        x: position.x + (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.RADIUS,
        y: position.y + (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.HEIGHT_VARIATION,
        z: position.z + (Math.random() - 0.5) * DESTRUCTION_PARTICLE_CONFIG.SPAWN.RADIUS
      };

      particle.spawn(world, particlePosition);
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