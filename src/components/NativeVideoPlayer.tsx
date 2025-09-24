import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/native-video-player.css';

interface NativeVideoPlayerProps {
  videoPath: string;
  width?: number;
  height?: number;
  autoplay?: boolean;
  controls?: boolean;
  onLoadedMetadata?: (metadata: any) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
}

interface VideoFrame {
  data: string; // base64
  width: number;
  height: number;
  timestamp: number;
}

interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export const NativeVideoPlayer: React.FC<NativeVideoPlayerProps> = ({
  videoPath,
  width = 800,
  height = 600,
  autoplay = false,
  controls = true,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  onError
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string>('');
  const playerIdRef = useRef<string>(`player_${Date.now()}`);

  // Funciones de control
  const play = useCallback(async () => {
    try {
      await (window as any).electronAPI?.nativePlayerPlay?.(playerIdRef.current);
      setPlayerState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Play failed:', error);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await (window as any).electronAPI?.nativePlayerPause?.(playerIdRef.current);
      setPlayerState(prev => ({ ...prev, isPaused: true }));
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Pause failed:', error);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await (window as any).electronAPI?.nativePlayerStop?.(playerIdRef.current);
      setPlayerState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        isPaused: false, 
        currentTime: 0 
      }));
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Stop failed:', error);
    }
  }, []);

  const seek = useCallback(async (timeInSeconds: number) => {
    try {
      await (window as any).electronAPI?.nativePlayerSeek?.(playerIdRef.current, timeInSeconds);
      setPlayerState(prev => ({ ...prev, currentTime: timeInSeconds }));
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Seek failed:', error);
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    try {
      await (window as any).electronAPI?.nativePlayerSetVolume?.(playerIdRef.current, volume);
      setPlayerState(prev => ({ ...prev, volume }));
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Set volume failed:', error);
    }
  }, []);

  // Inicializar reproductor nativo
  const initializePlayer = useCallback(async () => {
    try {
      console.log('🎬 [NativeVideoPlayer] Initializing player for:', videoPath);
      
      const result = await (window as any).electronAPI?.initializeNativePlayer?.(
        playerIdRef.current,
        {
          videoPath,
          width,
          height,
          controls
        }
      );

      if (result?.success) {
        setIsInitialized(true);
        setPlayerState(prev => ({ ...prev, duration: result.duration }));
        
        if (onLoadedMetadata) {
          onLoadedMetadata({
            duration: result.duration,
            width,
            height
          });
        }

        console.log('✅ [NativeVideoPlayer] Player initialized');
        
        if (autoplay) {
          // Llamar play directamente sin dependencia
          try {
            await (window as any).electronAPI?.nativePlayerPlay?.(playerIdRef.current);
            setPlayerState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
          } catch (playError) {
            console.error('❌ [NativeVideoPlayer] Autoplay failed:', playError);
          }
        }
      } else {
        throw new Error(result?.error || 'Failed to initialize native player');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [NativeVideoPlayer] Initialization failed:', errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [videoPath, width, height, controls, autoplay, onLoadedMetadata, onError]);

  // Renderizar frame en canvas
  const renderFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Crear imagen desde datos PNG base64
      const img = new Image();
      img.onload = () => {
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar imagen
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Actualizar tiempo
        setPlayerState(prev => ({ ...prev, currentTime: frame.timestamp }));
        onTimeUpdate?.(frame.timestamp);
        
        console.log(`🖼️ [NativeVideoPlayer] Rendered JPEG frame at ${frame.timestamp.toFixed(2)}s`);
      };
      
      img.onerror = (error) => {
        console.error('❌ [NativeVideoPlayer] Image load error:', error);
      };
      
      // Cargar imagen JPEG desde base64
      img.src = `data:image/jpeg;base64,${frame.data}`;
      
    } catch (error) {
      console.error('❌ [NativeVideoPlayer] Frame rendering error:', error);
    }
  }, [onTimeUpdate]);

  // Escuchar frames de video desde el proceso principal
  useEffect(() => {
    const handleVideoFrame = (_event: any, frame: VideoFrame) => {
      renderFrame(frame);
    };

    const handlePlayerStateUpdate = (_event: any, state: PlayerState) => {
      setPlayerState(state);
      
      if (!state.isPlaying && state.currentTime >= state.duration) {
        onEnded?.();
      }
    };

    // Registrar listeners
    (window as any).electronAPI?.onVideoFrame?.(handleVideoFrame);
    (window as any).electronAPI?.onPlayerStateUpdate?.(handlePlayerStateUpdate);

    return () => {
      // Limpiar listeners
      (window as any).electronAPI?.removeVideoFrameListener?.(handleVideoFrame);
      (window as any).electronAPI?.removePlayerStateUpdateListener?.(handlePlayerStateUpdate);
    };
  }, [renderFrame, onEnded]);

  // Inicializar cuando cambie el videoPath
  useEffect(() => {
    if (videoPath) {
      // Generar nuevo ID para evitar conflictos
      playerIdRef.current = `player_${Date.now()}`;
      
      const init = async () => {
        try {
          await initializePlayer();
        } catch (initError) {
          console.error('❌ [NativeVideoPlayer] Init error:', initError);
        }
      };
      
      init();
    }

    return () => {
      // Destruir reproductor al desmontar
      const playerId = playerIdRef.current;
      (window as any).electronAPI?.destroyNativePlayer?.(playerId);
    };
  }, [videoPath]);

  // Formatear tiempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Renderizar error
  if (error) {
    return (
      <div className="native-video-player error">
        <div className="error-message">
          <h3>❌ Error de Reproductor Nativo</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Recargar Aplicación
          </button>
        </div>
      </div>
    );
  }

  // Renderizar loading
  if (!isInitialized) {
    return (
      <div className="native-video-player loading">
        <div className="loading-message">
          <h3>🔄 Inicializando Reproductor Nativo</h3>
          <p>Configurando FFmpeg para reproducción directa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="native-video-player">
      <div className="video-container">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="video-canvas"
        />
        
        {controls && (
          <div className="video-controls">
            <div className="control-buttons">
              <button 
                onClick={playerState.isPlaying && !playerState.isPaused ? pause : play}
                className="play-pause-btn"
              >
                {playerState.isPlaying && !playerState.isPaused ? '⏸️' : '▶️'}
              </button>
              
              <button onClick={stop} className="stop-btn">
                ⏹️
              </button>
              
              <span className="time-display">
                {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
              </span>
            </div>
            
            <div className="progress-container">
              <input
                type="range"
                min={0}
                max={playerState.duration}
                value={playerState.currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="progress-bar"
              />
            </div>
            
            <div className="volume-container">
              <span>🔊</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={playerState.volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="volume-bar"
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="debug-info">
        <small>
          Estado: {playerState.isPlaying ? (playerState.isPaused ? 'Pausado' : 'Reproduciendo') : 'Detenido'} | 
          Tiempo: {formatTime(playerState.currentTime)} | 
          Duración: {formatTime(playerState.duration)} | 
          Volumen: {Math.round(playerState.volume * 100)}%
        </small>
      </div>
    </div>
  );
};

export default NativeVideoPlayer;