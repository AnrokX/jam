import { Entity, Player, Vector3Like, World, PlayerEntity, PlayerInput } from 'hytopia';
import { PlayerProjectileManager } from '../managers/player-projectile-manager';
import { RaycastHandler } from '../raycast/raycast-handler';

interface GameWorld extends World {
    raycastHandler: RaycastHandler;
}

export interface MovementState {
  position: Vector3Like;
  velocity: Vector3Like;
  isJumping?: boolean;
  isSprinting?: boolean;
  timestamp: number;
}

export class PredictiveCharacterController {
  private static readonly MOVEMENT_SPEED = 5;
  private static readonly PREDICTION_THRESHOLD = 0.8;
  private static readonly PREDICTION_STEPS = 2;
  private static readonly LERP_FACTOR = 0.15;
  private static readonly SYNC_INTERVAL = 5000; // Sync every 5 seconds
  private static readonly VELOCITY_THRESHOLD = 0.5; // Add this constant
  private lastSyncTime: number = 0;
  private serverTimeOffset: number = 0;
  private rttHistory: number[] = [];
  private averageRTT: number = 0;
  private lastServerPosition: Vector3Like | null = null;
  private lastInputTime: number = 0;
  private pendingInputs: Array<{
    input: any,
    timestamp: number,
    position: Vector3Like,
    movement: Vector3Like
  }> = [];
  private readonly player: Player;
  private readonly entity: Entity;
  private readonly projectileManager: PlayerProjectileManager;
  private lastProcessedInput: { [key: string]: any } = {};
  private currentVelocity: Vector3Like = { x: 0, y: 0, z: 0 };
  private serverVelocity: Vector3Like = { x: 0, y: 0, z: 0 };
  
  private pendingMovements: MovementState[] = [];

  // Add entityVelocity to track the entity's velocity separately
  private entityVelocity: Vector3Like = { x: 0, y: 0, z: 0 };

  constructor(player: Player, entity: Entity, raycastHandler: RaycastHandler) {
    this.player = player;
    this.entity = entity;
    
    if (!player.world) {
      throw new Error('Player world is undefined');
    }
    
    this.projectileManager = new PlayerProjectileManager(player.world, raycastHandler);
    this.projectileManager.initializePlayer(player.id);
    
    // Initialize time sync
    this.syncTime();
    setInterval(() => this.syncTime(), PredictiveCharacterController.SYNC_INTERVAL);
  }

  private syncTime(): void {
    const clientTime = Date.now();
    this.player.ui.sendData({
      type: 'timeSync',
      data: {
        clientTime
      }
    });
  }

  private updateTimeSync(serverTime: number, originalClientTime: number): void {
    const currentTime = Date.now();
    const rtt = currentTime - originalClientTime;
    
    // Update RTT tracking
    this.rttHistory.push(rtt);
    if (this.rttHistory.length > 10) this.rttHistory.shift();
    this.averageRTT = this.rttHistory.reduce((a, b) => a + b) / this.rttHistory.length;

    // Estimate server time offset (assuming symmetric latency)
    const latency = rtt / 2;
    this.serverTimeOffset = serverTime - (currentTime - latency);
  }

