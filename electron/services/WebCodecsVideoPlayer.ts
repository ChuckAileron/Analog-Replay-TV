import { spawn, ChildProcess } from 'child_process';
import { ipcMain, BrowserWindow } from 'electron';

export class WebCodecsVideoPlayer {
  private ffmpegVideoProcess: ChildProcess | null = null;
  private ffmpegAudioProcess: ChildProcess | null = null;
  private window: BrowserWindow;
  private isPlaying = false;
  private currentFile = '';
  private videoDecoder: any = null;
  private audioDecoder: any = null;
  private supportedVideoCodec: string = '';
  private supportedAudioCodec: string = '';

  constructor(window: BrowserWindow) {
    this.window = window;
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // Verificar compatibilidad
    ipcMain.handle('webcodecs:check-support', async () => {
      return await this.checkSupport();
    });

    // Reproducir archivo
    ipcMain.handle('webcodecs:play', async (event, filePath: string) => {
      return await this.playFile(filePath);
    });

    // Parar reproducción
    ipcMain.handle('webcodecs:stop', async () => {
      return await this.stop();
    });

    // Pausar/reanudar
    ipcMain.handle('webcodecs:toggle-pause', async () => {
      return await this.togglePause();
    });
  }

  private async checkSupport() {
    try {
      // Enviar verificación al renderer
      const support = await this.window.webContents.executeJavaScript(`
        (async () => {
          // Verificar compatibilidad con WebCodecs API
          const checkWebCodecsSupport = () => {
            const features = {
              videoDecoder: 'VideoDecoder' in window,
              audioDecoder: 'AudioDecoder' in window,
              videoEncoder: 'VideoEncoder' in window,
              audioEncoder: 'AudioEncoder' in window,
            };

            return {
              supported: features.videoDecoder && features.audioDecoder,
              features
            };
          };

          // Verificar códecs soportados
          const getSupportedCodecs = async () => {
            const videoCodecs = [
              'avc1.42E01E', // H.264 Baseline
              'avc1.4D401E', // H.264 Main
              'avc1.640028', // H.264 High
              'hev1.1.6.L93.B0', // H.265/HEVC
              'vp09.00.10.08', // VP9
              'av01.0.04M.08' // AV1
            ];

            const audioCodecs = [
              'mp4a.40.2', // AAC-LC
              'mp4a.40.5', // AAC-HE
              'opus', // Opus
              'mp3' // MP3
            ];

            const supportedVideo = [];
            const supportedAudio = [];

            // Verificar video
            for (const codec of videoCodecs) {
              try {
                const config = { codec };
                const support = await VideoDecoder.isConfigSupported(config);
                if (support.supported) {
                  supportedVideo.push(codec);
                }
              } catch (e) {
                // Codec no soportado
              }
            }

            // Verificar audio
            for (const codec of audioCodecs) {
              try {
                const config = { codec, sampleRate: 48000, numberOfChannels: 2 };
                const support = await AudioDecoder.isConfigSupported(config);
                if (support.supported) {
                  supportedAudio.push(codec);
                }
              } catch (e) {
                // Codec no soportado
              }
            }

            return {
              video: supportedVideo,
              audio: supportedAudio
            };
          };
          
          const support = checkWebCodecsSupport();
          let codecs = { video: [], audio: [] };
          
          if (support.supported) {
            codecs = await getSupportedCodecs();
          }
          
          return { support, codecs };
        })()
      `);

      console.log('WebCodecs Support:', support);
      return support;
    } catch (error) {
      console.error('Error checking WebCodecs support:', error);
      return { support: { supported: false, features: {} }, codecs: { video: [], audio: [] } };
    }
  }

