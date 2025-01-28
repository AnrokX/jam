import { World } from './mocks/hytopia';
import { Vector3 } from '../types';
import { RaycastOptions } from '../raycast/raycast-handler';

describe('Raycast System', () => {
    let world: World;
    
    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        world = new World();
        jest.spyOn(world.simulation, 'raycast');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Block Detection', () => {
        test('should detect block at exact coordinates', () => {
            const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
            world.chunkLattice.setBlock(blockPos, 1);

            const result = world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            );

            expect(result).not.toBeNull();
            expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
            expect(result?.hitDistance).toBe(1);
            expect(world.chunkLattice.getBlock(blockPos)).toBe(1);
        });

        test('should return null when no block is hit', () => {
            const result = world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            );
            expect(result).toBeNull();
        });

        test('should not detect blocks beyond max length', () => {
            const blockPos: Vector3 = { x: 0, y: 6, z: 0 };
            world.chunkLattice.setBlock(blockPos, 1);

            const result = world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            );
            expect(result).toBeNull();
            expect(world.chunkLattice.getBlock(blockPos)).toBe(1);
        });
    });

    describe('Direction Handling', () => {
        test('should normalize direction vector', () => {
            const blockPos: Vector3 = { x: 1, y: 0, z: 0 };
            world.chunkLattice.setBlock(blockPos, 1);

            const result = world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 2, y: 0, z: 0 }, // Non-normalized vector
                5
            );

            expect(result).not.toBeNull();
            expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
            expect(result?.hitDistance).toBe(1);
        });

        // TODO: Implement proper diagonal handling for throwing mechanics
        test.skip('should handle diagonal directions', () => {
            const blockPos: Vector3 = { x: 1, y: 1, z: 0 };
            world.chunkLattice.setBlock(blockPos, 1);

            const result = world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 1, z: 0 },
                5
            );

            expect(result?.hitPoint).toEqual(blockPos);
            expect(result?.hitDistance).toBeCloseTo(Math.sqrt(2));
        });
    });

    describe('Debug Visualization', () => {
        test('should handle debug visualization options', () => {
            const options: RaycastOptions = {
                debugColor: { r: 1, g: 0, b: 0 },
                debugDuration: 2000
            };

            world.simulation.enableDebugRaycasting(true);
            world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5,
                options
            );

            expect(world.simulation.isDebugRaycastingEnabled()).toBe(true);
        });

        test('should handle visualization errors gracefully', () => {
            const mockRaycast = jest.spyOn(world.simulation, 'debugRaycast')
                .mockImplementation(() => {
                    throw new Error('Visualization error');
                });

            expect(() => world.simulation.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            )).not.toThrow();

            mockRaycast.mockRestore();
        });
    });
}); 
