// Motor FFmpeg TypeScript para procesamiento de video
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { 
  VideoMetadata, 
  VideoAnalysisResult, 
  ConversionOptions, 
  ConversionProgress, 
  VideoProcessingResult,
  CachedVideo,
  FFmpegConfig,
  ConversionEvents,
  SupportedFormats
} from '../types/video.types';

export class VideoEngine {
  private config: FFmpegConfig;
  private activeConversions = new Map<string, ChildProcess>();
  private cache = new Map<string, CachedVideo>();
  private stats = {
    totalVideosProcessed: 0,
    totalConversions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageConversionTime: 0,
    totalCacheSize: 0
  };

  private supportedFormats: SupportedFormats = {
    input: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'mpg', 'mpeg', 'ts', 'mts'],
    output: ['mp4', 'webm'],
    videoCodecs: ['libx264', 'libx265', 'libvpx-vp9', 'copy'],
    audioCodecs: ['aac', 'mp3', 'libvorbis', 'opus', 'copy']
  };

  constructor(config: FFmpegConfig) {
    this.config = config;
    this.initializeCache();
  }

  // Inicializar sistema de cache
  private async initializeCache(): Promise<void> {
    try {
      // Crear directorios si no existen
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      await fs.mkdir(this.config.tempDir, { recursive: true });

      // Cargar cache existente
      await this.loadCacheIndex();
      
      // Limpiar archivos huérfanos
      await this.cleanupOrphanedFiles();
      
      console.log('✅ VideoEngine inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando VideoEngine:', error);
    }
  }

  // Analizar video para determinar compatibilidad
  async analyzeVideo(filePath: string): Promise<VideoAnalysisResult> {
    try {
      const metadata = await this.extractMetadata(filePath);
      const compatibilityIssues: string[] = [];
      
      // Verificar compatibilidad HTML5
      const isHTML5Compatible = this.checkHTML5Compatibility(metadata, compatibilityIssues);
      
      return {
        metadata: {
          ...metadata,
          isHTML5Compatible,
          needsConversion: !isHTML5Compatible
        },
        needsConversion: !isHTML5Compatible,
        conversionOptions: !isHTML5Compatible ? this.getOptimalConversionOptions(metadata) : undefined,
        compatibilityIssues,
        compatibilityReport: {
          canPlayNatively: isHTML5Compatible,
          recommendedAction: isHTML5Compatible ? 'play' : 'convert',
          conversionNeeded: !isHTML5Compatible,
          estimatedConversionTime: this.estimateConversionTime(metadata)
        }
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Error analizando video: ${errorMessage}`);
    }
  }

  // Extraer metadata con FFprobe
  private async extractMetadata(filePath: string): Promise<VideoMetadata> {
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
            isHTML5Compatible: false,
            needsConversion: false
          };

          resolve(metadata);
        } catch (parseError: unknown) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          reject(new Error(`Error parsing FFprobe output: ${errorMessage}`));
        }
      });
    });
  }

  // Verificar compatibilidad HTML5
  private checkHTML5Compatibility(metadata: VideoMetadata, issues: string[]): boolean {
    let isCompatible = true;

    // Verificar formato de contenedor
    const supportedContainers = ['mp4', 'webm'];
    if (!supportedContainers.some(container => metadata.format.includes(container))) {
      issues.push(`Contenedor no compatible: ${metadata.format}`);
      isCompatible = false;
    }

    // Verificar codec de video
    const supportedVideoCodecs = ['h264', 'vp8', 'vp9', 'av01'];
    if (!supportedVideoCodecs.includes(metadata.videoCodec)) {
      issues.push(`Codec de video no compatible: ${metadata.videoCodec}`);
      isCompatible = false;
    }

    // Verificar codec de audio
    const supportedAudioCodecs = ['aac', 'mp3', 'vorbis', 'opus'];
    if (metadata.audioCodec !== 'none' && !supportedAudioCodecs.includes(metadata.audioCodec)) {
      issues.push(`Codec de audio no compatible: ${metadata.audioCodec}`);
      isCompatible = false;
    }

    // Verificar resolución extrema
    if (metadata.width > 4096 || metadata.height > 2160) {
      issues.push(`Resolución muy alta: ${metadata.width}x${metadata.height}`);
      isCompatible = false;
    }

    return isCompatible;
  }

  // Obtener opciones óptimas de conversión
  private getOptimalConversionOptions(metadata: VideoMetadata): ConversionOptions {
    // Decidir formato de salida basado en el archivo original
    const outputFormat: 'mp4' | 'webm' = metadata.format.includes('webm') ? 'webm' : 'mp4';
    
    // Configuración por defecto optimizada
    const options: ConversionOptions = {
      outputFormat,
      videoCodec: outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264',
      audioCodec: outputFormat === 'webm' ? 'libvorbis' : 'aac',
      preset: 'fast',
      quality: 'balanced',
      crf: 23
    };

    // Ajustar resolución si es necesario
    if (metadata.width > 1920 || metadata.height > 1080) {
      options.resolution = {
        width: 1920,
        height: 1080
      };
    }

    // Ajustar bitrate si es muy alto
    if (metadata.bitrate > 8000000) { // 8 Mbps
      options.bitrate = 4000000; // 4 Mbps
    }

    return options;
  }

  // Convertir video con progreso en tiempo real
  async convertVideo(
    inputPath: string, 
    options: ConversionOptions,
    events?: ConversionEvents
  ): Promise<VideoProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Verificar si ya está en cache
      const cacheKey = this.generateCacheKey(inputPath, options);
      const cached = await this.getCachedVideo(cacheKey);
      
      if (cached && await this.fileExists(cached.convertedPath)) {
        this.stats.cacheHits++;
        events?.onComplete?.({
          success: true,
          outputPath: cached.convertedPath,
          metadata: cached.metadata
        });
        return {
          success: true,
          outputPath: cached.convertedPath,
          metadata: cached.metadata
        };
      }

      this.stats.cacheMisses++;
      
      // Generar nombre de archivo de salida
      const outputPath = await this.generateOutputPath(inputPath, options);
      
      // Configurar argumentos de FFmpeg
      const args = this.buildFFmpegArgs(inputPath, outputPath, options);
      
      events?.onStart?.(inputPath);
      
      // Ejecutar conversión
      const result = await this.executeConversion(
        inputPath, 
        outputPath, 
        args, 
        events
      );

      if (result.success) {
        // Guardar en cache
        await this.saveToCacheAsync(cacheKey, inputPath, outputPath);
        
        // Actualizar estadísticas
        this.stats.totalConversions++;
        const conversionTime = Date.now() - startTime;
        this.updateAverageConversionTime(conversionTime);
      }

      events?.onComplete?.(result);
      return result;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResult = {
        success: false,
        error: errorMessage
      };
      events?.onError?.(errorMessage);
      events?.onComplete?.(errorResult);
      return errorResult;
    }
  }

  // Construir argumentos de FFmpeg
  private buildFFmpegArgs(inputPath: string, outputPath: string, options: ConversionOptions): string[] {
    const args: string[] = [
      '-i', inputPath,
      '-y', // Sobrescribir archivo de salida
    ];

    // Hardware acceleration si está habilitada
    if (this.config.enableHardwareAcceleration) {
      args.push('-hwaccel', 'auto');
    }

    // Video codec y opciones
    if (options.videoCodec === 'libx264') {
      args.push(
        '-c:v', 'libx264',
        '-preset', options.preset,
        '-crf', (options.crf || 23).toString()
      );
    } else if (options.videoCodec === 'libvpx-vp9') {
      args.push(
        '-c:v', 'libvpx-vp9',
        '-crf', (options.crf || 30).toString(),
        '-b:v', '0'
      );
    }

    // Audio codec
    args.push('-c:a', options.audioCodec);

    // Resolución si es especificada
    if (options.resolution) {
      args.push('-vf', `scale=${options.resolution.width}:${options.resolution.height}`);
    }

    // Bitrate si es especificado
    if (options.bitrate) {
      args.push('-b:v', `${options.bitrate}`);
    }

    // Logging
    args.push('-loglevel', this.config.logLevel);
    
    // Progress reporting
    args.push('-progress', 'pipe:1');

    args.push(outputPath);

    return args;
  }

  // Ejecutar conversión con progreso
  private async executeConversion(
    inputPath: string,
    outputPath: string,
    args: string[],
    events?: ConversionEvents
  ): Promise<VideoProcessingResult> {
    const metadata = await this.extractMetadata(inputPath);
    
    return new Promise((resolve) => {
      const ffmpegPath = this.config.binaryPath || 'ffmpeg';
      const process = spawn(ffmpegPath, args);
      
      this.activeConversions.set(inputPath, process);

      let stderr = '';
      
      // Parsear progreso
      process.stdout.on('data', (data) => {
        const progress = this.parseFFmpegProgress(data.toString(), metadata.duration);
        if (progress && events?.onProgress) {
          events.onProgress(progress);
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', async (code) => {
        this.activeConversions.delete(inputPath);
        
        if (code === 0) {
          try {
            const outputMetadata = await this.extractMetadata(outputPath);
            resolve({
              success: true,
              outputPath,
              metadata: outputMetadata
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            resolve({
              success: false,
              error: `Error verificando archivo convertido: ${errorMessage}`
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

  // Parsear progreso de FFmpeg
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
      const currentTime = parseInt(progress.out_time_ms) / 1000000; // microseconds to seconds
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

  // Utilidades
  private parseFPS(rFrameRate: string): number {
    if (!rFrameRate) return 0;
    const [num, den] = rFrameRate.split('/').map(Number);
    return den ? num / den : num;
  }

  private generateCacheKey(inputPath: string, options: ConversionOptions): string {
    const input = JSON.stringify({ inputPath, options });
    return crypto.createHash('md5').update(input).digest('hex');
  }

  private async generateOutputPath(inputPath: string, options: ConversionOptions): Promise<string> {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    const extension = options.outputFormat;
    return path.join(this.config.cacheDir, `${baseName}_${timestamp}.${extension}`);
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

  private estimateConversionTime(metadata: VideoMetadata): number {
    // Estimación básica: 1 minuto de video = 30 segundos de conversión
    return Math.ceil(metadata.duration / 2);
  }

  // Métodos de cache (implementación básica)
  private async loadCacheIndex(): Promise<void> {
    // Implementar carga de índice de cache
  }

  private async cleanupOrphanedFiles(): Promise<void> {
    // Implementar limpieza de archivos huérfanos
  }

  private async getCachedVideo(cacheKey: string): Promise<CachedVideo | null> {
    return this.cache.get(cacheKey) || null;
  }

  private async saveToCacheAsync(_cacheKey: string, _inputPath: string, _outputPath: string): Promise<void> {
    // TODO: Implementar guardado en cache
    // Por ahora es un placeholder
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private updateAverageConversionTime(newTime: number): void {
    const total = this.stats.averageConversionTime * this.stats.totalConversions;
    this.stats.averageConversionTime = (total + newTime) / (this.stats.totalConversions + 1);
  }

  // API Pública
  public getStats() {
    return { ...this.stats };
  }

  public getSupportedFormats(): SupportedFormats {
    return { ...this.supportedFormats };
  }

  public async cancelConversion(inputPath: string): Promise<boolean> {
    const process = this.activeConversions.get(inputPath);
    if (process) {
      process.kill();
      this.activeConversions.delete(inputPath);
      return true;
    }
    return false;
  }
}