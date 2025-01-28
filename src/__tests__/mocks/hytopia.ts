import type { Vector3 } from '../../types';
import { RaycastHandler, RaycastOptions } from '../../raycast/raycast-handler';

export class World {
    chunkLattice: ChunkLattice;
    simulation: Simulation;

    constructor() {
        // Create simulation first
        this.simulation = new Simulation();
        // Create chunk lattice with reference to world
        this.chunkLattice = new ChunkLattice(this);
        // Set chunk lattice in simulation
        this.simulation.setChunkLattice(this.chunkLattice);
    }
}

export class ChunkLattice {
    private raycastHandler: RaycastHandler;

    constructor(world: World) {
        this.raycastHandler = new RaycastHandler();
        this.raycastHandler.setWorld(world);
    }

    setBlock(position: Vector3, blockType: number): void {
        this.raycastHandler.setBlock(position, blockType);
    }

    getRaycastHandler(): RaycastHandler {
        return this.raycastHandler;
    }
}

export class Simulation {
    private debugRaycastEnabled = false;
    private chunkLattice?: ChunkLattice;

    enableDebugRaycasting(enabled: boolean) {
        this.debugRaycastEnabled = enabled;
    }

    isDebugRaycastingEnabled(): boolean {
        return this.debugRaycastEnabled;
    }

    debugRaycast(origin: Vector3, direction: Vector3, length: number, color: any, duration: number) {
        // Mock implementation - in real game this would visualize the raycast
        if (this.debugRaycastEnabled) {
            console.log('Debug raycast:', { origin, direction, length, color, duration });
        }
    }

    raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions) {
        if (!this.chunkLattice) {
            throw new Error('ChunkLattice not initialized');
        }
        return this.chunkLattice.getRaycastHandler().raycast(origin, direction, length, options);
    }

    setChunkLattice(chunkLattice: ChunkLattice) {
        this.chunkLattice = chunkLattice;
    }
} 
