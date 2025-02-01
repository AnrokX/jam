import { describe, test, expect, mock } from 'bun:test';
import { MovingBlockEntity } from '../moving_blocks/moving-block-entity';
import { DefaultBlockMovement } from '../moving_blocks/block-movement';
import { Vector3Like } from 'hytopia';

describe('Block Movement Behavior', () => {
  test('should normalize direction vector on initialization', () => {
    const block = new MovingBlockEntity({
      direction: { x: 2, y: 0, z: 0 }, // Non-normalized vector
      moveSpeed: 10
    });

    const direction = block.getDirection();
    expect(direction.x).toBe(1); // Should be normalized to 1
    expect(direction.y).toBe(0);
    expect(direction.z).toBe(0);
  });

  test('should handle movement calculations correctly', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    // Initialize position through setPosition
    block.setPosition({ x: 0, y: 0, z: 0 });
    
    movement.update(block, 1000); // 1 second

    expect(mockSetPosition).toHaveBeenCalledWith({
      x: 10, // moveSpeed * 1 second
      y: 0,
      z: 0
    });
  });

  test('should handle boundary checks', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10,
      movementBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 5, y: 5, z: 5 }
      }
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    // Initialize position through setPosition
    block.setPosition({ x: 0, y: 0, z: 0 });
    
    movement.update(block, 1000); // Would move to x=10, beyond bounds
    
    // Should have triggered bounds check and reversal
    expect(block.getDirection().x).toBe(-1);
  });

  test('should handle zero movement speed', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 0
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    // Initialize position through setPosition
    block.setPosition({ x: 0, y: 0, z: 0 });
    
    movement.update(block, 1000);
    
    expect(mockSetPosition).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      z: 0
    });
  });

  test('should handle diagonal movement normalization', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 1, z: 1 },
      moveSpeed: 10
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    // Initialize position through setPosition
    block.setPosition({ x: 0, y: 0, z: 0 });
    
    movement.update(block, 1000);
    
    const expectedMove = 10 / Math.sqrt(3); // Normalized movement in each direction
    expect(mockSetPosition).toHaveBeenCalledWith({
      x: expectedMove,
      y: expectedMove,
      z: expectedMove
    });
  });

  test('should handle multi-axis boundary checks', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 1, z: 1 },
      moveSpeed: 10,
      movementBounds: {
        min: { x: -5, y: 0, z: -5 },
        max: { x: 5, y: 10, z: 5 }
      }
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    // Start at edge of bounds
    block.setPosition({ x: 4.9, y: 9.9, z: 4.9 });
    
    movement.update(block, 200); // Small movement that would exceed bounds
    
    // Should have reversed all axes
    const direction = block.getDirection();
    expect(direction.x).toBe(-1);
    expect(direction.y).toBe(-1);
    expect(direction.z).toBe(-1);
  });

  test('should respect partial boundary constraints', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 1, z: 1 },
      moveSpeed: 10,
      movementBounds: {
        min: { x: -5, y: 0, z: 0 },
        max: { x: 5, y: 0, z: 0 } // Only constrained in Y and Z
      }
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    block.setPosition({ x: 0, y: 0, z: 0 });
    movement.update(block, 1000);

    // Should only move in X direction
    expect(mockSetPosition).toHaveBeenCalledWith({
      x: 10,
      y: 0,
      z: 0
    });
  });

  test('should handle epsilon boundary cases', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10,
      movementBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10.001, y: 10, z: 10 } // Slightly over 10 to test epsilon
      }
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = mock((pos: Vector3Like) => {});
    block.setPosition = mockSetPosition;

    block.setPosition({ x: 9.999, y: 0, z: 0 });
    movement.update(block, 100); // Small movement

    // Should not trigger boundary reversal due to epsilon tolerance
    expect(block.getDirection().x).toBe(1);
  });
});