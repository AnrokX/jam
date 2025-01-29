import { Vector3, Block, RaycastHit } from '../types';

export interface Color {
    r: number;
    g: number;
    b: number;
}

export interface RaycastOptions {
    ignoresSensors?: boolean;
    filterFlags?: number;
    filterGroups?: number;
    filterExcludeCollider?: any;
    filterExcludeRigidBody?: any;
    filterPredicate?: (collider: any) => boolean;
    debugColor?: Color;
    debugDuration?: number;
}

export interface WorldInterface {
    simulation: {
        raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions): RaycastHit;
        enableDebugRaycasting(enabled: boolean): void;
        isDebugRaycastingEnabled(): boolean;
    };
    chunkLattice: {
        setBlock(position: Vector3, blockType: number): void;
        getBlock(position: Vector3): number;
        hasBlock(position: Vector3): boolean;
    };
}

export class RaycastHandler {
    private isDebugMode: boolean = false;

    constructor(private world: WorldInterface) {
        this.isDebugMode = process.env.NODE_ENV === 'development';
    }

    raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions): RaycastHit {
        return this.world.simulation.raycast(origin, direction, length, options);
    }

    setBlock(position: Vector3, blockType: number): void {
        this.world.chunkLattice.setBlock(position, blockType);
    }
} 
