import type { TVSettings, AspectRatio } from '../../types/tv.types';

// Definimos las configuraciones por defecto en el código
const DEFAULT_SETTINGS: TVSettings = {
  brightness  : 50,
  contrast    : 50,
  volume      : 50,
  isMuted     : false,
  aspectRatio : '16:9',
  tvStyle     : '90s'
};// Clave para almacenamiento local
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
    } catch (error) {
        console.error('Error saving settings to localStorage:', error);
    }
};

export const settingsManager = {
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
     * Obtiene el valor del aspect ratio actual
     * @returns {AspectRatio} El aspect ratio actual
     */
    getAspectRatio: (): AspectRatio => {
        return settingsManager.getCurrentSettings().aspectRatio;
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
    }
};
