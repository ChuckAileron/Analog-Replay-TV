import type { TVSettings, AspectRatio, CRTFilterStyle } from '../../types/tv.types';

// Definimos las configuraciones por defecto en el código
const DEFAULT_SETTINGS: TVSettings = {
  brightness  : 50,
  contrast    : 50,
  volume      : 50,
  isMuted     : false,
  aspectRatio : '16:9',
  tvStyle     : '90s',
  crtFilter   : true,  // Por defecto activado
  crtStyle    : 'analog-replay', // Filtro original de Analog Replay TV
  tvFrame     : true,  // Bisel de la TV visible por defecto (solo aplica al estilo 90s)
  lastChannel : 1       // Por defecto, canal 1
};
// Clave para almacenamiento local
const STORAGE_KEY: string = 'retro-tv-settings';

/**
 * Obtiene las configuraciones almacenadas en localStorage
 * @returns {TVSettings | null} Las configuraciones almacenadas o null si hay error
 */
const getStoredSettings = (): TVSettings | null => {
    try {
        const stored: string | null = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Error reading settings from localStorage:', error);
        return null;
    }
};

/**
 * Guarda las configuraciones en localStorage
 * @param {TVSettings} settings - Las configuraciones a guardar
 */
const saveSettings = (settings: TVSettings): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        void window.electronAPI?.saveSettingsConfig?.(settings).catch((error) => {
            console.error('Error persisting settings in SQLite:', error);
        });
    } catch (error) {
        console.error('Error saving settings to localStorage:', error);
    }
};

export const settingsManager = {
    initialize: async (): Promise<TVSettings> => {
        const legacySettings = settingsManager.getCurrentSettings();
        try {
            const storedSettings = await window.electronAPI.migrateSettingsConfig(legacySettings);
            const settings = { ...DEFAULT_SETTINGS, ...storedSettings };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return settings;
        } catch (error) {
            console.error('Error initializing settings from SQLite:', error);
            return legacySettings;
        }
    },

    /**
     * Obtiene la configuración actual
     * @returns {TVSettings} La configuración actual
     */
    getCurrentSettings: (): TVSettings => {
        const storedSettings: TVSettings | null = getStoredSettings();
        return storedSettings 
            ? { ...DEFAULT_SETTINGS, ...storedSettings } 
            : DEFAULT_SETTINGS;
    },

    /**
     * Actualiza una configuración específica
     * @param {Partial<TVSettings>} settings - Configuraciones parciales a actualizar
     * @returns {TVSettings} Las nuevas configuraciones
     */
    updateSettings: (settings: Partial<TVSettings>): TVSettings => {
        const currentSettings: TVSettings = settingsManager.getCurrentSettings();
        const newSettings: TVSettings    = {
            ...currentSettings,
            ...settings
        };
        
        saveSettings(newSettings);
        return newSettings;
    },

    /**
     * Restaura la configuración por defecto
     * @returns {TVSettings} Las configuraciones por defecto
     */
    resetSettings: (): TVSettings => {
        saveSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    },

    /**
     * Cambia el aspect ratio entre 16:9 y 4:3
     * @returns {TVSettings} Las nuevas configuraciones
     */
    toggleAspectRatio: (): TVSettings => {
        const currentSettings: TVSettings = settingsManager.getCurrentSettings();
        const newAspectRatio: AspectRatio = currentSettings.aspectRatio === '16:9'
            ? '4:3'
            : '16:9';
        return settingsManager.updateSettings({ aspectRatio: newAspectRatio });
    },

    /**
     * Cambia el estilo de TV entre 90s y 00s
     * @returns {TVSettings} Las nuevas configuraciones
     */
    toggleTVStyle: (): TVSettings => {
        const currentSettings: TVSettings = settingsManager.getCurrentSettings();
        const newStyle = currentSettings.tvStyle === '90s' ? '00s' : '90s';
        return settingsManager.updateSettings({ tvStyle: newStyle });
    },

    /**
     * Activa/desactiva el filtro CRT (solo aplica al estilo 90s)
     * @returns {TVSettings} Las nuevas configuraciones
     */
    toggleCRTFilter: (): TVSettings => {
        const currentSettings: TVSettings = settingsManager.getCurrentSettings();
        return settingsManager.updateSettings({ crtFilter: !currentSettings.crtFilter });
    },

    /**
     * Elige el shader del filtro CRT (solo aplica al estilo 90s)
     * @param {CRTFilterStyle} crtStyle - Shader a utilizar
     * @returns {TVSettings} Las nuevas configuraciones
     */
    setCRTStyle: (crtStyle: CRTFilterStyle): TVSettings => {
        return settingsManager.updateSettings({ crtStyle });
    },

    /**
     * Alterna entre los shaders del filtro CRT disponibles
     * @returns {TVSettings} Las nuevas configuraciones
     */
    cycleCRTStyle: (): TVSettings => {
        const currentSettings: TVSettings = settingsManager.getCurrentSettings();
        const newStyle: CRTFilterStyle = currentSettings.crtStyle === 'royale'
            ? 'analog-replay'
            : 'royale';
        return settingsManager.setCRTStyle(newStyle);
    },

    /**
     * Muestra/oculta el bisel (marco) de la TV (solo aplica al estilo 90s;
     * el estilo 00s siempre se ve sin marco)
     * @returns {TVSettings} Las nuevas configuraciones
     */
    toggleTVFrame: (): TVSettings => {
        const currentSettings: TVSettings = settingsManager.getCurrentSettings();
        return settingsManager.updateSettings({ tvFrame: !currentSettings.tvFrame });
    },

    /**
     * Guarda el último canal sintonizado, para restaurarlo al reabrir la app
     * @param {number} channelNumber - Número del canal actual
     * @returns {TVSettings} Las nuevas configuraciones
     */
    setLastChannel: (channelNumber: number): TVSettings => {
        return settingsManager.updateSettings({ lastChannel: channelNumber });
    }
};
