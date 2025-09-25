import { BrowserWindow } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import os from 'os';
import { videoAnalyzer } from './VideoAnalyzer.js';

/**
 * Estrategias de reproducción de video
 */
export enum PlaybackStrategy {
  NATIVE_VIDEO = 'native_video',      // Reproducción directa HTML5 <video>
  FFMPEG_TRANSCODE = 'ffmpeg_transcode', // FFmpeg → MP4 fragments → MSE
  FFMPEG_HTTP_STREAM = 'ffmpeg_http'    // FFmpeg HTTP streaming
}

/**
 * Información detectada del formato de video
 */
export interface VideoFormatInfo {
  extension: string;
  mimeType?: string;
  isNativeSupported: boolean;
  strategy: PlaybackStrategy;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Configuración de reproducción
 */
export interface PlaybackConfig {
  filePath: string;
  seekTime?: number;
  autoPlay?: boolean;
  loop?: boolean;
  crtFilter?: boolean;
}

/**
 * Resultado de operación de reproducción
 */
export interface PlaybackResult {
  success: boolean;
  message?: string;
  error?: string;
  strategy?: PlaybackStrategy;
}

/**
 * Información de mensaje de error
 */
export interface ErrorMessageInfo {
  title: string;
  message: string;
  type: 'file-not-found' | 'transcoding-error' | 'playback-error' | 'general-error';
}

/**
 * Manager principal para reproducción adaptiva de video
 * Detecta formatos y selecciona la mejor estrategia de reproducción
 */
export class VideoStreamManager {
  private mainWindow: BrowserWindow;
  private currentFFmpegProcess: ChildProcess | null = null;
  private httpServer: any = null;
  private httpPort: number = 8080;
  private tempFilesToCleanup: Set<string> = new Set(); // Track archivos temporales
  
  // Estado de reproducción actual
  private currentPlayback: {
    strategy: PlaybackStrategy;
    filePath: string;
    isActive: boolean;
  } | null = null;

  // Formatos con soporte nativo garantizado en Electron/Chromium
  private readonly NATIVE_FORMATS = new Set([
    '.mp4', '.webm', '.ogg', '.ogv'
  ]);

  // Formatos que requieren transcoding pero funcionan bien
  private readonly TRANSCODE_FORMATS = new Set([
    '.mkv', '.avi', '.mov', '.m4v', '.3gp'
  ]);

  // Formatos que solo funcionan con HTTP streaming (problemáticos)
  private readonly STREAM_FORMATS = new Set([
    '.mpg', '.mpeg', '.wmv', '.flv', '.asf', '.vob'
  ]);

