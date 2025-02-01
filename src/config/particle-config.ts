import { Vector3Like } from 'hytopia';

export interface ParticleConfig {
  COUNT: number;
  SCALE: number;
  LIFETIME: number;
  SPREAD_RADIUS: number;
  SPEED: number;
  PHYSICS: {
    MASS: number;
    FRICTION: number;
    BOUNCINESS: number;
  };
  FORCES: {
    UPWARD_MIN: number;
    UPWARD_MAX: number;
    SPIN_STRENGTH: number;
    EXPLOSION_MULTIPLIER: number;
  };
  SPAWN: {
    RADIUS: number;
    HEIGHT_VARIATION: number;
  };
}

export const DESTRUCTION_PARTICLE_CONFIG: ParticleConfig = {
  COUNT: 50,                // Number of particles
  SCALE: 0.1,             // Size of each particle
  LIFETIME: 1200,           // How long particles exist (ms)
  SPREAD_RADIUS: 0.3,      // Initial spread distance
  SPEED: 0.15,            // Base movement speed
  PHYSICS: {
    MASS: 0.1,
    FRICTION: 0.2,
    BOUNCINESS: 0.5
  },
  FORCES: {
    UPWARD_MIN: 0.3,      // Minimum upward force
    UPWARD_MAX: 0.7,      // Maximum upward force
    SPIN_STRENGTH: 0.2,   // How much particles spin
    EXPLOSION_MULTIPLIER: 2.0  // Multiplier for outward force
  },
  SPAWN: {
    RADIUS: 0.2,          // Random spawn radius
    HEIGHT_VARIATION: 0.2  // Random height variation
  }
}; 