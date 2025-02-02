import { World, Player } from 'hytopia';
import { ProjectileEntity } from '../entities/projectile-entity';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3Like } from 'hytopia';

export interface PlayerProjectileState {
  previewProjectile: ProjectileEntity | null;
  lastInputState: { mr: boolean };
  projectilesRemaining: number;
}

export class PlayerProjectileManager {
  private static readonly INITIAL_PROJECTILE_COUNT = 100;
  private playerStates = new Map<string, PlayerProjectileState>();
  private readonly world: World;
  private readonly raycastHandler: RaycastHandler;
  private readonly enablePreview: boolean;

  constructor(world: World, raycastHandler: RaycastHandler, enablePreview: boolean = false) {
    this.world = world;
    this.raycastHandler = raycastHandler;
    this.enablePreview = enablePreview;
  }

  initializePlayer(playerId: string): void {
    this.playerStates.set(playerId, {
      previewProjectile: null,
      lastInputState: { mr: false },
      projectilesRemaining: PlayerProjectileManager.INITIAL_PROJECTILE_COUNT
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
      enablePreview: this.enablePreview,
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
    return projectile;
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
      // Throw the projectile and clean up preview
      state.previewProjectile.throw(direction);
      state.previewProjectile.clearTrajectoryMarkers();
      state.previewProjectile = null;
      
      // Decrease projectile count
      state.projectilesRemaining--;
    }

    // Update last input state
    state.lastInputState.mr = currentMrState;
  }

  // Optional: Method to refill projectiles (could be used for pickups or respawn)
  refillProjectiles(playerId: string, amount: number = PlayerProjectileManager.INITIAL_PROJECTILE_COUNT): void {
    const state = this.playerStates.get(playerId);
    if (state) {
      state.projectilesRemaining = amount;
    }
  }
} 