  constructor(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * Detecta el codec de video usando FFprobe
   */
  private async detectVideoCodec(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const ffprobe = spawn('ffprobe', [
          '-v', 'quiet',
          '-show_entries', 'stream=codec_name',
          '-select_streams', 'v:0',
          '-of', 'csv=p=0',
          filePath
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });

        ffprobe.on('close', (code) => {
          if (code === 0) {
            const codec = output.trim().split(',')[0];
            resolve(codec || null);
          } else {
            resolve(null);
          }
        });

        ffprobe.on('error', () => {
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Detecta el formato de video y determina la mejor estrategia
   */
  public async detectVideoFormat(filePath: string): Promise<VideoFormatInfo> {
    const extension = path.extname(filePath).toLowerCase();
    console.log(`📋 [VideoStreamManager] Analizando formato: ${extension}`);

    // Detectar codec específico para archivos que podrían necesitar transcoding
    let codec: string | null = null;
    if (this.NATIVE_FORMATS.has(extension)) {
      codec = await this.detectVideoCodec(filePath);
      console.log(`🔍 [VideoStreamManager] Codec detectado: ${codec}`);
    }

    let strategy: PlaybackStrategy;
    let confidence: 'high' | 'medium' | 'low';
    
    if (this.NATIVE_FORMATS.has(extension)) {
      // Verificar si el codec es compatible aunque el contenedor sea nativo
      if (codec && ['h264', 'h265', 'hevc', 'vp8', 'vp9', 'av01'].includes(codec.toLowerCase())) {
        strategy = PlaybackStrategy.NATIVE_VIDEO;
        confidence = 'high';
        console.log(`✅ [VideoStreamManager] Formato nativo compatible: ${extension} (${codec})`);
      } else if (codec && ['mpeg2video', 'mpeg1video', 'xvid', 'divx'].includes(codec.toLowerCase())) {
        strategy = PlaybackStrategy.FFMPEG_TRANSCODE;
        confidence = 'medium';
        console.log(`🔄 [VideoStreamManager] Codec incompatible, requiere transcoding: ${extension} (${codec})`);
      } else {
        // Sin codec info, intentar nativo primero
        strategy = PlaybackStrategy.NATIVE_VIDEO;
        confidence = 'medium';
        console.log(`⚠️ [VideoStreamManager] Formato nativo sin confirmación de codec: ${extension}`);
      }
    } else if (this.TRANSCODE_FORMATS.has(extension)) {
      strategy = PlaybackStrategy.FFMPEG_TRANSCODE;
      confidence = 'medium';
      console.log(`🔄 [VideoStreamManager] Formato para transcoding: ${extension}`);
    } else {
      strategy = PlaybackStrategy.FFMPEG_HTTP_STREAM;
      confidence = 'low';
      console.log(`🌐 [VideoStreamManager] Formato para streaming: ${extension}`);
    }

    return {
      extension,
      isNativeSupported: strategy === PlaybackStrategy.NATIVE_VIDEO,
      strategy,
      confidence
    };
  }

  /**
   * Reproduce un video usando la estrategia óptima
   */
  public async playVideo(config: PlaybackConfig): Promise<void> {
    const { filePath, seekTime = 0, autoPlay = true, crtFilter = false } = config;
    
    console.log(`🎮 [VideoStreamManager] Reproduciendo: ${filePath}`);
    console.log(`⏰ [VideoStreamManager] Seek time: ${seekTime}s`);
    console.log(`🎨 [VideoStreamManager] CRT Filter: ${crtFilter}`);

    // Verificar que el archivo fuente existe
    try {
      await fs.access(filePath);
      console.log(`✅ [VideoStreamManager] Archivo fuente encontrado: ${filePath}`);
    } catch {
      const errorMessage = `❌ [VideoStreamManager] Archivo fuente no encontrado: ${filePath}`;
      console.error(errorMessage);
      
      // Mostrar mensaje de error al usuario
      await this.showErrorMessage({
        title: 'Archivo no encontrado',
        message: `No se pudo encontrar el archivo de video en la ruta especificada:\n\n${filePath}\n\nVerifica que el archivo existe y que la ruta sea correcta.`,
        type: 'file-not-found'
      });
      
      throw new Error(`Source file not found: ${filePath}`);
    }

    // Detener reproducción anterior si existe
    await this.stopCurrentPlayback();

    // Detectar formato y estrategia
    const formatInfo = await this.detectVideoFormat(filePath);
    
    console.log(`📋 [VideoStreamManager] Estrategia seleccionada: ${formatInfo.strategy}`);

    // Ejecutar estrategia apropiada
    switch (formatInfo.strategy) {
      case PlaybackStrategy.NATIVE_VIDEO:
        await this.playNativeVideo(filePath, seekTime, autoPlay, crtFilter);
        break;
        
      case PlaybackStrategy.FFMPEG_TRANSCODE:
        await this.playWithTranscoding(filePath, seekTime, autoPlay, crtFilter);
        break;
        
      case PlaybackStrategy.FFMPEG_HTTP_STREAM:
        await this.playWithHttpStreaming(filePath, seekTime, autoPlay, crtFilter);
        break;
    }
  }

  /**
   * Estrategia 1: Reproducción nativa HTML5
   */
  private async playNativeVideo(filePath: string, seekTime: number, autoPlay: boolean, crtFilter: boolean = false): Promise<void> {
    console.log(`⚡ [VideoStreamManager] Reproducción nativa: ${filePath}`);

    const videoScript = `
      (() => {
        try {
          // Namespace específico para VideoStreamManager
          if (!window.VSMPlayer) {
            window.VSMPlayer = {};
          }
          
          // Función para encontrar el container con retry
          const findVideoContainer = () => {
            return new Promise((resolve, reject) => {
              let attempts = 0;
              const maxAttempts = 10;
              
              const tryFind = () => {
                attempts++;
                const videoContainer = document.getElementById('video-container');
                
                if (videoContainer) {
                  console.log('📦 Container encontrado en intento:', attempts);
                  resolve(videoContainer);
                  return;
                }
                
                if (attempts >= maxAttempts) {
                  // Como último recurso, buscar cualquier elemento que pueda servir como container
                  const tvPlayer = document.querySelector('.tv-show-player');
                  if (tvPlayer) {
                    console.log('📦 Usando tv-show-player como container fallback');
                    tvPlayer.id = 'video-container-fallback';
                    resolve(tvPlayer);
                    return;
                  }
                  
                  reject(new Error(\`Container no encontrado después de \${maxAttempts} intentos\`));
                  return;
                }
                
                console.log(\`🔍 Intento \${attempts}/\${maxAttempts} - Buscando container...\`);
                setTimeout(tryFind, 100); // Esperar 100ms antes del siguiente intento
              };
              
              tryFind();
            });
          };
          
          // Buscar el container con retry y procesar cuando se encuentre
          findVideoContainer().then((videoContainer) => {
          
          // Debug container info
          console.log('📦 Container info:', JSON.stringify({
            id: videoContainer.id,
            offsetWidth: videoContainer.offsetWidth,
            offsetHeight: videoContainer.offsetHeight,
            display: getComputedStyle(videoContainer).display,
            visibility: getComputedStyle(videoContainer).visibility,
            backgroundColor: getComputedStyle(videoContainer).backgroundColor
          }));
          
          // Limpiar cualquier video anterior y contenido del contenedor
          const existingVideos = videoContainer.querySelectorAll('video');
          console.log('🗑️ Limpiando videos existentes:', existingVideos.length);
          existingVideos.forEach(video => video.remove());
          
          // Limpiar cualquier contenido de texto/mensaje anterior
          videoContainer.innerHTML = '';
          console.log('🗑️ Contenedor limpiado completamente');
          
          const videoElement = document.createElement('video');
          videoElement.id = 'vsm-main-video';
          
          // SOLUCION: Usar protocolo file:// para archivos temporales, asset:// para archivos normales
          const normalizedPath = '${filePath.replace(/\\/g, '/')}';
          const isTemp = normalizedPath.includes('/temp/') || 
                         normalizedPath.includes('/Temp/') || 
                         normalizedPath.includes('AppData/Local/Temp') ||
                         normalizedPath.includes('analog_replay_') ||
                         normalizedPath.match(/[/\\]analog_replay_[0-9]+[.]mp4$/);
          
          console.log('🔍 Path analysis:', JSON.stringify({
            originalPath: '${filePath}',
            normalizedPath: normalizedPath,
            isTemp: isTemp,
            containsTemp: normalizedPath.includes('/temp/'),
            containsTemp2: normalizedPath.includes('/Temp/'),
            containsLocalTemp: normalizedPath.includes('AppData/Local/Temp'),
            containsAnalogReplay: normalizedPath.includes('analog_replay_'),
                        matchesPattern: !!normalizedPath.match(/[/\\]analog_replay_[0-9]+[.]mp4$/)
          }));
          
          if (isTemp) {
            // Para archivos temporales usar file://
            videoElement.src = 'file:///' + normalizedPath;
            console.log('🔗 Using file:// URL for temp file:', videoElement.src);
          } else {
            // Para archivos normales usar asset://
            videoElement.src = 'asset:///' + normalizedPath;
            console.log('🔗 Using asset:// URL for normal file:', videoElement.src);
          }
          
          // Verificar que el archivo existe antes de continuar
          // Nota: Removemos el await porque este contexto no es async
          fetch(videoElement.src, { method: 'HEAD' }).then(response => {
            console.log('📡 File accessibility test:', JSON.stringify({
              url: videoElement.src,
              status: response.status,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries())
            }));
          }).catch(error => {
            console.warn('⚠️ File accessibility test failed:', error);
          });
          
          videoElement.controls = true;
          videoElement.autoplay = ${autoPlay};
          videoElement.currentTime = ${seekTime};
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.maxWidth = '100%';
          videoElement.style.maxHeight = '100%';
          videoElement.style.backgroundColor = '#000';
          videoElement.style.display = 'block';
          videoElement.style.margin = '0';
          videoElement.style.objectFit = 'contain';
          
          // Aplicar filtro CRT si está activado
          if (${crtFilter}) {
            videoElement.classList.add('crt-filter');
            console.log('🎨 [VideoStreamManager] Filtro CRT aplicado');
          }
          
          // Forzar renderizado
          videoElement.load();
          
          // Almacenar referencia en namespace
          window.VSMPlayer.currentVideo = videoElement;
          
          videoContainer.appendChild(videoElement);
          
          // Verificar si el elemento está visible
          console.log('🔍 Video element info:', JSON.stringify({
            id: videoElement.id,
            src: videoElement.src,
            offsetWidth: videoElement.offsetWidth,
            offsetHeight: videoElement.offsetHeight,
            parentNode: videoElement.parentNode ? 'exists' : 'null',
            display: getComputedStyle(videoElement).display,
            visibility: getComputedStyle(videoElement).visibility,
            position: getComputedStyle(videoElement).position
          }));
          
          videoElement.addEventListener('loadedmetadata', () => {
            console.log('✅ Video metadata cargada');
            console.log('📊 Video dimensions:', JSON.stringify({
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight,
              duration: videoElement.duration,
              currentTime: videoElement.currentTime,
              paused: videoElement.paused,
              ended: videoElement.ended
            }));
            
            // Forzar el tamaño del video después de cargar metadata
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
              console.log('🔧 Ajustando tamaño del video element');
              videoElement.style.aspectRatio = \`\${videoElement.videoWidth}/\${videoElement.videoHeight}\`;
            }
          });
          
          videoElement.addEventListener('canplay', () => {
            console.log('✅ Video listo para reproducir');
            // Asegurar que el video se muestre
            videoElement.style.opacity = '1';
            videoElement.style.visibility = 'visible';
          });
          
          videoElement.addEventListener('loadstart', () => {
            console.log('🔄 Video iniciando carga...');
          });
          
          videoElement.addEventListener('progress', () => {
            console.log('📈 Video cargando...');
          });
          
          videoElement.addEventListener('error', (e) => {
            console.error('❌ Error en video:', e);
            console.error('❌ Video error details:', JSON.stringify({
              error: videoElement.error ? {
                code: videoElement.error.code,
                message: videoElement.error.message,
                MEDIA_ERR_ABORTED: videoElement.error.code === 1,
                MEDIA_ERR_NETWORK: videoElement.error.code === 2,
                MEDIA_ERR_DECODE: videoElement.error.code === 3,
                MEDIA_ERR_SRC_NOT_SUPPORTED: videoElement.error.code === 4
              } : null,
              networkState: videoElement.networkState,
              readyState: videoElement.readyState,
              currentSrc: videoElement.currentSrc,
              src: videoElement.src
            }));
            
            // Intentar estrategias alternativas basadas en el error
            if (videoElement.error && videoElement.error.code === 4) {
              console.warn('⚠️ Formato no soportado, podría ser problema de protocolo');
              console.warn('📋 Current src:', videoElement.src);
              console.warn('📋 Original path:', '${filePath}');
            }
          });
          
          videoElement.addEventListener('play', () => {
            console.log('▶️ Video play event fired');
          });
          
          videoElement.addEventListener('playing', () => {
            console.log('🎬 Video is now playing');
          });
          
          videoElement.addEventListener('pause', () => {
            console.log('⏸️ Video paused');
          });
          
          videoElement.addEventListener('ended', () => {
            console.log('🏁 Video ended');
          });
          
          console.log('✅ Video nativo configurado:', videoElement);
          
        }).catch((error) => {
          console.error('❌ Error interno:', error);
        });
          
        } catch (error) {
          console.error('❌ Error interno:', error);
        }
      })()
    `;

    try {
      await this.mainWindow.webContents.executeJavaScript(videoScript);
      this.currentPlayback = {
        strategy: PlaybackStrategy.NATIVE_VIDEO,
        filePath,
        isActive: true
      };
    } catch (error) {
      console.error('❌ [VideoStreamManager] Error en reproducción nativa:', error);
      throw error;
    }
  }

  /**
   * Estrategia 2: Transcodificación con FFmpeg
   */
  private async playWithTranscoding(filePath: string, seekTime: number, autoPlay: boolean, crtFilter: boolean = false): Promise<void> {
    console.log(`🔄 [VideoStreamManager] Transcoding: ${filePath}`);
    
    // Crear nombre de archivo único basado en hash del archivo original
    const cachedFilePath = await this.getCachedVideoPath(filePath);
    const tempFilePath = cachedFilePath;
    
    console.log(`📁 [VideoStreamManager] Archivo de cache: ${cachedFilePath}`);
    
    // Verificar si ya existe el archivo en cache
    try {
      await fs.access(cachedFilePath);
      console.log(`✅ [VideoStreamManager] Archivo de cache encontrado, reutilizando: ${cachedFilePath}`);
      
      // Reproducir el archivo cacheado directamente
      await this.playNativeVideo(cachedFilePath, 0, autoPlay, crtFilter); // seekTime ya aplicado durante transcoding original
      return;
    } catch {
      // El archivo no existe en cache, proceder con transcoding
      console.log(`� [VideoStreamManager] Archivo no en cache, transcodificando...`);
    }
    
    try {
      // Analizar el video fuente para aplicar restricciones de calidad
      console.log(`🔍 [VideoStreamManager] Analizando video para restricciones de calidad...`);
      const analysisResult = await videoAnalyzer.analyzeVideo(filePath);
      const sourceMetadata = analysisResult.metadata;
      
      console.log(`📊 [VideoStreamManager] Metadata del video: ${sourceMetadata.width}x${sourceMetadata.height}, ${sourceMetadata.videoCodec}`);
      
      // Aplicar restricciones de calidad 480p
      const qualityConstraints = this.applyQualityConstraints(sourceMetadata);
      
      // Parámetros de FFmpeg mejorados para compatibilidad HTML5 completa y velocidad
      const ffmpegArgs = [
        '-i', filePath,
        '-c:v', 'libx264',          // Codec de video H.264
        '-preset', 'fast',          // Preset más rápido para acelerar conversión
        '-threads', '0',            // Usar todos los cores disponibles
        '-crf', '25',               // CRF ajustado para balance velocidad/calidad
        '-profile:v', 'baseline',   // Perfil baseline para máxima compatibilidad
        '-level', '3.0',            // Nivel 3.0 para compatibilidad web
        '-pix_fmt', 'yuv420p',      // Formato de pixel compatible
        ...qualityConstraints.videoArgs, // Aplicar restricciones de resolución y bitrate
        '-c:a', 'aac',              // Codec de audio AAC
        '-ac', '2',                 // 2 canales de audio
        '-ar', '44100',             // Sample rate
        '-b:a', '128k',             // Bitrate de audio
        '-movflags', '+faststart',   // Optimizar para streaming web
        '-ss', seekTime.toString(), // Punto de inicio
        '-avoid_negative_ts', 'make_zero', // Evitar timestamps negativos
        '-fflags', '+genpts',       // Generar timestamps
        '-y',                       // Sobrescribir archivo existente
        tempFilePath
      ];
      
      console.log(`🔧 [VideoStreamManager] Ejecutando FFmpeg...`);
      console.log(`🎬 [FFmpeg] Comando completo: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      // Ejecutar FFmpeg con Promise
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        this.currentFFmpegProcess = ffmpeg;
        
        let stderr = '';
        let lastProgressTime = 0;
        
        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          
          // Mostrar progreso cada 2 segundos
          const now = Date.now();
          if (now - lastProgressTime > 2000) {
            if (output.includes('time=')) {
              const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
              if (timeMatch) {
                const progressTime = timeMatch[1];
                console.log(`⚙️ [VideoStreamManager] Progreso: ${progressTime}`);
                
                // Enviar progreso al renderer
                try {
                  this.mainWindow.webContents.send('transcoding-progress', {
                    time: progressTime,
                    message: `Convirtiendo video: ${progressTime}`
                  });
                } catch (error) {
                  console.warn('❌ Error enviando progreso al renderer:', error);
                }
                
                lastProgressTime = now;
              }
            }
          }
        });
        
        ffmpeg.on('close', (code) => {
          this.currentFFmpegProcess = null;
          if (code === 0) {
            console.log(`✅ [VideoStreamManager] Transcoding completado exitosamente`);
            
            // Notificar al renderer que el transcoding terminó
            try {
              this.mainWindow.webContents.send('transcoding-complete', {
                success: true,
                message: 'Transcoding completado, iniciando reproducción...'
              });
            } catch (error) {
              console.warn('❌ Error enviando notificación de transcoding completo:', error);
            }
            
            resolve();
          } else if (code === null) {
            // Proceso interrumpido (SIGTERM/SIGKILL) - no es un error real
            console.warn(`⚠️ [VideoStreamManager] Proceso FFmpeg interrumpido (código null)`);
            reject(new Error(`FFmpeg process was interrupted`));
          } else {
            console.error(`❌ [VideoStreamManager] FFmpeg terminó con código: ${code}`);
            console.error(`❌ [VideoStreamManager] Stderr:`, stderr.slice(-500)); // Solo últimos 500 chars
            reject(new Error(`FFmpeg failed with code ${code}`));
          }
        });
        
        ffmpeg.on('error', (error) => {
          this.currentFFmpegProcess = null;
          console.error(`❌ [VideoStreamManager] Error ejecutando FFmpeg:`, error.message);
          reject(error);
        });
      });
      
      // Verificar que el archivo se creó correctamente
      const stats = await fs.stat(tempFilePath);
      console.log(`📊 [VideoStreamManager] Archivo transcodificado creado: ${Math.round(stats.size / 1024 / 1024)}MB`);
      
      // Reproducir el archivo transcodificado
      console.log(`🎬 [VideoStreamManager] Reproduciendo archivo transcodificado...`);
      await this.playNativeVideo(tempFilePath, 0, autoPlay, crtFilter); // seekTime ya aplicado
      
      // Marcar el estado actual
      this.currentPlayback = {
        strategy: PlaybackStrategy.FFMPEG_TRANSCODE,
        filePath: tempFilePath, // Usar el archivo temporal como referencia
        isActive: true
      };
      
      // Configurar limpieza automática del archivo temporal (extraer nombre del path)
      const tempFileName = path.basename(tempFilePath);
      this.setupTempFileCleanup(tempFilePath, tempFileName);
      
    } catch (error) {
      console.error(`❌ [VideoStreamManager] Error en transcoding:`, error);
      
      // Determinar el tipo de error y mostrar mensaje apropiado
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType: ErrorMessageInfo['type'] = 'transcoding-error';
      let title = 'Error de Transcoding';
      let message = `Ocurrió un error durante la conversión del video:\n\n${errorMessage}\n\nVerifica que FFmpeg esté instalado y disponible.`;
      
      // Detectar errores específicos
      if (errorMessage.includes('No such file or directory') || errorMessage.includes('ENOENT')) {
        errorType = 'file-not-found';
        title = 'Archivo no encontrado';
        message = `No se pudo encontrar el archivo de video durante el transcoding:\n\n${filePath}\n\nVerifica que el archivo existe y que la ruta sea correcta.`;
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
        title = 'Error de permisos';
        message = `No se tienen permisos para acceder al archivo:\n\n${filePath}\n\nVerifica los permisos del archivo y la carpeta.`;
      } else if (errorMessage.includes('ffmpeg') || errorMessage.includes('spawn')) {
        title = 'FFmpeg no encontrado';
        message = `FFmpeg no está disponible o no se pudo ejecutar.\n\nAsegúrate de que FFmpeg esté instalado y disponible en PATH.`;
      }
      
      // Mostrar mensaje de error al usuario
      await this.showErrorMessage({
        title,
        message,
        type: errorType
      });
      
      // Fallback: mostrar mensaje en el contenedor de video también
      console.warn('⚠️ [VideoStreamManager] Transcoding falló, mostrando mensaje de error');
      
      const errorScript = `
        (() => {
          const container = document.getElementById('video-container');
          if (container) {
            container.innerHTML = \`
              <div style="color: #ff6b6b; text-align: center; padding: 40px; background: #2a2a2a; border-radius: 8px; font-family: Arial, sans-serif;">
                <h3 style="margin-top: 0;">🔄 Error de Transcoding</h3>
                <p><strong>Archivo:</strong> ${path.basename(filePath)}</p>
                <p style="color: #ffaa00; margin: 15px 0;">${title}</p>
                <details style="text-align: left; margin-top: 20px; padding: 10px; background: rgba(255, 107, 107, 0.1); border-radius: 4px;">
                  <summary style="cursor: pointer; font-weight: bold;">Ver detalles técnicos</summary>
                  <p style="margin: 10px 0; font-family: monospace; font-size: 12px; word-break: break-all;">${errorMessage}</p>
                </details>
              </div>
            \`;
          }
        })()
      `;
      
      await this.mainWindow.webContents.executeJavaScript(errorScript);
      throw error;
    }
  }

  /**
   * Estrategia 3: HTTP Streaming con FFmpeg
   */
  private async playWithHttpStreaming(filePath: string, seekTime: number, autoPlay: boolean, crtFilter: boolean = false): Promise<void> {
    console.log(`🌐 [VideoStreamManager] HTTP Streaming: ${filePath}`);
    
    // TODO: Implementar HTTP server interno con FFmpeg
    // Por ahora, intentar reproducción nativa como fallback
    console.warn('⚠️ [VideoStreamManager] HTTP streaming no implementado aún, intentando reproducción nativa');
    await this.playNativeVideo(filePath, seekTime, autoPlay, crtFilter);
  }

  /**
   * Detiene la reproducción actual y limpia recursos
   */
  public async stopCurrentPlayback(): Promise<void> {
    console.log('🛑 [VideoStreamManager] Deteniendo reproducción actual...');

    // Parar proceso FFmpeg si existe
    if (this.currentFFmpegProcess) {
      this.currentFFmpegProcess.kill('SIGKILL');
      this.currentFFmpegProcess = null;
      console.log('🔴 [VideoStreamManager] Proceso FFmpeg terminado');
    }

    // Cerrar servidor HTTP si existe
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
      console.log('🔴 [VideoStreamManager] Servidor HTTP cerrado');
    }

    // Limpiar archivo temporal del video anterior si existía
    if (this.currentPlayback?.strategy === PlaybackStrategy.FFMPEG_TRANSCODE) {
      const tempFile = this.currentPlayback.filePath;
      if (tempFile && this.tempFilesToCleanup.has(tempFile)) {
        console.log('🧹 [VideoStreamManager] Limpiando archivo temporal del video anterior');
        await this.cleanupTempFile(tempFile);
      }
    }

    // Limpiar DOM
    const cleanupScript = `
      (() => {
        const videos = document.querySelectorAll('video');
        console.log('🧹 Limpiando', videos.length, 'elementos de video');
        videos.forEach(video => {
          video.pause();
          video.src = '';
          video.remove();
        });
        
        if (window.VSMPlayer) {
          window.VSMPlayer.currentVideo = null;
        }
        
        return { success: true, cleaned: videos.length };
      })()
    `;

    try {
      const result = await this.mainWindow.webContents.executeJavaScript(cleanupScript);
      console.log('🧹 [VideoStreamManager] Cleanup result:', result);
      
      this.currentPlayback = null;
    } catch (error) {
      console.error('❌ [VideoStreamManager] Error en cleanup:', error);
    }
  }

  /**
   * Configura limpieza automática del archivo temporal cuando termine el video
   */
  private setupTempFileCleanup(tempFilePath: string, tempFileName: string): void {
    // Agregar a la lista de archivos a limpiar
    this.tempFilesToCleanup.add(tempFilePath);
    
    // Inyectar listeners de video para limpieza automática
    const cleanupScript = `
      (() => {
        const video = document.getElementById('vsm-main-video');
        if (!video) return;
        
        const tempFilePath = '${tempFilePath}';
        const tempFileName = '${tempFileName}';
        
        // Función de limpieza
        const cleanup = () => {
          console.log('🧹 [VideoStreamManager] Solicitando limpieza de archivo temporal:', tempFileName);
          window.electronAPI?.cleanupTempFile?.(tempFilePath);
        };
        
        // Limpiar SOLO cuando termine el video completamente
        video.addEventListener('ended', () => {
          console.log('🏁 [VideoStreamManager] Video terminado, limpiando archivo temporal');
          cleanup();
        }, { once: true });
        
        // Limpiar cuando se cambie a otro video (beforeunload)
        window.addEventListener('beforeunload', cleanup);
        
        console.log('✅ [VideoStreamManager] Limpieza automática configurada para:', tempFileName);
        console.log('📋 [VideoStreamManager] Se limpiará cuando: video termine o se cambie de video');
      })()
    `;
    
    this.mainWindow.webContents.executeJavaScript(cleanupScript);
    
    // Backup: limpiar después de 2 horas como último recurso (por si el usuario deja la app abierta)
    setTimeout(async () => {
      if (this.tempFilesToCleanup.has(tempFilePath)) {
        console.log('⏰ [VideoStreamManager] Limpieza automática por tiempo (2 horas):', tempFileName);
        await this.cleanupTempFile(tempFilePath);
      }
    }, 7200000); // 2 horas
  }

  /**
   * Genera un path de cache único basado en el archivo original
   */
  private async getCachedVideoPath(originalFilePath: string): Promise<string> {
    try {
      // Obtener estadísticas del archivo para el hash
      const stats = await fs.stat(originalFilePath);
      
      // Normalizar el nombre del archivo para consistencia entre sesiones  
      const normalizedFileName = path.basename(originalFilePath);
      const fileInfo = `${normalizedFileName}_${stats.size}_${stats.mtime.getTime()}`;
      
      console.log(`📋 [VideoStreamManager] Cache key: ${fileInfo}`);
      
      // Crear hash único
      const hash = crypto.createHash('md5').update(fileInfo).digest('hex');
      const cacheFileName = `analog_replay_cache_${hash}.mp4`;
      
      // Usar directorio de cache específico
      const cacheDir = path.join(os.tmpdir(), 'analog_replay_cache');
      
      // Crear directorio de cache si no existe
      try {
        await fs.mkdir(cacheDir, { recursive: true });
      } catch {
        // Ignorar si ya existe
      }
      
      return path.join(cacheDir, cacheFileName);
    } catch (error) {
      console.error('❌ [VideoStreamManager] Error creando path de cache:', error);
      // Fallback a temporal con timestamp
      const tempDir = os.tmpdir();
      const tempFileName = `analog_replay_${Date.now()}.mp4`;
      return path.join(tempDir, tempFileName);
    }
  }

  /**
   * Limpia un archivo temporal específico
   */
  public async cleanupTempFile(tempFilePath: string): Promise<void> {
    if (!this.tempFilesToCleanup.has(tempFilePath)) {
      return; // Ya fue limpiado
    }
    
    try {
      await fs.unlink(tempFilePath);
      this.tempFilesToCleanup.delete(tempFilePath);
      const fileName = path.basename(tempFilePath);
      console.log(`✅ [VideoStreamManager] Archivo temporal eliminado: ${fileName}`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.warn(`⚠️ [VideoStreamManager] Error limpiando archivo temporal:`, error);
      }
    }
  }

  /**
   * Muestra un mensaje de error al usuario
   */
  private async showErrorMessage(errorInfo: ErrorMessageInfo): Promise<void> {
    const { title, message, type } = errorInfo;
    
    try {
      const errorScript = `
        (() => {
          // Crear y mostrar un mensaje de error personalizado
          const createErrorMessage = () => {
            // Remover mensajes de error anteriores
            const existingErrors = document.querySelectorAll('.vsm-error-message');
            existingErrors.forEach(el => el.remove());
            
            // Crear elemento de error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'vsm-error-message';
            errorDiv.style.cssText = \`
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
              color: white;
              padding: 20px 30px;
              border-radius: 10px;
              box-shadow: 0 8px 25px rgba(238, 90, 82, 0.3);
              z-index: 10000;
              max-width: 500px;
              font-family: 'Arial', sans-serif;
              text-align: center;
              animation: errorFadeIn 0.3s ease-out;
            \`;
            
            // Agregar animación CSS
            if (!document.getElementById('vsm-error-styles')) {
              const style = document.createElement('style');
              style.id = 'vsm-error-styles';
              style.textContent = \`
                @keyframes errorFadeIn {
                  from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                  }
                  to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                  }
                }
                
                .vsm-error-message h3 {
                  margin: 0 0 15px 0;
                  font-size: 20px;
                  font-weight: bold;
                }
                
                .vsm-error-message p {
                  margin: 0;
                  line-height: 1.5;
                  white-space: pre-line;
                }
                
                .vsm-error-close {
                  margin-top: 20px;
                  padding: 10px 20px;
                  background: rgba(255, 255, 255, 0.2);
                  color: white;
                  border: none;
                  border-radius: 5px;
                  cursor: pointer;
                  font-size: 14px;
                  transition: background 0.2s;
                }
                
                .vsm-error-close:hover {
                  background: rgba(255, 255, 255, 0.3);
                }
              \`;
              document.head.appendChild(style);
            }
            
            // Crear contenido del error
            errorDiv.innerHTML = \`
              <h3>${title}</h3>
              <p>${message}</p>
              <button class="vsm-error-close" onclick="this.parentElement.remove()">Cerrar</button>
            \`;
            
            document.body.appendChild(errorDiv);
            
            // Auto-remover después de 8 segundos
            setTimeout(() => {
              if (errorDiv.parentElement) {
                errorDiv.remove();
              }
            }, 8000);
          };
          
          createErrorMessage();
        })()
      `;
      
      await this.mainWindow.webContents.executeJavaScript(errorScript);
      
      console.log(`📢 [VideoStreamManager] Mensaje de error mostrado: ${type} - ${title}`);
    } catch (error) {
      console.error('❌ [VideoStreamManager] Error mostrando mensaje de error:', error);
    }
  }

  /**
   * Destruye el VideoStreamManager y limpia todos los recursos
   */
  public async destroy(): Promise<void> {
    console.log('🗑️ [VideoStreamManager] Limpiando recursos...');
    
    // Limpiar todos los archivos temporales
    for (const tempFile of this.tempFilesToCleanup) {
      await this.cleanupTempFile(tempFile);
    }
    
    await this.stopCurrentPlayback();
  }

  /**
   * Aplica restricciones de calidad basadas en el requerimiento:
   * - Si resolución >= 480p, convertir a 480p
   * - Si resolución < 480p, mantener resolución original
   */
  private applyQualityConstraints(sourceMetadata: any): { videoArgs: string[] } {
    const { width, height } = sourceMetadata;
    const videoArgs: string[] = [];

    // Determinar si necesitamos aplicar la restricción de 480p
    const isSD480OrHigher = height >= 480;

    if (isSD480OrHigher) {
      // Aplicar restricción de 480p
      console.log(`🎯 [VideoStreamManager] Aplicando restricción 480p a video ${width}x${height}`);
      
      // Calcular relación de aspecto para mantener proporciones
      const aspectRatio = width / height;
      
      let targetWidth: number;
      const targetHeight = 480;
      
      // Relaciones de aspecto comunes
      if (Math.abs(aspectRatio - (16/9)) < 0.01) {
        // 16:9 aspect ratio
        targetWidth = 854;
      } else if (Math.abs(aspectRatio - (4/3)) < 0.01) {
        // 4:3 aspect ratio
        targetWidth = 640;
      } else {
        // Calcular ancho manteniendo relación de aspecto
        targetWidth = Math.round(480 * aspectRatio);
        // Asegurar números pares para mejor encoding
        targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
      }

      videoArgs.push('-s', `${targetWidth}x${targetHeight}`);
      videoArgs.push('-b:v', '1500k'); // 1.5 Mbps para 480p

      console.log(`📐 [VideoStreamManager] Resolución objetivo: ${targetWidth}x${targetHeight}`);
    } else {
      // Mantener resolución original para videos menores a 480p
      console.log(`📐 [VideoStreamManager] Manteniendo resolución original: ${width}x${height} (menor a 480p)`);
      
      // Ajustar bitrate basado en resolución original
      const pixelCount = width * height;
      if (pixelCount <= (320 * 240)) {
        videoArgs.push('-b:v', '500k'); // 500 kbps para videos muy pequeños
      } else if (pixelCount <= (480 * 360)) {
        videoArgs.push('-b:v', '800k'); // 800 kbps para videos pequeños
      } else {
        videoArgs.push('-b:v', '1200k'); // 1.2 Mbps para videos cercanos a 480p
      }
    }

    return { videoArgs };
  }
}