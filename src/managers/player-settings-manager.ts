import { World, Player, PlayerCameraOrientation } from 'hytopia';

export interface PlayerSettings {
    sensitivity: number;
    crosshairColor: string;
    bgmVolume: number;
}

export interface UISettingsData {
    type: 'updateSettings';
    setting: keyof PlayerSettings;
    value: any;
}

export class PlayerSettingsManager {
    private static instance: PlayerSettingsManager;
    private readonly world: World;
    private playerSettings = new Map<string, PlayerSettings>();

    // Sensitivity constants
    private static readonly SENSITIVITY = {
        DEFAULT: 1.0,
        MIN: 0.1,
        MAX: 5.0,
        // Convert UI slider (1-100) to actual multiplier
        SLIDER_TO_MULTIPLIER: (value: number) => {
            // Non-linear scaling for better fine control
            // 1-100 gets mapped to 0.1-5.0 with exponential scaling
            const normalized = value / 100;
            return PlayerSettingsManager.SENSITIVITY.MIN + 
                   (Math.pow(normalized, 2) * 
                   (PlayerSettingsManager.SENSITIVITY.MAX - PlayerSettingsManager.SENSITIVITY.MIN));
        }
    };

    private constructor(world: World) {
        this.world = world;
    }

    public static getInstance(world: World): PlayerSettingsManager {
        if (!PlayerSettingsManager.instance) {
            PlayerSettingsManager.instance = new PlayerSettingsManager(world);
        }
        return PlayerSettingsManager.instance;
    }

    public initializePlayer(playerId: string): void {
        this.playerSettings.set(playerId, {
            sensitivity: PlayerSettingsManager.SENSITIVITY.DEFAULT,
            crosshairColor: '#ffff00',
            bgmVolume: 0.1 // Default background music volume
        });
    }

    public removePlayer(playerId: string): void {
        this.playerSettings.delete(playerId);
    }

    public updateSetting(playerId: string, setting: keyof PlayerSettings, value: any): void {
        const settings = this.playerSettings.get(playerId);
        if (!settings) return;

        if (setting === 'sensitivity') {
            // Convert slider value to actual multiplier
            const multiplier = PlayerSettingsManager.SENSITIVITY.SLIDER_TO_MULTIPLIER(value);
            settings.sensitivity = multiplier;
        } else if (setting === 'bgmVolume') {
            // Convert slider value (0-100) to volume (0-1)
            // Ensure exact 0 when muting
            const normalizedVolume = value / 100;
            settings.bgmVolume = normalizedVolume === 0 ? 0 : Math.max(0, Math.min(1, normalizedVolume));
        } else {
            settings[setting] = value;
        }
    }

    /**
     * Gets the current settings for a player
     * @param playerId The ID of the player
     * @returns The player's settings or undefined if not found
     */
    public getPlayerSettings(playerId: string): PlayerSettings | undefined {
        return this.playerSettings.get(playerId);
    }

    public applyCameraSensitivity(playerId: string, orientation: PlayerCameraOrientation): PlayerCameraOrientation {
        const settings = this.playerSettings.get(playerId);
        if (!settings) return orientation;

        // Apply sensitivity multiplier to both pitch and yaw
        return {
            pitch: orientation.pitch * settings.sensitivity,
            yaw: orientation.yaw * settings.sensitivity
        };
    }

    public cleanup(): void {
        this.playerSettings.clear();
    }
} 