import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ConversionProgress, VideoProcessingResult, ConversionOptions } from '../types/video.types';

export class VideoConverter {
  private static instance: VideoConverter;
  private conversionsInProgress: Map<string, boolean> = new Map();
  private tempDir: string;

  constructor(tempDir: string = 'temp/converted') {
    this.tempDir = tempDir;
    this.ensureTempDir();
  }

  static getInstance(tempDir?: string): VideoConverter {
    if (!VideoConverter.instance) {
      VideoConverter.instance = new VideoConverter(tempDir);
    }
    return VideoConverter.instance;
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async convertToHTML5Compatible(
    inputPath: string,
    options: Partial<ConversionOptions> = {},
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<VideoProcessingResult> {
    const hash = this.generateFileHash(inputPath);
    
    // Check if already converting
    if (this.conversionsInProgress.get(hash)) {
      throw new Error('Conversion already in progress for this file');
    }

    // Check if already converted (cache)
    const cachedFile = await this.getCachedConversion(inputPath);
    if (cachedFile) {
      console.log('🎯 [VideoConverter] Using cached conversion:', cachedFile);
      return {
        success: true,
        outputPath: cachedFile
      };
    }

    this.conversionsInProgress.set(hash, true);

    try {
      const result = await this.performConversion(inputPath, options, onProgress);
      return result;
    } finally {
      this.conversionsInProgress.delete(hash);
    }
  }

  private async performConversion(
    inputPath: string,
    options: Partial<ConversionOptions>,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<VideoProcessingResult> {
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(this.tempDir, `${fileName}_converted.mp4`);

    // Default conversion options optimized for HTML5
    const defaultOptions: ConversionOptions = {
      outputFormat: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      preset: 'fast',
      quality: 'balanced',
      crf: 23
    };

    const mergedOptions = { ...defaultOptions, ...options };

    console.log('🔄 [VideoConverter] Starting conversion:', {
      input: inputPath,
      output: outputPath,
      options: mergedOptions
    });

    return new Promise((resolve, reject) => {
      const args = this.buildFFmpegArgs(inputPath, outputPath, mergedOptions);
      console.log('⚙️ [VideoConverter] FFmpeg command:', 'ffmpeg', args.join(' '));

      const ffmpeg = spawn('ffmpeg', args);
      let totalDuration = 0;

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        
        // Extract duration from first output
        if (totalDuration === 0) {
          const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.\d+/);
          if (durationMatch) {
            const [, hours, minutes, seconds] = durationMatch;
            totalDuration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          }
        }

        // Extract progress
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d+/);
        if (timeMatch && totalDuration > 0) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const percentage = Math.min(100, Math.round((currentTime / totalDuration) * 100));

          // Extract additional info
          const speedMatch = output.match(/speed=\s*([0-9.]+x)/);
          const fpsMatch = output.match(/fps=\s*([0-9.]+)/);
          const bitrateMatch = output.match(/bitrate=\s*([0-9.]+[kmg]bits\/s)/i);
          const sizeMatch = output.match(/size=\s*([0-9]+[kmg]B)/i);

          const progress: ConversionProgress = {
            percentage,
            currentTime,
            totalTime: totalDuration,
            speed: speedMatch ? speedMatch[1] : 'N/A',
            fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
            bitrate: bitrateMatch ? bitrateMatch[1] : 'N/A',
            size: sizeMatch ? sizeMatch[1] : 'N/A',
            eta: this.calculateETA(currentTime, totalDuration, speedMatch?.[1]),
            isComplete: false
          };

          onProgress?.(progress);
        }
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          console.log('✅ [VideoConverter] Conversion completed successfully');
          
          // Verify output file exists
          try {
            await fs.access(outputPath);
            
            // Final progress callback
            onProgress?.({
              percentage: 100,
              currentTime: totalDuration,
              totalTime: totalDuration,
              speed: '1x',
              fps: 0,
              bitrate: 'Complete',
              size: 'Complete',
              eta: '00:00:00',
              isComplete: true
            });

            resolve({
              success: true,
              outputPath
            });
          } catch (error) {
            reject(new Error('Conversion completed but output file not found'));
          }
        } else {
          console.error('❌ [VideoConverter] FFmpeg process failed with code:', code);
          reject(new Error(`FFmpeg conversion failed with exit code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('❌ [VideoConverter] FFmpeg spawn error:', error);
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }

  private buildFFmpegArgs(inputPath: string, outputPath: string, options: ConversionOptions): string[] {
    const args: string[] = [
      '-i', inputPath,
      '-c:v', options.videoCodec,
      '-c:a', options.audioCodec,
      '-preset', options.preset
    ];

    // Quality settings
    if (options.crf) {
      args.push('-crf', options.crf.toString());
    }

    // Resolution scaling
    if (options.resolution) {
      args.push('-s', `${options.resolution.width}x${options.resolution.height}`);
    } else if (options.maxWidth || options.maxHeight) {
      const scale = options.maxWidth && options.maxHeight 
        ? `${options.maxWidth}:${options.maxHeight}:force_original_aspect_ratio=decrease`
        : options.maxWidth 
          ? `${options.maxWidth}:-2`
          : `-2:${options.maxHeight}`;
      args.push('-vf', `scale=${scale}`);
    }

    // Bitrate
    if (options.bitrate) {
      args.push('-b:v', `${options.bitrate}k`);
    }

    // Overwrite output file and optimization
    args.push(
      '-y', // Overwrite output file
      '-movflags', '+faststart', // Optimize for web streaming
      '-pix_fmt', 'yuv420p', // Ensure compatibility
      outputPath
    );

    return args;
  }

  private calculateETA(currentTime: number, totalTime: number, speed?: string): string {
    if (!speed || currentTime === 0) return 'Calculating...';
    
    const speedMultiplier = parseFloat(speed.replace('x', ''));
    if (speedMultiplier === 0) return 'Calculating...';
    
    const remainingTime = totalTime - currentTime;
    const etaSeconds = remainingTime / speedMultiplier;
    
    const hours = Math.floor(etaSeconds / 3600);
    const minutes = Math.floor((etaSeconds % 3600) / 60);
    const seconds = Math.floor(etaSeconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private generateFileHash(filePath: string): string {
    // Simple hash based on file path and modification time
    return Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '');
  }

  private async getCachedConversion(inputPath: string): Promise<string | null> {
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const cachedPath = path.join(this.tempDir, `${fileName}_converted.mp4`);
    
    try {
      await fs.access(cachedPath);
      
      // Check if cache is newer than original
      const [inputStat, cachedStat] = await Promise.all([
        fs.stat(inputPath),
        fs.stat(cachedPath)
      ]);
      
      if (cachedStat.mtime > inputStat.mtime) {
        return cachedPath;
      }
    } catch (error) {
      // File doesn't exist or error accessing
    }
    
    return null;
  }

  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.tempDir, file)))
      );
      console.log('🧹 [VideoConverter] Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  getConversionsInProgress(): string[] {
    return Array.from(this.conversionsInProgress.keys());
  }
}

export const videoConverter = VideoConverter.getInstance();