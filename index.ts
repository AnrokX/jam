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
import { MovingBlockManager, MOVING_BLOCK_CONFIG } from './src/moving_blocks/moving-block-entity';
import { ScoreManager } from './src/managers/score-manager';
import { RoundManager } from './src/managers/round-manager';
import { BlockParticleEffects } from './src/effects/block-particle-effects';
import { TestBlockSpawner } from './src/utils/test-spawner';
import { SceneUIManager } from './src/scene-ui/scene-ui-manager';

// Configuration flags
const IS_TEST_MODE = false;  // Set this to true to enable test mode, false for normal game
const DEBUG_ENABLED = false;  // Development debug flag

startServer(world => {
  console.log('Starting server and initializing debug settings...');
  console.log(`Test mode: ${IS_TEST_MODE ? 'enabled' : 'disabled'}`);
  
  // Initialize SceneUIManager
  const sceneUIManager = SceneUIManager.getInstance(world);
  
  // Enable debug rendering for development
  world.simulation.enableDebugRendering(DEBUG_ENABLED);
  
  // Initialize raycast handler with debug enabled
  const raycastHandler = new RaycastHandler(world);
  raycastHandler.enableDebugRaycasting(DEBUG_ENABLED);
  console.log('RaycastHandler initialized with debug enabled');

  // Development flag for trajectory preview - set to false to disable
  const SHOW_TRAJECTORY_PREVIEW = false;

  // Initialize the projectile manager
  const projectileManager = new PlayerProjectileManager(world, raycastHandler, SHOW_TRAJECTORY_PREVIEW);

  // Initialize the score manager
  const scoreManager = new ScoreManager();

  // Initialize the moving block manager
  const movingBlockManager = new MovingBlockManager(world, scoreManager);
  
  // Initialize test spawner if in test mode
  const testSpawner = IS_TEST_MODE ? new TestBlockSpawner(world, movingBlockManager) : null;
  
  // Initialize the round manager (only used in normal mode)
  const roundManager = !IS_TEST_MODE ? new RoundManager(world, movingBlockManager, scoreManager) : null;

  // Register test mode commands if in test mode
  if (IS_TEST_MODE && testSpawner) {
    // Register commands without the '/' prefix
    world.chatManager.registerCommand('spawn1', (player) => {
      console.log('Executing spawn1 command');
      testSpawner.spawnStaticTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a static target', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn2', (player) => {
      console.log('Executing spawn2 command');
      testSpawner.spawnSineWaveBlock();
      world.chatManager.sendPlayerMessage(player, 'Spawned a sine wave block', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn3', (player) => {
      console.log('Executing spawn3 command');
      testSpawner.spawnVerticalWaveBlock();
      world.chatManager.sendPlayerMessage(player, 'Spawned a vertical wave block', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn4', (player) => {
      console.log('Executing spawn4 command');
      testSpawner.spawnRegularBlock();
      world.chatManager.sendPlayerMessage(player, 'Spawned a regular block', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn5', (player) => {
      console.log('Executing spawn5 command');
      testSpawner.spawnPopUpTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a pop-up target', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn6', (player) => {
      console.log('Executing spawn6 command');
      testSpawner.spawnRisingTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a rising target (stops at pop-up height, then shoots up)', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn7', (player) => {
      console.log('Executing spawn7 command');
      testSpawner.spawnParabolicTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a parabolic target (moves in a long, dramatic arc with physics-based motion)', 'FFFF00');
    });

    world.chatManager.registerCommand('spawnall', (player) => {
      console.log('Executing spawnall command');
      testSpawner.spawnTestBlocks();
      world.chatManager.sendPlayerMessage(player, 'Spawned all block types', 'FFFF00');
    });

    world.chatManager.registerCommand('clearblocks', (player) => {
      console.log('Executing clearblocks command');
      world.entityManager.getAllEntities()
        .filter(entity => entity.name.toLowerCase().includes('block'))
        .forEach(entity => entity.despawn());
      world.chatManager.sendPlayerMessage(player, 'Cleared all blocks', 'FFFF00');
    });

    world.chatManager.registerCommand('testhelp', (player) => {
      console.log('Executing testhelp command');
      world.chatManager.sendPlayerMessage(player, 'Test Mode Commands:', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn1 - Spawn static target', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn2 - Spawn sine wave block', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn3 - Spawn vertical wave block', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn4 - Spawn regular block', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn5 - Spawn pop-up target', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn6 - Spawn rising target (stops at pop-up height, then shoots up)', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawn7 - Spawn parabolic target (long-range arc with physics-based motion)', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawnall - Spawn all block types', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'clearblocks - Remove all blocks', 'FFFF00');
    });
  }

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
    
    // Generate spawn position based on player count
    const playerCount = world.entityManager.getAllPlayerEntities().length;
    const spawnPos = playerCount === 0 ? 
      // First player spawns at the back of the left platform
      {
        x: -43,
        y: 5,
        z: 1
      } :
      // Second player spawns at the back of the right platform
      {
        x: 44,
        y: 5,
        z: 1
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
    playerEntity.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    
    // Hide only the local player's model from their own view
    // This won't affect how other players see them
    player.camera.setModelHiddenNodes([
      'Armature',      // Main skeleton
      'Mesh',          // Main mesh
      'Body_mesh',     // Body mesh if separated
      'Character',     // Common root node name
      'Skeleton',      // Alternative skeleton name
      'Root'           // Root node
    ]);
    
    // Set camera to eye level and slightly forward
    playerEntity.player.camera.setOffset({
      x: 0,
      y: 1,  // Eye level height
      z: 0   // Slightly forward to avoid any model clipping
    });

    // Set a comfortable FOV for first-person gameplay (70 degrees is a common value)
    playerEntity.player.camera.setFov(70);
  
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

    // Start the round or spawn test blocks based on mode
    if (IS_TEST_MODE && testSpawner) {
      testSpawner.spawnTestBlocks();
      console.log('Test blocks spawned');
    } else if (roundManager && !roundManager.isActive()) {
      roundManager.startRound();
    }

    // Send appropriate welcome messages
    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
    world.chatManager.sendPlayerMessage(player, 'Right click to raycast.');
    world.chatManager.sendPlayerMessage(player, 'Left click to throw projectiles.');
    
    if (IS_TEST_MODE) {
      world.chatManager.sendPlayerMessage(player, 'TEST MODE: One of each block type has been spawned', 'FFFF00');
    } else {
      world.chatManager.sendPlayerMessage(player, `Round ${roundManager!.getCurrentRound()} - Hit as many blocks as you can before time runs out!`, 'FFFF00');
    }
    
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');

    // Send help message for test mode
    if (IS_TEST_MODE) {
      world.chatManager.sendPlayerMessage(player, 'Type /testhelp to see available test commands', 'FFFF00');
    }
  };

  /**
   * Handles the event when a player leaves the game.
   */
  world.onPlayerLeave = player => {
    console.log('Player left the game');
    
    // Clean up player states
    scoreManager.removePlayer(player.id);
    projectileManager.removePlayer(player.id);
    
    // Handle round system when player leaves (only in normal mode)
    if (!IS_TEST_MODE && roundManager) {
      roundManager.handlePlayerLeave();
    }
    
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  new Audio({
    uri: 'audio/music/hytopia-main.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);

  // Cleanup particle effects and UI when the scene changes or the game shuts down
  BlockParticleEffects.getInstance(world).cleanup();
  sceneUIManager.cleanup();
});
