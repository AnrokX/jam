import { BlockMovementBehavior } from 'hytopia';
import { MovingBlockEntity } from './moving-block-entity';
import { Vector3Like } from 'hytopia';

export interface BlockMovementBehavior {
  update(block: MovingBlockEntity, deltaTimeMs: number): void;
}

export class DefaultBlockMovement implements BlockMovementBehavior {
  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    const deltaSeconds = deltaTimeMs / 1000;
    const newPosition = {
      x: block.position.x + block.getDirection().x * block.getMoveSpeed() * deltaSeconds,
      y: block.position.y + block.getDirection().y * block.getMoveSpeed() * deltaSeconds,
      z: block.position.z + block.getDirection().z * block.getMoveSpeed() * deltaSeconds,
    };

    // Check bounds via block method (using the block's internal configuration)
    if (!block.isWithinMovementBounds(newPosition)) {
      if (block.shouldOscillate()) {
        block.reverseMovementDirection();
      } else {
        block.resetToInitialPosition();
        return;
      }
    }
    block.setPosition(newPosition);
  }
} 