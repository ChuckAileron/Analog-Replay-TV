import fs from 'fs';
import path from 'path';
import type { ShowConfig } from '../types/show.types';
import { defaultShowConfig } from '../config/shows/default.shows';

/**
 * Servicio para manejar la configuración de shows
 */
export class ShowService {
  private static instance: ShowService;
  private config: ShowConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(
      process.cwd(),
      'src',
      'config',
      'shows',
      'shows.config.json'
    );
  }

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(configPath?: string): ShowService {
    if (!ShowService.instance) {
      ShowService.instance = new ShowService(configPath);
    }
    return ShowService.instance;
  }

  /**
   * Carga la configuración de shows desde el archivo
   */
  public async loadConfig(): Promise<ShowConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data) as ShowConfig;
      } else {
        console.warn(`Archivo de configuración de shows no encontrado en: ${this.configPath}`);
        console.log('Usando configuración por defecto...');
        this.config = { ...defaultShowConfig };
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Error al cargar la configuración de shows:', error);
      console.log('Usando configuración por defecto...');
      this.config = { ...defaultShowConfig };
    }

    return this.config;
  }

  /**
   * Guarda la configuración actual en el archivo
   */
  public async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No hay configuración cargada para guardar');
    }

    try {
      // Asegurar que el directorio existe
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Actualizar timestamp
      this.config.lastUpdated = new Date().toISOString();

      // Guardar archivo
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
      
      console.log(`Configuración de shows guardada en: ${this.configPath}`);
    } catch (error) {
      console.error('Error al guardar la configuración de shows:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración actual (la carga si no está cargada)
   */
  public async getConfig(): Promise<ShowConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  /**
   * Actualiza la configuración y la guarda
   */
  public async updateConfig(newConfig: ShowConfig): Promise<void> {
    this.config = newConfig;
    await this.saveConfig();
  }

  /**
   * Recarga la configuración desde el archivo
   */
  public async reloadConfig(): Promise<ShowConfig> {
    this.config = null;
    return await this.loadConfig();
  }

  /**
   * Obtiene shows por canal
   */
  public async getShowsByChannel(channel: string) {
    const config = await this.getConfig();
    return config.shows.filter(show => show.channel.includes(channel));
  }

  /**
   * Obtiene shows por año
   */
  public async getShowsByYear(year: number, tolerance: number = 3) {
    const config = await this.getConfig();
    return config.shows.filter(show =>
      show.seasons.some(season =>
        Math.abs(season.year - year) <= tolerance
      )
    );
  }

  /**
   * Obtiene shows por canal y año
   */
  public async getShowsByChannelAndYear(
    channel: string,
    year: number,
    tolerance: number = 3
  ) {
    const config = await this.getConfig();
    return config.shows.filter(show =>
      show.channel.includes(channel) &&
      show.seasons.some(season =>
        Math.abs(season.year - year) <= tolerance
      )
    );
  }

  /**
   * Obtiene un show aleatorio por canal
   */
  public async getRandomShowByChannel(channel: string) {
    const channelShows = await this.getShowsByChannel(channel);
    if (channelShows.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * channelShows.length);
    return channelShows[randomIndex];
  }

  /**
   * Obtiene un show por ID
   */
  public async getShowById(showId: number) {
    const config = await this.getConfig();
    return config.shows.find(show => show.id === showId);
  }

  /**
   * Obtiene shows aleatorios para programación
   */
  public async getRandomShowsForSchedule(
    channel: string,
    year: number,
    count: number = 6,
    tolerance: number = 3
  ) {
    const availableShows = await this.getShowsByChannelAndYear(channel, year, tolerance);
    
    if (availableShows.length === 0) {
      // Si no hay shows del año específico, buscar por canal solamente
      const channelShows = await this.getShowsByChannel(channel);
      if (channelShows.length === 0) return [];
      
      // Mezclar y tomar los primeros 'count' shows
      const shuffled = [...channelShows].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }

    // Si hay shows disponibles, priorizar los del año específico
    const currentYearShows = availableShows.filter(show =>
      show.seasons.some(season => season.year === year)
    );
    
    const olderShows = availableShows.filter(show =>
      show.seasons.every(season => season.year !== year)
    );

    const selectedShows = [];
    
    // Máximo 6 shows del año específico (como menciona el TODO)
    const maxCurrentYearShows = Math.min(6, count);
    const shuffledCurrentYear = [...currentYearShows].sort(() => 0.5 - Math.random());
    selectedShows.push(...shuffledCurrentYear.slice(0, maxCurrentYearShows));

    // Completar con shows de años anteriores si es necesario
    const remaining = count - selectedShows.length;
    if (remaining > 0 && olderShows.length > 0) {
      const shuffledOlder = [...olderShows].sort(() => 0.5 - Math.random());
      selectedShows.push(...shuffledOlder.slice(0, remaining));
    }

    return selectedShows;
  }

  /**
   * Obtiene estadísticas de la configuración actual
   */
  public async getStats() {
    const config = await this.getConfig();
    
    const totalShows = config.shows.length;
    const totalSeasons = config.shows.reduce((sum, show) => sum + show.seasons.length, 0);
    const totalEpisodes = config.shows.reduce((sum, show) =>
      sum + show.seasons.reduce((seasonSum, season) => seasonSum + season.episodes.length, 0), 0
    );

    const allChannels = new Set(config.shows.flatMap(show => show.channel));
    const channelsCount = allChannels.size;

    const allYears = config.shows.flatMap(show => show.seasons.map(season => season.year));
    const yearsRange = allYears.length > 0
      ? { min: Math.min(...allYears), max: Math.max(...allYears) }
      : { min: 0, max: 0 };

    const averageEpisodesPerShow = totalShows > 0 ? Math.round(totalEpisodes / totalShows) : 0;
    const averageSeasonsPerShow = totalShows > 0 ? Math.round(totalSeasons / totalShows) : 0;

    // Duración promedio de episodios
    const allDurations = config.shows.flatMap(show =>
      show.seasons.flatMap(season =>
        season.episodes.map(episode => this.parseDurationToMinutes(episode.duration))
      )
    );
    const averageEpisodeDuration = allDurations.length > 0
      ? Math.round(allDurations.reduce((sum, duration) => sum + duration, 0) / allDurations.length)
      : 0;

    return {
      totalShows,
      totalSeasons,
      totalEpisodes,
      channelsCount,
      channels: Array.from(allChannels),
      yearsRange,
      averageEpisodesPerShow,
      averageSeasonsPerShow,
      averageEpisodeDuration,
      lastUpdated: config.lastUpdated
    };
  }

  /**
   * Convierte una duración en formato "mm:ss" o "hh:mm:ss" a minutos
   */
  private parseDurationToMinutes(duration: string): number {
    const parts = duration.split(':').map(Number);
    
    if (parts.length === 2) {
      // Formato mm:ss
      return parts[0] + parts[1] / 60;
    } else if (parts.length === 3) {
      // Formato hh:mm:ss
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    }
    
    return 0;
  }

  /**
   * Busca shows por nombre o título de episodio
   */
  public async searchShows(query: string) {
    const config = await this.getConfig();
    const queryLower = query.toLowerCase();
    
    return config.shows.filter(show => {
      // Buscar en nombre del show
      if (show.name.toLowerCase().includes(queryLower)) {
        return true;
      }
      
      // Buscar en títulos de episodios
      return show.seasons.some(season =>
        season.episodes.some(episode =>
          episode.title.toLowerCase().includes(queryLower) ||
          (episode.description && episode.description.toLowerCase().includes(queryLower))
        )
      );
    });
  }

  /**
   * Obtiene shows por rango de años
   */
  public async getShowsByYearRange(startYear: number, endYear: number) {
    const config = await this.getConfig();
    
    return config.shows.filter(show =>
      show.seasons.some(season =>
        season.year >= startYear && season.year <= endYear
      )
    );
  }
}