  // Get current server time estimate
  private getEstimatedServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }

  tickWithPlayerInput(entity: Entity, input: PlayerInput, deltaTimeMs: number): void {
    // Use estimated server time instead of local time
    const currentTime = this.getEstimatedServerTime();
    
    // Process movement first
    const movement = this.calculateMovement(input, deltaTimeMs);
    if (movement) {
      // Apply movement immediately without waiting for prediction
      const immediatePosition = {
        x: this.entity.position.x + movement.x,
        y: this.entity.position.y + movement.y,
        z: this.entity.position.z + movement.z
      };

      // Store input for reconciliation
      this.pendingInputs.push({
        input: { ...input },
        timestamp: currentTime,
        position: immediatePosition,
        movement
      });

      // Apply movement immediately
      this.entity.setPosition(immediatePosition);
      
      // Send movement to server
      this.player.ui.sendData({
        type: 'playerMovement',
        data: {
          input: { ...input },
          timestamp: currentTime,
          position: immediatePosition,
          movement
        }
      });
    }

    // Handle mouse input for projectiles
    const mouseLeftJustPressed = input.ml && !this.lastProcessedInput.ml;
    if (mouseLeftJustPressed) {
      console.log('Mouse left clicked:', input);
      
      // Create a clean copy of the input state for projectile handling
      const predictionId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const projectileInput = {
        ml: true,  // Changed from input.ml to explicitly set true
        mr: false  // Ensure mr is false
      };

      // Handle projectile input through the manager
      this.projectileManager.handleProjectileInput(
        this.player.id,
        entity.position,
        this.player.camera.facingDirection,
        projectileInput,
        this.player
      );

      // Update UI with current projectile count after input handling
      this.player.ui.sendData({
        type: 'updateProjectileCount',
        count: this.projectileManager.getProjectilesRemaining(this.player.id)
      });
    }

    // Update last processed input state
    this.lastProcessedInput = { ...input };
    this.lastInputTime = currentTime;
  }

  private calculateMovement(input: PlayerInput, deltaTimeMs: number): Vector3Like | null {
    const deltaSeconds = deltaTimeMs / 1000;
    const speed = PredictiveCharacterController.MOVEMENT_SPEED * deltaSeconds;

    let dx = 0;
    let dz = 0;

    // Get camera direction
    const cameraDirection = this.player.camera.facingDirection;
    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
    
    // Calculate forward and right vectors based on camera angle
    const forward = {
      x: Math.sin(cameraAngle),
      z: Math.cos(cameraAngle)
    };
    // Right vector is forward vector rotated 90 degrees clockwise
    const right = {
      x: Math.cos(cameraAngle),
      z: -Math.sin(cameraAngle)
    };

    // Apply movement relative to camera direction
    if (input.w) {
      dx += forward.x;
      dz += forward.z;
    }
    if (input.s) {
      dx -= forward.x;
      dz -= forward.z;
    }
    if (input.a) {
      dx += right.x;
      dz += right.z;
    }
    if (input.d) {
      dx -= right.x;
      dz -= right.z;
    }

    // No movement
    if (dx === 0 && dz === 0) return null;

    // Normalize and apply speed
    const magnitude = Math.sqrt(dx * dx + dz * dz);
    if (magnitude !== 0) {
      dx = (dx / magnitude) * speed;
      dz = (dz / magnitude) * speed;
    }

    return { x: dx, y: 0, z: dz };
  }

  public handleServerUpdate(serverState: MovementState): void {
    // Remove processed inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.timestamp > serverState.timestamp);

    // Check if we need to correct position
    const positionError = this.calculatePositionError(serverState.position);
    if (positionError > PredictiveCharacterController.PREDICTION_THRESHOLD) {
      // Smoothly interpolate to server position
      const currentPos = this.entity.position;
      const interpolatedPosition = {
        x: currentPos.x + (serverState.position.x - currentPos.x) * PredictiveCharacterController.LERP_FACTOR,
        y: currentPos.y + (serverState.position.y - currentPos.y) * PredictiveCharacterController.LERP_FACTOR,
        z: currentPos.z + (serverState.position.z - currentPos.z) * PredictiveCharacterController.LERP_FACTOR
      };

      // Apply interpolated position
      this.entity.setPosition(interpolatedPosition);
      this.lastServerPosition = serverState.position;

      // Reapply pending inputs from the interpolated position
      let currentPosition = { ...interpolatedPosition };
      this.pendingInputs.forEach(input => {
        if (input.movement) {
          // Apply movement with prediction steps
          const predictedMovement = {
            x: input.movement.x * PredictiveCharacterController.PREDICTION_STEPS,
            y: input.movement.y * PredictiveCharacterController.PREDICTION_STEPS,
            z: input.movement.z * PredictiveCharacterController.PREDICTION_STEPS
          };
          
          currentPosition = {
            x: currentPosition.x + predictedMovement.x,
            y: currentPosition.y + predictedMovement.y,
            z: currentPosition.z + predictedMovement.z
          };
          this.entity.setPosition(currentPosition);
        }
      });
    }

    // Update our tracked velocity instead of accessing entity.velocity
    if (this.calculateVelocityError(serverState.velocity) > PredictiveCharacterController.VELOCITY_THRESHOLD) {
      this.entityVelocity = {
        x: this.entityVelocity.x + (serverState.velocity.x - this.entityVelocity.x) * PredictiveCharacterController.LERP_FACTOR,
        y: this.entityVelocity.y + (serverState.velocity.y - this.entityVelocity.y) * PredictiveCharacterController.LERP_FACTOR,
        z: this.entityVelocity.z + (serverState.velocity.z - this.entityVelocity.z) * PredictiveCharacterController.LERP_FACTOR
      };
    }
    
    // Reapply pending movements with new velocity
    this.reapplyPendingMovements(serverState);
  }

  private calculatePositionError(serverPosition: Vector3Like): number {
    const clientPos = this.entity.position;
    return Math.sqrt(
      Math.pow(clientPos.x - serverPosition.x, 2) +
      Math.pow(clientPos.y - serverPosition.y, 2) +
      Math.pow(clientPos.z - serverPosition.z, 2)
    );
  }

  private calculateVelocityError(serverVelocity: Vector3Like): number {
    return Math.sqrt(
      Math.pow(this.entityVelocity.x - serverVelocity.x, 2) +
      Math.pow(this.entityVelocity.y - serverVelocity.y, 2) +
      Math.pow(this.entityVelocity.z - serverVelocity.z, 2)
    );
  }

  private reapplyPendingMovements(serverState: MovementState): void {
    let currentPosition = { ...serverState.position };
    let currentVelocity = { ...this.entityVelocity };

    this.pendingMovements.forEach(movement => {
      // Apply movement with current velocity
      currentPosition = {
        x: currentPosition.x + currentVelocity.x,
        y: currentPosition.y + currentVelocity.y,
        z: currentPosition.z + currentVelocity.z
      };

      // Update velocity based on movement state
      if (movement.isJumping) {
        currentVelocity.y += PredictiveCharacterController.MOVEMENT_SPEED;
      }
      if (movement.isSprinting) {
        const sprintMultiplier = 1.5;
        currentVelocity.x *= sprintMultiplier;
        currentVelocity.z *= sprintMultiplier;
      }
    });

    // Apply final position
    this.entity.setPosition(currentPosition);
    this.entityVelocity = currentVelocity;
  }

  private hasMovementInputChanged(newInput: any): boolean {
    return ['forward', 'backward', 'left', 'right', 'jump', 'sprint'].some(
      key => newInput[key] !== this.lastProcessedInput[key]
    );
  }

  // Add method to get current velocity
  public getVelocity(): Vector3Like {
    return { ...this.entityVelocity };
  }
} 