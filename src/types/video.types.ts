// Tipos principales para el motor de video TypeScript

export interface VideoMetadata {
  filename: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  videoCodec: string;
  audioCodec: string;
  format: string;
  size: number;
  isHTML5Compatible: boolean;
  needsConversion: boolean;
}

export interface VideoPlayerRef {
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  mute(): void;
  unmute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getState(): VideoPlayerState;
}

export interface VideoAnalysisResult {
  metadata: VideoMetadata;
  needsConversion: boolean;
  conversionOptions?: ConversionOptions;
  compatibilityIssues: string[];
  compatibilityReport: {
    canPlayNatively: boolean;
    recommendedAction: 'play' | 'convert' | 'unsupported';
    conversionNeeded: boolean;
    estimatedConversionTime: number;
  };
}

export interface ConversionOptions {
  outputFormat: 'mp4' | 'webm';
  videoCodec: 'libx264' | 'libx265' | 'libvpx-vp9';
  audioCodec: 'aac' | 'mp3' | 'libvorbis' | 'opus';
  resolution?: {
    width: number;
    height: number;
  };
  bitrate?: number;
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  quality: 'fast' | 'balanced' | 'high';
  crf?: number; // Constant Rate Factor (18-28)
  maxWidth?: number;
  maxHeight?: number;
}

export interface ConversionProgress {
  percentage: number;
  currentTime: number;
  totalTime: number;
  speed: string;
  fps: number;
  bitrate: string;
  size: string;
  eta: string;
  isComplete: boolean;
  error?: string;
}

export interface VideoProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  metadata?: VideoMetadata;
}

export interface CachedVideo {
  originalPath: string;
  convertedPath: string;
  hash: string;
  createdAt: Date;
  size: number;
  metadata: VideoMetadata;
}

export interface VideoPlayerState {
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  buffered: TimeRanges | null;
  error: string | null;
  quality: 'auto' | 'high' | 'medium' | 'low';
}

export interface VideoPlayerConfig {
  autoplay: boolean;
  controls: boolean;
  muted: boolean;
  loop: boolean;
  preload: 'none' | 'metadata' | 'auto';
  style: 'retro-90s' | 'retro-00s' | 'modern';
  effectsEnabled: boolean;
}

export interface VideoPlayerCallbacks {
  onLoadStart?: () => void;
  onLoadedMetadata?: (metadata: VideoMetadata) => void;
  onCanPlay?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onProgress?: (buffered: TimeRanges) => void;
  onVolumeChange?: (volume: number, muted: boolean) => void;
  onError?: (error: string) => void;
  onEnded?: () => void;
}

// Eventos del sistema de conversión
export interface ConversionEvents {
  onStart?: (inputPath: string) => void;
  onProgress?: (progress: ConversionProgress) => void;
  onComplete?: (result: VideoProcessingResult) => void;
  onError?: (error: string) => void;
}

// Configuración del motor FFmpeg
export interface FFmpegConfig {
  binaryPath?: string;
  tempDir: string;
  cacheDir: string;
  maxCacheSize: number; // MB
  enableHardwareAcceleration: boolean;
  logLevel: 'quiet' | 'error' | 'warning' | 'info' | 'verbose' | 'debug';
}

// Formatos soportados
export interface SupportedFormats {
  input: string[];
  output: string[];
  videoCodecs: string[];
  audioCodecs: string[];
}

// Estado del cache
export interface CacheState {
  totalFiles: number;
  totalSize: number;
  oldestFile: Date;
  newestFile: Date;
  cacheHitRate: number;
}

export interface VideoEngineStats {
  totalVideosProcessed: number;
  totalConversions: number;
  cacheHits: number;
  cacheMisses: number;
  averageConversionTime: number;
  totalCacheSize: number;
}