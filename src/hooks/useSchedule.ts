import { useState, useEffect, useCallback } from 'react';
import type {
  ScheduleEntry,
  TimeCalculation,
  ScheduleStatus,
  ScheduleConfig
} from '../types/schedule.types';
import { ScheduleService } from '../services/ScheduleService';

export interface UseScheduleReturn {
  // Estado del servicio
  status: ScheduleStatus;
  isInitialized: boolean;
  needsYearSelection: boolean;
  
  // Configuración actual
  config: ScheduleConfig | null;
  
  // Programación actual
  currentEntry: ScheduleEntry | null;
  timeCalculation: TimeCalculation | null;
  
  // Métodos
  initialize: () => Promise<void>;
  setPrimaryYear: (year: number) => Promise<void>;
  getCurrentShow: (channelId: string) => Promise<ScheduleEntry | null>;
  getTimeCalculation: (entry: ScheduleEntry) => TimeCalculation;
  enableSeasonRepeat: (enabled: boolean) => Promise<void>;
  
  // Estado de carga
  loading: boolean;
  error: string | null;
}

/**
 * Hook personalizado para manejar la programación de canales
 */
export function useSchedule(): UseScheduleReturn {
  const [status, setStatus] = useState<ScheduleStatus>('not_initialized');
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [currentEntry, setCurrentEntry] = useState<ScheduleEntry | null>(null);
  const [timeCalculation, setTimeCalculation] = useState<TimeCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scheduleService = ScheduleService.getInstance();

  // Derivados del estado
  const isInitialized = status !== 'not_initialized' && status !== 'initializing';
  const needsYearSelection = status === 'needs_year_selection';

  /**
   * Inicializa el servicio de programación
   */
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus('initializing');
      
      console.log('🚀 [useSchedule] Inicializando servicio de programación...');
      
      const newStatus = await scheduleService.initialize();
      setStatus(newStatus);
      
      // Cargar configuración actual
      const currentConfig = await scheduleService.getCurrentConfig();
      setConfig(currentConfig);
      
      console.log('✅ [useSchedule] Servicio inicializado con estado:', newStatus);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ [useSchedule] Error en inicialización:', errorMessage);
      setError(errorMessage);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [scheduleService]);

  /**
   * Establece el año principal de programación
   */
  const setPrimaryYear = useCallback(async (year: number) => {
    try {
      setLoading(true);
      setError(null);
      setStatus('generating');
      
      console.log(`📅 [useSchedule] Estableciendo año principal: ${year}`);
      
      await scheduleService.setPrimaryYear(year);
      
      // Actualizar configuración
      const updatedConfig = await scheduleService.getCurrentConfig();
      setConfig(updatedConfig);
      
      // Verificar el nuevo estado
      const newStatus = await scheduleService.getScheduleStatus();
      setStatus(newStatus);
      
      console.log('✅ [useSchedule] Año principal establecido exitosamente');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al establecer año';
      console.error('❌ [useSchedule] Error estableciendo año:', errorMessage);
      setError(errorMessage);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [scheduleService]);

  /**
   * Obtiene el show actual para un canal
   */
  const getCurrentShow = useCallback(async (channelId: string): Promise<ScheduleEntry | null> => {
    try {
      setError(null);
      
      const entry = await scheduleService.getCurrentScheduleEntry(channelId);
      setCurrentEntry(entry);
      
      if (entry) {
        const calculation = scheduleService.calculateCurrentShowTime(entry);
        setTimeCalculation(calculation);
      } else {
        setTimeCalculation(null);
      }
      
      return entry;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error obteniendo show actual';
      console.error('❌ [useSchedule] Error obteniendo show:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [scheduleService]);

  /**
   * Calcula el tiempo actual de un show
   */
  const getTimeCalculation = useCallback((entry: ScheduleEntry): TimeCalculation => {
    return scheduleService.calculateCurrentShowTime(entry);
  }, [scheduleService]);

  /**
   * Habilita o deshabilita la repetición de temporadas
   */
  const enableSeasonRepeat = useCallback(async (enabled: boolean) => {
    try {
      setError(null);
      
      await scheduleService.enableSeasonRepeat(enabled);
      
      // Actualizar configuración
      const updatedConfig = await scheduleService.getCurrentConfig();
      setConfig(updatedConfig);
      
      console.log(`✅ [useSchedule] Repetición de temporadas ${enabled ? 'habilitada' : 'deshabilitada'}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error cambiando configuración';
      console.error('❌ [useSchedule] Error en configuración:', errorMessage);
      setError(errorMessage);
    }
  }, [scheduleService]);

  /**
   * Actualiza el estado cada minuto para mantener sincronización
   */
  useEffect(() => {
    if (!isInitialized || !currentEntry) return;

    const updateInterval = setInterval(() => {
      if (currentEntry) {
        const calculation = scheduleService.calculateCurrentShowTime(currentEntry);
        setTimeCalculation(calculation);
        
        // Si el show ha terminado, limpiar el estado actual
        if (calculation.remainingTime <= 0) {
          setCurrentEntry(null);
          setTimeCalculation(null);
        }
      }
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(updateInterval);
  }, [isInitialized, currentEntry, scheduleService]);

  /**
   * Verificar estado del servicio periódicamente
   */
  useEffect(() => {
    if (!isInitialized) return;

    const statusInterval = setInterval(async () => {
      try {
        const currentStatus = await scheduleService.getScheduleStatus();
        if (currentStatus !== status) {
          setStatus(currentStatus);
          
          // Si cambió a un estado con configuración actualizada, recargarla
          if (currentStatus === 'ready' || currentStatus === 'converting_videos') {
            const updatedConfig = await scheduleService.getCurrentConfig();
            setConfig(updatedConfig);
          }
        }
      } catch (err) {
        console.error('❌ [useSchedule] Error verificando estado:', err);
      }
    }, 30000); // Verificar cada 30 segundos

    return () => clearInterval(statusInterval);
  }, [isInitialized, status, scheduleService]);

  return {
    // Estado
    status,
    isInitialized,
    needsYearSelection,
    config,
    currentEntry,
    timeCalculation,
    loading,
    error,
    
    // Métodos
    initialize,
    setPrimaryYear,
    getCurrentShow,
    getTimeCalculation,
    enableSeasonRepeat
  };
}

/**
 * Hook para obtener información específica de programación de un canal
 */
export function useChannelSchedule(channelId: string) {
  const [currentShow, setCurrentShow] = useState<ScheduleEntry | null>(null);
  const [timeInfo, setTimeInfo] = useState<TimeCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  
  const scheduleService = ScheduleService.getInstance();

  /**
   * Actualiza la información del canal
   */
  const updateChannelInfo = useCallback(async () => {
    if (!channelId) return;
    
    try {
      setLoading(true);
      
      const entry = await scheduleService.getCurrentScheduleEntry(channelId);
      setCurrentShow(entry);
      
      if (entry) {
        const calculation = scheduleService.calculateCurrentShowTime(entry);
        setTimeInfo(calculation);
      } else {
        setTimeInfo(null);
      }
      
    } catch (err) {
      console.error(`❌ [useChannelSchedule] Error actualizando canal ${channelId}:`, err);
    } finally {
      setLoading(false);
    }
  }, [channelId, scheduleService]);

  // Actualizar información al cambiar de canal
  useEffect(() => {
    updateChannelInfo();
  }, [channelId, updateChannelInfo]);

  // Actualizar cada minuto
  useEffect(() => {
    const interval = setInterval(updateChannelInfo, 60000);
    return () => clearInterval(interval);
  }, [updateChannelInfo]);

  return {
    currentShow,
    timeInfo,
    loading,
    refresh: updateChannelInfo
  };
}