import { Vector3 } from '../types';
import { RaycastHandler } from './raycast-handler';

export interface PlayerInput {
    ml?: boolean;  // mouse left clicked, optional to match SDK
    mr?: boolean;  // mouse right clicked, optional to match SDK
}

export interface EntityPosition {
    position: Vector3;
    facingDirection: Vector3;
}

export class BlockInteractionHandler {
    constructor(
        private raycastHandler: RaycastHandler,
        private readonly maxReachDistance: number = 5
    ) {}

    handleInput(input: PlayerInput, entity: EntityPosition): void {
        // Early return if no input or undefined inputs
        if (!input.ml && !input.mr) return;

        console.log('Processing block interaction input:', input);
        console.log('Entity position:', entity.position);
        console.log('Entity facing direction:', entity.facingDirection);

        const raycastResult = this.raycastHandler.raycast(
            entity.position,
            entity.facingDirection,
            this.maxReachDistance,
            {
                debugColor: { r: 1, g: 0, b: 0 },  // Red for breaking
                debugDuration: 1000
            }
        );

        if (raycastResult?.hitBlock) {
            if (input.ml) {
                console.log(`Breaking block at: ${JSON.stringify(raycastResult.hitBlock.globalCoordinate)}`);
                this.raycastHandler.setBlock(raycastResult.hitBlock.globalCoordinate, 0); // 0 = air/no block
            }
        }

        // Reset inputs to prevent spam
        input.ml = false;
        input.mr = false;
    }
} 