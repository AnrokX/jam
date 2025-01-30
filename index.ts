import {
  startServer,
  Audio,
  PlayerEntity,
  RaycastOptions,
  PlayerCameraMode
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
  raycastHandler.enableDebugRaycasting(false);
  console.log('RaycastHandler initialized with debug enabled');

  // Store preview projectile at server scope
  let previewProjectile: ProjectileEntity | null = null;
  
  // Development flag for trajectory preview - set to false to disable
  const SHOW_TRAJECTORY_PREVIEW = false;

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

    // Spawn the entity first
    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });
    console.log(`Player spawned at (0, 10, 0)`);

    // Configure first-person camera after spawning
    playerEntity.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    
    // Hide the entire player model in first person
    playerEntity.setModelHiddenNodes(['*', 'Body', 'Head', 'Arms', 'Legs']);
    
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

      // Right mouse button pressed or held
      if (input.mr) {
        // Create preview projectile if it doesn't exist
        if (!previewProjectile) {
          previewProjectile = new ProjectileEntity({
            modelScale: 1,
            speed: 25,
            raycastHandler,
            enablePreview: SHOW_TRAJECTORY_PREVIEW
          });

          // Calculate spawn position
          const spawnOffset = {
            x: entity.player.camera.facingDirection.x,
            y: Math.max(entity.player.camera.facingDirection.y, -0.5),
            z: entity.player.camera.facingDirection.z
          };

          const offsetMag = Math.sqrt(
            spawnOffset.x * spawnOffset.x + 
            spawnOffset.y * spawnOffset.y + 
            spawnOffset.z * spawnOffset.z
          );

          const SPAWN_DISTANCE = 2.0;
          const spawnPos = {
            x: entity.position.x + (spawnOffset.x / offsetMag) * SPAWN_DISTANCE,
            y: entity.position.y + (spawnOffset.y / offsetMag) * SPAWN_DISTANCE + 1.5,
            z: entity.position.z + (spawnOffset.z / offsetMag) * SPAWN_DISTANCE
          };

          previewProjectile.spawn(world, spawnPos);
        }

        // Update trajectory preview
        previewProjectile.showTrajectoryPreview(entity.player.camera.facingDirection);
      } 
      // Right mouse button released
      else if (previewProjectile) {
        // Throw the projectile and clean up preview
        const throwDirection = entity.player.camera.facingDirection;
        previewProjectile.throw(throwDirection);
        previewProjectile.clearTrajectoryMarkers();
        previewProjectile = null;
      }
    };

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
