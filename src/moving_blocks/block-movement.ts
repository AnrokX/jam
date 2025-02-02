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

export class SineWaveMovement implements BlockMovementBehavior {
  private elapsedTime: number = 0;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly baseAxis: 'x' | 'y' | 'z';
  private readonly waveAxis: 'x' | 'y' | 'z';
  private readonly initialY: number;
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
    this.initialY = 0; // Will be set on first update
    
    if (this.DEBUG_ENABLED) {
      console.log('Created SineWaveMovement with:', {
        amplitude: this.amplitude,
        frequency: this.frequency,
        baseAxis: this.baseAxis,
        waveAxis: this.waveAxis
      });
    }
  }

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    // Store initial Y position on first update
    if (this.elapsedTime === 0) {
      (this as any).initialY = block.position.y;
    }

    this.elapsedTime += deltaTimeMs / 1000;
    
    // Calculate base movement along the primary axis (usually Z)
    const baseSpeed = block.getMoveSpeed() * (deltaTimeMs / 1000);
    const baseMovement = block.getDirection()[this.baseAxis] * baseSpeed;
    
    // Calculate sine wave offset
    const waveOffset = this.amplitude * Math.sin(2 * Math.PI * this.frequency * this.elapsedTime);
    
    const newPosition = { ...block.position };
    newPosition[this.baseAxis] += baseMovement;

    // Handle wave movement differently based on axis
    if (this.waveAxis === 'y') {
      // For Y-axis, oscillate around the initial spawn height
      newPosition.y = (this as any).initialY + waveOffset;
    } else {
      // For X or Z axis waves, just apply the offset directly
      newPosition[this.waveAxis] = waveOffset;
    }

    if (this.DEBUG_ENABLED) {
      console.log('SineWave Update:', {
        elapsedTime: this.elapsedTime.toFixed(2),
        baseMovement: baseMovement.toFixed(2),
        waveOffset: waveOffset.toFixed(2),
        initialY: (this as any).initialY,
        newPos: {
          x: newPosition.x.toFixed(2),
          y: newPosition.y.toFixed(2),
          z: newPosition.z.toFixed(2)
        }
      });
    }

    if (!block.isWithinMovementBounds(newPosition)) {
      if (block.shouldOscillate()) {
        block.reverseMovementDirection();
        // Adjust elapsed time to maintain smooth wave pattern when reversing
        this.elapsedTime = Math.PI / (2 * Math.PI * this.frequency) - this.elapsedTime;
        if (this.DEBUG_ENABLED) {
          console.log('Reversing direction, new elapsed time:', this.elapsedTime);
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