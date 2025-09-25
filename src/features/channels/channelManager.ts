import type { Channel } from '../../types/tv.types';
import type { TVShow } from '../../types/show.types';
import { readConfig, writeConfig } from './channelsStorage';
import { showManager } from '../shows/showManager';

interface ChannelChangeResult {
  channelNumber: number;
  channelInfo: Channel | null;
  show: TVShow | null;
  error?: string;
}

// Rango de números de canal permitidos
const MIN_CHANNEL:  number  = 1;
const MAX_CHANNEL:  number  = 999;

// Estado interno
let channels:               Channel[]             = [];
let isInitialized:          boolean               = false;
let initializationPromise:  Promise<void> | null  = null;

// Función auxiliar para guardar la configuración de canales
async function saveToFile(channels: Channel[]): Promise<void> {
  const config = {
    channels,
    lastUpdated: new Date().toISOString()
  };

  await writeConfig(config);
}

export const channelManager = {
  // Inicializar los canales
  initialize: async (): Promise<void> => {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        if (!isInitialized) {
          console.log('Initializing channels...');
          const config = await readConfig();
          channels = config.channels;
          isInitialized = true;
          console.log('Channels initialized:', channels);
        }
      }
      catch (error) {
        console.error('Error in channel initialization:', error);
        throw error;
      }
    })();

    return initializationPromise;
  },
  changeChannel: async (currentChannel: number, direction: 'up' | 'down'): Promise<ChannelChangeResult> => {
    try {
      // Asegurarse de que ambos managers estén inicializados
      await Promise.all([
        !isInitialized ? channelManager.initialize() : Promise.resolve(),
        showManager.initialize()
      ]);

      // Si no hay canales configurados o están vacíos, usar el comportamiento básico
      if (!channels || channels.length === 0) {
        console.log('⚠️ [channelManager] No hay canales configurados, usando comportamiento básico');
        const newChannel = direction === 'up'
          ? (currentChannel < MAX_CHANNEL ? currentChannel + 1 : MIN_CHANNEL)
          : (currentChannel > MIN_CHANNEL ? currentChannel - 1 : MAX_CHANNEL);
          
        return {
          channelNumber: newChannel,
          channelInfo: null,
          show: null,
          error: 'No hay canales configurados'
        };
      }

      // Obtener todos los números de canal disponibles y ordenarlos
      const availableChannels = channels
        .filter(ch => ch.isEnabled !== false) // Solo incluir canales habilitados
        .map(ch => ch.number)
        .sort((a, b) => a - b);

      if (availableChannels.length === 0) {
        console.log('⚠️ [channelManager] No hay canales habilitados');
        return {
          channelNumber: currentChannel,
          channelInfo: null,
          show: null,
          error: 'No hay canales habilitados'
        };
      }

      console.log('📺 [channelManager] Canales disponibles:', availableChannels);
      console.log(`🔄 [channelManager] Cambiando canal ${currentChannel} ${direction === 'up' ? '⬆️' : '⬇️'}`);

      // Determinar el nuevo número de canal
      const newChannelNumber = direction === 'up'
        ? (availableChannels.find(num => num > currentChannel) || availableChannels[0])
        : ([...availableChannels].reverse().find(num => num < currentChannel) || availableChannels[availableChannels.length - 1]);

      console.log(`✅ [channelManager] Nuevo canal: ${newChannelNumber}`);

      // Obtener la información del canal
      const channelInfo = channelManager.getChannelInfo(newChannelNumber);
      if (!channelInfo) {
        return {
          channelNumber: newChannelNumber,
          channelInfo: null,
          show: null,
          error: `No se encontró información para el canal ${newChannelNumber}`
        };
      }

      // Buscar el programa correspondiente
      console.log('🔍 [channelManager] Buscando show para el canal:', channelInfo.name, `(ID: ${channelInfo.id}, UUID: ${channelInfo.uuid})`);
      const shows = await showManager.getShows();
      
      console.log('🎬 [channelManager] Shows disponibles:', shows.length);
      shows.forEach((show: TVShow, index: number) => {
        console.log(`  [${index}] ${show.name} -> canales:`, show.channel);
        console.log(`    📝 Tipo de canales:`, typeof show.channel);
        console.log(`    📝 ¿Es array?:`, Array.isArray(show.channel));
        console.log(`    📝 Contenido:`, JSON.stringify(show.channel));
      });
      
      const matchingShow = shows.find((show: TVShow) => {
        const matches = show.channel.some((ch: string) => {
          const uuidMatch = ch === channelInfo.uuid;
          const idMatch = ch === String(channelInfo.id);
          const nameMatch = ch.toLowerCase() === channelInfo.name.toLowerCase();
          
          console.log(`  🔍 Comparando "${ch}" con:`, {
            uuid: channelInfo.uuid,
            uuidMatch,
            id: String(channelInfo.id),
            idMatch,
            name: channelInfo.name.toLowerCase(),
            nameMatch,
            chType: typeof ch,
            chValue: ch
          });
          
          return uuidMatch || idMatch || nameMatch;
        });
        
        if (matches) {
          console.log(`  ✅ Show encontrado: ${show.name}`);
        }
        
        return matches;
      });

      if (matchingShow) {
        // Verificar que el programa tenga al menos una temporada con episodios
        const hasEpisodes = matchingShow.seasons.some((season: any) => 
          season.episodes && season.episodes.length > 0 && season.contentPath
        );

        if (hasEpisodes) {
          console.log('✅ [channelManager] Show encontrado:', {
            id: matchingShow.id,
            nombre: matchingShow.name,
            temporadas: matchingShow.seasons.length,
            episodiosTotales: matchingShow.seasons.reduce((total: number, season: any) => total + season.episodes.length, 0)
          });
          
          // LOGS DETALLADOS PARA DEBUG
          console.log(`📺 [channelManager] CANAL ACTUAL: ${newChannelNumber} (${channelInfo.name})`);
          console.log(`🎬 [channelManager] SHOW SELECCIONADO: ${matchingShow.name}`);
          console.log(`🎯 [channelManager] CANALES DEL SHOW: [${matchingShow.channel.join(', ')}]`);
          
          // Seleccionar episodio para mostrar info
          const randomSeason = matchingShow.seasons[Math.floor(Math.random() * matchingShow.seasons.length)];
          const randomEpisode = randomSeason.episodes[Math.floor(Math.random() * randomSeason.episodes.length)];
          
          console.log(`🎭 [channelManager] EPISODIO QUE SE VA A REPRODUCIR:`);
          console.log(`   - Serie: ${matchingShow.name}`);
          console.log(`   - Temporada: ${randomSeason.season}`);
          console.log(`   - Episodio: ${randomEpisode.episode} - ${randomEpisode.title}`);
          console.log(`   - Archivo: ${randomEpisode.fileName}`);
          console.log(`   - Ruta: ${randomSeason.contentPath}`);
          console.log(`📍 [channelManager] REPRODUCIENDO EN CANAL: ${newChannelNumber} (${channelInfo.name})`);
          
        } else {
          console.log('⚠️ [channelManager] Show encontrado pero no tiene episodios disponibles:', matchingShow.name);
          return {
            channelNumber: newChannelNumber,
            channelInfo,
            show: null,
            error: undefined // No mostramos error al usuario
          };
        }
      } else {
        console.log('ℹ️ [channelManager] No se encontró show para el canal');
      }

      return {
        channelNumber: newChannelNumber,
        channelInfo,
        show: matchingShow || null,
        error: undefined // No mostramos error al usuario
      };
    } catch (error) {
      console.error('❌ [channelManager] Error al cambiar canal:', error);
      return {
        channelNumber: currentChannel, // Mantener el canal actual en caso de error
        channelInfo: null,
        show: null,
        error: `Error al cambiar canal: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  isValidChannel: (channelNumber: number): boolean => {
    return channelNumber >= MIN_CHANNEL && channelNumber <= MAX_CHANNEL;
  },

  getChannelInfo: (channelNumber: number): Channel | null => {
    return channels.find(ch => ch.number === channelNumber) || null;
  },

  getChannels: async (): Promise<Channel[]> => {
    return channels;
  },

  addChannel: async (channelData: Omit<Channel, 'id'>): Promise<Channel> => {
    const newChannel: Channel = {
      ...channelData,
      id: Math.max(0, ...channels.map(ch => typeof ch.id === 'number' ? ch.id : 0)) + 1
    };
    channels.push(newChannel);

    console.log('Added new channel:', newChannel);
    
    try {
      // Guardar tanto en localStorage como en el archivo
      const config = {
        channels,
        lastUpdated: new Date().toISOString()
      };
      
      await Promise.all([
        writeConfig(config),
        saveToFile(channels)
      ]);
    }
    catch (error) {
      console.error('Error saving channel:', error);
      // Revertir cambios en memoria si hay error
      channels.pop();
      throw error;
    }
    
    return newChannel;
  },

  updateChannel: async (id: number, updates: Partial<Channel>): Promise<Channel | null> => {
    const index = channels.findIndex(ch => ch.id === id);
    if (index === -1) return null;

    const oldChannel = { ...channels[index] };
    channels[index] = { ...oldChannel, ...updates };
    
    console.log('Updated channel:', channels[index]);

    try {
      // Guardar tanto en localStorage como en el archivo
      const config = {
        channels,
        lastUpdated: new Date().toISOString()
      };
      
      await Promise.all([
        writeConfig(config),
        saveToFile(channels)
      ]);
    }
    catch (error) {
      console.error('Error updating channel:', error);
      // Revertir cambios en memoria si hay error
      channels[index] = oldChannel;
      throw error;
    }
    
    return channels[index];
  },

  deleteChannel: async (id: number): Promise<boolean> => {
    const initialLength:  number          = channels.length;
    const oldChannels:    Array<Channel>  = [...channels];
    
    channels = channels.filter(ch => ch.id !== id);
    
    try {
      // Guardar tanto en localStorage como en el archivo
      const config = {
        channels,
        lastUpdated: new Date().toISOString()
      };
      
      await Promise.all([
        writeConfig(config),
        saveToFile(channels)
      ]);
    }
    catch (error) {
      console.error('Error deleting channel:', error);
      // Revertir cambios en memoria si hay error
      channels = oldChannels;
      throw error;
    }
    
    return channels.length !== initialLength;
  }
};
