// Reproductor de video nativo usando FFmpeg y Canvas con streaming continuo
import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';

export interface NativeVideoPlayerConfig {
  videoPath: string;
  window: BrowserWindow;
  width: number;
  height: number;
  controls: boolean;
}

export interface VideoFrame {
  data: string; // base64
  width: number;
  height: number;
  timestamp: number;
}

export class NativeVideoPlayer {
  private ffmpegProcess: ChildProcess | null = null;
  private audioProcess: ChildProcess | null = null; // Proceso separado para audio
  private config: NativeVideoPlayerConfig;
  private isPlaying = false;
  private isPaused = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 1.0;
  private frameCallback: ((frame: VideoFrame) => void) | null = null;
  private frameRate = 25; // Aumentado a 25 FPS
  private frameBuffer = Buffer.alloc(0);
  private playbackTimer: NodeJS.Timeout | null = null;
  private lastFrameTime = Date.now();

  constructor(config: NativeVideoPlayerConfig) {
    this.config = config;
  }

  // Inicializar reproductor
  async initialize(): Promise<boolean> {
    try {
      console.log('🎬 [NativeVideoPlayer] Initializing for:', this.config.videoPath);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(this.config.videoPath)) {
        throw new Error(`Video file not found: ${this.config.videoPath}`);
      }

      // Obtener duración del video
      await this.getVideoDuration();
      
      console.log('✅ [NativeVideoPlayer] Initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Initialization failed:', error);
      return false;
    }
  }

  // Obtener duración del video
  private async getVideoDuration(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        this.config.videoPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output);
            this.duration = parseFloat(metadata.format.duration) || 0;
            
            console.log('📊 [NativeVideoPlayer] Duration:', this.duration);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`FFprobe failed with code ${code}`));
        }
      });
    });
  }

  // Reproducir video
  async play(): Promise<void> {
    if (this.isPlaying && !this.isPaused) return;

    try {
      if (this.isPaused) {
        // Reanudar desde pausa
        this.isPaused = false;
        this.resumePlayback();
      } else {
        // Iniciar nueva reproducción
        await this.startFFmpegStream();
      }
      
      this.isPlaying = true;
      console.log('▶️ [NativeVideoPlayer] Playing');
      
      // Notificar cambio de estado
      this.sendStateUpdate();
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Play failed:', error);
      throw error;
    }
  }

  // Pausar video
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pausePlayback();
    console.log('⏸️ [NativeVideoPlayer] Paused');
    
    // Notificar cambio de estado
    this.sendStateUpdate();
  }

  // Detener video
  stop(): void {
    this.cleanup();
    
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTime = 0;
    console.log('⏹️ [NativeVideoPlayer] Stopped');
    
    // Notificar cambio de estado
    this.sendStateUpdate();
  }

  // Buscar posición específica
  async seek(timeInSeconds: number): Promise<void> {
    if (timeInSeconds < 0 || timeInSeconds > this.duration) return;
    
    const wasPlaying = this.isPlaying && !this.isPaused;
    
    // Parar la reproducción actual
    this.cleanup();
    
    // Establecer nuevo tiempo
    this.currentTime = timeInSeconds;
    
    // Reiniciar si estaba reproduciendo
    if (wasPlaying) {
      await this.startFFmpegStream();
    }
    
    console.log('🔍 [NativeVideoPlayer] Seek to:', timeInSeconds);
    
    // Notificar cambio de estado
    this.sendStateUpdate();
  }

  // Establecer volumen
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log('🔊 [NativeVideoPlayer] Volume:', this.volume);
    
    // Notificar cambio de estado
    this.sendStateUpdate();
  }

  // Limpiar recursos
  private cleanup(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
    
    if (this.audioProcess) {
      this.audioProcess.kill('SIGTERM');
      this.audioProcess = null;
    }
    
    // Limpiar buffer
    this.frameBuffer = Buffer.alloc(0);
  }

  // Pausar reproducción
  private pausePlayback(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  // Reanudar reproducción
  private resumePlayback(): void {
    this.startPlaybackTimer();
  }

  // Iniciar stream de FFmpeg con extracción de frames individuales
  private async startFFmpegStream(): Promise<void> {
    // Limpiar proceso anterior
    this.cleanup();

    // Optimizado para 25 FPS fluido con JPEG (más ligero que PNG)
    const args = [
      '-ss', this.currentTime.toString(),
      '-i', this.config.videoPath,
      '-vf', `scale=${this.config.width}:${this.config.height}`,
      '-r', '25', // 25 FPS para fluidez
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg', // MJPEG es más ligero que PNG
      '-q:v', '3', // Calidad alta pero comprimida
      '-loglevel', 'error',
      'pipe:1'
    ];

    console.log('🚀 [NativeVideoPlayer] Starting FFmpeg with 25 FPS JPEG extraction:', args);

    this.ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (!this.ffmpegProcess.stdout) {
      throw new Error('Failed to start FFmpeg process');
    }

    // Procesar imágenes JPEG individuales
    this.processImageFrames();
    
    // Iniciar audio en paralelo
    this.startAudioStream();
    
    this.ffmpegProcess.on('error', (error) => {
      console.error('❌ [NativeVideoPlayer] FFmpeg error:', error);
    });

    this.ffmpegProcess.stderr?.on('data', (data) => {
      const logMessage = data.toString();
      console.log('📺 [FFmpeg stderr]:', logMessage.trim());
    });

    this.ffmpegProcess.on('close', (code) => {
      console.log('📺 [NativeVideoPlayer] FFmpeg closed with code:', code);
      if (code !== null && code !== 0 && code !== 255) {
        console.error('❌ [NativeVideoPlayer] FFmpeg exited with error code:', code);
      }
      if (this.isPlaying) {
        this.isPlaying = false;
        this.cleanup();
      }
    });
  }

  // Procesar frames como imágenes PNG individuales
  private processImageFrames(): void {
    if (!this.ffmpegProcess?.stdout) return;

    let frameCount = 0;
    let imageBuffer = Buffer.alloc(0);
    const startTime = Date.now();
    const maxRunTime = 60000; // Máximo 60 segundos
    
    console.log('📊 [NativeVideoPlayer] Starting JPEG frame processing at 25 FPS');
    
    this.ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
      // Verificar timeout
      if (Date.now() - startTime > maxRunTime) {
        console.log('⏱️ [NativeVideoPlayer] Max runtime reached, stopping stream');
        this.cleanup();
        return;
      }
      
      imageBuffer = Buffer.concat([imageBuffer, chunk]);
      
      // Buscar delimitadores JPEG (FF D8 para start, FF D9 para end)
      let startIndex = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const jpegStart = imageBuffer.indexOf(Buffer.from([0xFF, 0xD8]), startIndex);
        if (jpegStart === -1) break;
        
        // Buscar final de JPEG
        const jpegEnd = imageBuffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
        
        if (jpegEnd !== -1) {
          // Extraer imagen completa (incluir el marcador de fin)
          const jpegData = imageBuffer.slice(jpegStart, jpegEnd + 2);
          this.processJpegFrame(jpegData, frameCount);
          frameCount++;
          startIndex = jpegEnd + 2;
        } else {
          // Guardar buffer parcial para siguiente chunk
          imageBuffer = imageBuffer.slice(jpegStart);
          break;
        }
      }
      
      // Log progreso cada 25 frames (1 segundo)
      if (frameCount % 25 === 0 && frameCount > 0) {
        console.log(`📊 [NativeVideoPlayer] Processed ${frameCount} JPEG frames`);
      }
    });
    
    this.ffmpegProcess.stdout.on('end', () => {
      console.log('📊 [NativeVideoPlayer] JPEG frame processing ended');
    });
    
    this.ffmpegProcess.stdout.on('error', (error) => {
      console.error('❌ [NativeVideoPlayer] PNG frame processing error:', error);
    });
  }

  // Procesar frame PNG individual
  private processJpegFrame(jpegData: Buffer, frameNumber: number): void {
    if (!this.isPlaying || this.isPaused) return;
    
    try {
      // Convertir JPEG a base64
      const base64Data = jpegData.toString('base64');
      
      // Calcular timestamp para 25 FPS
      const timestamp = this.currentTime + (frameNumber / 25); // 25 FPS
      
      // Crear frame
      const frame: VideoFrame = {
        data: base64Data,
        width: this.config.width,
        height: this.config.height,
        timestamp: timestamp
      };

      // Enviar frame al renderer
      this.sendFrameToRenderer(frame);
      
      // Log cada 25 frames (1 segundo)
      if (frameNumber % 25 === 0) {
        console.log(`📊 [NativeVideoPlayer] Sent JPEG frame ${frameNumber}, timestamp: ${timestamp.toFixed(2)}s`);
      }
      
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Error processing JPEG frame:', error);
    }
  }

  // Iniciar stream de audio separado
  private startAudioStream(): void {
    const audioArgs = [
      '-ss', this.currentTime.toString(),
      '-i', this.config.videoPath,
      '-vn', // Solo audio, sin video
      '-f', 'wav',
      '-acodec', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '2',
      '-loglevel', 'error',
      'pipe:1'
    ];

    console.log('🔊 [NativeVideoPlayer] Starting audio stream');

    this.audioProcess = spawn('ffmpeg', audioArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (this.audioProcess.stdout) {
      // En una implementación real, aquí enviarías el audio al sistema de audio
      // Por ahora, simplemente drenar el stream para evitar buffer overflow
      this.audioProcess.stdout.on('data', (_chunk) => {
        // TODO: Implementar reproducción de audio real
        // Por ahora solo drenar para evitar problemas de memoria
      });
    }

    this.audioProcess.on('close', (code) => {
      console.log('🔊 [NativeVideoPlayer] Audio stream closed with code:', code);
    });

    this.audioProcess.on('error', (error) => {
      console.error('❌ [NativeVideoPlayer] Audio stream error:', error);
    });
  }

  // Iniciar timer de reproducción
  private startPlaybackTimer(): void {
    if (this.playbackTimer) return;
    
    // Timer más simple para actualizar solo el estado
    this.playbackTimer = setInterval(() => {
      if (!this.isPaused && this.isPlaying) {
        // Incrementar tiempo lentamente para sincronización básica
        this.currentTime += 0.1;
        
        // Verificar si hemos llegado al final
        if (this.currentTime >= this.duration) {
          this.stop();
          this.config.window.webContents.send('video-ended');
          return;
        }
        
        // Enviar actualización de estado cada segundo aprox
        if (Math.floor(this.currentTime * 10) % 10 === 0) {
          this.sendStateUpdate();
        }
      }
    }, 100); // 100ms para mejor responsividad
  }

  // Enviar frame al renderer
  private sendFrameToRenderer(frame: VideoFrame): void {
    if (this.frameCallback) {
      this.frameCallback(frame);
    }
    
    // Enviar frame via IPC
    try {
      this.config.window.webContents.send('video-frame', {
        data: frame.data,
        width: frame.width,
        height: frame.height,
        timestamp: frame.timestamp
      });
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Error sending frame:', error);
    }
  }

  // Enviar actualización de estado
  private sendStateUpdate(): void {
    try {
      this.config.window.webContents.send('player-state-update', {
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        currentTime: this.currentTime,
        duration: this.duration,
        volume: this.volume
      });
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Error sending state update:', error);
    }
  }

  // Establecer callback de frame
  setFrameCallback(callback: (frame: VideoFrame) => void): void {
    this.frameCallback = callback;
  }

  // Obtener estado actual
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume
    };
  }

  // Destruir reproductor
  destroy(): void {
    console.log('🗑️ [NativeVideoPlayer] Destroyed');
    this.cleanup();
  }
}

