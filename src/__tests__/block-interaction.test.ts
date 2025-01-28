import { BlockInteractionHandler, PlayerInput, EntityPosition } from '../raycast/block-interaction-handler';
import { World } from './mocks/hytopia';
import { Vector3, RaycastHit } from '../types';

describe('BlockInteractionHandler', () => {
    let world: World;
    let handler: BlockInteractionHandler;
    let mockEntity: EntityPosition;
    let mockInput: PlayerInput;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        world = new World();
        handler = new BlockInteractionHandler(world);
        mockEntity = {
            position: { x: 0, y: 0, z: 0 },
            facingDirection: { x: 1, y: 0, z: 0 }
        };
        mockInput = { ml: false, mr: false };
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    test('should perform raycast when input is received', () => {
        const raycastSpy = jest.spyOn(world.simulation, 'raycast').mockReturnValue({
            hitPoint: { x: 1, y: 0, z: 0 },
            hitDistance: 1,
            hitBlock: { globalCoordinate: { x: 1, y: 0, z: 0 } }
        });
        mockInput.ml = true;

        handler.handleInput(mockInput, mockEntity);

        expect(raycastSpy).toHaveBeenCalledWith(
            mockEntity.position,
            mockEntity.facingDirection,
            5,
            expect.objectContaining({
                debugColor: expect.any(Object),
                debugDuration: expect.any(Number)
            })
        );

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Raycast hit at distance:')
        );
    });

    test('should not perform raycast without input', () => {
        const raycastSpy = jest.spyOn(world.simulation, 'raycast');
        mockInput.ml = false;
        mockInput.mr = false;

        handler.handleInput(mockInput, mockEntity);

        expect(raycastSpy).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should reset input flags after handling', () => {
        mockInput.ml = true;
        mockInput.mr = true;

        handler.handleInput(mockInput, mockEntity);

        expect(mockInput.ml).toBe(false);
        expect(mockInput.mr).toBe(false);
    });

    test('should log hit information when raycast hits a block', () => {
        const mockHit = {
            hitPoint: { x: 2, y: 0, z: 0 },
            hitDistance: 2,
            hitBlock: { globalCoordinate: { x: 2, y: 0, z: 0 } }
        };
        jest.spyOn(world.simulation, 'raycast').mockReturnValue(mockHit);
        mockInput.ml = true;

        handler.handleInput(mockInput, mockEntity);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Raycast hit at distance: 2')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Hit point:')
        );
    });

    test('should log when raycast hits a block', () => {
        const mockHit = {
            hitPoint: { x: 2, y: 0, z: 0 },
            hitDistance: 2,
            hitBlock: { globalCoordinate: { x: 2, y: 0, z: 0 } }
        } as any;
        jest.spyOn(world.simulation, 'raycast').mockReturnValue(mockHit);
        mockInput.ml = true;

        handler.handleInput(mockInput, mockEntity);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Block hit detected at:')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('(2, 0, 0)')
        );
    });

    test('should log when raycast misses blocks', () => {
        const mockMiss = {
            hitPoint: { x: 2, y: 0, z: 0 },
            hitDistance: 2
        } as any;
        jest.spyOn(world.simulation, 'raycast').mockReturnValue(mockMiss);
        mockInput.ml = true;

        handler.handleInput(mockInput, mockEntity);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('No block hit')
        );
    });

    // TODO: Implement proper diagonal handling for throwing mechanics
    describe.skip('Future Throwing Mechanics', () => {
        test('should handle diagonal directions', () => {
            const blockPos: Vector3 = { x: 1, y: 1, z: 1 };
            world.chunkLattice.setBlock(blockPos, 1);
            mockEntity.facingDirection = { x: 1, y: 1, z: 1 };
            mockInput.ml = true;

            handler.handleInput(mockInput, mockEntity);

            expect(world.chunkLattice.getBlock(blockPos)).toBe(0);
        });

        test('should maintain precision with normalized directions', () => {
            const blockPos: Vector3 = { x: 1, y: 0, z: 0 };
            world.chunkLattice.setBlock(blockPos, 1);
            mockEntity.facingDirection = { x: 2, y: 0, z: 0 }; // Non-normalized
            mockInput.ml = true;

            handler.handleInput(mockInput, mockEntity);

            expect(world.chunkLattice.getBlock(blockPos)).toBe(0);
        });
    });
}); 