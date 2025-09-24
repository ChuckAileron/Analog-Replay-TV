import { useState, useEffect } from 'react';
import type { CommercialConfig, CommercialContext } from '../types/commercial.types';
import { CommercialService } from '../services/CommercialService';

/**
 * Hook personalizado para manejar comerciales
 */
export const useCommercials = () => {
  const [config, setConfig] = useState<CommercialConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const commercialService = CommercialService.getInstance();

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedConfig = await commercialService.getConfig();
      setConfig(loadedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar comerciales');
      console.error('Error loading commercial config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  /**
   * Obtiene comerciales para un canal y año específicos
   */
  const getCommercialsForChannel = async (
    channel: string,
    year?: number,
    maxYearDifference: number = 5
  ) => {
    try {
      return await commercialService.getCommercialsByChannelAndYear(
        channel,
        year,
        maxYearDifference
      );
    } catch (err) {
      console.error('Error getting commercials for channel:', err);
      return [];
    }
  };

  /**
   * Obtiene comerciales aleatorios para rellenar un tiempo específico
   */
  const getRandomCommercialsForDuration = async (
    channel: string,
    durationInSeconds: number,
    year?: number
  ) => {
    try {
      return await commercialService.getRandomCommercialsForDuration(
        channel,
        durationInSeconds,
        year
      );
    } catch (err) {
      console.error('Error getting random commercials:', err);
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
   * Obtiene todos los contextos de comerciales
   */
  const getContexts = (): CommercialContext[] => {
    return config?.contexts || [];
  };

  /**
   * Obtiene contextos por canal
   */
  const getContextsByChannel = (channel: string): CommercialContext[] => {
    return config?.contexts.filter(context => 
      context.channel.includes(channel)
    ) || [];
  };

  /**
   * Obtiene un contexto por ID
   */
  const getContextById = (contextId: string): CommercialContext | undefined => {
    return config?.contexts.find(context => context.id === contextId);
  };

  /**
   * Obtiene estadísticas de comerciales
   */
  const getStats = () => {
    if (!config) {
      return {
        totalContexts: 0,
        totalCommercials: 0,
        channelsWithCommercials: 0,
        yearsRange: { min: 0, max: 0 }
      };
    }

    const totalContexts = config.contexts.length;
    const totalCommercials = config.contexts.reduce(
      (sum, context) => sum + context.commercials.length,
      0
    );

    const allChannels = new Set(
      config.contexts.flatMap(context => context.channel)
    );
    const channelsWithCommercials = allChannels.size;

    const allYears = config.contexts.flatMap(context =>
      context.commercials.map(commercial => commercial.year)
    );
    const yearsRange = allYears.length > 0 
      ? { min: Math.min(...allYears), max: Math.max(...allYears) }
      : { min: 0, max: 0 };

    return {
      totalContexts,
      totalCommercials,
      channelsWithCommercials,
      yearsRange
    };
  };

  return {
    config,
    loading,
    error,
    getCommercialsForChannel,
    getRandomCommercialsForDuration,
    reloadConfig,
    getContexts,
    getContextsByChannel,
    getContextById,
    getStats
  };
};