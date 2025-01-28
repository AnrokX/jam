import { World, Simulation } from 'hytopia';

describe('Raycast', () => {
    let world: World;
    
    beforeEach(() => {
        world = new World({
            name: 'test-world',
            id: 1,
            skyboxUri: 'default'
        });
    });

    test('should detect when ray hits a block', () => {
        // Given: A ray origin and direction
        const origin = { x: 0, y: 0, z: 0 };
        const direction = { x: 0, y: 1, z: 0 }; // Shooting straight up
        const length = 5;

        // When: We perform the raycast
        const result = world.simulation.raycast(origin, direction, length);

        // Then: We should get hit information
        expect(result).not.toBeNull();
        if (result) {
            expect(result.hitBlock).toBeDefined();
            expect(result.hitPoint).toBeDefined();
            expect(result.hitDistance).toBeLessThanOrEqual(length);
        }
    });
}); 
