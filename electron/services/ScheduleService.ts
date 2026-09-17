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
  // 'filler': espacio de relleno (logo animado "AnalogReplayTV") que ocupa el
  // tiempo restante de un slot de 30 minutos cuando el episodio dura menos.
  // A futuro será reemplazado/complementado por comerciales reales.
  type: 'show' | 'commercial' | 'filler';
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

// ===== Tipos mínimos para leer los JSON reales de shows/canales =====

interface RealChannel {
  id: number | string;
  uuid?: string;
  name: string;
  number: number;
  isEnabled?: boolean;
}

interface RealEpisode {
  episode: number;
  title: string;
  duration: string; // "mm:ss" o "hh:mm:ss"
  fileName?: string;
}

interface RealSeason {
  season: number;
  year: number;
  episodes: RealEpisode[];
  contentPath?: string;
  contentPaths?: string[];
}

interface RealShow {
  id: number | string;
  uuid?: string;
  name: string;
  channel: string[];
  seasons: RealSeason[];
  airYears?: number[];
  airUntilToDate?: boolean;
  // Controla cómo se repite el episodio de un show a lo largo del día:
  // - 'daily-repeat' (default): el mismo episodio se transmite en TODOS los
  //   turnos del show durante el día; solo avanza al siguiente episodio al
  //   comenzar el día siguiente.
  // - 'once-per-day': el show aparece una única vez en el día (un solo turno);
  //   igualmente avanza al siguiente episodio al día siguiente.
  episodeAiringMode?: 'daily-repeat' | 'once-per-day';
}

// Estado de emisión de un show durante la generación de la programación anual
interface ShowAiringState {
  show: RealShow;
  episodes: FlatEpisode[];
  pointer: number; // índice del episodio "de hoy" dentro de `episodes`
  mode: 'daily-repeat' | 'once-per-day';
}

// Episodio aplanado con referencia a su show, usado para armar la rotación
interface FlatEpisode {
  show: RealShow;
  season: number;
  episode: number;
  episodeTitle: string;
  durationSeconds: number;
}

