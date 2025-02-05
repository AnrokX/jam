import { World, Audio } from 'hytopia';

export class AudioManager {
    private static instance: AudioManager;
    private world: World;
    private backgroundMusic?: Audio;

    private constructor(world: World) {
        this.world = world;
    }

    public static getInstance(world: World): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager(world);
        }
        return AudioManager.instance;
    }

    public playBackgroundMusic(): void {
        this.backgroundMusic = new Audio({
            uri: 'audio/music/hytopia-main.mp3',
            loop: true,
            volume: 0.1,
        });
        this.backgroundMusic.play(this.world);
    }

    public cleanup(): void {
        // Audio cleanup will be handled by the world's garbage collection
        this.backgroundMusic = undefined;
    }
} 