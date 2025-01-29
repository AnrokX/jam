import { Vector3 } from '../types';
import { WorldInterface } from './raycast-handler';

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
    private lastLogTime: number = 0;
    private readonly LOG_INTERVAL: number = 1; // Log once per second at most

    constructor(
        private world: WorldInterface,
        private readonly maxReachDistance: number = 5
    ) {
        this.isDebugMode = process.env.NODE_ENV === 'development';
    }

    private shouldLog(): boolean {
        const now = Date.now();
        if (now - this.lastLogTime >= this.LOG_INTERVAL) {
            this.lastLogTime = now;
            return true;
        }
        return false;
    }

    handleInput(input: PlayerInput, entity: EntityPosition): void {
        // Early return if no input or undefined inputs
        if (!input.ml && !input.mr) return;

        try {
            // Perform raycast for visualization only
            const result = this.world.simulation.raycast(
                entity.position,
                entity.facingDirection,
                this.maxReachDistance,
                {
                    debugColor: { r: 1, g: 0, b: 0 },  // Red for visualization
                    debugDuration: 1000
                }
            );

            if (result && this.shouldLog()) {
                console.log(`Raycast hit at distance: ${result.hitDistance}`);
                if (result.hitBlock) {
                    const coord = result.hitBlock.globalCoordinate;
                    console.log(`Block hit detected at: (${coord.x}, ${coord.y}, ${coord.z})`);
                } else {
                    console.log('No block hit');
                }
                if (result.hitPoint) {
                    console.log(`Hit point: (${result.hitPoint.x}, ${result.hitPoint.y}, ${result.hitPoint.z})`);
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