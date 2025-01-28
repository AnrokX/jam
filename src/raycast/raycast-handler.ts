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

    setWorld(world: any) {
        console.log('Setting world in RaycastHandler');
        this.world = world;
        // Verify world simulation is available
        if (this.world?.simulation) {
            console.log('World simulation is available');
        }
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
        console.log(`Raycasting from ${JSON.stringify(origin)} in direction ${JSON.stringify(direction)}`);
        
        // Normalize direction vector
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Always show debug raycast if world is available
        if (this.world?.simulation) {
            console.log('Visualizing raycast with debug renderer');
            // Default debug color if none provided
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
                console.error('Error visualizing raycast:', error);
            }
        } else {
            console.warn('World or simulation not available for debug visualization');
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
                console.log(`Hit block at ${JSON.stringify(point)}`);
                return {
                    hitBlock: {
                        globalCoordinate: point
                    },
                    hitPoint: point,
                    hitDistance: dist
                };
            }
        }

        console.log('No block hit');
        return null;
    }
} 
