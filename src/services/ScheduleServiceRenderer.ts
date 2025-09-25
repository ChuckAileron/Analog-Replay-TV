import type {
  ScheduleConfig,
  ScheduleEntry,
  ScheduleStatus,
  TVGuideData,
  TVGuideProgram
} from '../types/schedule.types';

/**
 * Versión del ScheduleService para el renderer que usa la API de Electron
 */
export class ScheduleServiceRenderer {
  private static instance: ScheduleServiceRenderer;

  private constructor() {}

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): ScheduleServiceRenderer {
    if (!ScheduleServiceRenderer.instance) {
      ScheduleServiceRenderer.instance = new ScheduleServiceRenderer();
    }
    return ScheduleServiceRenderer.instance;
  }

  /**
   * Inicializa el servicio de programación
   */
  public async initialize(): Promise<ScheduleStatus> {
    try {
      const result = await window.electronAPI.schedule.initialize();
      return result as ScheduleStatus;
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Establece el año primario para la programación
   */
  public async setPrimaryYear(year: number): Promise<boolean> {
    try {
      await window.electronAPI.schedule.setPrimaryYear(year);
      return true;
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error estableciendo año:', error);
      return false;
    }
  }

  /**
   * Obtiene la configuración actual
   */
  public async getCurrentConfig(): Promise<ScheduleConfig | null> {
    try {
      return await window.electronAPI.schedule.getCurrentConfig();
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error obteniendo configuración:', error);
      throw error;
    }
  }

  /**
   * Obtiene la entrada de programación actual para un canal
   */
  public async getCurrentScheduleEntry(channelId?: string): Promise<ScheduleEntry | null> {
    try {
      return await window.electronAPI.schedule.getCurrentScheduleEntry(channelId);
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error obteniendo entrada de programación:', error);
      return null;
    }
  }

  /**
   * Obtiene los datos del TV Guide para una fecha específica
   * Por ahora implementamos una versión básica usando los datos existentes
   */
  public async getTVGuideData(year: number, month: number, day: number): Promise<TVGuideData | null> {
    try {
      console.log(`📅 [ScheduleServiceRenderer] Solicitando datos del TV Guide para ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      
      // Por ahora, crear datos del TV Guide usando los canales y programación existente
      // TODO: Implementar método específico en el main process para TV Guide
      
      // Obtener canales disponibles
      const channels = await window.electronAPI.loadChannelsConfig();
      if (!channels || !channels.channels || channels.channels.length === 0) {
        console.warn('⚠️ [ScheduleServiceRenderer] No hay canales disponibles');
        return null;
      }

      // Crear estructura del TV Guide
      const guideChannels = await Promise.all(
        channels.channels.map(async (channel: any) => {
          // Usar datos reales de programación
          const programs: TVGuideProgram[] = [];
          
          // Obtener shows reales para este canal
          try {
            // Mapear IDs numéricos a los channelId string usados en la programación
            const channelIdMap: { [key: string]: string } = {
              '1': 'ch_disney_001',
              '2': 'ch_nickelodeon_002',
              '3': 'ch_cartoonnetwork_003'
            };
            
            // En lugar de intentar obtener el show actual, usar el primer show del día como base
            // y variar los horarios para el TV Guide
            const baseDate = new Date(year, month - 1, day, 8, 0, 0); // 8:00 AM como base
            const mappedChannelId = channelIdMap[channel.id.toString()] || channel.id.toString();
            const currentEntry = await window.electronAPI.schedule.getScheduleEntryAt(baseDate.toISOString(), mappedChannelId);
            
            // Si hay programación real, usarla como base
            if (currentEntry && currentEntry.showName && !currentEntry.showName.includes('Programación')) {
              // Generar horario basado en programación real
              for (let hour = 6; hour < 24; hour++) {
                const startTime = new Date(year, month - 1, day, hour, 0);
                const endTime = new Date(year, month - 1, day, hour + 1, 0);
                
                programs.push({
                  id: `${channel.id}-${hour}`,
                  showId: parseInt(currentEntry.showId) || 1,
                  showName: currentEntry.showName,
                  seasonNumber: currentEntry.season || 1,
                  episodeNumber: currentEntry.episode || hour - 5,
                  episodeTitle: currentEntry.episodeTitle || `Episodio ${hour - 5}`,
                  startTime: startTime,
                  endTime: endTime,
                  duration: 60,
                  description: `${currentEntry.showName} - ${currentEntry.episodeTitle || 'Programación continua'}`,
                  isCurrentlyPlaying: false,
                  progress: 0
                });
              }
            } else {
              // Fallback: usar solo el nombre del canal
              for (let hour = 6; hour < 24; hour++) {
                const startTime = new Date(year, month - 1, day, hour, 0);
                const endTime = new Date(year, month - 1, day, hour + 1, 0);
                
                programs.push({
                  id: `${channel.id}-${hour}`,
                  showId: 1,
                  showName: channel.name,
                  seasonNumber: 1,
                  episodeNumber: hour - 5,
                  episodeTitle: `${hour.toString().padStart(2, '0')}:00`,
                  startTime: startTime,
                  endTime: endTime,
                  duration: 60,
                  description: `Programación de ${channel.name}`,
                  isCurrentlyPlaying: false,
                  progress: 0
                });
              }
            }
          } catch (error) {
            console.warn(`❌ Error obteniendo programación para ${channel.name}:`, error);
            // Fallback: usar solo el nombre del canal
            for (let hour = 6; hour < 24; hour++) {
              const startTime = new Date(year, month - 1, day, hour, 0);
              const endTime = new Date(year, month - 1, day, hour + 1, 0);
              
              programs.push({
                id: `${channel.id}-${hour}`,
                showId: 1,
                showName: channel.name,
                seasonNumber: 1,
                episodeNumber: hour - 5,
                episodeTitle: `${hour.toString().padStart(2, '0')}:00`,
                startTime: startTime,
                endTime: endTime,
                duration: 60,
                description: `Programación de ${channel.name}`,
                isCurrentlyPlaying: false,
                progress: 0
              });
            }
          }

          return {
            channelId: channel.id.toString(),
            channelNumber: channel.id,
            channelName: channel.name,
            programs
          };
        })
      );

      const tvGuideData: TVGuideData = {
        year: year,
        month: month,
        day: day,
        channels: guideChannels
      };

      console.log(`✅ [ScheduleServiceRenderer] TV Guide generado: ${guideChannels.length} canales, ${guideChannels.reduce((total: number, ch: any) => total + ch.programs.length, 0)} programas`);
      
      return tvGuideData;

    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error obteniendo datos del TV Guide:', error);
      return null;
    }
  }

  /**
   * Obtiene datos del TV Guide para un rango de fechas
   */
  public async getTVGuideDataRange(startDate: Date, endDate: Date): Promise<Map<string, TVGuideData>> {
    const rangeData = new Map<string, TVGuideData>();
    
    try {
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const guideData = await this.getTVGuideData(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          currentDate.getDate()
        );
        
        if (guideData) {
          rangeData.set(dateKey, guideData);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`📊 [ScheduleServiceRenderer] Datos de rango cargados: ${rangeData.size} días`);
      
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error cargando rango de datos:', error);
    }
    
    return rangeData;
  }

  /**
   * Obtiene estadísticas del TV Guide
   */
  public async getTVGuideStats(startDate: Date, endDate: Date): Promise<any> {
    try {
      const rangeData = await this.getTVGuideDataRange(startDate, endDate);
      
      let totalPrograms = 0;
      let totalChannels = 0;
      
      rangeData.forEach(dayData => {
        totalChannels = Math.max(totalChannels, dayData.channels.length);
        dayData.channels.forEach(channel => {
          totalPrograms += channel.programs.length;
        });
      });
      
      return {
        totalDays: rangeData.size,
        totalChannels,
        totalPrograms
      };
      
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error calculando estadísticas:', error);
      return null;
    }
  }

  /**
   * Busca programas en el TV Guide
   */
  public async searchProgramsInGuide(query: string, startDate: Date, endDate: Date): Promise<{ date: string; channel: any; program: TVGuideProgram }[]> {
    try {
      const results: { date: string; channel: any; program: TVGuideProgram }[] = [];
      const rangeData = await this.getTVGuideDataRange(startDate, endDate);
      
      const searchTerm = query.toLowerCase();
      
      rangeData.forEach((dayData, date) => {
        dayData.channels.forEach(channel => {
          channel.programs.forEach(program => {
            const matchesName = program.showName.toLowerCase().includes(searchTerm);
            const matchesEpisode = program.episodeTitle?.toLowerCase().includes(searchTerm);
            const matchesDescription = program.description?.toLowerCase().includes(searchTerm);
            
            if (matchesName || matchesEpisode || matchesDescription) {
              results.push({
                date,
                channel,
                program
              });
            }
          });
        });
      });
      
      console.log(`🔍 [ScheduleServiceRenderer] Búsqueda "${query}": ${results.length} resultados encontrados`);
      
      return results;
      
    } catch (error) {
      console.error('❌ [ScheduleServiceRenderer] Error en búsqueda:', error);
      return [];
    }
  }

  /**
   * Métodos adicionales para compatibilidad con useSchedule
   */
  
  public async getScheduleStatus(): Promise<ScheduleStatus> {
    return 'ready';
  }

  public calculateCurrentShowTime(_entry: ScheduleEntry): any {
    // Mock implementation
    return {
      totalDuration: 1800, // 30 minutos
      elapsedTime: 0,
      remainingTime: 1800,
      progress: 0
    };
  }

  public async enableSeasonRepeat(enabled: boolean): Promise<void> {
    console.log(`🔄 [ScheduleServiceRenderer] Season repeat ${enabled ? 'enabled' : 'disabled'}`);
  }
}