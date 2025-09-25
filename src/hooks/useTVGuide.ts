import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  TVGuideData,
  TVGuideNavigationState,
  TVGuideViewConfig,
  TVGuideProgram
} from '../types/schedule.types';
import { ScheduleService } from '../services/ScheduleService';

export interface UseTVGuideReturn {
  // Datos de la guía
  guideData: TVGuideData | null;
  guideDataRange: Map<string, TVGuideData>;
  
  // Estado de navegación
  navigationState: TVGuideNavigationState;
  
  // Configuración de vista
  viewConfig: TVGuideViewConfig;
  
  // Estados de carga
  loading: boolean;
  error: string | null;
  
  // Métodos de navegación
  navigateUp: () => void;
  navigateDown: () => void;
  navigateLeft: () => void;
  navigateRight: () => void;
  goToDate: (year: number, month: number, day: number) => Promise<void>;
  goToToday: () => Promise<void>;
  goToChannel: (channelIndex: number) => void;
  
  // Métodos de datos
  refreshData: () => Promise<void>;
  searchPrograms: (query: string) => Promise<void>;
  getSelectedProgram: () => TVGuideProgram | null;
  
  // Resultados de búsqueda
  searchResults: { date: string; channel: any; program: TVGuideProgram }[];
  isSearching: boolean;
  clearSearch: () => void;
  
  // Estadísticas
  stats: any;
}

const DEFAULT_VIEW_CONFIG: TVGuideViewConfig = {
  showPastDays: 3,
  showFutureDays: 7,
  timeSlotDuration: 30,
  startHour: 6,
  endHour: 26 // 02:00 del día siguiente
};

/**
 * Hook personalizado para manejar el TV Guide con navegación por teclado
 */
