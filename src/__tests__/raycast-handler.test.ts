import { World } from './mocks/hytopia';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3Like } from 'hytopia';

describe('RaycastHandler', () => {
    let world: World;
    let handler: RaycastHandler;
    let consoleSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        world = new World();
        handler = new RaycastHandler(world);
        // Enable debug mode for testing
        handler.enableDebugRaycasting(true);
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    test('should handle raycast with no hits', () => {
        const origin = { x: 0, y: 0, z: 0 } as Vector3Like;
        const direction = { x: 1, y: 0, z: 0 } as Vector3Like;
        const length = 5;

        const result = handler.raycast(origin, direction, length);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No hit detected'));
    });

    test('should detect block hits', () => {
        const origin = { x: 0, y: 0, z: 0 } as Vector3Like;
        const direction = { x: 1, y: 0, z: 0 } as Vector3Like;
        const length = 5;

        // Add a test block at x=3
        world.simulation.addTestBlock(3, 0, 0);

        const result = handler.raycast(origin, direction, length);

        expect(result).not.toBeNull();
        expect(result?.hitBlock).toBeDefined();
        expect(result?.hitBlock?.globalCoordinate.x).toBe(3);
        expect(result?.hitDistance).toBeLessThan(length);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hit detected'));
    });

    test('should handle debug visualization settings', () => {
        handler.enableDebugRaycasting(true);
        expect(handler.isDebugRaycastingEnabled()).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith('Enabling debug raycasting');

        handler.enableDebugRaycasting(false);
        expect(handler.isDebugRaycastingEnabled()).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith('Disabling debug raycasting');
    });

    test('should handle invalid inputs', () => {
        const result = handler.raycast(
            null as unknown as Vector3Like,
            { x: 1, y: 0, z: 0 } as Vector3Like,
            5
        );

        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid raycast parameters'));
    });

    test('should handle zero direction vector', () => {
        const origin = { x: 0, y: 0, z: 0 } as Vector3Like;
        const zeroDirection = { x: 0, y: 0, z: 0 } as Vector3Like;
        
        const result = handler.raycast(origin, zeroDirection, 5);
        
        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid raycast parameters: zero direction vector'));
    });

    test('should work with non-normalized direction vectors', () => {
        const origin = { x: 0, y: 0, z: 0 } as Vector3Like;
        const nonNormalizedDir = { x: 2, y: 0, z: 0 } as Vector3Like;
        const length = 5;

        world.simulation.addTestBlock(3, 0, 0);
        const result = handler.raycast(origin, nonNormalizedDir, length);

        expect(result).not.toBeNull();
        expect(result?.hitBlock).toBeDefined();
        expect(result?.hitBlock?.globalCoordinate.x).toBe(3);
        expect(result?.hitDistance).toBeLessThan(length);
    });
}); 