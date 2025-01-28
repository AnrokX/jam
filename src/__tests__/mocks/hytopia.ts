export class World {
    simulation: Simulation;
    chunkLattice: ChunkLattice;
    
    constructor(config: { name: string; id: number; skyboxUri: string }) {
        this.simulation = new Simulation();
        this.chunkLattice = new ChunkLattice();
    }
}

export class ChunkLattice {
    setBlock(position: Vector3, blockType: number): void {
        // Mock implementation that does nothing
    }
}

export class Simulation {
    raycast(origin: Vector3, direction: Vector3, length: number): RaycastHit | null {
        // Mock implementation that always returns null to make tests fail
        return null;
    }
}

export interface Block {
    globalCoordinate: Vector3;
}

export interface RaycastHit {
    hitBlock: Block;
    hitPoint: Vector3;
    hitDistance: number;
}

interface Vector3 {
    x: number;
    y: number;
    z: number;
} 