export function useTVGuide(): UseTVGuideReturn {
  const [guideData, setGuideData] = useState<TVGuideData | null>(null);
  const [guideDataRange, setGuideDataRange] = useState<Map<string, TVGuideData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewConfig] = useState<TVGuideViewConfig>(DEFAULT_VIEW_CONFIG);
  const [searchResults, setSearchResults] = useState<{ date: string; channel: any; program: TVGuideProgram }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const scheduleService = ScheduleService.getInstance();

  // Estado de navegación inicial
  const today = new Date();
  const [navigationState, setNavigationState] = useState<TVGuideNavigationState>({
    selectedYear: today.getFullYear(),
    selectedMonth: today.getMonth() + 1,
    selectedDay: today.getDate(),
    selectedChannel: 0,
    selectedProgram: 0
  });

  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>();

  // Cargar datos automáticamente cuando se inicializa el hook
  useEffect(() => {
    console.log('🚀 [useTVGuide] Inicializando hook, cargando datos para hoy');
    loadGuideData(navigationState.selectedYear, navigationState.selectedMonth, navigationState.selectedDay);
  }, []); // Solo ejecutar una vez al montar

  /**
   * Carga los datos de la guía para una fecha específica
   */
  const loadGuideData = useCallback(async (year: number, month: number, day: number) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`📅 [useTVGuide] Cargando datos para ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      
      const data = await scheduleService.getTVGuideData(year, month, day);
      console.log(`📊 [useTVGuide] Datos recibidos:`, {
        hasData: !!data,
        channelsCount: data?.channels?.length || 0,
        totalPrograms: data?.channels?.reduce((total: number, ch: any) => total + (ch.programs?.length || 0), 0) || 0
      });
      
      setGuideData(data);

      if (data && data.channels.length > 0) {
        // Ajustar el canal seleccionado si está fuera de rango
        setNavigationState(prev => ({
          ...prev,
          selectedChannel: Math.min(prev.selectedChannel, data.channels.length - 1)
        }));
        console.log(`✅ [useTVGuide] Datos cargados exitosamente: ${data.channels.length} canales`);
      } else {
        console.warn(`⚠️ [useTVGuide] No se encontraron datos para la fecha solicitada`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error cargando datos de la guía';
      console.error('❌ [useTVGuide] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [scheduleService]);

  /**
   * Carga un rango de datos para navegación fluida
   */
  const loadGuideDataRange = useCallback(async (centerDate: Date) => {
    try {
      const startDate = new Date(centerDate);
      startDate.setDate(startDate.getDate() - viewConfig.showPastDays);
      
      const endDate = new Date(centerDate);
      endDate.setDate(endDate.getDate() + viewConfig.showFutureDays);

      console.log(`📅 [useTVGuide] Cargando rango: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}`);
      
      const rangeData = await scheduleService.getTVGuideDataRange(startDate, endDate);
      setGuideDataRange(rangeData);

      // Cargar estadísticas
      const statsData = await scheduleService.getTVGuideStats(startDate, endDate);
      setStats(statsData);

    } catch (err) {
      console.error('❌ [useTVGuide] Error cargando rango:', err);
    }
  }, [scheduleService, viewConfig]);

  /**
   * Navegar hacia arriba (canal anterior)
   */
  const navigateUp = useCallback(() => {
    setNavigationState(prev => {
      if (!guideData || guideData.channels.length === 0) return prev;
      
      const newChannelIndex = prev.selectedChannel > 0 ? prev.selectedChannel - 1 : guideData.channels.length - 1;
      
      return {
        ...prev,
        selectedChannel: newChannelIndex,
        selectedProgram: 0 // Reset al primer programa
      };
    });
  }, [guideData]);

  /**
   * Navegar hacia abajo (canal siguiente)
   */
  const navigateDown = useCallback(() => {
    setNavigationState(prev => {
      if (!guideData || guideData.channels.length === 0) return prev;
      
      const newChannelIndex = prev.selectedChannel < guideData.channels.length - 1 ? prev.selectedChannel + 1 : 0;
      
      return {
        ...prev,
        selectedChannel: newChannelIndex,
        selectedProgram: 0 // Reset al primer programa
      };
    });
  }, [guideData]);

  /**
   * Navegar hacia la izquierda (día anterior o programa anterior)
   */
  const navigateLeft = useCallback(() => {
    setNavigationState(prev => {
      if (!guideData) return prev;

      const currentChannel = guideData.channels[prev.selectedChannel];
      
      // Si hay programa anterior en el canal actual
      if (currentChannel && prev.selectedProgram > 0) {
        return {
          ...prev,
          selectedProgram: prev.selectedProgram - 1
        };
      }
      
      // Si no hay programa anterior, ir al día anterior
      const currentDate = new Date(prev.selectedYear, prev.selectedMonth - 1, prev.selectedDay);
      currentDate.setDate(currentDate.getDate() - 1);
      
      const newState = {
        ...prev,
        selectedYear: currentDate.getFullYear(),
        selectedMonth: currentDate.getMonth() + 1,
        selectedDay: currentDate.getDate(),
        selectedProgram: 0
      };

      // Cargar datos del nuevo día
      loadGuideData(newState.selectedYear, newState.selectedMonth, newState.selectedDay);
      
      return newState;
    });
  }, [guideData, loadGuideData]);

  /**
   * Navegar hacia la derecha (día siguiente o programa siguiente)
   */
  const navigateRight = useCallback(() => {
    setNavigationState(prev => {
      if (!guideData) return prev;

      const currentChannel = guideData.channels[prev.selectedChannel];
      
      // Si hay programa siguiente en el canal actual
      if (currentChannel && prev.selectedProgram < currentChannel.programs.length - 1) {
        return {
          ...prev,
          selectedProgram: prev.selectedProgram + 1
        };
      }
      
      // Si no hay programa siguiente, ir al día siguiente
      const currentDate = new Date(prev.selectedYear, prev.selectedMonth - 1, prev.selectedDay);
      currentDate.setDate(currentDate.getDate() + 1);
      
      const newState = {
        ...prev,
        selectedYear: currentDate.getFullYear(),
        selectedMonth: currentDate.getMonth() + 1,
        selectedDay: currentDate.getDate(),
        selectedProgram: 0
      };

      // Cargar datos del nuevo día
      loadGuideData(newState.selectedYear, newState.selectedMonth, newState.selectedDay);
      
      return newState;
    });
  }, [guideData, loadGuideData]);

  /**
   * Ir a una fecha específica
   */
  const goToDate = useCallback(async (year: number, month: number, day: number) => {
    setNavigationState(prev => ({
      ...prev,
      selectedYear: year,
      selectedMonth: month,
      selectedDay: day,
      selectedChannel: 0,
      selectedProgram: 0
    }));

    await loadGuideData(year, month, day);
    await loadGuideDataRange(new Date(year, month - 1, day));
  }, [loadGuideData, loadGuideDataRange]);

  /**
   * Ir al día actual
   */
  const goToToday = useCallback(async () => {
    const today = new Date();
    await goToDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }, [goToDate]);

  /**
   * Ir a un canal específico
   */
  const goToChannel = useCallback((channelIndex: number) => {
    setNavigationState(prev => ({
      ...prev,
      selectedChannel: Math.max(0, Math.min(channelIndex, (guideData?.channels.length || 1) - 1)),
      selectedProgram: 0
    }));
  }, [guideData]);

  /**
   * Refrescar los datos actuales
   */
  const refreshData = useCallback(async () => {
    const { selectedYear, selectedMonth, selectedDay } = navigationState;
    await loadGuideData(selectedYear, selectedMonth, selectedDay);
    await loadGuideDataRange(new Date(selectedYear, selectedMonth - 1, selectedDay));
  }, [navigationState, loadGuideData, loadGuideDataRange]);

  /**
   * Buscar programas
   */
  const searchPrograms = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      
      const centerDate = new Date(navigationState.selectedYear, navigationState.selectedMonth - 1, navigationState.selectedDay);
      const startDate = new Date(centerDate);
      startDate.setDate(startDate.getDate() - viewConfig.showPastDays);
      
      const endDate = new Date(centerDate);
      endDate.setDate(endDate.getDate() + viewConfig.showFutureDays);

      const results = await scheduleService.searchProgramsInGuide(query, startDate, endDate);
      setSearchResults(results);
      
      console.log(`🔍 [useTVGuide] Búsqueda "${query}": ${results.length} resultados`);
      
    } catch (err) {
      console.error('❌ [useTVGuide] Error en búsqueda:', err);
    } finally {
      setIsSearching(false);
    }
  }, [navigationState, scheduleService, viewConfig]);

  /**
   * Limpiar búsqueda
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  /**
   * Obtener el programa seleccionado actualmente
   */
  const getSelectedProgram = useCallback((): TVGuideProgram | null => {
    if (!guideData || !guideData.channels[navigationState.selectedChannel]) {
      return null;
    }

    const selectedChannel = guideData.channels[navigationState.selectedChannel];
    return selectedChannel.programs[navigationState.selectedProgram] || null;
  }, [guideData, navigationState]);

  // Configurar navegación por teclado
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Solo procesar si no hay elementos de input enfocados
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          navigateUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateDown();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigateLeft();
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateRight();
          break;
        case 'Home':
          event.preventDefault();
          goToToday();
          break;
        case 'F5':
          event.preventDefault();
          refreshData();
          break;
      }
    };

    keyHandlerRef.current = handleKeyDown;
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (keyHandlerRef.current) {
        window.removeEventListener('keydown', keyHandlerRef.current);
      }
    };
  }, [navigateUp, navigateDown, navigateLeft, navigateRight, goToToday, refreshData]);

  // Cargar datos inicial
  useEffect(() => {
    const { selectedYear, selectedMonth, selectedDay } = navigationState;
    loadGuideData(selectedYear, selectedMonth, selectedDay);
    loadGuideDataRange(new Date(selectedYear, selectedMonth - 1, selectedDay));
  }, []); // Solo al montar el componente

  return {
    guideData,
    guideDataRange,
    navigationState,
    viewConfig,
    loading,
    error,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    goToDate,
    goToToday,
    goToChannel,
    refreshData,
    searchPrograms,
    getSelectedProgram,
    searchResults,
    isSearching,
    clearSearch,
    stats
  };
}

/**
 * Hook más simple para obtener solo los datos del TV Guide
 */
export function useTVGuideData(year: number, month: number, day: number) {
  const [data, setData] = useState<TVGuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scheduleService = ScheduleService.getInstance();

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const guideData = await scheduleService.getTVGuideData(year, month, day);
        
        if (!isCancelled) {
          setData(guideData);
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Error cargando datos';
          setError(errorMessage);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [year, month, day, scheduleService]);

  return { data, loading, error };
}