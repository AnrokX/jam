import { Entity, Player, Vector3Like, World, PlayerEntity } from 'hytopia';

export class PredictiveCharacterController {
  private static readonly MOVEMENT_SPEED = 12;
  private static readonly PREDICTION_THRESHOLD = 0.8;
  private static readonly PREDICTION_STEPS = 2;
  private static readonly LERP_FACTOR = 0.15;
  private lastServerPosition: Vector3Like | null = null;
  private lastInputTime: number = 0;
  private pendingInputs: Array<{
    input: any,
    timestamp: number,
    position: Vector3Like,
    movement: Vector3Like
  }> = [];
  private readonly player: Player;
  private readonly playerEntity: PlayerEntity;

  constructor(player: Player, playerEntity: PlayerEntity) {
    this.player = player;
    this.playerEntity = playerEntity;
  }

  tickWithPlayerInput(entity: Entity, input: any, deltaTimeMs: number): void {
    const currentTime = Date.now();
    
    // Apply movement immediately for responsiveness
    const movement = this.calculateMovement(input, deltaTimeMs);
    if (movement) {
      // Apply movement immediately without waiting for prediction
      const immediatePosition = {
        x: this.playerEntity.position.x + movement.x,
        y: this.playerEntity.position.y + movement.y,
        z: this.playerEntity.position.z + movement.z
      };

      // Store input for reconciliation
      this.pendingInputs.push({
        input: { ...input },
        timestamp: currentTime,
        position: immediatePosition,
        movement
      });

      // Apply movement immediately
      this.playerEntity.setPosition(immediatePosition);
      
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

    this.lastInputTime = currentTime;
  }

  private calculateMovement(input: any, deltaTimeMs: number): Vector3Like | null {
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
    const right = {
      x: -Math.sin(cameraAngle),
      z: Math.cos(cameraAngle)
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
      dx -= right.x;
      dz -= right.z;
    }
    if (input.d) {
      dx += right.x;
      dz += right.z;
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

  public handleServerUpdate(serverPosition: Vector3Like, serverTime: number): void {
    // Remove processed inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.timestamp > serverTime);

    // Check if we need to correct position
    const positionError = this.calculatePositionError(serverPosition);
    if (positionError > PredictiveCharacterController.PREDICTION_THRESHOLD) {
      // Smoothly interpolate to server position
      const currentPos = this.playerEntity.position;
      const interpolatedPosition = {
        x: currentPos.x + (serverPosition.x - currentPos.x) * PredictiveCharacterController.LERP_FACTOR,
        y: currentPos.y + (serverPosition.y - currentPos.y) * PredictiveCharacterController.LERP_FACTOR,
        z: currentPos.z + (serverPosition.z - currentPos.z) * PredictiveCharacterController.LERP_FACTOR
      };

      // Apply interpolated position
      this.playerEntity.setPosition(interpolatedPosition);
      this.lastServerPosition = serverPosition;

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
          this.playerEntity.setPosition(currentPosition);
        }
      });
    }
  }

  private calculatePositionError(serverPosition: Vector3Like): number {
    const clientPos = this.playerEntity.position;
    return Math.sqrt(
      Math.pow(clientPos.x - serverPosition.x, 2) +
      Math.pow(clientPos.y - serverPosition.y, 2) +
      Math.pow(clientPos.z - serverPosition.z, 2)
    );
  }
} 