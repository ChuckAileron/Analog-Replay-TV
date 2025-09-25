import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Clean main-process ScheduleService implementation.
export interface ScheduleEntry {
  id: string;
  showId: string;
  showName: string;
  season: number;
  episode: number;
  episodeTitle?: string;
  channelId: string;
  channelName: string;
  startTime: string; // ISO
  endTime: string; // ISO
  duration?: string;
  type: 'show' | 'commercial';
}

export interface MonthlySchedule {
  year: number;
  month: number;
  monthName: string;
  entries: ScheduleEntry[];
  generated: string;
  primaryYear: number;
}

export interface ScheduleConfig {
  primaryYear: number;
  secondaryYears: number[];
  lastGenerated: string;
  currentYear: number;
  generatedMonths: string[];
}

export class ScheduleServiceMain {
  private static instance: ScheduleServiceMain | null = null;
  private configPath: string;
  private schedulesPath: string;
  private config: ScheduleConfig | null = null;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'schedule-config.json');
    this.schedulesPath = path.join(process.cwd(), 'src', 'config', 'schedules');
    if (!fs.existsSync(this.schedulesPath)) fs.mkdirSync(this.schedulesPath, { recursive: true });
    this.setupIPC();
  }

  public static getInstance(): ScheduleServiceMain {
    if (!this.instance) this.instance = new ScheduleServiceMain();
    return this.instance;
  }

  private setupIPC(): void {
    ipcMain.handle('schedule:initialize', async () => {
      await this.loadConfig();
      return { success: true, config: this.config };
    });
  }

  private async loadConfig(): Promise<void> {
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(content) as ScheduleConfig;
      return;
    }
    this.config = { primaryYear: new Date().getFullYear(), secondaryYears: [], lastGenerated: '', currentYear: new Date().getFullYear(), generatedMonths: [] };
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  private getMonthName(month: number): string {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    return months[Math.max(0, month - 1)] || 'unknown';
  }

  public async getMonthSchedule(year: number, month: number): Promise<MonthlySchedule | null> {
    const monthName = this.getMonthName(month);
    const filePath = path.join(this.schedulesPath, String(year), `${monthName}-${year}.json`);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as MonthlySchedule;
  }
}

export const scheduleServiceMain = ScheduleServiceMain.getInstance();