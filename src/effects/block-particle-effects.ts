import { Entity, Vector3Like, RigidBodyType, ColliderShape, World } from 'hytopia';
import { MOVING_BLOCK_CONFIG } from '../moving_blocks/moving-block-entity';
import { DESTRUCTION_PARTICLE_CONFIG } from '../config/particle-config';

export class BlockParticleEffects {
  private particles: Entity[] = [];

 

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