import { World, Player } from 'hytopia';
import { ProjectileEntity } from '../entities/projectile-entity';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3Like } from 'hytopia';
import { BlockParticleEffects } from '../effects/block-particle-effects';
import { AudioManager } from './audio-manager';
import { RoundManager } from './round-manager';

export interface PlayerProjectileState {
  previewProjectile: ProjectileEntity | null;
  lastInputState: { mr: boolean };
  projectilesRemaining: number;
  lastShotTime: number;
  predictedProjectiles: Map<string, ProjectileEntity>;
}

export class PlayerProjectileManager {
  private static readonly INITIAL_AMMO_COUNT = 1000;
  private static readonly SHOT_COOLDOWN = 400; // 400ms cooldown (~150 shots per minute)
  private static readonly PROJECTILE_SOUNDS = [
    'audio/sfx/projectile/grenade-launcher.mp3',
    'audio/sfx/projectile/grenade-launcher2.mp3',
    'audio/sfx/projectile/grenade-launcher3.mp3'
  ];
  private static readonly PREDICTION_TIMEOUT = 1000; // Time to wait for server confirmation
  private playerStates = new Map<string, PlayerProjectileState>();
  private readonly world: World;
  private readonly raycastHandler: RaycastHandler;
  private readonly enablePreview: boolean;
  private readonly audioManager: AudioManager;
  private readonly roundManager?: RoundManager;

  constructor(world: World, raycastHandler: RaycastHandler, enablePreview: boolean = false, roundManager?: RoundManager) {
    this.world = world;
    this.raycastHandler = raycastHandler;
    this.enablePreview = enablePreview;
    this.audioManager = AudioManager.getInstance(world);
    this.roundManager = roundManager;
  }

  initializePlayer(playerId: string): void {
    this.playerStates.set(playerId, {
      previewProjectile: null,
      lastInputState: { mr: false },
      projectilesRemaining: PlayerProjectileManager.INITIAL_AMMO_COUNT,
      lastShotTime: 0,
      predictedProjectiles: new Map()
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

  private createProjectile(
    playerId: string, 
    position: Vector3Like, 
    direction: Vector3Like,
    isPrediction: boolean = false
  ): ProjectileEntity {
    const projectile = new ProjectileEntity({
      name: 'Projectile',
      modelUri: 'models/projectiles/bomb.gltf',
      modelScale: 0.3,
      speed: 20,
      lifetime: 2300,
      damage: 10,
      raycastHandler: this.raycastHandler,
      enablePreview: this.enablePreview,
      playerId: playerId,
      isPrediction
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

    // Check if shooting is allowed based on round state
    if (this.roundManager && !this.roundManager.isShootingAllowed()) {
      // Clear any existing preview if shooting is not allowed
      if (state.previewProjectile) {
        state.previewProjectile.despawn();
        state.previewProjectile = null;
      }
      return;
    }

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

      // Create and spawn predicted projectile immediately
      const predictedProjectile = this.createProjectile(playerId, position, direction, true);
      const predictionId = predictedProjectile.getPredictionId();
      
      if (predictionId) {
        state.predictedProjectiles.set(predictionId, predictedProjectile);
        
        // Set timeout to clean up prediction if not confirmed
        setTimeout(() => {
          if (!predictedProjectile.isConfirmed()) {
            predictedProjectile.despawn();
            state.predictedProjectiles.delete(predictionId);
          }
        }, PlayerProjectileManager.PREDICTION_TIMEOUT);
      }

      // Throw the predicted projectile immediately
      predictedProjectile.throw(direction);

      // Update state
      state.lastShotTime = currentTime;
      state.projectilesRemaining--;

      // Send the shot to the server for validation
      if (player) {
        player.ui.sendData({
          type: 'projectileShot',
          data: {
            position,
            direction,
            timestamp: currentTime,
            predictionId
          }
        });
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

  // New method to handle server confirmation
  public handleServerConfirmation(playerId: string, predictionId: string, serverPosition: Vector3Like): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    const predictedProjectile = state.predictedProjectiles.get(predictionId);
    if (predictedProjectile) {
      // Compare predicted position with server position
      const predictedPos = predictedProjectile.position;
      const positionError = Math.sqrt(
        Math.pow(predictedPos.x - serverPosition.x, 2) +
        Math.pow(predictedPos.y - serverPosition.y, 2) +
        Math.pow(predictedPos.z - serverPosition.z, 2)
      );

      if (positionError > 0.5) { // If error is too large, correct the position
        predictedProjectile.setPosition(serverPosition);
      }

      predictedProjectile.confirmPrediction();
    }
  }
} 