import type { Channel } from '../../types/tv.types';
import { defaultChannels } from '../../config/channels/default.channels';

export interface ChannelConfig {
  channels: Channel[];
  lastUpdated: string;
}

export async function readConfig(): Promise<ChannelConfig> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.loadChannelsConfig) {
      console.log('Using Electron API to load channels');
      const config = await window.electronAPI.loadChannelsConfig();
      console.log('Loaded channels:', config);
      return config;
    } else {
      console.warn('Electron API not available, using default channels');
      return {
        channels: defaultChannels,
        lastUpdated: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Error reading channel config:', error);
    // Si hay un error al leer el archivo, usar los canales por defecto
    const defaultConfig: ChannelConfig = {
      channels: defaultChannels,
      lastUpdated: new Date().toISOString()
    };
    
    // Intentar guardar la configuración por defecto
    try {
      await writeConfig(defaultConfig);
    } catch (writeError) {
      console.error('Error writing default config:', writeError);
    }
    
    return defaultConfig;
  }
}

export async function writeConfig(config: ChannelConfig): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.saveChannelsConfig) {
      console.log('Using Electron API to save channels');
      await window.electronAPI.saveChannelsConfig(config);
      console.log('Channels saved successfully');
    } else {
      console.warn('Electron API not available, changes will not be persisted');
    }
  } catch (error) {
    console.error('Error writing channel config:', error);
    throw error;
  }
}