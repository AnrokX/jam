import { World } from './mocks/hytopia';
import { Vector3 } from '../types';
import { RaycastOptions, RaycastHandler } from '../raycast/raycast-handler';

describe('Raycast for Block Breaking', () => {
    let world: World;
    let raycastHandler: RaycastHandler;
    
    beforeEach(() => {
        // Reset environment for tests
        process.env.NODE_ENV = 'test';
        
        // Initialize world with spies
        world = new World();
        jest.spyOn(world.simulation, 'raycast');
        
        // Initialize handler
        raycastHandler = new RaycastHandler();
        raycastHandler.setWorld(world);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Block Detection', () => {
        test('should detect block at exact coordinates', () => {
            const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
            raycastHandler.setBlock(blockPos, 1);

            const result = raycastHandler.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            );

            expect(result).not.toBeNull();
            expect(result?.hitBlock.globalCoordinate).toEqual(blockPos);
            expect(result?.hitDistance).toBe(1);
        });

        test('should return null when no block is hit', () => {
            const result = raycastHandler.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            );
            expect(result).toBeNull();
        });

        test('should not detect blocks beyond max length', () => {
            const blockPos: Vector3 = { x: 0, y: 6, z: 0 };
            raycastHandler.setBlock(blockPos, 1);

            const result = raycastHandler.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            );
            expect(result).toBeNull();
        });
    });

    describe('Direction Handling', () => {
        test('should normalize direction vector', () => {
            const blockPos: Vector3 = { x: 1, y: 0, z: 0 };
            raycastHandler.setBlock(blockPos, 1);

            const result = raycastHandler.raycast(
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
            raycastHandler.setBlock(blockPos, 1);

            const result = raycastHandler.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 1, z: 0 },
                5
            );

            expect(result?.hitPoint).toEqual(blockPos);
            expect(result?.hitDistance).toBeCloseTo(Math.sqrt(2));
        });
    });

    describe('Debug Visualization', () => {
        test('should call debug visualization with correct parameters', () => {
            const options: RaycastOptions = {
                debugColor: { r: 1, g: 0, b: 0 },
                debugDuration: 2000
            };

            raycastHandler.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5,
                options
            );

            expect(world.simulation.raycast).toHaveBeenCalledWith(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5,
                expect.objectContaining({
                    debugColor: options.debugColor,
                    debugDuration: options.debugDuration
                })
            );
        });

        test('should handle visualization errors gracefully', () => {
            jest.spyOn(world.simulation, 'raycast').mockImplementation(() => {
                throw new Error('Visualization error');
            });

            expect(() => raycastHandler.raycast(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                5
            )).not.toThrow();
        });
    });
}); 
