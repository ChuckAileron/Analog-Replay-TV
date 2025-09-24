// Motor FFmpeg TypeScript para procesamiento de video (Electron Main Process)
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Tipos simplificados para el proceso principal
interface VideoMetadata {
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

interface ConversionOptions {
  outputFormat: 'mp4' | 'webm';
  videoCodec: 'libx264' | 'libx265' | 'libvpx-vp9';
  audioCodec: 'aac' | 'mp3' | 'libvorbis' | 'opus';
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  quality: 'fast' | 'balanced' | 'high';
  crf?: number;
  resolution?: { width: number; height: number };
  bitrate?: number;
}

interface ConversionProgress {
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

interface VideoProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  metadata?: VideoMetadata;
}

interface FFmpegConfig {
  binaryPath?: string;
  tempDir: string;
  cacheDir: string;
  maxCacheSize: number;
  enableHardwareAcceleration: boolean;
  logLevel: 'quiet' | 'error' | 'warning' | 'info' | 'verbose' | 'debug';
}

export class VideoEngineMain {
  private config: FFmpegConfig;
  private activeConversions = new Map<string, ChildProcess>();

  constructor(config: FFmpegConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      await fs.mkdir(this.config.tempDir, { recursive: true });
      console.log('✅ VideoEngineMain inicializado');
    } catch (error) {
      console.error('❌ Error inicializando VideoEngineMain:', error);
    }
  }

