import { World, Audio } from 'hytopia';

export class AudioManager {
    private static instance: AudioManager;
    private world: World;
    private backgroundMusic?: Audio;
    private sfxVolume: number = 0.5;

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

    public playSoundEffect(sfxPath: string, volume: number = this.sfxVolume): void {
        const sfx = new Audio({
            uri: sfxPath,
            loop: false,
            volume: volume,
        });
        sfx.play(this.world);
    }

    public setSfxVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    public cleanup(): void {
        // Audio cleanup will be handled by the world's garbage collection
        this.backgroundMusic = undefined;
    }
} 