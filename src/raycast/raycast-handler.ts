import { Vector3, Block, RaycastHit } from '../types';

export interface Color {
    r: number;
    g: number;
    b: number;
}

export interface RaycastOptions {
    filterExcludeRigidBody?: string;
    debugColor?: Color;
    debugDuration?: number;
}

export interface WorldInterface {
    simulation: {
        raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions): RaycastHit | null;
    };
    chunkLattice: {
        setBlock(position: Vector3, blockType: number): void;
    };
}

export class RaycastHandler {
    private isDebugMode: boolean = false;

    constructor(private world: WorldInterface) {
        this.isDebugMode = process.env.NODE_ENV === 'development';
    }

    raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions): RaycastHit | null {
        return this.world.simulation.raycast(origin, direction, length, options);
    }

    setBlock(position: Vector3, blockType: number): void {
        this.world.chunkLattice.setBlock(position, blockType);
    }
} 
