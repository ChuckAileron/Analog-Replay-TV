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
      return (result ?? 'ready') as ScheduleStatus;
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
   * Obtiene los datos del TV Guide para una fecha específica, leyendo
   * directamente las entradas reales de la programación generada (mismo
   * archivo mensual que usa `getCurrentScheduleEntry`), en vez de inventar
   * horarios artificiales. Esto asegura que la guía muestre el show y
   * episodio real que corresponde a cada franja horaria de cada canal.
   */
  public async getTVGuideData(year: number, month: number, day: number): Promise<TVGuideData | null> {
    try {
      console.log(`📅 [ScheduleServiceRenderer] Solicitando datos del TV Guide para ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);

      // Obtener canales disponibles
      const channelsConfig = await window.electronAPI.loadChannelsConfig();
      if (!channelsConfig || !channelsConfig.channels || channelsConfig.channels.length === 0) {
        console.warn('⚠️ [ScheduleServiceRenderer] No hay canales disponibles');
        return null;
      }

      // Obtener el mes completo de programación real (mismos datos que usa
      // el reproductor para determinar qué se transmite ahora)
      const monthSchedule = await window.electronAPI.schedule.getMonthSchedule(year, month);
      const allEntries: any[] = monthSchedule?.entries || [];

      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();

      const guideChannels = channelsConfig.channels.map((channel: any) => {
        // Un canal puede identificarse en las entradas por su uuid, id legacy o nombre
        const channelEntries = allEntries
          .filter((entry) => {
            const matchesChannel =
              entry.channelId === channel.uuid ||
              entry.channelId === String(channel.id) ||
              (typeof entry.channelId === 'string' && entry.channelId.toLowerCase() === String(channel.name).toLowerCase());

            if (!matchesChannel) return false;

            const start = new Date(entry.startTime).getTime();
            const end = new Date(entry.endTime).getTime();
            // Incluir cualquier entrada que se solape con el día solicitado
            return start < dayEnd && end > dayStart;
          })
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        const programs: TVGuideProgram[] = channelEntries.map((entry) => {
          const startTime = new Date(entry.startTime);
          const endTime = new Date(entry.endTime);
          return {
            id: entry.id,
            showId: 0, // El id real es un uuid/string (entry.showId); no aplica al tipo numérico legacy
            showName: entry.showName,
            seasonNumber: entry.season,
            episodeNumber: entry.episode,
            episodeTitle: entry.episodeTitle,
            startTime,
            endTime,
            duration: Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)),
            description: entry.episodeTitle ? `${entry.showName}: ${entry.episodeTitle}` : entry.showName,
            isCurrentlyPlaying: false,
            progress: 0
          };
        });

        return {
          channelId: channel.uuid || String(channel.id),
          channelNumber: channel.number,
          channelName: channel.name,
          programs
        };
      });

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

  public calculateCurrentShowTime(entry: ScheduleEntry): any {
    const startMs = new Date(entry.startTime).getTime();
    const endMs = new Date(entry.endTime).getTime();
    const nowMs = Date.now();

    const totalDuration = Math.max(0, (endMs - startMs) / 1000);
    const elapsedTime = Math.max(0, Math.min(totalDuration, (nowMs - startMs) / 1000));
    const remainingTime = Math.max(0, totalDuration - elapsedTime);
    const progress = totalDuration > 0 ? (elapsedTime / totalDuration) * 100 : 0;

    return { totalDuration, elapsedTime, remainingTime, progress };
  }

  public async enableSeasonRepeat(enabled: boolean): Promise<void> {
    console.log(`🔄 [ScheduleServiceRenderer] Season repeat ${enabled ? 'enabled' : 'disabled'}`);
  }
}