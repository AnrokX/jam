import type { Vector3 } from '../../types';
import { RaycastHandler, RaycastOptions } from '../../raycast/raycast-handler';

export class World {
    chunkLattice: ChunkLattice;
    simulation: Simulation;

    constructor() {
        this.chunkLattice = new ChunkLattice();
        this.simulation = new Simulation(this.chunkLattice);
    }
}

export class ChunkLattice {
    private blocks: Map<string, number> = new Map();

    setBlock(position: Vector3, blockType: number): void {
        const key = `${position.x},${position.y},${position.z}`;
        if (blockType === 0) {
            this.blocks.delete(key);
        } else {
            this.blocks.set(key, blockType);
        }
    }

    getBlock(position: Vector3): number {
        const key = `${position.x},${position.y},${position.z}`;
        return this.blocks.get(key) || 0;
    }

    hasBlock(position: Vector3): boolean {
        const key = `${position.x},${position.y},${position.z}`;
        return this.blocks.has(key);
    }
}

export class Simulation {
    private debugRaycastEnabled = false;

    constructor(private chunkLattice: ChunkLattice) {}

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
        // Normalize direction vector
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Check each integer point along the ray until we hit length
        for (let dist = 0; dist <= length; dist++) {
            const point = {
                x: Math.round(origin.x + normalizedDir.x * dist),
                y: Math.round(origin.y + normalizedDir.y * dist),
                z: Math.round(origin.z + normalizedDir.z * dist)
            };

            if (this.chunkLattice.hasBlock(point)) {
                return {
                    hitBlock: {
                        globalCoordinate: point
                    },
                    hitPoint: point,
                    hitDistance: dist
                };
            }
        }

        return null;
    }
} 