  private async playFile(filePath: string): Promise<void> {
    try {
      console.log('🎬 [WebCodecsVideoPlayer] Iniciando reproducción de:', filePath);
      console.log('🔍 [WebCodecsVideoPlayer] Verificando estado de procesos anteriores...');
      
      if (this.ffmpegVideoProcess || this.ffmpegAudioProcess) {
        console.log('🛑 [WebCodecsVideoPlayer] Parando procesos anteriores');
        await this.stop();
      }

      this.currentFile = filePath;

      // Verificar compatibilidad primero
      console.log('🔍 [WebCodecsVideoPlayer] Verificando compatibilidad WebCodecs...');
      const { support, codecs } = await this.checkSupport();
      
      if (!support.supported) {
        throw new Error('WebCodecs no está soportado en este navegador');
      }
      console.log('✅ [WebCodecsVideoPlayer] WebCodecs soportado correctamente');

      // Elegir el mejor códec soportado
      const videoCodec = this.selectBestVideoCodec(codecs.video);
      const audioCodec = this.selectBestAudioCodec(codecs.audio);

      console.log(`🎯 [WebCodecsVideoPlayer] Using codecs - Video: ${videoCodec}, Audio: ${audioCodec}`);

      // Inicializar decodificadores WebCodecs en el proceso principal
      await this.initializeWebCodecsDecoders(videoCodec, audioCodec);

      // Iniciar FFmpeg para generar stream compatible con WebCodecs
      console.log('🚀 [WebCodecsVideoPlayer] Iniciando streams de FFmpeg...');
      await this.startFFmpegStream(filePath, videoCodec, audioCodec);
      
      this.isPlaying = true;
      console.log('✅ [WebCodecsVideoPlayer] Reproducción iniciada exitosamente');
      
    } catch (error) {
      console.error('❌ [WebCodecsVideoPlayer] Error playing file:', error);
      throw error;
    }
  }

  private async initializeWebCodecsDecoders(videoCodec: string, audioCodec: string): Promise<void> {
    try {
      console.log('🔧 [WebCodecsVideoPlayer] Inicializando decodificadores WebCodecs...');
      
      this.supportedVideoCodec = videoCodec;
      this.supportedAudioCodec = audioCodec;

      // Inicializar VideoDecoder en el proceso principal usando webContents
      const videoDecoderInit = await this.window.webContents.executeJavaScript(`
        (async () => {
          try {
            window.videoDecoderGlobal = new VideoDecoder({
              output: (frame) => {
                // Crear ImageBitmap del frame para transferir al proceso principal
                createImageBitmap(frame).then(bitmap => {
                  // Renderizar frame directamente en canvas
                  const canvas = document.getElementById('videoCanvas');
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    canvas.width = frame.displayWidth;
                    canvas.height = frame.displayHeight;
                    ctx.drawImage(frame, 0, 0);
                    console.log('✅ Frame renderizado:', frame.displayWidth + 'x' + frame.displayHeight);
                  }
                  
                  frame.close();
                }).catch(err => console.error('Error creating ImageBitmap:', err));
              },
              error: (error) => {
                console.error('VideoDecoder error:', error);
              }
            });

            await window.videoDecoderGlobal.configure({
              codec: '${videoCodec}',
              optimizeForLatency: true
            });

            console.log('✅ VideoDecoder configurado:', '${videoCodec}');
            return { success: true, codec: '${videoCodec}' };
          } catch (error) {
            console.error('❌ Error configurando VideoDecoder:', error);
            return { success: false, error: error.message };
          }
        })()
      `);

      if (!videoDecoderInit.success) {
        throw new Error(`VideoDecoder init failed: ${videoDecoderInit.error}`);
      }

      // Inicializar AudioDecoder
      const audioDecoderInit = await this.window.webContents.executeJavaScript(`
        (async () => {
          try {
            window.audioDecoderGlobal = new AudioDecoder({
              output: (audioData) => {
                // Reproducir audio directamente
                if (window.audioContextGlobal) {
                  try {
                    const audioBuffer = window.audioContextGlobal.createBuffer(
                      audioData.numberOfChannels,
                      audioData.numberOfFrames,
                      audioData.sampleRate
                    );

                    for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
                      const channelData = audioBuffer.getChannelData(channel);
                      audioData.copyTo(channelData, { planeIndex: channel });
                    }

                    const source = window.audioContextGlobal.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(window.audioContextGlobal.destination);
                    source.start();
                    
                    console.log('✅ Audio reproducido');
                  } catch (error) {
                    console.error('Error reproduciendo audio:', error);
                  }
                }
                audioData.close();
              },
              error: (error) => {
                console.error('AudioDecoder error:', error);
              }
            });

            // Crear AudioContext global si no existe
            if (!window.audioContextGlobal) {
              window.audioContextGlobal = new AudioContext();
            }

            await window.audioDecoderGlobal.configure({
              codec: '${audioCodec}',
              sampleRate: 48000,
              numberOfChannels: 2
            });

            console.log('✅ AudioDecoder configurado:', '${audioCodec}');
            return { success: true, codec: '${audioCodec}' };
          } catch (error) {
            console.error('❌ Error configurando AudioDecoder:', error);
            return { success: false, error: error.message };
          }
        })()
      `);

      if (!audioDecoderInit.success) {
        console.warn(`⚠️ AudioDecoder init failed: ${audioDecoderInit.error}`);
      }

      console.log('✅ [WebCodecsVideoPlayer] Decodificadores WebCodecs inicializados');
      
    } catch (error) {
      console.error('❌ [WebCodecsVideoPlayer] Error inicializando decodificadores:', error);
      throw error;
    }
  }

