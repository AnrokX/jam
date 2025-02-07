import { World, Player } from 'hytopia';
import { ProjectileEntity } from '../entities/projectile-entity';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3Like } from 'hytopia';
import { BlockParticleEffects } from '../effects/block-particle-effects';
import { AudioManager } from './audio-manager';
import { RoundManager } from './round-manager';

export interface PlayerProjectileState {
  previewProjectile: ProjectileEntity | null;
  lastInputState: { ml: boolean };
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
      lastInputState: { ml: false },
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

  public createProjectile(
    playerId: string, 
    position: Vector3Like, 
    direction: Vector3Like,
    isPrediction: boolean = false
  ): ProjectileEntity {
    const projectile = new ProjectileEntity({
      name: 'Projectile',
      modelUri: 'models/projectiles/bomb.gltf',
      modelScale: 1.0,
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
    console.log('[PlayerProjectileManager] handleProjectileInput called for player:', playerId, 'input:', input);

    const state = this.playerStates.get(playerId);
    if (!state) {
      console.log('[PlayerProjectileManager] No state found for player:', playerId);
      player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] No state found for player: ${playerId}` });
      return;
    }

    // Check if shooting is allowed based on round state
    if (this.roundManager && !this.roundManager.isShootingAllowed()) {
      console.log('[PlayerProjectileManager] Shooting not allowed by roundManager for player:', playerId);
      player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Shooting not allowed for player: ${playerId}` });
      if (state.previewProjectile) {
        state.previewProjectile.despawn();
        state.previewProjectile = null;
      }
      return;
    }

    const currentMlState = input.ml ?? false;
    console.log('[PlayerProjectileManager] Current ml state:', currentMlState);
    player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Current ml state: ${currentMlState}` });

    const mlJustPressed = currentMlState && !state.lastInputState.ml;
    console.log('[PlayerProjectileManager] mlJustPressed flag:', mlJustPressed);
    player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] mlJustPressed: ${mlJustPressed}` });

    if (mlJustPressed) {
      const currentTime = Date.now();
      const timeSinceLastShot = currentTime - state.lastShotTime;
      console.log('[PlayerProjectileManager] Time since last shot (ms):', timeSinceLastShot);
      player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Time since last shot (ms): ${timeSinceLastShot}` });

      if (timeSinceLastShot < PlayerProjectileManager.SHOT_COOLDOWN) {
        if (player) {
          const remainingCooldown = Math.ceil((PlayerProjectileManager.SHOT_COOLDOWN - timeSinceLastShot) / 100) / 10;
          console.log('[PlayerProjectileManager] Shot is on cooldown. Remaining:', remainingCooldown, 's');
          player.ui.sendData({ 
            type: 'onCooldown',
            remainingSeconds: remainingCooldown 
          });
        }
        return;
      }

      if (state.projectilesRemaining <= 0) {
        console.log('[PlayerProjectileManager] No projectiles remaining for player:', playerId);
        player.ui.sendData({ type: 'attemptShootNoAmmo' });
        return;
      }

      console.log('[PlayerProjectileManager] Creating predicted projectile for player:', playerId);
      player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Creating predicted projectile for player: ${playerId}` });

      // Create and spawn predicted projectile immediately
      const predictedProjectile = this.createProjectile(playerId, position, direction, true);
      const predictionId = predictedProjectile.getPredictionId();

      if (predictionId) {
        // Store predicted projectile
        state.predictedProjectiles.set(predictionId, predictedProjectile);
        console.log('[PlayerProjectileManager] Predicted projectile created with predictionId:', predictionId);
        player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Predicted projectile created with predictionId: ${predictionId}` });

        // Throw the projectile immediately for responsiveness
        predictedProjectile.throw(direction);
        console.log('[PlayerProjectileManager] Projectile thrown immediately for prediction.');
        player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Projectile thrown immediately for prediction.` });

        // Update state immediately for responsiveness
        state.lastShotTime = currentTime;
        state.projectilesRemaining--;
        console.log('[PlayerProjectileManager] Updated state: projectilesRemaining =', state.projectilesRemaining, ', lastShotTime =', state.lastShotTime);
        player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Updated state: projectilesRemaining = ${state.projectilesRemaining}` });

        // Send shot data to server for validation
        player.ui.sendData({
          type: 'projectileShot',
          data: {
            position,
            direction,
            timestamp: currentTime,
            predictionId
          }
        });
        console.log('[PlayerProjectileManager] Sent shot data to server:', { position, direction, timestamp: currentTime, predictionId });
        player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Sent shot data to server with predictionId: ${predictionId}` });

        // Set timeout to clean up prediction if not confirmed
        setTimeout(() => {
          if (!predictedProjectile.isConfirmed()) {
            console.log('[PlayerProjectileManager] Prediction not confirmed, despawning projectile with predictionId:', predictionId);
            player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Prediction not confirmed, despawning projectile with predictionId: ${predictionId}` });
            predictedProjectile.despawn();
            state.predictedProjectiles.delete(predictionId);
          } else {
            console.log('[PlayerProjectileManager] Prediction confirmed for projectile with predictionId:', predictionId);
            player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Prediction confirmed for projectile with predictionId: ${predictionId}` });
          }
        }, PlayerProjectileManager.PREDICTION_TIMEOUT);

        // Play sound effect
        this.audioManager.playRandomSoundEffect(PlayerProjectileManager.PROJECTILE_SOUNDS, 0.4);
        console.log('[PlayerProjectileManager] Played projectile sound effect.');
        player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Played projectile sound effect.` });
      }
    }

    // Update last input state
    state.lastInputState = { ...input };
    console.log('[PlayerProjectileManager] Updated lastInputState for player:', playerId, state.lastInputState);
    player.ui.sendData({ type: 'debugLog', message: `[PlayerProjectileManager] Updated lastInputState for player: ${playerId}` });
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

  public handleServerConfirmation(playerId: string, data: { predictionId: string, position: Vector3Like, timestamp: number }): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    const predictedProjectile = state.predictedProjectiles.get(data.predictionId);
    if (!predictedProjectile) return;

    // Mark projectile as confirmed
    predictedProjectile.confirmPrediction();

    // If server position differs significantly, correct it
    const positionDiff = {
      x: Math.abs(predictedProjectile.position.x - data.position.x),
      y: Math.abs(predictedProjectile.position.y - data.position.y),
      z: Math.abs(predictedProjectile.position.z - data.position.z)
    };

    const POSITION_THRESHOLD = 0.5; // Threshold for position correction
    if (positionDiff.x > POSITION_THRESHOLD || 
        positionDiff.y > POSITION_THRESHOLD || 
        positionDiff.z > POSITION_THRESHOLD) {
      // Smoothly interpolate to correct position
      const LERP_FACTOR = 0.3;
      const currentPos = predictedProjectile.position;
      const interpolatedPosition = {
        x: currentPos.x + (data.position.x - currentPos.x) * LERP_FACTOR,
        y: currentPos.y + (data.position.y - currentPos.y) * LERP_FACTOR,
        z: currentPos.z + (data.position.z - currentPos.z) * LERP_FACTOR
      };
      predictedProjectile.setPosition(interpolatedPosition);
    }
  }
} 