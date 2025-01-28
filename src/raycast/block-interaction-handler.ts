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
    private isDebugMode: boolean = false;

    constructor(
        private raycastHandler: RaycastHandler,
        private readonly maxReachDistance: number = 5
    ) {
        this.isDebugMode = process.env.NODE_ENV === 'development';
    }

    handleInput(input: PlayerInput, entity: EntityPosition): void {
        // Early return if no input or undefined inputs
        if (!input.ml && !input.mr) return;

        try {
            const raycastResult = this.raycastHandler.raycast(
                entity.position,
                entity.facingDirection,
                this.maxReachDistance,
                {
                    debugColor: { r: 1, g: 0, b: 0 }, 
                    debugDuration: 1000
                }
            );

            if (raycastResult?.hitBlock) {
                if (input.ml) {
                    this.raycastHandler.setBlock(raycastResult.hitBlock.globalCoordinate, 0); // 0 = air/no block
                }
            }
        } catch (error) {
            if (this.isDebugMode) {
                console.error('Error in block interaction:', error);
            }
        } finally {
            // Reset inputs to prevent spam
            input.ml = false;
            input.mr = false;
        }
    }
} 