  private selectBestVideoCodec(supportedCodecs: string[]): string {
    // Prioridad: H.264 High > H.264 Main > H.264 Baseline > VP9 > HEVC > AV1
    const priorities = [
      'avc1.640028', // H.264 High
      'avc1.4D401E', // H.264 Main  
      'avc1.42E01E', // H.264 Baseline
      'vp09.00.10.08', // VP9
      'hev1.1.6.L93.B0', // HEVC
      'av01.0.04M.08' // AV1
    ];

    for (const codec of priorities) {
      if (supportedCodecs.includes(codec)) {
        return codec;
      }
    }

    return supportedCodecs[0] || 'avc1.42E01E'; // Fallback
  }

  private selectBestAudioCodec(supportedCodecs: string[]): string {
    // Prioridad: AAC-LC > Opus > AAC-HE > MP3
    const priorities = ['mp4a.40.2', 'opus', 'mp4a.40.5', 'mp3'];

    for (const codec of priorities) {
      if (supportedCodecs.includes(codec)) {
        return codec;
      }
    }

    return supportedCodecs[0] || 'mp4a.40.2'; // Fallback
  }

  private async startFFmpegStream(filePath: string, videoCodec: string, audioCodec: string): Promise<void> {
    console.log('🔄 [WebCodecsVideoPlayer] Starting FFmpeg streams...');
    
    try {
      // Start video stream
      await this.startVideoStream(filePath, videoCodec);
      
      // Start audio stream  
      await this.startAudioStream(filePath, audioCodec);
      
      console.log('✅ [WebCodecsVideoPlayer] Both streams started');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [WebCodecsVideoPlayer] FFmpeg error:', errorMessage);
      throw error;
    }
  }

  private async startVideoStream(filePath: string, videoCodec: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🎬 [WebCodecsVideoPlayer] Iniciando stream de video...');
      
      // Configurar FFmpeg para video H.264 (universal para todos los formatos de entrada)
      const videoArgs = [
        '-i', filePath,
        '-c:v', 'libx264',               // Convertir cualquier codec de video a H.264
        '-profile:v', this.getH264Profile(videoCodec),
        '-level:v', '4.0',
        '-pix_fmt', 'yuv420p',           // Formato de pixel compatible
        '-g', '30',                      // GOP size
        '-keyint_min', '30',
        '-sc_threshold', '0',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Asegurar dimensiones pares
        '-an',                           // Sin audio en este stream
        '-f', 'h264',                    // Output H.264 raw
        'pipe:1'
      ];

      console.log('🚀 [WebCodecsVideoPlayer] Video FFmpeg args:', videoArgs.join(' '));

      try {
        this.ffmpegVideoProcess = spawn('ffmpeg', videoArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (error) {
        console.error('❌ [WebCodecsVideoPlayer] Error spawning FFmpeg video process:', error);
        reject(new Error(`FFmpeg no disponible: ${error}`));
        return;
      }

      let isResolved = false;

      this.ffmpegVideoProcess.on('spawn', () => {
        console.log('✅ [WebCodecsVideoPlayer] Video process iniciado');
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
        this.setupVideoHandlers();
      });

      this.ffmpegVideoProcess.on('error', (error: any) => {
        console.error('❌ [WebCodecsVideoPlayer] Error en video process:', error);
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      });

      this.ffmpegVideoProcess.stderr?.on('data', (data: any) => {
        console.log('📝 [WebCodecsVideoPlayer] Video FFmpeg stderr:', data.toString());
      });
    });
  }

