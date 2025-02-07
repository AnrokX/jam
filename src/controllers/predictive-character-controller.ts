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

  // Base values for thresholds
  private static readonly BASE_PREDICTION_THRESHOLD = 0.8;
  private static readonly BASE_PREDICTION_STEPS = 2;
  private static readonly BASE_LERP_FACTOR = 0.15;
  
  // Extended latency breakpoints (in ms)
  private static readonly LATENCY_BREAKPOINTS = {
    EXCELLENT: 50,   // < 50ms
    GOOD: 100,       // 50-100ms
    FAIR: 200,       // 100-200ms
    POOR: 300,       // 200-300ms
    BAD: 400,        // 300-400ms
    TERRIBLE: 500    // > 400ms
  };

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
    const currentTime = this.getEstimatedServerTime();
    
    if (input.w || input.s || input.a || input.d) {
      // Calculate the movement vector first
      const moveVector = this.calculateMoveVector(input);
      
      // Apply movement directly using entity position
      const newPosition = {
        x: this.entity.position.x + moveVector.x,
        y: this.entity.position.y,
        z: this.entity.position.z + moveVector.z
      };

      // Force immediate position update
      this.entity.setPosition(newPosition);

      // Store for reconciliation
      this.pendingInputs.push({
        input: { ...input },
        timestamp: currentTime,
        position: newPosition,
        movement: moveVector
      });

      // Send to server but don't wait for response
      this.player.ui.sendData({
        type: 'playerMovement',
        data: {
          input: { ...input },
          timestamp: currentTime,
          position: newPosition,
          movement: moveVector,
          immediate: true // Flag to tell server this was already applied
        }
      });
    }
  }

  private calculateMoveVector(input: PlayerInput): Vector3Like {
    const cameraDirection = this.player.camera.facingDirection;
    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
    
    const forward = {
      x: Math.sin(cameraAngle),
      z: Math.cos(cameraAngle)
    };

    // Right vector is perpendicular to forward
    const right = {
      x: forward.z,  // Changed sign
      z: -forward.x  // Changed sign
    };

    const moveVector = { x: 0, y: 0, z: 0 };
    // Use server timestep instead of hardcoded 60fps
    const speed = PredictiveCharacterController.MOVEMENT_SPEED * (1/60); // Will match server tick rate

    if (input.w) { moveVector.x += forward.x * speed; moveVector.z += forward.z * speed; }
    if (input.s) { moveVector.x -= forward.x * speed; moveVector.z -= forward.z * speed; }
    if (input.a) { moveVector.x -= right.x * speed; moveVector.z -= right.z * speed; }
    if (input.d) { moveVector.x += right.x * speed; moveVector.z += right.z * speed; }

    // Normalize before applying speed to ensure consistent movement in all directions
    const magnitude = Math.sqrt(moveVector.x * moveVector.x + moveVector.z * moveVector.z);
    if (magnitude > 0) {
      const normalizedSpeed = speed * 1.5; // Increased speed multiplier
      moveVector.x = (moveVector.x / magnitude) * normalizedSpeed;
      moveVector.z = (moveVector.z / magnitude) * normalizedSpeed;
    }

    return moveVector;
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

  private calculatePositionError(serverPosition: Vector3Like): number {
    const clientPos = this.entity.position;
    
    // Calculate component-wise errors
    const errors = {
      x: Math.abs(clientPos.x - serverPosition.x),
      y: Math.abs(clientPos.y - serverPosition.y),
      z: Math.abs(clientPos.z - serverPosition.z)
    };

    // Get dynamic thresholds
    const thresholds = this.getDynamicThresholds();
    
    // Weight vertical errors differently (jumping/falling needs different handling)
    const verticalWeight = 1.5;
    
    // Calculate weighted error
    const weightedError = Math.sqrt(
      errors.x * errors.x +
      (errors.y * errors.y * verticalWeight) +
      errors.z * errors.z
    );

    // Log significant errors for debugging
    if (weightedError > thresholds.predictionThreshold) {
      this.player.ui.sendData({
        type: 'debugLog',
        message: `Position error detected: ${weightedError.toFixed(2)} units ` +
                `(x: ${errors.x.toFixed(2)}, y: ${errors.y.toFixed(2)}, z: ${errors.z.toFixed(2)})`
      });
    }

    return weightedError;
  }

  public handleServerUpdate(serverState: MovementState): void {
    // Remove processed inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.timestamp > serverState.timestamp);

    // Get current thresholds
    const thresholds = this.getDynamicThresholds();

    // Check if we need to correct position
    const positionError = this.calculatePositionError(serverState.position);
    if (positionError > thresholds.predictionThreshold) {
      const currentPos = this.entity.position;
      
      // Calculate error velocity (how fast we're diverging)
      const errorVelocity = {
        x: (serverState.position.x - currentPos.x) / (this.averageRTT / 1000),
        y: (serverState.position.y - currentPos.y) / (this.averageRTT / 1000),
        z: (serverState.position.z - currentPos.z) / (this.averageRTT / 1000)
      };

      // Adjust lerp factor based on error velocity
      const errorSpeed = Math.sqrt(
        errorVelocity.x * errorVelocity.x +
        errorVelocity.y * errorVelocity.y +
        errorVelocity.z * errorVelocity.z
      );
      
      // Use more aggressive correction for fast-moving errors
      const dynamicLerpFactor = Math.min(
        thresholds.lerpFactor * (1 + (errorSpeed / 10)),
        1.0 // Cap at 1.0 for stability
      );

      // Smoothly interpolate to server position with dynamic lerp
      const interpolatedPosition = {
        x: currentPos.x + (serverState.position.x - currentPos.x) * dynamicLerpFactor,
        y: currentPos.y + (serverState.position.y - currentPos.y) * dynamicLerpFactor,
        z: currentPos.z + (serverState.position.z - currentPos.z) * dynamicLerpFactor
      };

      // Apply interpolated position
      this.entity.setPosition(interpolatedPosition);
      this.lastServerPosition = serverState.position;

      // Log correction details for debugging
      this.player.ui.sendData({
        type: 'debugLog',
        message: `Correcting position with dynamic lerp: ${dynamicLerpFactor.toFixed(3)} ` +
                `(error speed: ${errorSpeed.toFixed(2)} units/s)`
      });

      // Reapply pending inputs with dynamic prediction steps
      let currentPosition = { ...interpolatedPosition };
      this.pendingInputs.forEach(input => {
        if (input.movement) {
          // Adjust prediction steps based on error magnitude
          const dynamicSteps = Math.max(
            thresholds.predictionSteps * (1 - (positionError / 10)),
            0.5 // Minimum prediction steps
          );

          const predictedMovement = {
            x: input.movement.x * dynamicSteps,
            y: input.movement.y * dynamicSteps,
            z: input.movement.z * dynamicSteps
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

  private getDynamicThresholds(): {
    predictionThreshold: number;
    predictionSteps: number;
    lerpFactor: number;
  } {
    const latency = this.averageRTT / 2; // One-way latency

    // Log latency for debugging
    this.player.ui.sendData({
      type: 'debugLog',
      message: `Current latency: ${latency}ms`
    });

    if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.TERRIBLE) {
      return {
        predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD * 2.0,
        predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS * 2.5,
        lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR * 0.3
      };
    } else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.BAD) {
      return {
        predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD * 1.75,
        predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS * 2.0,
        lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR * 0.4
      };
    } else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.POOR) {
      return {
        predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD * 1.5,
        predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS * 1.75,
        lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR * 0.5
      };
    } else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.FAIR) {
      return {
        predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD * 1.25,
        predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS * 1.5,
        lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR * 0.6
      };
    } else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.GOOD) {
      return {
        predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD * 1.1,
        predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS * 1.25,
        lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR * 0.8
      };
    } else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.EXCELLENT) {
      return {
        predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD,
        predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS,
        lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR
      };
    }
    
    // Excellent connection (< 50ms)
    return {
      predictionThreshold: PredictiveCharacterController.BASE_PREDICTION_THRESHOLD * 0.9,
      predictionSteps: PredictiveCharacterController.BASE_PREDICTION_STEPS * 0.9,
      lerpFactor: PredictiveCharacterController.BASE_LERP_FACTOR * 1.2
    };
  }

  // Add debug info method for monitoring
  private logLatencyStats(): void {
    const thresholds = this.getDynamicThresholds();
    const latency = this.averageRTT / 2;
    let connectionQuality = 'EXCELLENT';
    
    if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.TERRIBLE) connectionQuality = 'TERRIBLE';
    else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.BAD) connectionQuality = 'BAD';
    else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.POOR) connectionQuality = 'POOR';
    else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.FAIR) connectionQuality = 'FAIR';
    else if (latency > PredictiveCharacterController.LATENCY_BREAKPOINTS.GOOD) connectionQuality = 'GOOD';
    
    this.player.ui.sendData({
      type: 'debugLog',
      message: `Connection: ${connectionQuality} (${latency.toFixed(0)}ms) | ` +
               `Threshold: ${thresholds.predictionThreshold.toFixed(2)} | ` +
               `Steps: ${thresholds.predictionSteps.toFixed(2)} | ` +
               `Lerp: ${thresholds.lerpFactor.toFixed(2)}`
    });
  }
} 