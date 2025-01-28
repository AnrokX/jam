import {
  startServer,
  Audio,
  GameServer,
  PlayerEntity,
} from 'hytopia';

import worldMap from './assets/map.json';
import { RaycastHandler } from './src/raycast/raycast-handler';
import { BlockInteractionHandler } from './src/raycast/block-interaction-handler';

startServer(world => {
  console.log('Starting server and initializing debug settings...');
  
  // Enable debug rendering for development
  world.simulation.enableDebugRendering(false);  // Changed to true for better visibility
  // Enable debug raycasting to visualize our raycasts for testing
  world.simulation.enableDebugRaycasting(true);

  console.log('Debug settings initialized');

  world.loadMap(worldMap);

  // Initialize our handlers
  const raycastHandler = new RaycastHandler();
  console.log('RaycastHandler initialized');
  
  raycastHandler.setWorld(world); // Give raycastHandler access to world for debug visualization
  const blockInteractionHandler = new BlockInteractionHandler(raycastHandler);
  console.log('BlockInteractionHandler initialized');

  /**
   * Handles the event when a player joins the game.
   * This function is triggered upon a new player's connection.
   * It creates a player entity that manages input mapping
   * for controlling the in-game character, utilizing our
   * player entity controller for seamless integration.
   */
  world.onPlayerJoin = player => {
    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: [ 'idle' ],
      modelScale: 0.5,
    });
  
    // Wire up our block interaction handler to the SDK's input system
    playerEntity.controller!.onTickWithPlayerInput = (entity, input, cameraOrientation, deltaTimeMs) => {
      // Only process input if we have valid input data
      if (typeof input.ml === 'boolean' || typeof input.mr === 'boolean') {
        blockInteractionHandler.handleInput(
          {
            ml: input.ml || false,
            mr: input.mr || false
          },
          {
            position: entity.position,
            facingDirection: entity.player.camera.facingDirection
          }
        );
      }
    };

    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });

    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
    world.chatManager.sendPlayerMessage(player, 'Left click to break blocks.');
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
  };

  /**
   * Handles the event when a player leaves the game.
   * This function is triggered upon player disconnection.
   * It cleans up the player and any associated entities by
   * retrieving all PlayerEntity instances linked to the player
   * via the world's EntityManager. This ensures proper resource
   * release and maintains a consistent game state after a player exits.
   */
  world.onPlayerLeave = player => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  new Audio({
    uri: 'audio/music/hytopia-main.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);
});
