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
    const mockSetPosition = mock((pos: Vector3Like) => {
      block.position = pos;
    });
    
    block.position = { x: 0, y: 0, z: 0 };
    block.setPosition = mockSetPosition;

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
    const mockSetPosition = mock((pos: Vector3Like) => {
      block.position = pos;
    });
    
    block.position = { x: 0, y: 0, z: 0 };
    block.setPosition = mockSetPosition;

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
    const mockSetPosition = mock((pos: Vector3Like) => {
      block.position = pos;
    });
    
    block.position = { x: 0, y: 0, z: 0 };
    block.setPosition = mockSetPosition;

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
    const mockSetPosition = mock((pos: Vector3Like) => {
      block.position = pos;
    });
    
    block.position = { x: 0, y: 0, z: 0 };
    block.setPosition = mockSetPosition;

    movement.update(block, 1000);
    
    const expectedMove = 10 / Math.sqrt(3); // Normalized movement in each direction
    expect(mockSetPosition).toHaveBeenCalledWith({
      x: expectedMove,
      y: expectedMove,
      z: expectedMove
    });
  });
});