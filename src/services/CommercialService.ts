import fs from 'fs';
import path from 'path';
import type { CommercialConfig } from '../types/commercial.types';
import { defaultCommercialConfig } from '../config/commercials/default.commercials';

/**
 * Servicio para manejar la configuración de comerciales
 */
export class CommercialService {
  private static instance: CommercialService;
  private config: CommercialConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(
      process.cwd(),
      'src',
      'config',
      'commercials',
      'commercials.config.json'
    );
  }

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(configPath?: string): CommercialService {
    if (!CommercialService.instance) {
      CommercialService.instance = new CommercialService(configPath);
    }
    return CommercialService.instance;
  }

  /**
   * Carga la configuración de comerciales desde el archivo
   */
  public async loadConfig(): Promise<CommercialConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data) as CommercialConfig;
      } else {
        console.warn(`Archivo de configuración de comerciales no encontrado en: ${this.configPath}`);
        console.log('Usando configuración por defecto...');
        this.config = { ...defaultCommercialConfig };
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Error al cargar la configuración de comerciales:', error);
      console.log('Usando configuración por defecto...');
      this.config = { ...defaultCommercialConfig };
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
      
      console.log(`Configuración de comerciales guardada en: ${this.configPath}`);
    } catch (error) {
      console.error('Error al guardar la configuración de comerciales:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración actual (la carga si no está cargada)
   */
  public async getConfig(): Promise<CommercialConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  /**
   * Actualiza la configuración y la guarda
   */
  public async updateConfig(newConfig: CommercialConfig): Promise<void> {
    this.config = newConfig;
    await this.saveConfig();
  }

  /**
   * Recarga la configuración desde el archivo
   */
  public async reloadConfig(): Promise<CommercialConfig> {
    this.config = null;
    return await this.loadConfig();
  }

  /**
   * Obtiene comerciales por canal y año
   */
  public async getCommercialsByChannelAndYear(
    channel: string,
    year?: number,
    maxYearDifference: number = 5
  ) {
    const config = await this.getConfig();
    
    const relevantContexts = config.contexts.filter(context =>
      context.channel.includes(channel)
    );

    const commercials = relevantContexts.flatMap(context =>
      context.commercials
        .filter(commercial => {
          if (!year) return true;
          return Math.abs(commercial.year - year) <= maxYearDifference;
        })
        .map(commercial => ({
          ...commercial,
          contextId: context.id,
          contextName: context.name
        }))
    );

    return commercials;
  }

  /**
   * Obtiene comerciales aleatorios para una duración específica
   */
  public async getRandomCommercialsForDuration(
    channel: string,
    targetDurationInSeconds: number,
    year?: number
  ) {
    const availableCommercials = await this.getCommercialsByChannelAndYear(channel, year);
    
    if (availableCommercials.length === 0) {
      return [];
    }

    const selectedCommercials = [];
    let remainingDuration = targetDurationInSeconds;

    // Convertir duraciones a segundos para cálculos
    const commercialsWithSeconds = availableCommercials.map(commercial => ({
      ...commercial,
      durationInSeconds: this.parseDurationToSeconds(commercial.duration)
    }));

    // Seleccionar comerciales hasta llenar la duración objetivo
    while (remainingDuration > 0 && commercialsWithSeconds.length > 0) {
      // Filtrar comerciales que no excedan demasiado la duración restante
      const viableCommercials = commercialsWithSeconds.filter(
        commercial => commercial.durationInSeconds <= remainingDuration + 10 // 10 segundos de tolerancia
      );

      if (viableCommercials.length === 0) {
        // Si no hay comerciales viables, tomar el más corto disponible
        const shortest = commercialsWithSeconds.reduce((prev, current) =>
          prev.durationInSeconds < current.durationInSeconds ? prev : current
        );
        selectedCommercials.push(shortest);
        remainingDuration -= shortest.durationInSeconds;
      } else {
        // Seleccionar un comercial viable aleatoriamente
        const randomCommercial = viableCommercials[Math.floor(Math.random() * viableCommercials.length)];
        selectedCommercials.push(randomCommercial);
        remainingDuration -= randomCommercial.durationInSeconds;
      }
    }

    return selectedCommercials;
  }

  /**
   * Convierte una duración en formato "mm:ss" o "hh:mm:ss" a segundos
   */
  private parseDurationToSeconds(duration: string): number {
    const parts = duration.split(':').map(Number);
    
    if (parts.length === 2) {
      // Formato mm:ss
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // Formato hh:mm:ss
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return 0;
  }

  /**
   * Convierte segundos a formato "mm:ss"
   */
  public static formatSecondsToMMSS(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}