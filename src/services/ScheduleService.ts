/**
 * Wrapper del ScheduleService que redirige al ScheduleServiceRenderer
 * para evitar problemas de imports de Node.js en el renderer
 */
import { ScheduleServiceRenderer } from './ScheduleServiceRenderer';
import type {
  ScheduleConfig,
  ScheduleEntry,
  ScheduleStatus,
  TVGuideData
} from '../types/schedule.types';

export class ScheduleService {
  private static instance: ScheduleService;
  private renderer: ScheduleServiceRenderer;

  private constructor() {
    this.renderer = ScheduleServiceRenderer.getInstance();
  }

  public static getInstance(): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService();
    }
    return ScheduleService.instance;
  }

  // Métodos que redirigen al ScheduleServiceRenderer
  public async initialize(): Promise<ScheduleStatus> {
    return this.renderer.initialize();
  }

  public async setPrimaryYear(year: number): Promise<boolean> {
    return this.renderer.setPrimaryYear(year);
  }

  public async getCurrentConfig(): Promise<ScheduleConfig | null> {
    return this.renderer.getCurrentConfig();
  }

  public async getCurrentScheduleEntry(channelId?: string): Promise<ScheduleEntry | null> {
    return this.renderer.getCurrentScheduleEntry(channelId);
  }

  public async getTVGuideData(year: number, month: number, day: number): Promise<TVGuideData | null> {
    return this.renderer.getTVGuideData(year, month, day);
  }

  public async getScheduleStatus(): Promise<ScheduleStatus> {
    return this.renderer.getScheduleStatus();
  }

  public calculateCurrentShowTime(entry: ScheduleEntry): any {
    return this.renderer.calculateCurrentShowTime(entry);
  }

  public async enableSeasonRepeat(enabled: boolean): Promise<void> {
    return this.renderer.enableSeasonRepeat(enabled);
  }

  // Métodos adicionales para compatibilidad
  public async getTVGuideDataRange(startDate: Date, endDate: Date): Promise<Map<string, TVGuideData>> {
    return this.renderer.getTVGuideDataRange(startDate, endDate);
  }

  public async getTVGuideStats(startDate: Date, endDate: Date): Promise<any> {
    return this.renderer.getTVGuideStats(startDate, endDate);
  }

  public async searchProgramsInGuide(query: string, startDate: Date, endDate: Date): Promise<{ date: string; channel: any; program: any }[]> {
    return this.renderer.searchProgramsInGuide(query, startDate, endDate);
  }
}