import { Vector3, RaycastOptions, RaycastHit, Block, Vector3Like } from 'hytopia';

// Minimal Block implementation for testing
class MockBlock implements Block {
    constructor(
        public readonly globalCoordinate: Vector3Like,
        public readonly blockType = {} as Block['blockType']
    ) {}

    getNeighborGlobalCoordinateFromHitPoint(hitPoint: Vector3Like): Vector3Like {
        return { x: Math.round(hitPoint.x), y: Math.round(hitPoint.y), z: Math.round(hitPoint.z) };
    }
}

export class World {
    simulation = new Simulation();
}

export class Simulation {
    private debugRaycastEnabled = false;
    private blocks = new Map<string, MockBlock>();

    enableDebugRaycasting(enabled: boolean): void {
        this.debugRaycastEnabled = enabled;
    }

    get isDebugRaycastingEnabled(): boolean {
        return this.debugRaycastEnabled;
    }

    addTestBlock(x: number, y: number, z: number): void {
        const coord = { x: Math.round(x), y: Math.round(y), z: Math.round(z) };
        this.blocks.set(`${coord.x},${coord.y},${coord.z}`, new MockBlock(coord));
    }

    raycast(origin: Vector3Like, direction: Vector3Like, length: number, options?: RaycastOptions): RaycastHit | null {
        if (!origin || !direction || length <= 0) return null;

        // Normalize direction vector
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (magnitude === 0) return null;
        
        const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Check for blocks along the ray path
        for (let distance = 0.5; distance <= length; distance += 0.5) {
            const checkPoint = {
                x: Math.round(origin.x + normalizedDir.x * distance),
                y: Math.round(origin.y + normalizedDir.y * distance),
                z: Math.round(origin.z + normalizedDir.z * distance)
            };
            
            const key = `${checkPoint.x},${checkPoint.y},${checkPoint.z}`;
            const block = this.blocks.get(key);
            
            if (block) {
                return {
                    hitBlock: block,
                    hitPoint: {
                        x: origin.x + normalizedDir.x * distance,
                        y: origin.y + normalizedDir.y * distance,
                        z: origin.z + normalizedDir.z * distance
                    },
                    hitDistance: distance
                };
            }
        }
        
        return null;
    }
}

export class PlayerUI {
    onData?: (playerUI: PlayerUI, data: any) => void;

    sendData(data: any): void {
        if (this.onData) {
            this.onData(this, data);
        }
    }
}

export class Player {
    ui: PlayerUI = new PlayerUI();
    settings = {
        sensitivity: 50,
        crosshairColor: '#ffff00'
    };
} 
