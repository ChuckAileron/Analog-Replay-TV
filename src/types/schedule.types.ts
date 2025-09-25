/**
 * Tipos para el sistema de programación de Analog Replay TV
 */

export interface ScheduleEntry {
  id: string;
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  channelId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // duración en minutos
  blockType: 'show' | 'commercial' | 'filler';
  commercialBreaks?: CommercialBreak[];
  isRepeat?: boolean;
  repeatType?: 'morning' | 'afternoon' | 'night';
  conversionRequired?: boolean;
  conversionStatus?: 'pending' | 'converting' | 'completed' | 'error';
}

export interface CommercialBreak {
  id: string;
  startOffset: number; // tiempo desde el inicio del show en minutos
  duration: number; // duración en minutos
  commercials: ScheduledCommercial[];
}

export interface ScheduledCommercial {
  contextId: string;
  commercialId: string;
  fileName: string;
  duration: string;
  year: number;
}

export interface DaySchedule {
  date: string; // formato YYYY-MM-DD
  channelId: string;
  entries: ScheduleEntry[];
  totalDuration: number; // en minutos (1440 para un día completo)
}

export interface ChannelSchedule {
  channelId: string;
  channelName: string;
  year: number; // año principal de la programación
  isNightOnly: boolean; // programación exclusiva nocturna (00:00-05:59)
  dailySchedules: Map<string, DaySchedule>; // key: fecha YYYY-MM-DD
  currentShowRotation: ShowRotation[];
  nextScheduleGeneration: Date; // cuándo generar la próxima programación
}

export interface ShowRotation {
  showId: number;
  currentSeasonNumber: number;
  currentEpisodeNumber: number;
  repeatCount: number; // cuántas veces se ha mostrado esta temporada
  maxRepeats: number; // máximo de repeticiones (1 o 2 según configuración)
  isCompleted: boolean;
  timeSlots: TimeSlot[];
}

export interface TimeSlot {
  type: 'morning' | 'afternoon' | 'night';
  startHour: number;
  endHour: number;
  blockDuration: number; // 30 o 60 minutos
}

export interface ScheduleConfig {
  primaryYear: number; // año principal definido por el usuario
  allowYearSelection: boolean; // si puede volver a seleccionar el año
  repeatSeasons: boolean; // si repetir temporadas 2 veces
  lastYearCheck: string; // última vez que se verificó si necesita nueva programación
  yearTolerance: number; // tolerancia de años para búsqueda de shows
  maxShowsFromPrimaryYear: number; // máximo 6 shows del año principal
  schedules: Map<string, ChannelSchedule>; // key: channelId
  lastUpdated: string;
}

export interface TimeCalculation {
  currentTime: Date;
  showStartTime: Date;
  showEndTime: Date;
  elapsedTime: number; // tiempo transcurrido en minutos desde el inicio del show
  remainingTime: number; // tiempo restante del show en minutos
  seekPosition: number; // posición donde debe comenzar la reproducción en segundos
}

export interface ConversionTask {
  id: string;
  channelId: string;
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  inputPath: string;
  outputPath: string;
  priority: 'high' | 'normal' | 'low'; // alta prioridad para el show actual
  status: 'pending' | 'converting' | 'completed' | 'error';
  progress: number; // 0-100
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ScheduleState {
  isInitialized: boolean;
  isGeneratingSchedule: boolean;
  currentConversions: ConversionTask[];
  lastScheduleGeneration: Date;
  needsYearSelection: boolean; // si necesita que el usuario seleccione nuevo año
}

export interface ProgrammingBlock {
  type: 'show' | 'commercial';
  duration: number; // en minutos
  content: ShowBlock | CommercialBlock;
}

export interface ShowBlock {
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  startOffset: number; // desde qué minuto del episodio comenzar
  endOffset: number; // hasta qué minuto del episodio reproducir
}

export interface CommercialBlock {
  commercials: ScheduledCommercial[];
  totalDuration: number;
  fallbackMessage?: string; // mensaje si no hay comerciales
}

// Configuración de bloques de tiempo
export interface TimeBlockConfig {
  morning: {
    start: number; // hora en formato 24h
    end: number;
    blockDuration: number; // 30 o 60 minutos
  };
  afternoon: {
    start: number;
    end: number;
    blockDuration: number;
  };
  night: {
    start: number;
    end: number;
    blockDuration: number;
  };
  nightOnly: {
    start: number; // 0 (00:00)
    end: number;   // 6 (05:59)
    blockDuration: number;
  };
}

// Constantes por defecto
export const DEFAULT_TIME_BLOCKS: TimeBlockConfig = {
  morning: {
    start: 6,  // 06:00
    end: 12,   // 11:59
    blockDuration: 60
  },
  afternoon: {
    start: 12, // 12:00
    end: 18,   // 17:59
    blockDuration: 60
  },
  night: {
    start: 18, // 18:00
    end: 24,   // 23:59
    blockDuration: 60
  },
  nightOnly: {
    start: 0,  // 00:00
    end: 6,    // 05:59
    blockDuration: 60
  }
};

// Estados de programación
export type ScheduleStatus = 
  | 'not_initialized'
  | 'initializing'
  | 'ready'
  | 'generating'
  | 'converting_videos'
  | 'error'
  | 'needs_year_selection';

export interface ScheduleError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Tipos específicos para TV Guide
export interface TVGuideData {
  year: number;
  month: number;
  day: number;
  channels: TVGuideChannel[];
}

export interface TVGuideChannel {
  channelId: string;
  channelNumber: number;
  channelName: string;
  programs: TVGuideProgram[];
}

export interface TVGuideProgram {
  id: string;
  showId: number;
  showName: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle?: string;
  startTime: Date;
  endTime: Date;
  duration: number; // en minutos
  description?: string;
  isCurrentlyPlaying: boolean;
  progress?: number; // 0-100
}

export interface TVGuideNavigationState {
  selectedYear: number;
  selectedMonth: number; // 1-12
  selectedDay: number;
  selectedChannel: number; // índice del canal
  selectedProgram: number; // índice del programa
}

export interface TVGuideViewConfig {
  showPastDays: number; // cuántos días anteriores mostrar
  showFutureDays: number; // cuántos días futuros mostrar
  timeSlotDuration: number; // duración en minutos de cada slot
  startHour: number; // hora de inicio del guide (ej: 6 para 06:00)
  endHour: number; // hora de fin del guide (ej: 26 para 02:00 del día siguiente)
}