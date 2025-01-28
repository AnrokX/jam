import { World, Simulation } from './mocks/hytopia';

describe('Raycast for Block Breaking', () => {
    let world: World;
    
    beforeEach(() => {
        world = new World({
            name: 'test-world',
            id: 1,
            skyboxUri: 'default'
        });
    });

    test('should detect a block that can be broken', () => {
        // Given: A block at position (0, 1, 0)
        world.chunkLattice.setBlock({ x: 0, y: 1, z: 0 }, 1); // Place a block

        // And: A ray pointing at that block
        const origin = { x: 0, y: 0, z: 0 };
        const direction = { x: 0, y: 1, z: 0 }; // Shooting straight up
        const length = 5;

        // When: We perform the raycast
        const result = world.simulation.raycast(origin, direction, length);

        // Then: We should get the correct block hit information
        expect(result).not.toBeNull();
        expect(result?.hitBlock).toBeDefined();
        expect(result?.hitBlock.globalCoordinate).toEqual({ x: 0, y: 1, z: 0 });
        expect(result?.hitDistance).toBe(1); // Should be exactly 1 unit away
    });

    test('should return null when no block is hit', () => {
        // Given: No blocks in the path
        // When: We perform the raycast
        const result = world.simulation.raycast(
            { x: 0, y: 0, z: 0 }, // origin
            { x: 0, y: 1, z: 0 }, // direction
            5 // length
        );

        // Then: We should get null as there's no hit
        expect(result).toBeNull();
    });

    test('should not exceed maximum ray length', () => {
        // Given: A block beyond the ray length
        world.chunkLattice.setBlock({ x: 0, y: 6, z: 0 }, 1);

        // When: We perform the raycast with length 5
        const result = world.simulation.raycast(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            5
        );

        // Then: We should get null as the block is too far
        expect(result).toBeNull();
    });
}); 