export class ScheduleServiceMain {
  private static instance: ScheduleServiceMain | null = null;
  private configPath: string;
  private schedulesPath: string;
  private config: ScheduleConfig | null = null;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'schedule-config.json');
    // Los datos generados viven en userData (no en el código fuente), para
    // funcionar correctamente tanto en desarrollo como en builds empaquetadas.
    this.schedulesPath = path.join(userDataPath, 'schedules');
    if (!fs.existsSync(this.schedulesPath)) fs.mkdirSync(this.schedulesPath, { recursive: true });
    this.setupIPC();
  }

  public static getInstance(): ScheduleServiceMain {
    if (!this.instance) this.instance = new ScheduleServiceMain();
    return this.instance;
  }

  public async initialize(): Promise<'needs_year_selection' | 'ready'> {
    await this.loadConfig();

    if (!this.config || this.config.primaryYear === 0) {
      return 'needs_year_selection';
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!this.config.generatedMonths.includes(currentMonthKey)) {
      await this.generateYear(this.config.primaryYear);
    }

    return 'ready';
  }

  public async setPrimaryYear(year: number): Promise<void> {
    this.config = {
      primaryYear: year,
      secondaryYears: [],
      lastGenerated: new Date().toISOString(),
      currentYear: year,
      generatedMonths: []
    };

    await this.saveConfig();
    await this.generateYear(year);
  }

  public getCurrentConfig(): ScheduleConfig | null {
    return this.config;
  }

  public async getCurrentScheduleEntry(channelId?: string): Promise<ScheduleEntry | null> {
    const now = new Date();
    return this.getScheduleEntryAt(now.toISOString(), channelId);
  }

  public async getScheduleEntryAt(date: string, channelId?: string): Promise<ScheduleEntry | null> {
    const targetDate = new Date(date);
    const monthSchedule = await this.getMonthSchedule(targetDate.getFullYear(), targetDate.getMonth() + 1);
    if (!monthSchedule) return null;

    const candidate = monthSchedule.entries.find((entry) => {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      const matchesChannel = !channelId || entry.channelId === channelId;
      return matchesChannel && targetDate >= start && targetDate < end;
    });

    return candidate ?? null;
  }

  /**
   * Borra la configuración de programación y todos los archivos generados,
   * forzando que la aplicación vuelva a pedir la selección de año inicial.
   */
  public async resetSchedule(): Promise<{ success: boolean; error?: string }> {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
      if (fs.existsSync(this.schedulesPath)) {
        fs.rmSync(this.schedulesPath, { recursive: true, force: true });
      }
      fs.mkdirSync(this.schedulesPath, { recursive: true });

      this.config = {
        primaryYear: 0,
        secondaryYears: [],
        lastGenerated: '',
        currentYear: new Date().getFullYear(),
        generatedMonths: []
      };
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error reseteando la programación';
      console.error('❌ [ScheduleService] Error en resetSchedule:', error);
      return { success: false, error: message };
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) return;
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  private async loadConfig(): Promise<void> {
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(content) as ScheduleConfig;
      return;
    }

    this.config = {
      primaryYear: 0,
      secondaryYears: [],
      lastGenerated: '',
      currentYear: new Date().getFullYear(),
      generatedMonths: []
    };

    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  private getMonthName(month: number): string {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    return months[Math.max(0, month - 1)] || 'unknown';
  }

  // ===== Lectura de datos reales (shows/canales) desde el código fuente =====

  private readRealChannels(): RealChannel[] {
    try {
      const configPath = path.join(process.cwd(), 'src/config/channels/channels.config.json');
      if (!fs.existsSync(configPath)) return [];
      const data = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data);
      return (parsed.channels || []).filter((ch: RealChannel) => ch.isEnabled !== false);
    } catch (error) {
      console.error('❌ [ScheduleService] Error leyendo canales reales:', error);
      return [];
    }
  }

  private readRealShows(): RealShow[] {
    try {
      const configPath = path.join(process.cwd(), 'src/config/shows/shows.config.json');
      if (!fs.existsSync(configPath)) return [];
      const data = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.shows || [];
    } catch (error) {
      console.error('❌ [ScheduleService] Error leyendo shows reales:', error);
      return [];
    }
  }

  /**
   * Convierte una duración en formato "mm:ss" o "hh:mm:ss" a segundos.
   * Si el formato es inválido, retorna un valor por defecto razonable (5 minutos).
   */
  private parseDurationToSeconds(duration: string | undefined): number {
    const DEFAULT_SECONDS = 5 * 60;
    if (!duration) return DEFAULT_SECONDS;

    const parts = duration.split(':').map(p => parseInt(p, 10));
    if (parts.some(p => isNaN(p))) return DEFAULT_SECONDS;

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return minutes * 60 + seconds;
    }
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    }
    return DEFAULT_SECONDS;
  }

  /**
   * Determina si un show está asignado a un canal específico, comparando
   * por uuid, id (legacy) o nombre (case-insensitive).
   */
  private isShowAssignedToChannel(show: RealShow, channel: RealChannel): boolean {
    return show.channel.some((ch) =>
      ch === channel.uuid ||
      ch === String(channel.id) ||
      ch.toLowerCase() === channel.name.toLowerCase()
    );
  }

  /**
   * Determina si un show es elegible para transmitirse en un año determinado.
   * - Si `airUntilToDate` es true, siempre es elegible.
   * - Si `airYears` tiene valores, es elegible si el año solicitado está incluido.
   * - Si no tiene ninguno de los dos configurado, se considera elegible para
   *   cualquier año (comportamiento retrocompatible para shows sin configurar).
   */
  private isShowEligibleForYear(show: RealShow, year: number): boolean {
    if (show.airUntilToDate) return true;
    if (show.airYears && show.airYears.length > 0) {
      return show.airYears.includes(year);
    }
    return true; // Sin configuración: siempre disponible
  }

  /**
   * Verifica si al menos una de las carpetas de contenido configuradas para
   * una temporada existe REALMENTE en disco (no solo que el campo no esté
   * vacío). Esto evita programar episodios cuya carpeta configurada es
   * inválida u obsoleta, lo cual causaría que el reproductor tenga que
   * sustituir silenciosamente el episodio por otro disponible (generando
   * una discrepancia entre lo que muestra la guía y lo que realmente se
   * reproduce, además de perder el punto de reanudación calculado).
   */
  private seasonHasRealContent(season: RealSeason): boolean {
    const candidatePaths = [season.contentPath, ...(season.contentPaths || [])].filter(
      (p): p is string => !!p
    );

    return candidatePaths.some((candidatePath) => {
      try {
        return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory();
      } catch {
        return false;
      }
    });
  }

  /**
   * Aplana todos los episodios de un show (todas sus temporadas) en una
   * lista simple, preservando referencia a temporada/episodio real.
   */
  private flattenShowEpisodes(show: RealShow): FlatEpisode[] {
    const flat: FlatEpisode[] = [];
    for (const season of show.seasons) {
      if (!season.episodes || season.episodes.length === 0) continue;
      // Solo incluir temporadas cuya carpeta de contenido exista realmente en disco
      if (!this.seasonHasRealContent(season)) continue;

      for (const episode of season.episodes) {
        flat.push({
          show,
          season: season.season,
          episode: episode.episode,
          episodeTitle: episode.title,
          durationSeconds: this.parseDurationToSeconds(episode.duration)
        });
      }
    }
    return flat;
  }

  /**
   * Clave de calendario (año-mes-día en hora local) usada para detectar
   * cuándo el cursor de generación cruza a un nuevo día.
   */
  private dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  /**
   * Medianoche local del día siguiente al de la fecha dada.
   */
  private startOfNextDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  }

  /**
   * Crea una entrada de relleno ("AnalogReplayTV") entre dos instantes dados.
   */
  private buildFillerEntry(channelIdentifier: string, channelName: string, start: Date, end: Date): ScheduleEntry {
    return {
      id: uuidv4(),
      showId: 'analog-replay-tv-filler',
      showName: 'AnalogReplayTV',
      season: 0,
      episode: 0,
      episodeTitle: 'Identificación de estación',
      channelId: channelIdentifier,
      channelName,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration: `${Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))} min`,
      type: 'filler'
    };
  }

  /**
   * Genera la programación completa de un canal para todo el año, anclando
   * el inicio en el 1 de enero 00:00:00 y avanzando un cursor de tiempo en
   * bloques de 30 minutos ("slots").
   *
   * Cada show mantiene el MISMO episodio durante todo el día (puede repetirse
   * en varios de sus turnos, si está en modo 'daily-repeat'), y solo avanza
   * al siguiente episodio de su catálogo al comenzar el día siguiente. Los
   * shows en modo 'once-per-day' aparecen una única vez por día.
   *
   * Dentro de cada día, los shows disponibles se turnan entre sí en
   * round-robin: un show en modo 'daily-repeat' vuelve al final de la cola
   * después de cada turno (para repetirse más tarde ese mismo día con el
   * mismo episodio); uno en modo 'once-per-day' no vuelve a la cola.
   *
   * Cada episodio ocupa el número de slots de 30 min necesario para cubrir
   * su duración real (redondeando hacia arriba); si dura menos que su
   * slot, el tiempo restante se llena con una entrada de tipo 'filler'
   * (logo animado de "AnalogReplayTV") hasta el siguiente slot de 30 min.
   * Esto asegura que todos los episodios comiencen siempre en un horario
   * "en punto" o "y media", como una parrilla de TV real.
   */
  private buildChannelYearEntries(channel: RealChannel, shows: RealShow[], year: number): ScheduleEntry[] {
    const eligibleShows = shows.filter((show) =>
      this.isShowAssignedToChannel(show, channel) && this.isShowEligibleForYear(show, year)
    );

    const showStates: ShowAiringState[] = eligibleShows
      .map((show): ShowAiringState => ({
        show,
        episodes: this.flattenShowEpisodes(show),
        pointer: 0,
        mode: show.episodeAiringMode === 'once-per-day' ? 'once-per-day' : 'daily-repeat'
      }))
      .filter((state) => state.episodes.length > 0);

    if (showStates.length === 0) return [];

    const SLOT_SECONDS = 30 * 60; // 30 minutos
    const channelIdentifier = channel.uuid || String(channel.id);

    const entries: ScheduleEntry[] = [];
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);

    let cursor = new Date(yearStart);
    let currentDayKey = this.dayKey(cursor);
    // Cola de turnos del día actual: se reinicia con todos los shows cada vez
    // que el cursor cruza a un nuevo día.
    let queue: ShowAiringState[] = [...showStates];

    // Límite de seguridad para evitar loops infinitos si algo sale mal
    const maxIterations = 500000;
    let iterations = 0;

    while (cursor < yearEnd && iterations < maxIterations) {
      iterations++;

      // Detectar cambio de día: avanzar el episodio "de hoy" de cada show
      // (una sola vez, sin importar cuántas veces se repitió ayer) y
      // reiniciar la cola de turnos para el nuevo día.
      const cursorDayKey = this.dayKey(cursor);
      if (cursorDayKey !== currentDayKey) {
        for (const state of showStates) {
          state.pointer = (state.pointer + 1) % state.episodes.length;
        }
        queue = [...showStates];
        currentDayKey = cursorDayKey;
      }

      if (queue.length === 0) {
        // Todos los shows disponibles ya cumplieron su única aparición de hoy
        // (modo 'once-per-day') y ninguno queda para repetir: rellenar el
        // resto del día con el logo de identificación de estación.
        const dayEnd = this.startOfNextDay(cursor);
        entries.push(this.buildFillerEntry(channelIdentifier, channel.name, cursor, dayEnd));
        cursor = dayEnd;
        continue;
      }

      const state = queue.shift()!;
      const flatEpisode = state.episodes[state.pointer % state.episodes.length];

      // El episodio ocupa la cantidad de slots de 30 min necesaria para cubrir
      // su duración real (mínimo 1 slot), redondeando hacia arriba.
      const occupiedSlots = Math.max(1, Math.ceil(flatEpisode.durationSeconds / SLOT_SECONDS));
      const totalSlotSeconds = occupiedSlots * SLOT_SECONDS;

      const showStart = new Date(cursor);
      const showEnd = new Date(cursor.getTime() + flatEpisode.durationSeconds * 1000);

      entries.push({
        id: uuidv4(),
        showId: flatEpisode.show.uuid || String(flatEpisode.show.id),
        showName: flatEpisode.show.name,
        season: flatEpisode.season,
        episode: flatEpisode.episode,
        episodeTitle: flatEpisode.episodeTitle,
        channelId: channelIdentifier,
        channelName: channel.name,
        startTime: showStart.toISOString(),
        endTime: showEnd.toISOString(),
        duration: `${Math.round(flatEpisode.durationSeconds / 60)} min`,
        type: 'show'
      });

      // Si el episodio terminó antes de cubrir el/los slot(s) completos,
      // rellenar el tiempo restante con el logo animado de "AnalogReplayTV".
      const slotEnd = new Date(cursor.getTime() + totalSlotSeconds * 1000);
      if (slotEnd.getTime() > showEnd.getTime()) {
        entries.push(this.buildFillerEntry(channelIdentifier, channel.name, showEnd, slotEnd));
      }

      cursor = slotEnd;

      if (state.mode === 'daily-repeat') {
        queue.push(state); // vuelve al final de la cola para repetirse hoy
      }
      // 'once-per-day': no se vuelve a agregar; ya cumplió su única aparición de hoy
    }

    return entries;
  }

  public async generateYear(year: number): Promise<{ success: boolean; error?: string; generatedMonths?: number }> {
    try {
      const targetYear = Number.isFinite(year) ? year : new Date().getFullYear();

      const channels = this.readRealChannels();
      const shows = this.readRealShows();

      // Generar todas las entradas del año para todos los canales de una sola vez,
      // para poder mantener continuidad temporal y luego repartirlas por mes.
      const allEntries: ScheduleEntry[] = [];
      for (const channel of channels) {
        const channelEntries = this.buildChannelYearEntries(channel, shows, targetYear);
        allEntries.push(...channelEntries);
      }

      const generatedMonths: string[] = [];

      for (let month = 1; month <= 12; month++) {
        const monthEntries = allEntries.filter((entry) => {
          const start = new Date(entry.startTime);
          return start.getFullYear() === targetYear && start.getMonth() + 1 === month;
        });

        const schedule: MonthlySchedule = {
          year: targetYear,
          month,
          monthName: this.getMonthName(month),
          entries: monthEntries,
          generated: new Date().toISOString(),
          primaryYear: targetYear
        };

        const monthDir = path.join(this.schedulesPath, String(targetYear));
        if (!fs.existsSync(monthDir)) fs.mkdirSync(monthDir, { recursive: true });

        const filePath = path.join(monthDir, `${this.getMonthName(month)}-${targetYear}.json`);
        fs.writeFileSync(filePath, JSON.stringify(schedule, null, 2), 'utf8');
        generatedMonths.push(`${targetYear}-${String(month).padStart(2, '0')}`);
      }

      this.config = {
        primaryYear: targetYear,
        secondaryYears: [],
        lastGenerated: new Date().toISOString(),
        currentYear: targetYear,
        generatedMonths
      };

      await this.saveConfig();
      return { success: true, generatedMonths: generatedMonths.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error generando programación';
      console.error('❌ [ScheduleService] Error en generateYear:', error);
      return { success: false, error: message };
    }
  }

  public async getMonthSchedule(year: number, month: number): Promise<MonthlySchedule | null> {
    const monthName = this.getMonthName(month);
    const filePath = path.join(this.schedulesPath, String(year), `${monthName}-${year}.json`);
    if (!fs.existsSync(filePath)) {
      const result = await this.generateYear(year);
      if (!result.success) return null;
      return this.getMonthSchedule(year, month);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as MonthlySchedule;
  }

  private setupIPC(): void {
    ipcMain.handle('schedule:initialize', async () => {
      const status = await this.initialize();
      return { success: true, status, config: this.config };
    });

    ipcMain.handle('schedule:setPrimaryYear', async (_event, year: number) => {
      await this.setPrimaryYear(year);
      return { success: true, config: this.config };
    });

    ipcMain.handle('schedule:getCurrentConfig', async () => {
      return this.getCurrentConfig();
    });

    ipcMain.handle('schedule:getCurrentScheduleEntry', async (_event, channelId?: string) => {
      return this.getCurrentScheduleEntry(channelId);
    });

    ipcMain.handle('schedule:getScheduleEntryAt', async (_event, date: string, channelId?: string) => {
      return this.getScheduleEntryAt(date, channelId);
    });

    ipcMain.handle('schedule:getMonthSchedule', async (_event, year: number, month: number) => {
      return this.getMonthSchedule(year, month);
    });

    ipcMain.handle('schedule:generateYear', async (_event, year: number) => {
      return this.generateYear(year);
    });

    ipcMain.handle('schedule:reset', async () => {
      return this.resetSchedule();
    });
  }
}

export const scheduleServiceMain = ScheduleServiceMain.getInstance();
