export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Block {
    globalCoordinate: Vector3;
}

export interface RaycastHit {
    hitBlock?: Block;
    hitPoint: Vector3;
    hitDistance: number;
} 