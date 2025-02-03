import { Vector3Like } from 'hytopia';
import { MovingBlockEntity } from './moving-block-entity';

export interface BlockMovementBehavior {
  update(block: MovingBlockEntity, deltaTimeMs: number): void;
}

export class DefaultBlockMovement implements BlockMovementBehavior {
  private readonly DEBUG_ENABLED = false; // Set to true only during development

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    const deltaSeconds = deltaTimeMs / 1000;
    let newPosition = {
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
        newPosition = {
          x: block.position.x + block.getDirection().x * block.getMoveSpeed() * deltaSeconds,
          y: block.position.y + block.getDirection().y * block.getMoveSpeed() * deltaSeconds,
          z: block.position.z + block.getDirection().z * block.getMoveSpeed() * deltaSeconds,
        };
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

export class SineWaveMovement implements BlockMovementBehavior {
  private elapsedTime: number = 0;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly baseAxis: 'x' | 'y' | 'z';
  private readonly waveAxis: 'x' | 'y' | 'z';
  private initialY: number = 0; // Will be set on first update
  private readonly DEBUG_ENABLED = false;

  constructor(options: {
    amplitude?: number;
    frequency?: number;
    baseAxis?: 'x' | 'y' | 'z';
    waveAxis?: 'x' | 'y' | 'z';
  } = {}) {
    this.amplitude = options.amplitude ?? 3;
    this.frequency = options.frequency ?? 1;
    this.baseAxis = options.baseAxis ?? 'z';
    this.waveAxis = options.waveAxis ?? 'x';
    // initialY is set on first update
    if (this.DEBUG_ENABLED) {
      console.log('Created SineWaveMovement with:', {
        amplitude: this.amplitude,
        frequency: this.frequency,
        baseAxis: this.baseAxis,
        waveAxis: this.waveAxis
      });
    }
  }

  /**
   * Optionally clamps the position to be safely within the bounds.
   * If an axis is fixed (min === max) then it returns that fixed value.
   */
  private clampPosition(pos: Vector3Like, bounds: { min: Vector3Like; max: Vector3Like }): Vector3Like {
    const epsilon = 0.001;
    return {
      x: bounds.min.x === bounds.max.x ? bounds.min.x : Math.max(bounds.min.x + epsilon, Math.min(pos.x, bounds.max.x - epsilon)),
      y: bounds.min.y === bounds.max.y ? bounds.min.y : Math.max(bounds.min.y + epsilon, Math.min(pos.y, bounds.max.y - epsilon)),
      z: bounds.min.z === bounds.max.z ? bounds.min.z : Math.max(bounds.min.z + epsilon, Math.min(pos.z, bounds.max.z - epsilon))
    };
  }

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    // Set initialY on first update.
    if (this.elapsedTime === 0) {
      this.initialY = block.position.y;
    }
    this.elapsedTime += deltaTimeMs / 1000;

    const baseSpeed = block.getMoveSpeed() * (deltaTimeMs / 1000);
    const baseMovement = block.getDirection()[this.baseAxis] * baseSpeed;
    const waveOffset = this.amplitude * Math.sin(2 * Math.PI * this.frequency * this.elapsedTime);

    let newPosition = { ...block.position };
    newPosition[this.baseAxis] += baseMovement;

    // Apply wave offset on the proper axis
    if (this.waveAxis === 'y') {
      newPosition.y = this.initialY + waveOffset;
    } else {
      newPosition[this.waveAxis] = waveOffset;
    }

    if (this.DEBUG_ENABLED) {
      console.log('SineWave Update:', {
        elapsedTime: this.elapsedTime.toFixed(2),
        baseMovement: baseMovement.toFixed(2),
        waveOffset: waveOffset.toFixed(2),
        initialY: this.initialY,
        newPos: {
          x: newPosition.x.toFixed(2),
          y: newPosition.y.toFixed(2),
          z: newPosition.z.toFixed(2)
        }
      });
    }

    if (!block.isWithinMovementBounds(newPosition)) {
      if (block.shouldOscillate()) {
        // Reverse the movement direction.
        block.reverseMovementDirection();

        // Adjust elapsed time to try to maintain a smooth wave pattern.
        this.elapsedTime = Math.PI / (2 * Math.PI * this.frequency) - this.elapsedTime;
        if (this.DEBUG_ENABLED) {
          console.log('Reversing direction, new elapsed time:', this.elapsedTime);
        }
        // Recalculate after reversal.
        const reversedBaseSpeed = block.getMoveSpeed() * (deltaTimeMs / 1000);
        const reversedBaseMovement = block.getDirection()[this.baseAxis] * reversedBaseSpeed;
        newPosition = { ...block.position };
        newPosition[this.baseAxis] += reversedBaseMovement;
        if (this.waveAxis === 'y') {
          newPosition.y = this.initialY + waveOffset;
        } else {
          newPosition[this.waveAxis] = waveOffset;
        }
        // Clamp the newPosition into valid bounds.
        if (block['movementBounds']) {
          newPosition = this.clampPosition(newPosition, (block as any)['movementBounds']);
        }
      } else {
        block.resetToInitialPosition();
        this.elapsedTime = 0;
        if (this.DEBUG_ENABLED) {
          console.log('Reset to initial position');
        }
        return;
      }
    }

    block.setPosition(newPosition);
  }
}

export class StaticMovement implements BlockMovementBehavior {
  private readonly DEBUG_ENABLED = false;

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    // Static blocks don't move, but we still need to check if they're within bounds
    if (!block.isWithinMovementBounds(block.position)) {
      block.resetToInitialPosition();
      if (this.DEBUG_ENABLED) {
        console.debug('[StaticMovement] Position reset to initial');
      }
    }
  }
} 