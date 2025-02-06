import { describe, test, expect, jest } from '@jest/globals';
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

  test('should handle zero movement speed', () => {
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 0
    });

    const movement = new DefaultBlockMovement();
    const mockSetPosition = jest.fn();
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
    const mockSetPosition = jest.fn();
    block.setPosition = mockSetPosition;

    // Initialize position through setPosition
    block.setPosition({ x: 0, y: 0, z: 0 });
    
    movement.update(block, 1000); // Would move to x=10, beyond bounds
    
    // Should have triggered bounds check and reversal
    expect(block.getDirection().x).toBe(-1);
  });

});