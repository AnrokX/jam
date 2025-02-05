import { World, Player, PlayerCameraOrientation } from 'hytopia';

export interface PlayerSettings {
    sensitivity: number;
    crosshairColor: string;
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
            crosshairColor: '#ffff00'
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
        } else {
            settings[setting] = value;
        }
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