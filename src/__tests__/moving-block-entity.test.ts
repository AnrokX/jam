import { MovingBlockEntity, MovingBlockOptions } from '../moving_blocks/moving-block-entity';
import { ScoreManager } from '../managers/score-manager';

// Mock the hytopia imports
jest.mock('hytopia', () => ({
  Entity: class MockEntity {
    name: string;
    isSpawned: boolean = false;
    constructor(options: { name: string }) {
      this.name = options.name;
    }
    spawn() {}
    despawn() {}
    setPosition() {}
    setOpacity() {}
  },
  World: class MockWorld {},
  RigidBodyType: {
    KINEMATIC_POSITION: 'KINEMATIC_POSITION'
  },
  ColliderShape: {
    BLOCK: 'BLOCK'
  },
  CollisionGroup: {
    BLOCK: 'BLOCK',
    PLAYER: 'PLAYER',
    ENTITY: 'ENTITY'
  }
}));

describe('MovingBlockEntity onBlockBroken callback integration', () => {
  const playerId = 'player1';
  let scoreManager: ScoreManager;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    scoreManager.initializePlayer(playerId);
  });

  test('should call onBlockBroken callback to add score when block is broken', () => {
    // Create the onBlockBroken callback to add 5 points to the player score
    const onBlockBrokenMock = jest.fn(() => {
      scoreManager.addScore(playerId, 5);
    });

    // Create block options with a low health to trigger block break on one hit
    const blockOptions: MovingBlockOptions = {
      health: 1,
      isBreakable: true,
      onBlockBroken: onBlockBrokenMock
    };

    const fakeWorld = {} as any;
    const block = new MovingBlockEntity(blockOptions);
    block.spawn(fakeWorld, { x: 0, y: 0, z: 0 });

    // Create a fake projectile entity using our mocked Entity class
    const fakeProjectile = new (jest.requireMock('hytopia').Entity)({ 
      name: 'Projectile'
    });
    fakeProjectile.isSpawned = true;
    fakeProjectile.despawn = jest.fn();

    // Simulate collision with the projectile
    (block as any).handleCollision(fakeProjectile);

    // Verify the callback was called and score was added
    expect(onBlockBrokenMock).toHaveBeenCalled();
    expect(scoreManager.getScore(playerId)).toBe(5);
  });
}); 