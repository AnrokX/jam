import { Vector3Like } from 'hytopia';
import { MovingBlockEntity } from './moving-block-entity';

export interface BlockMovementBehavior {
  update(block: MovingBlockEntity, deltaTimeMs: number): void;
}

export class DefaultBlockMovement implements BlockMovementBehavior {
  private readonly DEBUG_ENABLED = false; // Set to true only during development

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    const deltaSeconds = deltaTimeMs / 1000;
    const newPosition = {
      x: block.position.x + block.getDirection().x * block.getMoveSpeed() * deltaSeconds,
      y: block.position.y + block.getDirection().y * block.getMoveSpeed() * deltaSeconds,
      z: block.position.z + block.getDirection().z * block.getMoveSpeed() * deltaSeconds,
    };

    if (this.DEBUG_ENABLED) {
      console.debug(`[BlockMovement] New position calculated: ${JSON.stringify(newPosition)}`);
    }

    if (!block.isWithinMovementBounds(newPosition)) {
      if (block.shouldOscillate()) {
        block.reverseMovementDirection();
        if (this.DEBUG_ENABLED) {
          console.debug('[BlockMovement] Direction reversed due to boundary');
        }
      } else {
        block.resetToInitialPosition();
        if (this.DEBUG_ENABLED) {
          console.debug('[BlockMovement] Position reset to initial');
        }
        return;
      }
    }
    
    block.setPosition(newPosition);
  }
} 