// Manager para múltiples instancias de reproductor (Singleton)
export class NativeVideoPlayerManager {
  private static instance: NativeVideoPlayerManager;
  private players = new Map<string, NativeVideoPlayer>();
  private window: BrowserWindow | null = null;

  private constructor() {}

  // Obtener instancia singleton
  static getInstance(): NativeVideoPlayerManager {
    if (!NativeVideoPlayerManager.instance) {
      NativeVideoPlayerManager.instance = new NativeVideoPlayerManager();
    }
    return NativeVideoPlayerManager.instance;
  }

  // Establecer ventana de trabajo
  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  // Crear nuevo reproductor
  async createPlayer(playerId: string, config: Omit<NativeVideoPlayerConfig, 'window'>): Promise<boolean> {
    if (!this.window) {
      console.error('❌ [NativePlayerManager] No window set');
      return false;
    }

    try {
      // Destruir reproductor existente si existe
      if (this.players.has(playerId)) {
        this.destroyPlayer(playerId);
      }

      const player = new NativeVideoPlayer({
        ...config,
        window: this.window
      });

      const success = await player.initialize();
      if (success) {
        this.players.set(playerId, player);
        console.log('✅ [NativePlayerManager] Player created:', playerId);
      }

      return success;
    } catch (error) {
      console.error('❌ [NativePlayerManager] Failed to create player:', error);
      return false;
    }
  }

  // Obtener reproductor
  getPlayer(playerId: string): NativeVideoPlayer | undefined {
    return this.players.get(playerId);
  }

  // Destruir reproductor
  destroyPlayer(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (player) {
      player.destroy();
      this.players.delete(playerId);
      console.log('🗑️ [NativePlayerManager] Player destroyed:', playerId);
      return true;
    }
    return false;
  }

  // Destruir todos los reproductores
  destroyAll(): void {
    for (const [, player] of this.players) {
      player.destroy();
    }
    this.players.clear();
    console.log('🗑️ [NativePlayerManager] All players destroyed');
  }
}