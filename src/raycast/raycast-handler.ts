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

export class RaycastHandler {
    private blocks: Map<string, number> = new Map();
    private world?: any; // Reference to the game world for debug visualization
    private isDebugMode: boolean = false;

    setWorld(world: any) {
        this.world = world;
        this.isDebugMode = process.env.NODE_ENV === 'development';
    }

    setBlock(position: Vector3, blockType: number): void {
        const key = `${position.x},${position.y},${position.z}`;
        if (blockType === 0) {
            this.blocks.delete(key);
        } else {
            this.blocks.set(key, blockType);
        }
    }

    raycast(origin: Vector3, direction: Vector3, length: number, options?: RaycastOptions): RaycastHit | null {
        // Normalize direction vector
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Handle debug visualization if world is available
        if (this.world?.simulation) {
            const debugColor = options?.debugColor || { r: 1, g: 0, b: 0 };
            const debugDuration = options?.debugDuration || 1000;
            
            try {
                this.world.simulation.raycast(
                    origin,
                    direction,
                    length,
                    {
                        filterExcludeRigidBody: options?.filterExcludeRigidBody,
                        debugColor,
                        debugDuration
                    }
                );
            } catch (error) {
                if (this.isDebugMode) {
                    console.error('Error in raycast visualization:', error);
                }
            }
        }

        // Check each integer point along the ray until we hit length
        for (let dist = 0; dist <= length; dist++) {
            const point = {
                x: Math.round(origin.x + normalizedDir.x * dist),
                y: Math.round(origin.y + normalizedDir.y * dist),
                z: Math.round(origin.z + normalizedDir.z * dist)
            };

            const key = `${point.x},${point.y},${point.z}`;
            if (this.blocks.has(key)) {
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
