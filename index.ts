import {
  startServer,
  Audio,
  PlayerEntity,
  RaycastOptions,
  PlayerCameraMode,
  PlayerUI
} from 'hytopia';

import worldMap from './assets/map.json';
import { RaycastHandler } from './src/raycast/raycast-handler';
import { PlayerProjectileManager } from './src/managers/player-projectile-manager';
import { MovingBlockManager } from './src/moving_blocks/moving-block-entity';
import { ScoreManager } from './src/managers/score-manager';

startServer(world => {
  console.log('Starting server and initializing debug settings...');
  
  // Enable debug rendering for development
  world.simulation.enableDebugRendering(false);
  
  // Initialize raycast handler with debug enabled
  const raycastHandler = new RaycastHandler(world);
  raycastHandler.enableDebugRaycasting(false);
  console.log('RaycastHandler initialized with debug enabled');

  // Development flag for trajectory preview - set to false to disable
  const SHOW_TRAJECTORY_PREVIEW = false;

  // Initialize the projectile manager
  const projectileManager = new PlayerProjectileManager(world, raycastHandler, SHOW_TRAJECTORY_PREVIEW);

  // Initialize the score manager
  const scoreManager = new ScoreManager();

  const BLOCK_SPAWN_INTERVAL = 5000; // 5 seconds in milliseconds
  const MAX_BLOCKS = 3; // Maximum number of blocks that can exist at once

  // Initialize the moving block manager and create the initial Z-axis obstacle
  const movingBlockManager = new MovingBlockManager(world, scoreManager);
  
  // Create initial blocks with different patterns
  movingBlockManager.createZAxisBlock();
  movingBlockManager.createSineWaveBlock({
    spawnPosition: { x: 0, y: 1, z: -5 },
    amplitude: 4,
    frequency: 0.5
  });

  // Set up periodic block spawning with different patterns
  setInterval(() => {
    // Only spawn new block if we're under the maximum
    if (movingBlockManager.getBlockCount() < MAX_BLOCKS) {
      // Spawn at a random position within bounds
      const spawnPos = {
        x: Math.random() * 10 - 5, // Random x between -5 and 5
        y: 1 + Math.random() * 3,  // Random y between 1 and 4
        z: Math.random() * 20 - 10 // Random z between -10 and 10
      };

      // Randomly choose between different block types
      const blockType = Math.random();
      if (blockType < 0.5) {
        movingBlockManager.createZAxisBlock(spawnPos);
        console.log(`New Z-axis block spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
      } else {
        movingBlockManager.createSineWaveBlock({
          spawnPosition: spawnPos,
          amplitude: 2 + Math.random() * 3, // Random amplitude between 2 and 5
          frequency: 0.3 + Math.random() * 0.7 // Random frequency between 0.3 and 1
        });
        console.log(`New sine wave block spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
      }
    }
  }, BLOCK_SPAWN_INTERVAL);

  world.loadMap(worldMap);

  /**
   * Handles the event when a player joins the game.
   * Sets up player entity and input handling for raycasting.
   */
  world.onPlayerJoin = player => {
    console.log('New player joined the game');
    
    // Initialize player's score
    scoreManager.initializePlayer(player.id);
    
    // Initialize player's projectile state
    projectileManager.initializePlayer(player.id);
    
    // Load the UI first
    player.ui.load('ui/index.html');
    
    // Send initial projectile count to UI
    player.ui.sendData({
      type: 'updateProjectileCount',
      count: projectileManager.getProjectilesRemaining(player.id)
    });
    
    // Generate random spawn position
    const spawnPos = {
      x: Math.random() * 20 - 10,  // Random x between -10 and 10
      y: 10,                       // Fixed height
      z: Math.random() * 20 - 10   // Random z between -10 and 10
    };

    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: [ 'idle' ],
      modelScale: 0.5,
    });

    // Spawn the entity at random position
    playerEntity.spawn(world, spawnPos);
    console.log(`Player spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y}, ${spawnPos.z.toFixed(2)})`);

    // Configure first-person camera after spawning
    playerEntity.player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
    
    // Hide the entire player model in first person
   // playerEntity.setModelHiddenNodes(['*', 'Body', 'Head', 'Arms', 'Legs']);
    
    // Set camera to eye level and slightly forward
    playerEntity.player.camera.setOffset({
      x: 0,
      y: 1.6,  // Eye level height
      z: 0.1   // Slightly forward to avoid any model clipping
    });
  
    // Wire up raycast handler and projectile system to the SDK's input system
    playerEntity.controller!.onTickWithPlayerInput = (entity, input, cameraOrientation, deltaTimeMs) => {
      // Right click for raycast
      if (input.mr) {
        const result = raycastHandler.raycast(
          entity.position,
          entity.player.camera.facingDirection,
          5
        );
        
        if (result) {
          console.log(`Raycast hit at distance: ${result.hitDistance}`);
          if (result.hitBlock) {
            const coord = result.hitBlock.globalCoordinate;
            console.log(`Hit block at (${coord.x}, ${coord.y}, ${coord.z})`);
          }
        } else {
          console.log('Raycast missed');
        }
        
        input.mr = false;
      }

      // Handle projectile input through the manager with left click
      const modifiedInput = { ...input };
      if (input.ml) {
        modifiedInput.mr = true;
        modifiedInput.ml = false;
      }
      
      projectileManager.handleProjectileInput(
        player.id,
        entity.position,
        entity.player.camera.facingDirection,
        modifiedInput,
        player
      );

      // Update UI with current projectile count after input handling
      player.ui.sendData({
        type: 'updateProjectileCount',
        count: projectileManager.getProjectilesRemaining(player.id)
      });
    };

    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
    world.chatManager.sendPlayerMessage(player, 'Right click to raycast.');
    world.chatManager.sendPlayerMessage(player, 'Left click to throw projectiles.');
    world.chatManager.sendPlayerMessage(player, 'Watch out for moving platforms!', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
  };

  /**
   * Handles the event when a player leaves the game.
   */
  world.onPlayerLeave = player => {
    console.log('Player left the game');
    
    // Clean up player states
    scoreManager.removePlayer(player.id);
    projectileManager.removePlayer(player.id);
    
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  new Audio({
    uri: 'audio/music/hytopia-main.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);
});
