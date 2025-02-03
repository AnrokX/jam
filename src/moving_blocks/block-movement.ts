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

export class PopUpMovement implements BlockMovementBehavior {
  private elapsedTime: number = 0;
  private state: 'rising' | 'paused' | 'falling' | 'complete' = 'rising';
  private readonly DEBUG_ENABLED = false;
  private readonly pauseDuration: number = 3000; // 3 seconds pause at top
  private readonly startY: number;
  private readonly topY: number;
  private pauseStartTime: number = 0;

  constructor(options: {
    startY?: number;
    topY?: number;
    pauseDuration?: number;
  } = {}) {
    this.startY = options.startY ?? -20;
    this.topY = options.topY ?? 8;
    this.pauseDuration = options.pauseDuration ?? 3000;
    
    if (this.DEBUG_ENABLED) {
      console.log('Created PopUpMovement with:', {
        startY: this.startY,
        topY: this.topY,
        pauseDuration: this.pauseDuration
      });
    }
  }

  // Getters for movement state
  public get currentState(): 'rising' | 'paused' | 'falling' | 'complete' {
    return this.state;
  }

  public get isComplete(): boolean {
    return this.state === 'complete';
  }

  public get isPaused(): boolean {
    return this.state === 'paused';
  }

  public get timeRemainingInPause(): number {
    if (this.state !== 'paused') return 0;
    return Math.max(0, this.pauseDuration - (this.elapsedTime - this.pauseStartTime));
  }

  public get totalElapsedTime(): number {
    return this.elapsedTime;
  }

  // Helper methods for state management
  private transitionToState(newState: 'rising' | 'paused' | 'falling' | 'complete'): void {
    if (this.DEBUG_ENABLED) {
      console.log(`State transition: ${this.state} -> ${newState}`);
    }
    
    this.state = newState;
    if (newState === 'paused') {
      this.pauseStartTime = this.elapsedTime;
    }
  }

  private shouldTransitionFromPaused(): boolean {
    return this.elapsedTime - this.pauseStartTime >= this.pauseDuration;
  }

  private calculateNewPosition(currentPosition: Vector3Like, deltaSeconds: number, speed: number): Vector3Like {
    const newPosition = { ...currentPosition };
    
    switch (this.state) {
      case 'rising':
        newPosition.y += speed * 2 * deltaSeconds;
        if (newPosition.y >= this.topY) {
          newPosition.y = this.topY;
          this.transitionToState('paused');
        }
        break;
        
      case 'falling':
        newPosition.y -= speed * 2 * deltaSeconds;
        if (newPosition.y <= this.startY) {
          newPosition.y = this.startY;
          this.transitionToState('complete');
        }
        break;
    }
    
    return newPosition;
  }

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    this.elapsedTime += deltaTimeMs;
    const deltaSeconds = deltaTimeMs / 1000;
    const speed = block.getMoveSpeed();
    
    if (this.state === 'complete') {
      if (block.isSpawned) {
        block.despawn();
      }
      return;
    }

    if (this.state === 'paused' && this.shouldTransitionFromPaused()) {
      this.transitionToState('falling');
    }

    const newPosition = this.calculateNewPosition(block.position, deltaSeconds, speed);

    if (this.DEBUG_ENABLED) {
      console.log('PopUpMovement Update:', {
        state: this.state,
        elapsedTime: this.elapsedTime.toFixed(2),
        position: newPosition,
        timeInPause: this.timeRemainingInPause
      });
    }

    block.setPosition(newPosition);
  }
}

export class RisingMovement implements BlockMovementBehavior {
  private elapsedTime: number = 0;
  private state: 'rising' | 'paused' | 'shooting' | 'complete' = 'rising';
  private readonly DEBUG_ENABLED = false;
  private readonly pauseDuration: number = 2000; // 2 seconds pause at first stop
  private readonly startY: number;
  private readonly firstStopY: number;
  private readonly finalY: number;
  private pauseStartTime: number = 0;

  constructor(options: {
    startY?: number;
    firstStopY?: number;
    finalY?: number;
    pauseDuration?: number;
  } = {}) {
    this.startY = options.startY ?? -20;
    this.firstStopY = options.firstStopY ?? 8; // Same height as pop-up target
    this.finalY = options.finalY ?? 30; // Much higher final position
    this.pauseDuration = options.pauseDuration ?? 2000;
    
    if (this.DEBUG_ENABLED) {
      console.log('Created RisingMovement with:', {
        startY: this.startY,
        firstStopY: this.firstStopY,
        finalY: this.finalY,
        pauseDuration: this.pauseDuration
      });
    }
  }

  // Getters for movement state
  public get currentState(): 'rising' | 'paused' | 'shooting' | 'complete' {
    return this.state;
  }

  public get isComplete(): boolean {
    return this.state === 'complete';
  }

  public get isPaused(): boolean {
    return this.state === 'paused';
  }

  public get isShooting(): boolean {
    return this.state === 'shooting';
  }

  public get timeRemainingInPause(): number {
    if (this.state !== 'paused') return 0;
    return Math.max(0, this.pauseDuration - (this.elapsedTime - this.pauseStartTime));
  }

  public get totalElapsedTime(): number {
    return this.elapsedTime;
  }

