import { World } from './mocks/hytopia';
import { Vector3 } from '../types';
import { RaycastOptions, RaycastHandler } from '../raycast/raycast-handler';

describe('Raycast for Block Breaking', () => {
    let world: World;
    let raycastHandler: RaycastHandler;
    
    beforeEach(() => {
        world = new World();
        raycastHandler = new RaycastHandler();
        raycastHandler.setWorld(world);
    });

    test('should initialize world components in correct order', () => {
        expect(world.simulation).toBeDefined();
        expect(world.chunkLattice).toBeDefined();
        expect(() => world.simulation.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5
        )).not.toThrow();
    });

    test('should detect a block that can be broken', () => {
        // Given: A block at position (0, 1, 0)
        const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
        raycastHandler.setBlock(blockPos, 1);

        // And: A ray pointing at that block
        const origin: Vector3 = { x: 0, y: 0, z: 0 };
        const direction: Vector3 = { x: 0, y: 1, z: 0 }; // Shooting straight up
        const length = 5;

        // When: We perform the raycast
        const result = raycastHandler.raycast(origin, direction, length);

        // Then: We should get the correct block hit information
        expect(result).not.toBeNull();
        expect(result?.hitBlock).toBeDefined();
        expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
        expect(result?.hitDistance).toBe(1); // Should be exactly 1 unit away
    });

    test('should normalize direction vector', () => {
        // Given: A non-normalized direction vector
        const direction: Vector3 = { x: 2, y: 2, z: 2 };
        const origin: Vector3 = { x: 0, y: 0, z: 0 };
        const blockPos: Vector3 = { x: 1, y: 1, z: 1 };
        raycastHandler.setBlock(blockPos, 1);

        // When: We perform the raycast
        const result = raycastHandler.raycast(origin, direction, 5);

        // Then: We should still hit the block correctly
        expect(result).not.toBeNull();
        expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
    });

    test('should handle debug visualization options', () => {
        // Given: Debug visualization options
        const options: RaycastOptions = {
            debugColor: { r: 1, g: 0, b: 0 },
            debugDuration: 2000
        };

        // When: We perform the raycast with debug options
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5,
            options
        );

        // Then: Debug visualization should be called
        expect(world.simulation.debugRaycast).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.any(Number),
            expect.objectContaining({
                debugColor: options.debugColor,
                debugDuration: options.debugDuration
            })
        );
    });

    // Tests preparing for future throwing mechanics
    test('should calculate correct hit point for angled shots', () => {
        // Given: A block at an angle
        const blockPos: Vector3 = { x: 1, y: 1, z: 0 };
        raycastHandler.setBlock(blockPos, 1);

        // When: We shoot at an angle
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 0 },
            5
        );

        // Then: Hit point should be precise
        expect(result?.hitPoint).toEqual(blockPos);
        expect(result?.hitDistance).toBeCloseTo(Math.sqrt(2)); // diagonal distance
    });

    test('should handle multiple blocks in path', () => {
        // Given: Multiple blocks in the path
        raycastHandler.setBlock({ x: 1, y: 1, z: 0 }, 1);
        raycastHandler.setBlock({ x: 2, y: 2, z: 0 }, 1);

        // When: We shoot through their path
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 0 },
            5
        );

        // Then: Should hit the first block
        expect(result?.hitBlock.globalCoordinate).toEqual({ x: 1, y: 1, z: 0 });
    });

    test('should exclude specified rigid body from raycast', () => {
        // Given: A block and a rigid body to exclude
        const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
        raycastHandler.setBlock(blockPos, 1);
        const rigidBodyToExclude = 'player-body-123';

        // When: We perform the raycast with exclusion
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5,
            { filterExcludeRigidBody: rigidBodyToExclude }
        );

        // Then: We should still hit the block
        expect(result).not.toBeNull();
        expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
    });

    test('should handle raycast options correctly', () => {
        // Given: A block and raycast options
        const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
        raycastHandler.setBlock(blockPos, 1);

        const options: RaycastOptions = {
            filterExcludeRigidBody: 'player-body-123',
            debugColor: { r: 255, g: 0, b: 0 }, // Red debug line
            debugDuration: 1000 // 1 second
        };

        // When: We perform the raycast with options
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5,
            options
        );

        // Then: We should get the correct hit information
        expect(result).not.toBeNull();
        expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
    });

    test('should return null when no block is hit', () => {
        // Given: No blocks in the path
        // When: We perform the raycast
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5
        );

        // Then: We should get null as there's no hit
        expect(result).toBeNull();
    });

    test('should not exceed maximum ray length', () => {
        // Given: A block beyond reach
        const blockPos: Vector3 = { x: 0, y: 6, z: 0 };
        raycastHandler.setBlock(blockPos, 1);

        // When: We perform the raycast with length 5
        const result = raycastHandler.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5
        );

        // Then: We should get null as the block is too far
        expect(result).toBeNull();
    });
}); 
