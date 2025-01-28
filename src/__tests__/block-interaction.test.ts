import { BlockInteractionHandler, PlayerInput, EntityPosition } from '../raycast/block-interaction-handler';
import { RaycastHandler } from '../raycast/raycast-handler';
import { Vector3 } from '../types';

describe('BlockInteractionHandler', () => {
    let blockInteractionHandler: BlockInteractionHandler;
    let raycastHandler: RaycastHandler;
    let input: PlayerInput;
    let entity: EntityPosition;

    beforeEach(() => {
        raycastHandler = new RaycastHandler();
        blockInteractionHandler = new BlockInteractionHandler(raycastHandler);
        input = { ml: false, mr: false };
        entity = {
            position: { x: 0, y: 0, z: 0 },
            facingDirection: { x: 0, y: 1, z: 0 }
        };
    });

    describe('Block Breaking', () => {
        test('should break block on left click when block is hit', () => {
            // Given: A block at position (0, 1, 0)
            const blockPos: Vector3 = { x: 0, y: 1, z: 0 };
            raycastHandler.setBlock(blockPos, 1);

            // And: Player left clicks while looking at the block
            input.ml = true;

            // When: We handle the input
            blockInteractionHandler.handleInput(input, entity);

            // Then: The block should be removed (set to 0)
            const raycastResult = raycastHandler.raycast(entity.position, entity.facingDirection, 5);
            expect(raycastResult).toBeNull(); // Block should be gone
            expect(input.ml).toBeFalsy(); // Input should be reset
        });

        test('should not break block when no block is hit', () => {
            // Given: No blocks in the world
            // And: Player left clicks
            input.ml = true;

            // When: We handle the input
            blockInteractionHandler.handleInput(input, entity);

            // Then: Nothing should happen (no errors)
            expect(input.ml).toBeFalsy(); // Input should be reset
        });

        test('should not break block beyond reach distance', () => {
            // Given: A block beyond reach
            const blockPos: Vector3 = { x: 0, y: 6, z: 0 };
            raycastHandler.setBlock(blockPos, 1);

            // And: Player left clicks
            input.ml = true;

            // When: We handle the input
            blockInteractionHandler.handleInput(input, entity);

            // Then: The block should still exist
            const raycastResult = raycastHandler.raycast(
                entity.position,
                entity.facingDirection,
                10 // Use longer distance to check if block exists
            );
            expect(raycastResult?.hitBlock.globalCoordinate).toEqual(blockPos);
            expect(input.ml).toBeFalsy(); // Input should be reset
        });
    });

    describe('Input Handling', () => {
        test('should handle undefined inputs gracefully', () => {
            // Given: Undefined inputs
            const undefinedInput: PlayerInput = {};
            
            // When: We handle the input
            blockInteractionHandler.handleInput(undefinedInput, entity);
            
            // Then: No errors should occur
            expect(undefinedInput.ml).toBeUndefined();
            expect(undefinedInput.mr).toBeUndefined();
        });

        test('should reset both inputs after handling', () => {
            // Given: Both inputs are true
            input.ml = true;
            input.mr = true;

            // When: We handle the input
            blockInteractionHandler.handleInput(input, entity);

            // Then: Both inputs should be reset
            expect(input.ml).toBeFalsy();
            expect(input.mr).toBeFalsy();
        });
    });

    describe('Future Throwing Mechanics Preparation', () => {
        test('should handle diagonal facing directions', () => {
            // Given: A block at diagonal position
            const blockPos: Vector3 = { x: 1, y: 1, z: 1 };
            raycastHandler.setBlock(blockPos, 1);

            // And: Player facing diagonally
            entity.facingDirection = { x: 1, y: 1, z: 1 };
            input.ml = true;

            // When: We handle the input
            blockInteractionHandler.handleInput(input, entity);

            // Then: Should still work correctly
            const raycastResult = raycastHandler.raycast(
                entity.position,
                entity.facingDirection,
                10
            );
            expect(raycastResult?.hitBlock.globalCoordinate).toEqual(blockPos);
        });

        test('should maintain precision with normalized directions', () => {
            // Given: A block and non-normalized facing direction
            const blockPos: Vector3 = { x: 1, y: 0, z: 0 };
            raycastHandler.setBlock(blockPos, 1);
            entity.facingDirection = { x: 2, y: 0, z: 0 }; // Non-normalized
            input.ml = true;

            // When: We handle the input
            blockInteractionHandler.handleInput(input, entity);

            // Then: Should still hit the block correctly
            const raycastResult = raycastHandler.raycast(
                entity.position,
                { x: 1, y: 0, z: 0 }, // Normalized for checking
                5
            );
            expect(raycastResult?.hitBlock.globalCoordinate).toEqual(blockPos);
        });
    });
}); 