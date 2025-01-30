import {
  startServer,
  Audio,
  PlayerEntity,
  RaycastOptions
} from 'hytopia';

import worldMap from './assets/map.json';
import { RaycastHandler } from './src/raycast/raycast-handler';
import { ProjectileEntity } from './src/entities/projectile-entity';

startServer(world => {
  console.log('Starting server and initializing debug settings...');
  
  // Enable debug rendering for development
  world.simulation.enableDebugRendering(false);
  
  // Initialize raycast handler with debug enabled
  const raycastHandler = new RaycastHandler(world);
  raycastHandler.enableDebugRaycasting(true);
  console.log('RaycastHandler initialized with debug enabled');

  world.loadMap(worldMap);

  /**
   * Handles the event when a player joins the game.
   * Sets up player entity and input handling for raycasting.
   */
  world.onPlayerJoin = player => {
    console.log('New player joined the game');
    
    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: [ 'idle' ],
      modelScale: 0.5,
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

      // Right click to throw projectile
      if (input.mr) {
        const projectile = new ProjectileEntity({
          modelScale: 1,
          speed: 25
        });

        // Calculate spawn position with better handling for looking down
        const spawnOffset = {
          x: entity.player.camera.facingDirection.x,
          y: Math.max(entity.player.camera.facingDirection.y, -0.5), // Limit downward offset
          z: entity.player.camera.facingDirection.z
        };

        // Normalize the offset
        const offsetMag = Math.sqrt(
          spawnOffset.x * spawnOffset.x + 
          spawnOffset.y * spawnOffset.y + 
          spawnOffset.z * spawnOffset.z
        );

        // Apply normalized offset with fixed distance
        const SPAWN_DISTANCE = 2.0;
        const spawnPos = {
          x: entity.position.x + (spawnOffset.x / offsetMag) * SPAWN_DISTANCE,
          y: entity.position.y + (spawnOffset.y / offsetMag) * SPAWN_DISTANCE + 1.5, // Add constant height offset
          z: entity.position.z + (spawnOffset.z / offsetMag) * SPAWN_DISTANCE
        };

        projectile.spawn(world, spawnPos);
        projectile.throw(entity.player.camera.facingDirection);
        input.mr = false;
      }
    };

    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });
    console.log(`Player spawned at (0, 10, 0)`);

    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
    world.chatManager.sendPlayerMessage(player, 'Left click to raycast.');
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
  };

  /**
   * Handles the event when a player leaves the game.
   */
  world.onPlayerLeave = player => {
    console.log('Player left the game');
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  new Audio({
    uri: 'audio/music/hytopia-main.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);
});
