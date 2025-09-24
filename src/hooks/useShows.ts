import { useState, useEffect } from 'react';
import type { ShowConfig, TVShow } from '../types/show.types';
import { ShowService } from '../services/ShowService';

/**
 * Hook personalizado para manejar shows
 */
export const useShows = () => {
  const [config, setConfig] = useState<ShowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const showService = ShowService.getInstance();

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedConfig = await showService.getConfig();
      setConfig(loadedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar shows');
      console.error('Error loading show config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  /**
   * Obtiene shows para un canal específico
   */
  const getShowsForChannel = async (channel: string): Promise<TVShow[]> => {
    try {
      return await showService.getShowsByChannel(channel);
    } catch (err) {
      console.error('Error getting shows for channel:', err);
      return [];
    }
  };

  /**
   * Obtiene shows para un año específico con tolerancia
   */
  const getShowsForYear = async (
    year: number,
    tolerance: number = 3
  ): Promise<TVShow[]> => {
    try {
      return await showService.getShowsByYear(year, tolerance);
    } catch (err) {
      console.error('Error getting shows for year:', err);
      return [];
    }
  };

  /**
   * Obtiene shows para un canal y año específicos
   */
  const getShowsForChannelAndYear = async (
    channel: string,
    year: number,
    tolerance: number = 3
  ): Promise<TVShow[]> => {
    try {
      return await showService.getShowsByChannelAndYear(channel, year, tolerance);
    } catch (err) {
      console.error('Error getting shows for channel and year:', err);
      return [];
    }
  };

  /**
   * Obtiene un show aleatorio para un canal
   */
  const getRandomShowForChannel = async (channel: string): Promise<TVShow | null> => {
    try {
      return await showService.getRandomShowByChannel(channel);
    } catch (err) {
      console.error('Error getting random show:', err);
      return null;
    }
  };

  /**
   * Obtiene shows aleatorios para programación
   */
  const getRandomShowsForSchedule = async (
    channel: string,
    year: number,
    count: number = 6,
    tolerance: number = 3
  ): Promise<TVShow[]> => {
    try {
      return await showService.getRandomShowsForSchedule(channel, year, count, tolerance);
    } catch (err) {
      console.error('Error getting random shows for schedule:', err);
      return [];
    }
  };

  /**
   * Busca shows por query
   */
  const searchShows = async (query: string): Promise<TVShow[]> => {
    try {
      return await showService.searchShows(query);
    } catch (err) {
      console.error('Error searching shows:', err);
      return [];
    }
  };

  /**
   * Obtiene un show por ID
   */
  const getShowById = async (showId: number): Promise<TVShow | undefined> => {
    try {
      return await showService.getShowById(showId);
    } catch (err) {
      console.error('Error getting show by id:', err);
      return undefined;
    }
  };

  /**
   * Obtiene shows por rango de años
   */
  const getShowsByYearRange = async (
    startYear: number,
    endYear: number
  ): Promise<TVShow[]> => {
    try {
      return await showService.getShowsByYearRange(startYear, endYear);
    } catch (err) {
      console.error('Error getting shows by year range:', err);
      return [];
    }
  };

  /**
   * Recarga la configuración
   */
  const reloadConfig = async () => {
    await loadConfig();
  };

  /**
   * Actualiza la configuración
   */
  const updateConfig = async (newConfig: ShowConfig) => {
    try {
      await showService.updateConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar configuración');
      console.error('Error updating config:', err);
    }
  };

  /**
   * Obtiene todos los shows
   */
  const getAllShows = (): TVShow[] => {
    return config?.shows || [];
  };

  /**
   * Obtiene estadísticas de shows
   */
  const getStats = async () => {
    try {
      return await showService.getStats();
    } catch (err) {
      console.error('Error getting stats:', err);
      return {
        totalShows: 0,
        totalSeasons: 0,
        totalEpisodes: 0,
        channelsCount: 0,
        channels: [],
        yearsRange: { min: 0, max: 0 },
        averageEpisodesPerShow: 0,
        averageSeasonsPerShow: 0,
        averageEpisodeDuration: 0,
        lastUpdated: ''
      };
    }
  };

  /**
   * Obtiene canales únicos de todos los shows
   */
  const getUniqueChannels = (): string[] => {
    if (!config) return [];
    
    const channelSet = new Set<string>();
    config.shows.forEach(show => {
      show.channel.forEach(channel => channelSet.add(channel));
    });
    
    return Array.from(channelSet).sort();
  };

  /**
   * Obtiene años únicos de todas las temporadas
   */
  const getUniqueYears = (): number[] => {
    if (!config) return [];
    
    const yearSet = new Set<number>();
    config.shows.forEach(show => {
      show.seasons.forEach(season => yearSet.add(season.year));
    });
    
    return Array.from(yearSet).sort();
  };

  /**
   * Filtra shows por múltiples criterios
   */
  const filterShows = (filters: {
    channel?: string;
    year?: number;
    yearTolerance?: number;
    hasMultipleSeasons?: boolean;
    minEpisodes?: number;
  }): TVShow[] => {
    if (!config) return [];

    return config.shows.filter(show => {
      // Filtro por canal
      if (filters.channel && !show.channel.includes(filters.channel)) {
        return false;
      }

      // Filtro por año
      if (filters.year !== undefined) {
        const tolerance = filters.yearTolerance || 3;
        const hasMatchingYear = show.seasons.some(season =>
          Math.abs(season.year - filters.year!) <= tolerance
        );
        if (!hasMatchingYear) return false;
      }

      // Filtro por múltiples temporadas
      if (filters.hasMultipleSeasons && show.seasons.length <= 1) {
        return false;
      }

      // Filtro por número mínimo de episodios
      if (filters.minEpisodes) {
        const totalEpisodes = show.seasons.reduce(
          (sum, season) => sum + season.episodes.length, 
          0
        );
        if (totalEpisodes < filters.minEpisodes) return false;
      }

      return true;
    });
  };

  return {
    config,
    loading,
    error,
    // Métodos de consulta
    getShowsForChannel,
    getShowsForYear,
    getShowsForChannelAndYear,
    getRandomShowForChannel,
    getRandomShowsForSchedule,
    searchShows,
    getShowById,
    getShowsByYearRange,
    // Métodos de configuración
    reloadConfig,
    updateConfig,
    // Métodos de acceso directo
    getAllShows,
    getStats,
    getUniqueChannels,
    getUniqueYears,
    filterShows
  };
};