  // Helper methods for state management
  private transitionToState(newState: 'rising' | 'paused' | 'shooting' | 'complete'): void {
    if (this.DEBUG_ENABLED) {
      console.log(`State transition: ${this.state} -> ${newState}`);
    }
    
    this.state = newState;
    if (newState === 'paused') {
      this.pauseStartTime = this.elapsedTime;
    }
  }

  private shouldTransitionFromPaused(): boolean {
    return this.elapsedTime - this.pauseStartTime >= this.pauseDuration;
  }

  private calculateNewPosition(currentPosition: Vector3Like, deltaSeconds: number, speed: number): Vector3Like {
    const newPosition = { ...currentPosition };
    
    switch (this.state) {
      case 'rising':
        newPosition.y += speed * 2 * deltaSeconds; // Double speed for initial rise
        if (newPosition.y >= this.firstStopY) {
          newPosition.y = this.firstStopY;
          this.transitionToState('paused');
        }
        break;

      case 'shooting':
        newPosition.y += speed * 4 * deltaSeconds; // Quadruple speed for final ascent
        if (newPosition.y >= this.finalY) {
          newPosition.y = this.finalY;
          this.transitionToState('complete');
        }
        break;
    }
    
    return newPosition;
  }

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    this.elapsedTime += deltaTimeMs;
    const deltaSeconds = deltaTimeMs / 1000;
    const speed = block.getMoveSpeed();
    
    if (this.state === 'complete') {
      if (block.isSpawned) {
        block.despawn();
      }
      return;
    }

    if (this.state === 'paused' && this.shouldTransitionFromPaused()) {
      this.transitionToState('shooting');
    }

    const newPosition = this.calculateNewPosition(block.position, deltaSeconds, speed);

    if (this.DEBUG_ENABLED) {
      console.log('RisingMovement Update:', {
        state: this.state,
        elapsedTime: this.elapsedTime.toFixed(2),
        position: newPosition,
        timeInPause: this.timeRemainingInPause
      });
    }

    block.setPosition(newPosition);
  }
}

export class ParabolicMovement implements BlockMovementBehavior {
  private elapsedTime: number = 0;
  private readonly DEBUG_ENABLED = false;
  private readonly startPoint: Vector3Like;
  private readonly endPoint: Vector3Like;
  private readonly totalDuration: number;
  private readonly maxHeight: number;
  private readonly gravity: number;
  private readonly initialVelocityY: number;
  private readonly horizontalSpeed: number;

  constructor(options: {
    startPoint?: Vector3Like;
    endPoint?: Vector3Like;
    maxHeight?: number;
    duration?: number;
  } = {}) {
    this.startPoint = options.startPoint ?? { x: 0, y: -20, z: 0 };
    this.endPoint = options.endPoint ?? { x: 0, y: -20, z: 20 };
    this.maxHeight = options.maxHeight ?? 15;
    this.totalDuration = options.duration ?? 5000; // 5 seconds total

    // Calculate physics parameters
    this.gravity = 2 * (this.maxHeight - this.startPoint.y) / Math.pow(this.totalDuration / 4000, 2);
    this.initialVelocityY = Math.sqrt(2 * this.gravity * (this.maxHeight - this.startPoint.y));
    
    // Calculate horizontal speed based on total distance and time
    const horizontalDistance = Math.sqrt(
      Math.pow(this.endPoint.x - this.startPoint.x, 2) +
      Math.pow(this.endPoint.z - this.startPoint.z, 2)
    );
    this.horizontalSpeed = horizontalDistance / (this.totalDuration / 1000);

    if (this.DEBUG_ENABLED) {
      console.log('Created ParabolicMovement with:', {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        maxHeight: this.maxHeight,
        duration: this.totalDuration,
        gravity: this.gravity,
        initialVelocityY: this.initialVelocityY,
        horizontalSpeed: this.horizontalSpeed
      });
    }
  }

  private calculatePosition(time: number): Vector3Like {
    // Time in seconds
    const t = time / 1000;
    
    // Calculate progress through the motion (0 to 1)
    const progress = Math.min(t / (this.totalDuration / 1000), 1);
    
    // Calculate vertical position using physics equations
    const verticalTime = t;
    const y = this.startPoint.y + 
              (this.initialVelocityY * verticalTime) - 
              (0.5 * this.gravity * verticalTime * verticalTime);
    
    // Calculate horizontal position with linear interpolation
    const x = this.startPoint.x + (this.endPoint.x - this.startPoint.x) * progress;
    const z = this.startPoint.z + (this.endPoint.z - this.startPoint.z) * progress;

    return { x, y, z };
  }

  update(block: MovingBlockEntity, deltaTimeMs: number): void {
    this.elapsedTime += deltaTimeMs;
    
    // Check if the movement is complete
    if (this.elapsedTime >= this.totalDuration) {
      if (block.isSpawned) {
        block.despawn();
      }
      return;
    }

    const newPosition = this.calculatePosition(this.elapsedTime);

    if (this.DEBUG_ENABLED) {
      console.log('ParabolicMovement Update:', {
        elapsedTime: this.elapsedTime.toFixed(2),
        position: newPosition,
        progress: (this.elapsedTime / this.totalDuration * 100).toFixed(1) + '%'
      });
    }

    block.setPosition(newPosition);
  }
} 