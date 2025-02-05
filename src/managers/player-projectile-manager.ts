import { World, Player } from 'hytopia';
import { ProjectileEntity } from '../entities/projectile-entity';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3Like } from 'hytopia';
import { BlockParticleEffects } from '../effects/block-particle-effects';
import { AudioManager } from './audio-manager';

export interface PlayerProjectileState {
  previewProjectile: ProjectileEntity | null;
  lastInputState: { mr: boolean };
  projectilesRemaining: number;
  lastShotTime: number;
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
  private readonly audioManager: AudioManager;

  constructor(world: World, raycastHandler: RaycastHandler) {
    this.world = world;
    this.raycastHandler = raycastHandler;
    this.audioManager = AudioManager.getInstance(world);
  }

  initializePlayer(playerId: string): void {
    this.playerStates.set(playerId, {
      previewProjectile: null,
      lastInputState: { mr: false },
      projectilesRemaining: PlayerProjectileManager.INITIAL_AMMO_COUNT,
      lastShotTime: 0
    });
  }

  removePlayer(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (state?.previewProjectile) {
      state.previewProjectile.despawn();
    }
    this.playerStates.delete(playerId);
  }

  getProjectilesRemaining(playerId: string): number {
    return this.playerStates.get(playerId)?.projectilesRemaining ?? 0;
  }

  private createProjectile(playerId: string, position: Vector3Like, direction: Vector3Like): ProjectileEntity {
    const projectile = new ProjectileEntity({
      modelScale: 1,
      raycastHandler: this.raycastHandler,
      playerId
    });

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
} 