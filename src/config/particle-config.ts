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
    SLEEP_THRESHOLD?: number;
    ANGULAR_SLEEP_THRESHOLD?: number;
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
  POOLING: {
    POOL_SIZE: number;
    MIN_POOL_SIZE: number;
  };
  INSTANCING: {
    BATCH_SIZE: number;
    ENABLE_MERGING: boolean;
    MERGE_DISTANCE: number;
    GPU_INSTANCING: boolean;
  };
  DISTANCE_SCALING: {
    ENABLED: boolean;
    FAR_DISTANCE: number;
    FAR_SCALE: number;
    MEDIUM_DISTANCE: number;
    MEDIUM_SCALE: number;
  };
}

export const DESTRUCTION_PARTICLE_CONFIG: ParticleConfig = {
  COUNT: 50,                // Number of particles
  SCALE: 0.15,             // Size of each particle
  LIFETIME: 1090,           // How long particles exist (ms)
  SPREAD_RADIUS: 0.3,      // Initial spread distance
  SPEED: 0.15,            // Base movement speed
  PHYSICS: {
    MASS: 0.1,
    FRICTION: 0.2,
    BOUNCINESS: 0.5,
    SLEEP_THRESHOLD: 0.01,
    ANGULAR_SLEEP_THRESHOLD: 0.01
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
  },
  POOLING: {
    POOL_SIZE: 300,
    MIN_POOL_SIZE: 100
  },
  INSTANCING: {
    BATCH_SIZE: 50,    // Number of particles to batch render
    ENABLE_MERGING: true,  // Merge nearby particle meshes
    MERGE_DISTANCE: 2.0,   // Distance threshold for merging
    GPU_INSTANCING: true   // Use GPU instancing when available
  },
  DISTANCE_SCALING: {
    ENABLED: true,
    FAR_DISTANCE: 30,
    FAR_SCALE: 0.2,
    MEDIUM_DISTANCE: 20,
    MEDIUM_SCALE: 0.5
  }
}; 