  private async startAudioStream(filePath: string, audioCodec: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔊 [WebCodecsVideoPlayer] Iniciando stream de audio...');
      
      // Configurar FFmpeg para audio AAC (universal para todos los formatos de entrada)
      const audioArgs = [
        '-i', filePath,
        '-c:a', 'aac',                   // Convertir cualquier codec de audio a AAC
        '-b:a', '128k',                  // Bitrate de audio estándar
        '-ar', '48000',                  // Sample rate estándar
        '-ac', '2',                      // Estéreo (mono se convierte automáticamente)
        '-vn',                           // Sin video en este stream
        '-f', 'adts',                    // Output AAC ADTS format
        'pipe:1'
      ];

      console.log('🚀 [WebCodecsVideoPlayer] Audio FFmpeg args:', audioArgs.join(' '));

      this.ffmpegAudioProcess = spawn('ffmpeg', audioArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let isResolved = false;

      this.ffmpegAudioProcess.on('spawn', () => {
        console.log('✅ [WebCodecsVideoPlayer] Audio process iniciado');
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
        this.setupAudioHandlers();
      });

      this.ffmpegAudioProcess.on('error', (error: any) => {
        console.error('❌ [WebCodecsVideoPlayer] Error en audio process:', error);
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      });

      this.ffmpegAudioProcess.stderr?.on('data', (data: any) => {
        console.log('📝 [WebCodecsVideoPlayer] Audio FFmpeg stderr:', data.toString());
      });
    });
  }

  private getH264Profile(codec: string): string {
    if (codec.includes('640028')) return 'high';
    if (codec.includes('4D401E')) return 'main';
    return 'baseline';
  }

  private setupVideoHandlers(): void {
    if (!this.ffmpegVideoProcess) {
      console.warn('⚠️ [WebCodecsVideoPlayer] No hay proceso de video para configurar streams');
      return;
    }

    console.log('🔗 [WebCodecsVideoPlayer] Configurando handlers de video stream');

    // Stream de video (stdout)
    this.ffmpegVideoProcess.stdout?.on('data', (chunk: Buffer) => {
      console.log('📹 [WebCodecsVideoPlayer] Chunk de video recibido:', chunk.length, 'bytes');
      // Enviar chunk H.264 al decodificador WebCodecs
      this.decodeVideoChunk(chunk);
    });

    console.log('✅ [WebCodecsVideoPlayer] Video stream handlers configurados');
  }

  private setupAudioHandlers(): void {
    if (!this.ffmpegAudioProcess) {
      console.warn('⚠️ [WebCodecsVideoPlayer] No hay proceso de audio para configurar streams');
      return;
    }

    console.log('🔗 [WebCodecsVideoPlayer] Configurando handlers de audio stream');

    // Stream de audio (stdout)
    this.ffmpegAudioProcess.stdout?.on('data', (chunk: Buffer) => {
      console.log('🔊 [WebCodecsVideoPlayer] Chunk de audio recibido:', chunk.length, 'bytes');
      // Enviar chunk AAC al decodificador WebCodecs
      this.decodeAudioChunk(chunk);
    });

    console.log('✅ [WebCodecsVideoPlayer] Audio stream handlers configurados');
  }

  private async decodeVideoChunk(chunk: Buffer): Promise<void> {
    try {
      // Detectar tipo de frame H.264
      let frameType = 'delta';
      
      // Buscar NAL units en el chunk
      for (let i = 0; i < chunk.length - 4; i++) {
        if (chunk[i] === 0x00 && chunk[i+1] === 0x00 && chunk[i+2] === 0x00 && chunk[i+3] === 0x01) {
          const nalType = chunk[i+4] & 0x1F;
          if (nalType === 5) { // IDR slice (keyframe)
            frameType = 'key';
            break;
          }
        }
      }

      // Debug: verificar estado del VideoDecoder
      const decoderStatus = await this.window.webContents.executeJavaScript(`
        (async () => {
          try {
            if (window.videoDecoderGlobal) {
              return {
                exists: true,
                state: window.videoDecoderGlobal.state,
                configured: window.videoDecoderGlobal.state === 'configured'
              };
            } else {
              return {
                exists: false,
                state: 'undefined',
                configured: false
              };
            }
          } catch (error) {
            return {
              exists: false,
              state: 'error',
              configured: false,
              error: error.message
            };
          }
        })()
      `);

      console.log('🔍 [WebCodecsVideoPlayer] VideoDecoder status:', decoderStatus);

      // Solo enviar chunk si el decoder está configurado
      if (decoderStatus.configured) {
        await this.window.webContents.executeJavaScript(`
          (async () => {
            try {
              const chunkData = new Uint8Array([${chunk.join(',')}]);
              const encodedChunk = new EncodedVideoChunk({
                type: '${frameType}',
                timestamp: ${Date.now() * 1000},
                data: chunkData
              });
              
              window.videoDecoderGlobal.decode(encodedChunk);
              console.log('✅ Video chunk decodificado:', '${frameType}', ${chunk.length}, 'bytes');
            } catch (error) {
              console.error('❌ Error decodificando video chunk:', error);
            }
          })()
        `);
      } else {
        console.warn('⚠️ [WebCodecsVideoPlayer] VideoDecoder no configurado:', decoderStatus);
      }
      
    } catch (error) {
      console.error('❌ [WebCodecsVideoPlayer] Error en decodeVideoChunk:', error);
    }
  }

  private async decodeAudioChunk(chunk: Buffer): Promise<void> {
    try {
      // Enviar chunk al decodificador WebCodecs en el renderer
      await this.window.webContents.executeJavaScript(`
        (async () => {
          try {
            if (window.audioDecoderGlobal && window.audioDecoderGlobal.state === 'configured') {
              const chunkData = new Uint8Array([${chunk.join(',')}]);
              const encodedChunk = new EncodedAudioChunk({
                type: 'key', // AAC frames pueden ser tratados como key
                timestamp: ${Date.now() * 1000},
                data: chunkData
              });
              
              window.audioDecoderGlobal.decode(encodedChunk);
              console.log('✅ Audio chunk decodificado:', ${chunk.length}, 'bytes');
            } else {
              console.warn('⚠️ AudioDecoder no configurado');
            }
          } catch (error) {
            console.error('❌ Error decodificando audio chunk:', error);
          }
        })()
      `);
      
    } catch (error) {
      console.error('❌ [WebCodecsVideoPlayer] Error en decodeAudioChunk:', error);
    }
  }

  private async stop(): Promise<void> {
    console.log('🛑 [WebCodecsVideoPlayer] Parando reproducción...');
    this.isPlaying = false;
    
    // Parar proceso de video
    if (this.ffmpegVideoProcess) {
      this.ffmpegVideoProcess.kill('SIGTERM');
      this.ffmpegVideoProcess = null;
      console.log('✅ [WebCodecsVideoPlayer] Proceso de video parado');
    }
    
    // Parar proceso de audio
    if (this.ffmpegAudioProcess) {
      this.ffmpegAudioProcess.kill('SIGTERM');
      this.ffmpegAudioProcess = null;
      console.log('✅ [WebCodecsVideoPlayer] Proceso de audio parado');
    }
    
    this.currentFile = '';

    // Notificar al renderer
    this.window.webContents.send('webcodecs:stopped');
    console.log('✅ [WebCodecsVideoPlayer] Reproducción parada completamente');
  }

  private async togglePause(): Promise<boolean> {
    // Por ahora, simple stop/start
    // TODO: Implementar pausa real con seek
    if (this.isPlaying) {
      await this.stop();
      return false;
    } else if (this.currentFile) {
      await this.playFile(this.currentFile);
      return true;
    }
    return false;
  }

  public cleanup(): void {
    this.stop();
    ipcMain.removeAllListeners('webcodecs:check-support');
    ipcMain.removeAllListeners('webcodecs:play');
    ipcMain.removeAllListeners('webcodecs:stop');
    ipcMain.removeAllListeners('webcodecs:toggle-pause');
  }
}