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