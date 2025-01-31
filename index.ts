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

  world.loadMap(worldMap);

  /**
   * Handles the event when a player joins the game.
   * Sets up player entity and input handling for raycasting.
   */
  world.onPlayerJoin = player => {
    console.log('New player joined the game');
    
    // Initialize player's projectile state
    projectileManager.initializePlayer(player.id);
    
    // Load the UI first
    player.ui.load('ui/index.html');
    
    // Send initial projectile count to UI
    player.ui.sendData({
      type: 'updateProjectileCount',
      count: projectileManager.getProjectilesRemaining(player.id)
    });
    
    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: [ 'idle' ],
      modelScale: 0.5,
    });

    // Spawn the entity first
    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });
    console.log(`Player spawned at (0, 10, 0)`);

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
      // Left click for raycast
      if (input.ml) {
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
        
        input.ml = false;
      }

      // Handle projectile input through the manager
      projectileManager.handleProjectileInput(
        player.id,
        entity.position,
        entity.player.camera.facingDirection,
        input,
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
    world.chatManager.sendPlayerMessage(player, 'Left click to raycast.');
    world.chatManager.sendPlayerMessage(player, 'Right click to throw projectiles.');
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
  };

  /**
   * Handles the event when a player leaves the game.
   */
  world.onPlayerLeave = player => {
    console.log('Player left the game');
    
    // Clean up player's projectile state
    projectileManager.removePlayer(player.id);
    
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  new Audio({
    uri: 'audio/music/hytopia-main.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);
});
