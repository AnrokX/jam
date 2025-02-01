import { describe, test, expect, mock } from 'bun:test';
import { MovingBlockEntity } from '../moving_blocks/moving-block-entity';
import { DefaultBlockMovement } from '../moving_blocks/block-movement';
import { World } from 'hytopia';

// Mock World class since we don't need actual world functionality for these tests
class MockWorld extends World {
  constructor() {
    super({});
  }
}

describe('Block Movement Behavior', () => {
  test('should move in the specified direction', () => {
    const world = new MockWorld();
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10,
      movementBehavior: new DefaultBlockMovement()
    });

    block.spawn(world, { x: 0, y: 0, z: 0 });
    block.onTick(block, 1000); // Simulate 1 second tick

    expect(block.position.x).toBeCloseTo(10);
    expect(block.position.y).toBeCloseTo(0);
    expect(block.position.z).toBeCloseTo(0);
  });

  test('should oscillate when hitting movement bounds', () => {
    const world = new MockWorld();
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10,
      oscillate: true,
      movementBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 5, y: 5, z: 5 }
      }
    });

    block.spawn(world, { x: 0, y: 0, z: 0 });
    
    // Move until hitting boundary
    block.onTick(block, 1000); // Should hit boundary and reverse
    
    // Direction should be reversed
    expect(block.getDirection().x).toBe(-1);
    expect(block.getDirection().y).toBe(0);
    expect(block.getDirection().z).toBe(0);
  });

  test('should reset to initial position when hitting bounds if not oscillating', () => {
    const world = new MockWorld();
    const initialPosition = { x: 0, y: 1, z: 0 };
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10,
      oscillate: false,
      movementBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 5, y: 5, z: 5 }
      }
    });

    block.spawn(world, initialPosition);
    block.onTick(block, 1000); // Move beyond bounds

    expect(block.position).toEqual(initialPosition);
  });

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

  test('should use default movement behavior if none provided', () => {
    const world = new MockWorld();
    const block = new MovingBlockEntity({});
    
    // Mock setPosition to verify it's called by movement behavior
    const setPositionMock = mock((position) => {
      block.position = position;
    });
    block.setPosition = setPositionMock;

    block.spawn(world, { x: 0, y: 0, z: 0 });
    block.onTick(block, 1000);

    expect(setPositionMock).toHaveBeenCalled();
  });

  test('should handle zero movement speed', () => {
    const world = new MockWorld();
    const block = new MovingBlockEntity({
      moveSpeed: 0,
      direction: { x: 1, y: 0, z: 0 }
    });

    const initialPosition = { x: 0, y: 0, z: 0 };
    block.spawn(world, initialPosition);
    block.onTick(block, 1000);

    expect(block.position).toEqual(initialPosition);
  });

  test('should handle diagonal movement', () => {
    const world = new MockWorld();
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 1, z: 1 }, // Diagonal direction
      moveSpeed: 10
    });

    block.spawn(world, { x: 0, y: 0, z: 0 });
    block.onTick(block, 1000);

    // Since direction is normalized, each component should move ~5.77 units (10 / √3)
    const expectedMove = 10 / Math.sqrt(3);
    expect(block.position.x).toBeCloseTo(expectedMove);
    expect(block.position.y).toBeCloseTo(expectedMove);
    expect(block.position.z).toBeCloseTo(expectedMove);
  });

  test('should handle very small time steps', () => {
    const world = new MockWorld();
    const block = new MovingBlockEntity({
      direction: { x: 1, y: 0, z: 0 },
      moveSpeed: 10
    });

    block.spawn(world, { x: 0, y: 0, z: 0 });
    block.onTick(block, 16); // Typical frame time (16ms)

    expect(block.position.x).toBeCloseTo(0.16); // 10 units/sec * 0.016 sec
    expect(block.position.y).toBe(0);
    expect(block.position.z).toBe(0);
  });
});