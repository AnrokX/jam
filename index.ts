import {
  startServer,
  Audio,
  GameServer,
  PlayerEntity,
} from 'hytopia';

import worldMap from './assets/map.json';


startServer(world => {
  // Enable debug rendering of the physics simulation for development.
  // This overlays lines in-game for colliders, rigid bodies, and raycasts.
  // Useful for debugging physics issues, but may impact performance.
  // Intended for development environments only.
  world.simulation.enableDebugRendering(false);


  world.loadMap(worldMap);

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
  
    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });

  
    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
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
