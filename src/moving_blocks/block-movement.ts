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

    console.debug(`[BlockMovement] Calculating new position:
      Current: ${JSON.stringify(block.position)}
      Delta: ${deltaSeconds}s
      New: ${JSON.stringify(newPosition)}
      ${block.getDebugInfo()}`);

    console.debug(`[BlockMovement] Boundary check:
      Position: ${JSON.stringify(newPosition)}
      Bounds: ${JSON.stringify(block.movementBounds)}
      Within bounds: ${block.isWithinMovementBounds(newPosition)}
      Current direction: ${JSON.stringify(block.getDirection())}
    `);

    if (!block.isWithinMovementBounds(newPosition)) {
      console.debug(`[BlockMovement] Block out of bounds, handling...
        Oscillate: ${block.shouldOscillate()}`);
      
      if (block.shouldOscillate()) {
        block.reverseMovementDirection();
        console.debug('[BlockMovement] Direction reversed');
      } else {
        block.resetToInitialPosition();
        console.debug('[BlockMovement] Position reset to initial');
        return;
      }
    }
    
    block.setPosition(newPosition);
  }
} 