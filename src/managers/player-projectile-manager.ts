import { World, Player } from 'hytopia';
import { ProjectileEntity } from '../entities/projectile-entity';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3Like } from 'hytopia';
import { BlockParticleEffects } from '../effects/block-particle-effects';
import { AudioManager } from './audio-manager';

const DEBUG_PREFIX = '[ProjectileManager]';

// Add debug interface
interface DebugProjectileInfo {
  id: string;
  spawnTime: number;
  lastKnownPosition?: Vector3Like;
  isPreview: boolean;
}

export interface PlayerProjectileState {
  previewProjectile: ProjectileEntity | null;
  lastInputState: { mr: boolean };
  projectilesRemaining: number;
  lastShotTime: number;
  // Add debug tracking
  activeProjectiles: Map<string, DebugProjectileInfo>;
}

export class PlayerProjectileManager {
  private static readonly INITIAL_AMMO_COUNT = 1000;
  private static readonly SHOT_COOLDOWN = 400; // 400ms cooldown (~150 shots per minute)
  private static readonly PROJECTILE_SOUNDS = [
    'audio/sfx/projectile/grenade-launcher.mp3',
    'audio/sfx/projectile/grenade-launcher2.mp3',
    'audio/sfx/projectile/grenade-launcher3.mp3'
  ];
  private playerStates = new Map<string, PlayerProjectileState>();
  private readonly world: World;
  private readonly raycastHandler: RaycastHandler;
  private readonly enablePreview: boolean;
  private readonly audioManager: AudioManager;

  constructor(world: World, raycastHandler: RaycastHandler, enablePreview: boolean = false) {
    this.world = world;
    this.raycastHandler = raycastHandler;
    this.enablePreview = enablePreview;
    this.audioManager = AudioManager.getInstance(world);
    
    // Add periodic debug check
    setInterval(() => this.debugCheckProjectiles(), 10000); // Check every 10 seconds
  }

  initializePlayer(playerId: string): void {
    console.log(`${DEBUG_PREFIX} Initializing player ${playerId}`);
    this.playerStates.set(playerId, {
      previewProjectile: null,
      lastInputState: { mr: false },
      projectilesRemaining: PlayerProjectileManager.INITIAL_AMMO_COUNT,
      lastShotTime: 0,
      activeProjectiles: new Map()
    });
  }

  removePlayer(playerId: string): void {
    console.log(`${DEBUG_PREFIX} Removing player ${playerId}`);
    const state = this.playerStates.get(playerId);
    if (state) {
      // Clean up all active projectiles
      state.activeProjectiles.forEach((info, id) => {
        console.log(`${DEBUG_PREFIX} Cleaning up projectile ${id} for player ${playerId}`);
        if (state.previewProjectile) {
          state.previewProjectile.despawn();
        }
      });
    }
    this.playerStates.delete(playerId);
  }

  getProjectilesRemaining(playerId: string): number {
    return this.playerStates.get(playerId)?.projectilesRemaining ?? 0;
  }

  private createProjectile(playerId: string, position: Vector3Like, direction: Vector3Like): ProjectileEntity {
    console.log(`${DEBUG_PREFIX} Creating new projectile for player ${playerId}`);
    
    const projectile = new ProjectileEntity({
      modelScale: 1,
      raycastHandler: this.raycastHandler,
      enablePreview: this.enablePreview,
      playerId
    });

    // Add to debug tracking
    const state = this.playerStates.get(playerId);
    if (state) {
      const debugInfo: DebugProjectileInfo = {
        id: `proj_${Math.random().toString(36).substr(2, 9)}`,
        spawnTime: Date.now(),
        lastKnownPosition: position,
        isPreview: false
      };
      state.activeProjectiles.set(debugInfo.id, debugInfo);
      
      // Set up position tracking
      const originalDespawn = projectile.despawn.bind(projectile);
      projectile.despawn = () => {
        console.log(`${DEBUG_PREFIX} Projectile ${debugInfo.id} despawning`);
        state.activeProjectiles.delete(debugInfo.id);
        originalDespawn();
      };
    }

    // Calculate spawn position
    const spawnOffset = {
      x: direction.x,
      y: Math.max(direction.y, -0.5),
      z: direction.z
    };

    const offsetMag = Math.sqrt(
      spawnOffset.x * spawnOffset.x + 
      spawnOffset.y * spawnOffset.y + 
      spawnOffset.z * spawnOffset.z
    );

    const SPAWN_DISTANCE = 2.0;
    const spawnPos = {
      x: position.x + (spawnOffset.x / offsetMag) * SPAWN_DISTANCE,
      y: position.y + (spawnOffset.y / offsetMag) * SPAWN_DISTANCE + 1.5,
      z: position.z + (spawnOffset.z / offsetMag) * SPAWN_DISTANCE
    };

    projectile.spawn(this.world, spawnPos);
    this.handleProjectileSpawn(projectile);
    return projectile;
  }

