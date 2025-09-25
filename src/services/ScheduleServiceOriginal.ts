import fs from 'fs';
import path from 'path';
import type {
  ScheduleConfig,
  ChannelSchedule,
  DaySchedule,
  ScheduleEntry,
  ShowRotation,
  TimeCalculation,
  ScheduleState,
  ScheduleStatus,
  TVGuideData,
  TVGuideChannel,
  TVGuideProgram
} from '../types/schedule.types';
import type { Channel } from '../types/tv.types';
import type { TVShow, TVSeason, TVEpisode } from '../types/show.types';
import { ShowService } from './ShowService';
// TODO: import { CommercialService } from './CommercialService';

/**
 * Servicio principal para manejar la programación de canales
 * Implementa toda la lógica de generación de programación descrita en el TODO
 */
export class ScheduleService {
  private static instance: ScheduleService;
  private config: ScheduleConfig | null = null;
  private state: ScheduleState;
  private configPath: string;
  private showService: ShowService;
  // TODO: Implementar cola de conversiones y manejo de comerciales

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(
      process.cwd(),
      'src',
      'config',
      'schedule',
      'schedule.config.json'
    );
    
    this.showService = ShowService.getInstance();
    // TODO: Integrar CommercialService cuando se implementen los comerciales
    
    this.state = {
      isInitialized: false,
      isGeneratingSchedule: false,
      currentConversions: [],
      lastScheduleGeneration: new Date(),
      needsYearSelection: false
    };
  }

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(configPath?: string): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService(configPath);
    }
    return ScheduleService.instance;
  }

  /**
   * Inicializa el servicio de programación
   */
  public async initialize(): Promise<ScheduleStatus> {
    try {
      console.log('🚀 [ScheduleService] Inicializando servicio de programación...');
      
      this.state.isInitialized = false;
      
      // Cargar configuración existente o crear una nueva
      await this.loadConfig();
      
      // Verificar si necesita selección de año inicial
      if (!this.config || this.config.primaryYear === 0) {
        console.log('📅 [ScheduleService] Necesita selección de año inicial');
        this.state.needsYearSelection = true;
        return 'needs_year_selection';
      }
      
      // Verificar si la programación está actualizada
      const needsNewSchedule = await this.needsScheduleRegeneration();
      
      if (needsNewSchedule) {
        console.log('🔄 [ScheduleService] Generando nueva programación...');
        this.state.isGeneratingSchedule = true;
        await this.generateYearlySchedule();
        this.state.isGeneratingSchedule = false;
      }
      
      // Verificar conversiones pendientes
      await this.checkPendingConversions();
      
      this.state.isInitialized = true;
      console.log('✅ [ScheduleService] Servicio inicializado correctamente');
      
      return this.state.currentConversions.length > 0 ? 'converting_videos' : 'ready';
      
    } catch (error) {
      console.error('❌ [ScheduleService] Error en inicialización:', error);
      this.state.isInitialized = false;
      return 'error';
    }
  }

  /**
   * Carga la configuración de programación
   */
  private async loadConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const configData = JSON.parse(data);
        
        // Convertir Maps que fueron serializados como objetos
        this.config = {
          ...configData,
          schedules: new Map(Object.entries(configData.schedules || {}))
        };
        
        // Convertir Maps anidados en los schedules
        if (this.config && this.config.schedules) {
          for (const [, schedule] of this.config.schedules) {
            if (schedule.dailySchedules && typeof schedule.dailySchedules === 'object') {
              schedule.dailySchedules = new Map(Object.entries(schedule.dailySchedules));
            }
          }
        }
        
        console.log('📂 [ScheduleService] Configuración cargada desde archivo');
      } else {
        console.log('📂 [ScheduleService] Creando nueva configuración');
        this.config = this.createDefaultConfig();
        await this.saveConfig();
      }
    } catch (error) {
      console.error('❌ [ScheduleService] Error al cargar configuración:', error);
      this.config = this.createDefaultConfig();
    }
  }

  /**
   * Crea una configuración por defecto
   */
  private createDefaultConfig(): ScheduleConfig {
    return {
      primaryYear: 0, // Sin año definido inicialmente
      allowYearSelection: true,
      repeatSeasons: false,
      lastYearCheck: new Date().toISOString(),
      yearTolerance: 3,
      maxShowsFromPrimaryYear: 6,
      schedules: new Map(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Guarda la configuración actual
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    try {
      // Asegurar que el directorio existe
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convertir Maps a objetos para serialización
      const configToSave = {
        ...this.config,
        schedules: Object.fromEntries(
          Array.from(this.config.schedules.entries()).map(([channelId, schedule]) => [
            channelId,
            {
              ...schedule,
              dailySchedules: Object.fromEntries(schedule.dailySchedules.entries())
            }
          ])
        ),
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
      console.log('💾 [ScheduleService] Configuración guardada');
    } catch (error) {
      console.error('❌ [ScheduleService] Error al guardar configuración:', error);
      throw error;
    }
  }

  /**
   * Establece el año principal de programación (primera vez o cambio manual)
   */
  public async setPrimaryYear(year: number): Promise<void> {
    if (!this.config) {
      throw new Error('Configuración no inicializada');
    }

    console.log(`📅 [ScheduleService] Estableciendo año principal: ${year}`);
    
    this.config.primaryYear = year;
    this.config.allowYearSelection = false;
    this.config.lastYearCheck = new Date().toISOString();
    
    // Limpiar programaciones existentes
    this.config.schedules.clear();
    
    await this.saveConfig();
    
    // Generar nueva programación
    this.state.isGeneratingSchedule = true;
    await this.generateYearlySchedule();
    this.state.isGeneratingSchedule = false;
    
    this.state.needsYearSelection = false;
  }

  /**
   * Verifica si necesita regenerar la programación
   */
  private async needsScheduleRegeneration(): Promise<boolean> {
    if (!this.config) return true;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Si es diciembre (mes 12), generar programación del próximo año
    if (currentMonth === 12 && this.config.schedules.size === 0) {
      console.log('📅 [ScheduleService] Es diciembre, generando programación del próximo año');
      return true;
    }
    
    // Si no hay programación para el año actual
    const hasCurrentYearSchedule = Array.from(this.config.schedules.values())
      .some(schedule => schedule.year === currentYear);
    
    if (!hasCurrentYearSchedule) {
      console.log('📅 [ScheduleService] No hay programación para el año actual');
      return true;
    }
    
    return false;
  }

  /**
   * Genera la programación anual para todos los canales
   */
  private async generateYearlySchedule(): Promise<void> {
    console.log('🎬 [ScheduleService] Iniciando generación de programación anual...');
    
    if (!this.config) {
      throw new Error('Configuración no inicializada');
    }

    try {
      // Obtener canales disponibles (esto debería venir del sistema de canales)
      const channels = await this.getAvailableChannels();
      
      for (const channel of channels) {
        await this.generateChannelSchedule(channel);
      }
      
      await this.saveConfig();
      this.state.lastScheduleGeneration = new Date();
      
      console.log('✅ [ScheduleService] Programación anual generada exitosamente');
      
    } catch (error) {
      console.error('❌ [ScheduleService] Error generando programación:', error);
      throw error;
    }
  }

  /**
   * Genera la programación para un canal específico
   */
  private async generateChannelSchedule(channel: Channel): Promise<void> {
    console.log(`📺 [ScheduleService] Generando programación para canal: ${channel.name}`);
    
    if (!this.config) return;
    
    // Obtener shows disponibles para este canal
    const availableShows = await this.showService.getRandomShowsForSchedule(
      channel.name,
      this.config.primaryYear,
      this.config.maxShowsFromPrimaryYear + 4, // Extra shows para completar programación
      this.config.yearTolerance
    );
    
    if (availableShows.length === 0) {
      console.log(`⚠️ [ScheduleService] No hay shows disponibles para el canal ${channel.name}`);
      return;
    }
    
    // Crear rotación de shows
    const showRotation = this.createShowRotation(availableShows, channel);
    
    // Crear schedule del canal
    const channelSchedule: ChannelSchedule = {
      channelId: channel.id.toString(),
      channelName: channel.name,
      year: this.config.primaryYear,
      isNightOnly: this.isNightOnlyChannel(channel),
      dailySchedules: new Map(),
      currentShowRotation: showRotation,
      nextScheduleGeneration: this.getNextScheduleGenerationDate()
    };
    
    // Generar programación diaria para todo el año
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1); // 1 de enero
    const endDate = new Date(currentYear, 11, 31); // 31 de diciembre
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const daySchedule = await this.generateDaySchedule(channelSchedule, date, showRotation);
      channelSchedule.dailySchedules.set(dateString, daySchedule);
    }
    
    // Guardar en la configuración
    this.config.schedules.set(channel.id.toString(), channelSchedule);
    
    console.log(`✅ [ScheduleService] Programación generada para ${channel.name}: ${channelSchedule.dailySchedules.size} días`);
  }

  /**
   * Crea la rotación de shows para un canal
   */
  private createShowRotation(shows: TVShow[], channel: Channel): ShowRotation[] {
    if (!this.config) return [];
    
    const rotation: ShowRotation[] = [];
    const timeSlots = this.getTimeSlots(this.isNightOnlyChannel(channel));
    
    for (const show of shows) {
      // Comenzar con la primera temporada y primer episodio
      const firstSeason = show.seasons[0];
      if (!firstSeason || !firstSeason.episodes.length) continue;
      
      rotation.push({
        showId: show.id,
        currentSeasonNumber: firstSeason.season,
        currentEpisodeNumber: firstSeason.episodes[0].episode,
        repeatCount: 0,
        maxRepeats: this.config.repeatSeasons ? 2 : 1,
        isCompleted: false,
        timeSlots: timeSlots
      });
    }
    
    return rotation;
  }

  /**
   * Obtiene las franjas horarias según el tipo de canal
   */
  private getTimeSlots(isNightOnly: boolean) {
    if (isNightOnly) {
      return [
        { type: 'night' as const, startHour: 0, endHour: 3, blockDuration: 60 },
        { type: 'night' as const, startHour: 3, endHour: 6, blockDuration: 60 }
      ];
    }
    
    return [
      { type: 'morning' as const, startHour: 6, endHour: 12, blockDuration: 60 },
      { type: 'afternoon' as const, startHour: 12, endHour: 18, blockDuration: 60 },
      { type: 'night' as const, startHour: 18, endHour: 24, blockDuration: 60 }
    ];
  }

  /**
   * Genera la programación para un día específico
   */
  private async generateDaySchedule(
    channelSchedule: ChannelSchedule,
    date: Date,
    showRotation: ShowRotation[]
  ): Promise<DaySchedule> {
    const dateString = date.toISOString().split('T')[0];
    const entries: ScheduleEntry[] = [];
    let currentTime = new Date(date);
    currentTime.setHours(channelSchedule.isNightOnly ? 0 : 6, 0, 0, 0);
    
    const timeSlots = channelSchedule.isNightOnly ? 
      [{ start: 0, end: 6 }] : 
      [{ start: 6, end: 12 }, { start: 12, end: 18 }, { start: 18, end: 24 }];
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _timeSlot of timeSlots) {
      for (const showRotationItem of showRotation) {
        if (showRotationItem.isCompleted) continue;
        
        // Obtener el episodio actual
        const show = await this.showService.getShowById(showRotationItem.showId);
        if (!show) continue;
        
        const season = show.seasons.find(s => s.season === showRotationItem.currentSeasonNumber);
        if (!season) continue;
        
        const episode = season.episodes.find(e => e.episode === showRotationItem.currentEpisodeNumber);
        if (!episode) continue;
        
        // Crear entrada de programación
        const entry = await this.createScheduleEntry(
          show,
          season,
          episode,
          channelSchedule,
          currentTime
        );
        
        entries.push(entry);
        
        // Actualizar tiempo actual
        currentTime = new Date(entry.endTime);
        
        // Avanzar al siguiente episodio
        this.advanceShowRotation(showRotationItem, show);
      }
    }
    
    return {
      date: dateString,
      channelId: channelSchedule.channelId,
      entries,
      totalDuration: 1440 // 24 horas en minutos
    };
  }

  /**
   * Crea una entrada de programación
   */
  private async createScheduleEntry(
    show: TVShow,
    season: TVSeason,
    episode: TVEpisode,
    channelSchedule: ChannelSchedule,
    startTime: Date
  ): Promise<ScheduleEntry> {
    const duration = this.parseDurationToMinutes(episode.duration);
    const blockDuration = this.getBlockDuration(duration);
    
    const endTime = new Date(startTime.getTime() + blockDuration * 60 * 1000);
    
    const entry: ScheduleEntry = {
      id: this.generateEntryId(),
      showId: show.id,
      seasonNumber: season.season,
      episodeNumber: episode.episode,
      channelId: channelSchedule.channelId,
      startTime: new Date(startTime),
      endTime: endTime,
      duration: blockDuration,
      blockType: 'show',
      conversionRequired: await this.checkConversionRequired(episode, season),
      conversionStatus: 'pending'
    };
    
    // Agregar comerciales si hay tiempo sobrante
    if (blockDuration > duration) {
      const commercialTime = blockDuration - duration;
      entry.commercialBreaks = await this.generateCommercialBreaks(
        channelSchedule.channelId,
        channelSchedule.year,
        commercialTime,
        duration
      );
    }
    
    return entry;
  }

  /**
   * Calcula cuánto tiempo ha transcurrido de un show según la hora actual
   */
  public calculateCurrentShowTime(entry: ScheduleEntry, currentTime?: Date): TimeCalculation {
    const now = currentTime || new Date();
    const showStart = new Date(entry.startTime);
    const showEnd = new Date(entry.endTime);
    
    // Si estamos antes del inicio del show
    if (now < showStart) {
      return {
        currentTime: now,
        showStartTime: showStart,
        showEndTime: showEnd,
        elapsedTime: 0,
        remainingTime: entry.duration,
        seekPosition: 0
      };
    }
    
    // Si estamos después del final del show
    if (now > showEnd) {
      return {
        currentTime: now,
        showStartTime: showStart,
        showEndTime: showEnd,
        elapsedTime: entry.duration,
        remainingTime: 0,
        seekPosition: entry.duration * 60 // convertir a segundos
      };
    }
    
    // Estamos durante el show
    const elapsedMs = now.getTime() - showStart.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    const remainingMinutes = entry.duration - elapsedMinutes;
    
    return {
      currentTime: now,
      showStartTime: showStart,
      showEndTime: showEnd,
      elapsedTime: elapsedMinutes,
      remainingTime: Math.max(0, remainingMinutes),
      seekPosition: Math.max(0, elapsedMinutes * 60) // convertir a segundos
    };
  }

  /**
   * Obtiene la entrada de programación actual para un canal
   */
  public async getCurrentScheduleEntry(channelId: string, currentTime?: Date): Promise<ScheduleEntry | null> {
    if (!this.config) return null;
    
    const now = currentTime || new Date();
    const channelSchedule = this.config.schedules.get(channelId);
    if (!channelSchedule) return null;
    
    const dateString = now.toISOString().split('T')[0];
    const daySchedule = channelSchedule.dailySchedules.get(dateString);
    if (!daySchedule) return null;
    
    // Buscar la entrada que corresponde a la hora actual
    for (const entry of daySchedule.entries) {
      const entryStart = new Date(entry.startTime);
      const entryEnd = new Date(entry.endTime);
      
      if (now >= entryStart && now < entryEnd) {
        return entry;
      }
    }
    
    return null;
  }

  // Métodos auxiliares
  private async getAvailableChannels(): Promise<Channel[]> {
    // Integrar con el sistema de canales existente
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const { channelManager } = await import('../features/channels/channelManager');
      await channelManager.initialize();
      return await channelManager.getChannels();
    } catch (error) {
      console.error('❌ [ScheduleService] Error obteniendo canales:', error);
      return [];
    }
  }

  private isNightOnlyChannel(_channel: Channel): boolean {
    // TODO: Determinar si un canal es solo nocturno basado en su configuración
    return false;
  }

  private getNextScheduleGenerationDate(): Date {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1, 11, 1); // 1 de diciembre del próximo año
    return nextYear;
  }

  private parseDurationToMinutes(duration: string): number {
    const parts = duration.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] + parts[1] / 60;
    } else if (parts.length === 3) {
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    }
    return 30; // valor por defecto
  }

  private getBlockDuration(showDuration: number): number {
    if (showDuration <= 30) {
      return 30;
    } else if (showDuration <= 60) {
      return 60;
    }
    return Math.ceil(showDuration / 30) * 30; // Redondear a múltiplos de 30
  }

  private generateEntryId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkConversionRequired(episode: TVEpisode, season: TVSeason): Promise<boolean> {
    if (!season.contentPath || !episode.fileName) return false;
    
    const filePath = path.join(season.contentPath, episode.fileName);
    // TODO: Verificar si el archivo necesita conversión basado en su formato
    return fs.existsSync(filePath) && path.extname(filePath) !== '.mp4';
  }

  private async generateCommercialBreaks(
    _channelId: string,
    _year: number,
    _totalCommercialTime: number,
    _showDuration: number
  ) {
    // TODO: Implementar generación de comerciales
    return [];
  }

  private advanceShowRotation(rotation: ShowRotation, show: TVShow): void {
    const currentSeason = show.seasons.find(s => s.season === rotation.currentSeasonNumber);
    if (!currentSeason) return;
    
    const currentEpisodeIndex = currentSeason.episodes.findIndex(e => e.episode === rotation.currentEpisodeNumber);
    
    // Si hay más episodios en la temporada
    if (currentEpisodeIndex < currentSeason.episodes.length - 1) {
      rotation.currentEpisodeNumber = currentSeason.episodes[currentEpisodeIndex + 1].episode;
      return;
    }
    
    // Si terminó la temporada, revisar si debe repetirla
    if (rotation.repeatCount < rotation.maxRepeats - 1) {
      rotation.repeatCount++;
      rotation.currentEpisodeNumber = currentSeason.episodes[0].episode;
      return;
    }
    
    // Pasar a la siguiente temporada
    const currentSeasonIndex = show.seasons.findIndex(s => s.season === rotation.currentSeasonNumber);
    if (currentSeasonIndex < show.seasons.length - 1) {
      const nextSeason = show.seasons[currentSeasonIndex + 1];
      rotation.currentSeasonNumber = nextSeason.season;
      rotation.currentEpisodeNumber = nextSeason.episodes[0].episode;
      rotation.repeatCount = 0;
    } else {
      // Show completado
      rotation.isCompleted = true;
    }
  }

  private async checkPendingConversions(): Promise<void> {
    // TODO: Implementar verificación de conversiones pendientes
  }

  // Métodos públicos para la interfaz
  public getState(): ScheduleState {
    return { ...this.state };
  }

  public async getScheduleStatus(): Promise<ScheduleStatus> {
    if (!this.state.isInitialized) return 'not_initialized';
    if (this.state.needsYearSelection) return 'needs_year_selection';
    if (this.state.isGeneratingSchedule) return 'generating';
    if (this.state.currentConversions.length > 0) return 'converting_videos';
    return 'ready';
  }

  public async enableSeasonRepeat(enabled: boolean): Promise<void> {
    if (!this.config) return;
    
    this.config.repeatSeasons = enabled;
    await this.saveConfig();
    
    // Actualizar todas las rotaciones
    for (const [, schedule] of this.config.schedules) {
      for (const rotation of schedule.currentShowRotation) {
        rotation.maxRepeats = enabled ? 2 : 1;
      }
    }
  }

  public getCurrentConfig(): ScheduleConfig | null {
    return this.config;
  }

  // Métodos específicos para TV Guide
  
  /**
   * Obtiene los datos de programación para el TV Guide de una fecha específica
   */
  public async getTVGuideData(year: number, month: number, day: number): Promise<TVGuideData | null> {
    if (!this.config) {
      console.warn('⚠️ [ScheduleService] Configuración no disponible para TV Guide');
      return null;
    }

    try {
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      const channels: TVGuideChannel[] = [];

      // Obtener todos los canales disponibles
      const availableChannels = await this.getAvailableChannels();
      
      for (const channel of availableChannels) {
        // Usar el UUID del canal para buscar en schedules
        const channelSchedule = this.config.schedules.get(channel.uuid || channel.id.toString());
        if (!channelSchedule) continue;

        const daySchedule = channelSchedule.dailySchedules.get(dateString);
        if (!daySchedule) continue;

        const programs: TVGuideProgram[] = [];
        const now = new Date();

        for (const entry of daySchedule.entries) {
          // Obtener información del show
          const show = await this.showService.getShowById(entry.showId);
          if (!show) continue;

          const season = show.seasons.find(s => s.season === entry.seasonNumber);
          const episode = season?.episodes.find(e => e.episode === entry.episodeNumber);

          // Determinar si está reproduciéndose actualmente
          const isCurrentlyPlaying = now >= new Date(entry.startTime) && now < new Date(entry.endTime);
          let progress = 0;

          if (isCurrentlyPlaying) {
            const elapsed = now.getTime() - new Date(entry.startTime).getTime();
            const total = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
            progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
          }

          programs.push({
            id: entry.id,
            showId: entry.showId,
            showName: show.name,
            seasonNumber: entry.seasonNumber,
            episodeNumber: entry.episodeNumber,
            episodeTitle: episode?.title,
            startTime: new Date(entry.startTime),
            endTime: new Date(entry.endTime),
            duration: entry.duration,
            description: episode?.description,
            isCurrentlyPlaying,
            progress: isCurrentlyPlaying ? progress : undefined
          });
        }

        channels.push({
          channelId: channel.uuid || channel.id.toString(),
          channelNumber: channel.number,
          channelName: channel.name,
          programs
        });
      }

      // Ordenar canales por número
      channels.sort((a, b) => a.channelNumber - b.channelNumber);

      return {
        year,
        month,
        day,
        channels
      };

    } catch (error) {
      console.error('❌ [ScheduleService] Error obteniendo datos de TV Guide:', error);
      return null;
    }
  }

  /**
   * Obtiene datos de TV Guide para un rango de fechas
   */
  public async getTVGuideDataRange(
    startDate: Date, 
    endDate: Date
  ): Promise<Map<string, TVGuideData>> {
    const guideDataMap = new Map<string, TVGuideData>();
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      const guideData = await this.getTVGuideData(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        currentDate.getDate()
      );
      
      if (guideData) {
        guideDataMap.set(dateString, guideData);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return guideDataMap;
  }

  /**
   * Busca programas en la guía por nombre
   */
  public async searchProgramsInGuide(
    query: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; channel: TVGuideChannel; program: TVGuideProgram }[]> {
    const results: { date: string; channel: TVGuideChannel; program: TVGuideProgram }[] = [];
    const guideDataMap = await this.getTVGuideDataRange(startDate, endDate);
    
    const queryLower = query.toLowerCase();
    
    for (const [dateString, guideData] of guideDataMap.entries()) {
      for (const channel of guideData.channels) {
        for (const program of channel.programs) {
          const matchesShow = program.showName.toLowerCase().includes(queryLower);
          const matchesEpisode = program.episodeTitle?.toLowerCase().includes(queryLower);
          const matchesDescription = program.description?.toLowerCase().includes(queryLower);
          
          if (matchesShow || matchesEpisode || matchesDescription) {
            results.push({
              date: dateString,
              channel,
              program
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Obtiene estadísticas de la programación para un período
   */
  public async getTVGuideStats(startDate: Date, endDate: Date) {
    const guideDataMap = await this.getTVGuideDataRange(startDate, endDate);
    
    let totalPrograms = 0;
    let totalChannels = 0;
    let totalDuration = 0;
    const uniqueShows = new Set<number>();
    const channelStats = new Map<string, number>();
    
    for (const guideData of guideDataMap.values()) {
      totalChannels = Math.max(totalChannels, guideData.channels.length);
      
      for (const channel of guideData.channels) {
        const channelProgramCount = channelStats.get(channel.channelId) || 0;
        channelStats.set(channel.channelId, channelProgramCount + channel.programs.length);
        
        for (const program of channel.programs) {
          totalPrograms++;
          totalDuration += program.duration;
          uniqueShows.add(program.showId);
        }
      }
    }
    
    return {
      totalPrograms,
      uniqueChannels: totalChannels,
      uniqueShows: uniqueShows.size,
      totalDurationHours: Math.round(totalDuration / 60),
      averageProgramsPerChannel: totalChannels > 0 ? Math.round(totalPrograms / totalChannels) : 0,
      channelStats: Object.fromEntries(channelStats)
    };
  }
}