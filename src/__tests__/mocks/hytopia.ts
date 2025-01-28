import type { Vector3 } from '../../types';
import { RaycastHandler, RaycastOptions } from '../../raycast/raycast-handler';

export class World {
    chunkLattice: ChunkLattice;
    simulation: Simulation;
    private raycastHandler: RaycastHandler;

    constructor() {
        // Create a single RaycastHandler instance
        this.raycastHandler = new RaycastHandler();
        this.raycastHandler.setWorld(this);

        // Create simulation first with the raycast handler
        this.simulation = new Simulation(this.raycastHandler);
        
        // Create chunk lattice with the same raycast handler
        this.chunkLattice = new ChunkLattice(this.raycastHandler);
    }
}

export class ChunkLattice {
    constructor(private raycastHandler: RaycastHandler) {}

    setBlock(position: Vector3, blockType: number): void {
        this.raycastHandler.setBlock(position, blockType);
    }

    getRaycastHandler(): RaycastHandler {
        return this.raycastHandler;
    }
}

export class Simulation {
    private debugRaycastEnabled = false;

    constructor(private raycastHandler: RaycastHandler) {}

    enableDebugRaycasting(enabled: boolean) {
        this.debugRaycastEnabled = enabled;
    }

    isDebugRaycastingEnabled(): boolean {
        return this.debugRaycastEnabled;
    }

    debugRaycast(origin: Vector3, direction: Vector3, length: number, options: RaycastOptions) {
        // Silent mock implementation for tests
        if (this.debugRaycastEnabled && process.env.NODE_ENV === 'development') {
            // Only log in development
            console.log('Debug raycast:', { origin, direction, length, options });
        }
    }

    raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions) {
        return this.raycastHandler.raycast(origin, direction, length, options);
    }
} 