  private handleProjectileSpawn(projectile: ProjectileEntity): void {
    projectile.onCollision = (position: Vector3Like, blockTextureUri: string) => {
      this.handleProjectileImpact(position, blockTextureUri);
    };
  }

  public handleProjectileInput(
    playerId: string,
    position: Vector3Like,
    direction: Vector3Like,
    input: any,
    player: Player
  ): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    const currentMrState = input.mr ?? false;
    const mrJustPressed = currentMrState && !state.lastInputState.mr;
    const mrJustReleased = !currentMrState && state.lastInputState.mr;

    // Right mouse button just pressed
    if (mrJustPressed) {
      const currentTime = Date.now();
      const timeSinceLastShot = currentTime - state.lastShotTime;

      if (timeSinceLastShot < PlayerProjectileManager.SHOT_COOLDOWN) {
        // Still on cooldown - provide feedback about remaining cooldown
        if (player) {
          const remainingCooldown = Math.ceil((PlayerProjectileManager.SHOT_COOLDOWN - timeSinceLastShot) / 100) / 10;
          player.ui.sendData({ 
            type: 'onCooldown',
            remainingSeconds: remainingCooldown
          });
        }
        return;
      }

      if (state.projectilesRemaining <= 0) {
        // Send UI event when trying to shoot with no ammo
        if (player) {
          player.ui.sendData({ type: 'attemptShootNoAmmo' });
        }
        return;
      }

      if (!state.previewProjectile) {
        state.previewProjectile = this.createProjectile(playerId, position, direction);
      }
    }
    
    // Update trajectory while held
    if (currentMrState && state.previewProjectile) {
      state.previewProjectile.showTrajectoryPreview(direction);
    }

    // Right mouse button just released
    if (mrJustReleased && state.previewProjectile) {
      // Play random grenade launcher sound
      this.audioManager.playRandomSoundEffect(PlayerProjectileManager.PROJECTILE_SOUNDS, 0.4);
      
      // Throw the projectile and clean up preview
      state.previewProjectile.throw(direction);
      state.previewProjectile.clearTrajectoryMarkers();
      state.previewProjectile = null;
      
      // Decrease projectile count and update last shot time
      state.projectilesRemaining--;
      state.lastShotTime = Date.now();
    }

    // Update last input state
    state.lastInputState.mr = currentMrState;
  }

  // Optional: Method to refill projectiles (could be used for pickups or respawn)
  refillProjectiles(playerId: string, amount: number = PlayerProjectileManager.INITIAL_AMMO_COUNT): void {
    const state = this.playerStates.get(playerId);
    if (state) {
      state.projectilesRemaining = amount;
    }
  }

  private handleProjectileImpact(position: Vector3Like, blockTextureUri: string): void {
    try {
      const particleSystem = BlockParticleEffects.getInstance(this.world);
      particleSystem.createDestructionEffect(this.world, position, blockTextureUri);
    } catch (error) {
      console.error('Failed to create particle effect:', error);
    }
  }

  private debugCheckProjectiles(): void {
    this.playerStates.forEach((state, playerId) => {
      state.activeProjectiles.forEach((info, id) => {
        const lifetime = Date.now() - info.spawnTime;
        if (lifetime > 10000) { // If projectile exists for more than 10 seconds
          console.warn(`${DEBUG_PREFIX} WARN: Projectile ${id} for player ${playerId} has been alive for ${lifetime}ms`);
          if (info.lastKnownPosition) {
            console.warn(`Last known position:`, info.lastKnownPosition);
          }
        }
      });
    });
  }
} 