  // Analizar video
  async analyzeVideo(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobePath = this.config.binaryPath ? 
        path.join(path.dirname(this.config.binaryPath), 'ffprobe.exe') : 
        'ffprobe';

      const process = spawn(ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe error: ${stderr}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
          const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

          if (!videoStream) {
            reject(new Error('No se encontró stream de video'));
            return;
          }

          const metadata: VideoMetadata = {
            filename: path.basename(filePath),
            duration: parseFloat(data.format.duration) || 0,
            width: parseInt(videoStream.width) || 0,
            height: parseInt(videoStream.height) || 0,
            fps: this.parseFPS(videoStream.r_frame_rate) || 0,
            bitrate: parseInt(data.format.bit_rate) || 0,
            videoCodec: videoStream.codec_name || 'unknown',
            audioCodec: audioStream?.codec_name || 'none',
            format: data.format.format_name || 'unknown',
            size: parseInt(data.format.size) || 0,
            isHTML5Compatible: this.checkHTML5Compatibility(videoStream, audioStream),
            needsConversion: false
          };

          metadata.needsConversion = !metadata.isHTML5Compatible;
          resolve(metadata);
        } catch (parseError) {
          reject(new Error(`Error parsing FFprobe output: ${parseError}`));
        }
      });
    });
  }

  // Convertir video
  async convertVideo(
    inputPath: string, 
    options: ConversionOptions,
    progressCallback?: (progress: ConversionProgress) => void
  ): Promise<VideoProcessingResult> {
    try {
      const outputPath = await this.generateOutputPath(inputPath, options);
      const args = this.buildFFmpegArgs(inputPath, outputPath, options);
      
      return await this.executeConversion(inputPath, outputPath, args, progressCallback);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Cancelar conversión
  async cancelConversion(inputPath: string): Promise<boolean> {
    const process = this.activeConversions.get(inputPath);
    if (process) {
      process.kill();
      this.activeConversions.delete(inputPath);
      return true;
    }
    return false;
  }

  // Métodos privados
  private checkHTML5Compatibility(videoStream: any, audioStream: any): boolean {
    const supportedVideoCodecs = ['h264', 'vp8', 'vp9', 'av01'];
    const supportedAudioCodecs = ['aac', 'mp3', 'vorbis', 'opus'];
    
    const videoCompatible = supportedVideoCodecs.includes(videoStream.codec_name);
    const audioCompatible = !audioStream || supportedAudioCodecs.includes(audioStream.codec_name);
    
    return videoCompatible && audioCompatible;
  }

  private parseFPS(rFrameRate: string): number {
    if (!rFrameRate) return 0;
    const [num, den] = rFrameRate.split('/').map(Number);
    return den ? num / den : num;
  }

  private async generateOutputPath(inputPath: string, options: ConversionOptions): Promise<string> {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    const extension = options.outputFormat;
    return path.join(this.config.cacheDir, `${baseName}_${timestamp}.${extension}`);
  }

  private buildFFmpegArgs(inputPath: string, outputPath: string, options: ConversionOptions): string[] {
    const args: string[] = [
      '-i', inputPath,
      '-y' // Sobrescribir archivo de salida
    ];

    // Hardware acceleration
    if (this.config.enableHardwareAcceleration) {
      args.push('-hwaccel', 'auto');
    }

    // Video codec
    args.push('-c:v', options.videoCodec);
    
    if (options.videoCodec === 'libx264') {
      args.push('-preset', options.preset);
      args.push('-crf', (options.crf || 23).toString());
    }

    // Audio codec
    args.push('-c:a', options.audioCodec);

    // Resolución
    if (options.resolution) {
      args.push('-vf', `scale=${options.resolution.width}:${options.resolution.height}`);
    }

    // Bitrate
    if (options.bitrate) {
      args.push('-b:v', `${options.bitrate}`);
    }

    // Progress reporting
    args.push('-progress', 'pipe:1');
    args.push('-loglevel', this.config.logLevel);

    args.push(outputPath);
    return args;
  }

  private async executeConversion(
    inputPath: string,
    outputPath: string,
    args: string[],
    progressCallback?: (progress: ConversionProgress) => void
  ): Promise<VideoProcessingResult> {
    return new Promise(async (resolve) => {
      const ffmpegPath = this.config.binaryPath || 'ffmpeg';
      const process = spawn(ffmpegPath, args);
      
      this.activeConversions.set(inputPath, process);

      let stderr = '';
      const metadata = await this.analyzeVideo(inputPath);
      
      process.stdout.on('data', (data) => {
        const progress = this.parseFFmpegProgress(data.toString(), metadata.duration);
        if (progress && progressCallback) {
          progressCallback(progress);
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', async (code) => {
        this.activeConversions.delete(inputPath);
        
        if (code === 0) {
          try {
            const outputMetadata = await this.analyzeVideo(outputPath);
            resolve({
              success: true,
              outputPath,
              metadata: outputMetadata
            });
          } catch (error) {
            resolve({
              success: false,
              error: `Error verificando archivo convertido: ${error}`
            });
          }
        } else {
          resolve({
            success: false,
            error: `FFmpeg error (code ${code}): ${stderr}`
          });
        }
      });

      process.on('error', (error) => {
        this.activeConversions.delete(inputPath);
        resolve({
          success: false,
          error: `Process error: ${error.message}`
        });
      });
    });
  }

  private parseFFmpegProgress(data: string, totalDuration: number): ConversionProgress | null {
    const lines = data.split('\n');
    const progress: any = {};

    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        progress[key.trim()] = value.trim();
      }
    }

    if (progress.out_time_ms) {
      const currentTime = parseInt(progress.out_time_ms) / 1000000;
      const percentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

      return {
        percentage: Math.min(percentage, 100),
        currentTime,
        totalTime: totalDuration,
        speed: progress.speed || '0x',
        fps: parseFloat(progress.fps) || 0,
        bitrate: progress.bitrate || '0kbits/s',
        size: progress.total_size || '0kB',
        eta: this.calculateETA(percentage, Date.now()),
        isComplete: percentage >= 100,
      };
    }

    return null;
  }

  private calculateETA(percentage: number, startTime: number): string {
    if (percentage <= 0) return 'Calculando...';
    
    const elapsed = Date.now() - startTime;
    const total = (elapsed / percentage) * 100;
    const remaining = total - elapsed;
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}