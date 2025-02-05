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
import { AudioManager } from './src/managers/audio-manager';
import { PlayerSettingsManager, UISettingsData } from './src/managers/player-settings-manager';

// Configuration flags
const IS_TEST_MODE = false;  // Set this to true to enable test mode, false for normal game
const DEBUG_ENABLED = false;  // Development debug flag


startServer(world => {
  console.log('Starting server and initializing debug settings...');
  console.log(`Test mode: ${IS_TEST_MODE ? 'enabled' : 'disabled'}`);
  
  // Initialize managers
  const sceneUIManager = SceneUIManager.getInstance(world);
  const settingsManager = PlayerSettingsManager.getInstance(world);
  
  // Enable debug rendering for development
  world.simulation.enableDebugRendering(DEBUG_ENABLED);
  
  // Initialize raycast handler with debug enabled
  const raycastHandler = new RaycastHandler(world);
  raycastHandler.enableDebugRaycasting(DEBUG_ENABLED);
  console.log('RaycastHandler initialized with debug enabled');

  // Initialize the projectile manager
  const projectileManager = new PlayerProjectileManager(world, raycastHandler);

  // Initialize the score manager
  const scoreManager = new ScoreManager();
  scoreManager.spawn(world, { x: 0, y: 0, z: 0 }); // Make it available as an entity

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
      testSpawner.spawnStaticTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a static target', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn2', (player) => {
      testSpawner.spawnSineWaveBlock();
      world.chatManager.sendPlayerMessage(player, 'Spawned a sine wave block', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn3', (player) => {
      testSpawner.spawnVerticalWaveBlock();
      world.chatManager.sendPlayerMessage(player, 'Spawned a vertical wave block', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn4', (player) => {
      testSpawner.spawnRegularBlock();
      world.chatManager.sendPlayerMessage(player, 'Spawned a regular block', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn5', (player) => {
      testSpawner.spawnPopUpTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a pop-up target', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn6', (player) => {
      testSpawner.spawnRisingTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a rising target (stops at pop-up height, then shoots up)', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn7', (player) => {
      testSpawner.spawnParabolicTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a parabolic target (moves in a long, dramatic arc with physics-based motion)', 'FFFF00');
    });

    world.chatManager.registerCommand('spawn8', (player) => {
      testSpawner.spawnPendulumTarget();
      world.chatManager.sendPlayerMessage(player, 'Spawned a pendulum target (swings like a pendulum in either XZ or YZ plane)', 'FFFF00');
    });

    world.chatManager.registerCommand('spawnall', (player) => {
      testSpawner.spawnTestBlocks();
      world.chatManager.sendPlayerMessage(player, 'Spawned all block types', 'FFFF00');
    });

    world.chatManager.registerCommand('clearblocks', (player) => {
      world.entityManager.getAllEntities()
        .filter(entity => entity.name.toLowerCase().includes('block'))
        .forEach(entity => entity.despawn());
      world.chatManager.sendPlayerMessage(player, 'Cleared all blocks', 'FFFF00');
    });

    world.chatManager.registerCommand('testround', (player) => {
      testSpawner.startTestRound();
      world.chatManager.sendPlayerMessage(player, 'Test Round Started!', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'Duration: 60 seconds', 'FFFF00');
      
      // End round notification
      setTimeout(() => {
        world.chatManager.sendPlayerMessage(player, 'Test Round Ended!', 'FFFF00');
      }, 60000);
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
      world.chatManager.sendPlayerMessage(player, 'spawn8 - Spawn pendulum target (swings like a pendulum in either XZ or YZ plane)', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'spawnall - Spawn all block types', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'clearblocks - Remove all blocks', 'FFFF00');
      world.chatManager.sendPlayerMessage(player, 'testround - Start a 60-second test round with mixed blocks', 'FFFF00');
    });
  }

  world.loadMap(worldMap);

  // Initialize AudioManager and start background music
  const audioManager = AudioManager.getInstance(world);
  
  /**
   * Handles the event when a player joins the game.
   * Sets up player entity and input handling for raycasting.
   */
  world.onPlayerJoin = player => {
    console.log('New player joined the game');
    
    // Initialize player states
    scoreManager.initializePlayer(player.id);
    projectileManager.initializePlayer(player.id);
    settingsManager.initializePlayer(player.id);
    
    // Load the UI first
    player.ui.load('ui/index.html');
    
    // Initialize audio with player's settings
    const playerSettings = settingsManager.getPlayerSettings(player.id);
    if (playerSettings) {
      // Start background music with initial volume
      audioManager.setBgmVolume(playerSettings.bgmVolume);
      audioManager.playBackgroundMusic();
      
      // Send initial settings to UI
      player.ui.sendData({
        type: 'settingsUpdate',
        settings: playerSettings
      });
    }
    
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
      // Apply sensitivity to camera orientation
      const adjustedOrientation = settingsManager.applyCameraSensitivity(player.id, cameraOrientation);
      
      // Create a clean copy of the input state to avoid recursive references
      const cleanInput = {
        ml: input.ml || false,
        mr: input.mr || false,
      };

      // Right click for raycast
      if (cleanInput.mr) {
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
        
        cleanInput.mr = false;
      }

      // Handle projectile input through the manager with left click
      if (cleanInput.ml) {
        cleanInput.mr = true;
        cleanInput.ml = false;
      }
      
      projectileManager.handleProjectileInput(
        player.id,
        entity.position,
        entity.player.camera.facingDirection,
        cleanInput,
        player
      );

      // Update UI with current projectile count after input handling
      player.ui.sendData({
        type: 'updateProjectileCount',
        count: projectileManager.getProjectilesRemaining(player.id)
      });

      // Return the adjusted orientation to apply the sensitivity
      return adjustedOrientation;
    };

    // Handle settings updates from UI
    player.ui.onData = (_playerUI: PlayerUI, data: any) => {
      if (data && data.type === 'updateSettings') {
        settingsManager.updateSetting(player.id, data.setting, data.value);
        
        // Handle background music volume changes
        if (data.setting === 'bgmVolume') {
          const volume = data.value / 100; // Convert from percentage to decimal
          audioManager.setBgmVolume(volume);
        }
      }
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
    world.chatManager.sendPlayerMessage(player, 'Press ESC, Tab, or P to open settings.', '00FF00');
    
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
    settingsManager.removePlayer(player.id);
    
    // Handle round system when player leaves (only in normal mode)
    if (!IS_TEST_MODE && roundManager) {
      roundManager.handlePlayerLeave();
    }
    
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  // Cleanup managers when the scene changes or the game shuts down
  BlockParticleEffects.getInstance(world).cleanup();
  sceneUIManager.cleanup();
  audioManager.cleanup();
  settingsManager.cleanup();
});
