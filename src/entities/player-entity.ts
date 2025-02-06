import { Entity, Player, Vector3Like, World, PlayerEntity } from 'hytopia';

export class PredictiveCharacterController {
  private static readonly MOVEMENT_SPEED = 8;
  private static readonly PREDICTION_THRESHOLD = 0.5;
  private lastServerPosition: Vector3Like | null = null;
  private lastInputTime: number = 0;
  private pendingInputs: Array<{
    input: any,
    timestamp: number,
    position: Vector3Like
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
      const predictedPosition = {
        x: this.playerEntity.position.x + movement.x,
        y: this.playerEntity.position.y + movement.y,
        z: this.playerEntity.position.z + movement.z
      };

      // Store input for reconciliation
      this.pendingInputs.push({
        input: { ...input },
        timestamp: currentTime,
        position: predictedPosition
      });

      // Apply predicted movement
      this.playerEntity.setPosition(predictedPosition);
      
      // Send movement to server
      this.player.ui.sendData({
        type: 'playerMovement',
        data: {
          input: { ...input },
          timestamp: currentTime,
          position: predictedPosition
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

    if (input.w) dz -= speed;
    if (input.s) dz += speed;
    if (input.a) dx -= speed;
    if (input.d) dx += speed;

    // No movement
    if (dx === 0 && dz === 0) return null;

    // Normalize diagonal movement
    if (dx !== 0 && dz !== 0) {
      const normalizer = 1 / Math.sqrt(2);
      dx *= normalizer;
      dz *= normalizer;
    }

    return { x: dx, y: 0, z: dz };
  }

  public handleServerUpdate(serverPosition: Vector3Like, serverTime: number): void {
    // Remove processed inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.timestamp > serverTime);

    // Check if we need to correct position
    const positionError = this.calculatePositionError(serverPosition);
    if (positionError > PredictiveCharacterController.PREDICTION_THRESHOLD) {
      // Position diverged too much, reset to server position
      this.playerEntity.setPosition(serverPosition);
      this.lastServerPosition = serverPosition;

      // Reapply remaining inputs
      this.pendingInputs.forEach(input => {
        const movement = this.calculateMovement(input.input, 16); // Assume 60fps
        if (movement) {
          const newPos = {
            x: this.playerEntity.position.x + movement.x,
            y: this.playerEntity.position.y + movement.y,
            z: this.playerEntity.position.z + movement.z
          };
          this.playerEntity.setPosition(newPos);
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