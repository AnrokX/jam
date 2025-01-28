import { BlockInteractionHandler, PlayerInput, EntityPosition } from '../raycast/block-interaction-handler';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3 } from '../types';

describe('BlockInteractionHandler', () => {
    let blockInteractionHandler: BlockInteractionHandler;
    let raycastHandler: RaycastHandler;
    let input: PlayerInput;
    let entity: EntityPosition;

    beforeEach(() => {
        // Reset environment for tests
        process.env.NODE_ENV = 'test';
        
        raycastHandler = new RaycastHandler();
        blockInteractionHandler = new BlockInteractionHandler(raycastHandler);
        
        input = { ml: false, mr: false };
        entity = {
            position: { x: 0, y: 0, z: 0 },
            facingDirection: { x: 0, y: 1, z: 0 }
        };
    });

    describe('Block Breaking', () => {
        test('should break block on left click when in range', () => {
            const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
            raycastHandler.setBlock(blockPos, 1);
            input.ml = true;

            blockInteractionHandler.handleInput(input, entity);

            const raycastResult = raycastHandler.raycast(entity.position, entity.facingDirection, 5);
            expect(raycastResult).toBeNull(); // Block should be gone
            expect(input.ml).toBeFalsy();
        });

        test('should not affect blocks beyond reach distance', () => {
            const blockPos: Vector3 = { x: 0, y: 6, z: 0 };
            raycastHandler.setBlock(blockPos, 1);
            input.ml = true;

            blockInteractionHandler.handleInput(input, entity);

            const raycastResult = raycastHandler.raycast(
                entity.position,
                entity.facingDirection,
                10
            );
            expect(raycastResult?.hitBlock.globalCoordinate).toEqual(blockPos);
            expect(input.ml).toBeFalsy();
        });
    });

    describe('Input Handling', () => {
        test('should handle undefined inputs gracefully', () => {
            const undefinedInput: PlayerInput = {};
            blockInteractionHandler.handleInput(undefinedInput, entity);
            expect(undefinedInput.ml).toBeUndefined();
            expect(undefinedInput.mr).toBeUndefined();
        });

        test('should reset inputs after handling', () => {
            input.ml = true;
            input.mr = true;
            blockInteractionHandler.handleInput(input, entity);
            expect(input.ml).toBeFalsy();
            expect(input.mr).toBeFalsy();
        });

        test('should handle errors gracefully', () => {
            jest.spyOn(raycastHandler, 'raycast').mockImplementation(() => {
                throw new Error('Test error');
            });

            input.ml = true;
            expect(() => {
                blockInteractionHandler.handleInput(input, entity);
            }).not.toThrow();
            expect(input.ml).toBeFalsy();
        });
    });

    // TODO: Implement proper diagonal handling for throwing mechanics
    describe.skip('Future Throwing Mechanics', () => {
        test('should handle diagonal directions', () => {
            const blockPos: Vector3 = { x: 1, y: 1, z: 1 };
            raycastHandler.setBlock(blockPos, 1);
            entity.facingDirection = { x: 1, y: 1, z: 1 };
            input.ml = true;

            blockInteractionHandler.handleInput(input, entity);

            const raycastResult = raycastHandler.raycast(
                entity.position,
                entity.facingDirection,
                10
            );
            expect(raycastResult?.hitBlock.globalCoordinate).toEqual(blockPos);
        });

        test('should maintain precision with normalized directions', () => {
            const blockPos: Vector3 = { x: 1, y: 0, z: 0 };
            raycastHandler.setBlock(blockPos, 1);
            entity.facingDirection = { x: 2, y: 0, z: 0 }; // Non-normalized
            input.ml = true;

            blockInteractionHandler.handleInput(input, entity);

            const raycastResult = raycastHandler.raycast(
                entity.position,
                { x: 1, y: 0, z: 0 },
                5
            );
            expect(raycastResult?.hitBlock.globalCoordinate).toEqual(blockPos);
        });
    });
}); 