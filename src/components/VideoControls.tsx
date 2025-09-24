// Controles de video personalizados con estilo retro
import { useState, useEffect, useCallback, useRef } from 'react';
import type { VideoPlayerRef, VideoPlayerState } from '../types/video.types';

interface VideoControlsProps {
  playerRef: React.RefObject<VideoPlayerRef>;
  style?: 'retro-90s' | 'retro-00s' | 'modern';
  className?: string;
  disabled?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  playerRef,
  style = 'retro-90s',
  className = '',
  disabled = false
}) => {
  const [playerState, setPlayerState] = useState<VideoPlayerState>({
    isLoading: false,
    isPlaying: false,
    isPaused: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    buffered: null,
    error: null,
    quality: 'auto'
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragVolume, setDragVolume] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Actualizar estado del reproductor
  useEffect(() => {
    const updateState = () => {
      if (playerRef.current) {
        const newState = playerRef.current.getState();
        setPlayerState(prevState => {
          // Solo actualizar si realmente cambió algo importante
          if (
            prevState.isPlaying !== newState.isPlaying ||
            prevState.muted !== newState.muted ||
            Math.abs(prevState.currentTime - newState.currentTime) > 0.5 ||
            prevState.duration !== newState.duration ||
            prevState.volume !== newState.volume
          ) {
            return newState;
          }
          return prevState;
        });
      }
    };

    const interval = setInterval(updateState, 500); // Menos frecuente
    return () => clearInterval(interval);
  }, []);

  // Formatear tiempo
  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Controles de reproducción
  const handlePlayPause = useCallback(async () => {
    if (!playerRef.current || disabled) return;

    try {
      if (playerState.isPlaying) {
        playerRef.current.pause();
      } else {
        await playerRef.current.play();
      }
    } catch (error) {
      console.error('Error en play/pause:', error);
    }
  }, [playerRef, playerState.isPlaying, disabled]);

  const handleVolumeToggle = useCallback(() => {
    if (!playerRef.current || disabled) return;

    if (playerState.muted) {
      playerRef.current.unmute();
    } else {
      playerRef.current.mute();
    }
  }, [playerRef, playerState.muted, disabled]);

  // Manejo de arrastre del progreso
  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !progressRef.current || !playerRef.current) return;
    
    setIsDragging(true);
    
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const newTime = percentage * playerState.duration;
    
    playerRef.current.seek(newTime);
  }, [disabled, playerState.duration, playerRef]);

  const handleProgressMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !progressRef.current || !playerRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percentage * playerState.duration;
    
    playerRef.current.seek(newTime);
  }, [isDragging, playerState.duration, playerRef]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragVolume(false);
  }, []);

  // Manejo de volumen
  const handleVolumeMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !volumeRef.current || !playerRef.current) return;
    
    setDragVolume(true);
    
    const rect = volumeRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const newVolume = Math.max(0, Math.min(1, percentage));
    
    playerRef.current.setVolume(newVolume);
  }, [disabled, playerRef]);

  const handleVolumeMouseMove = useCallback((e: MouseEvent) => {
    if (!dragVolume || !volumeRef.current || !playerRef.current) return;
    
    const rect = volumeRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    playerRef.current.setVolume(percentage);
  }, [dragVolume, playerRef]);

  // Event listeners globales
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleProgressMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    if (dragVolume) {
      document.addEventListener('mousemove', handleVolumeMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleProgressMouseMove);
      document.removeEventListener('mousemove', handleVolumeMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragVolume, handleProgressMouseMove, handleVolumeMouseMove, handleMouseUp]);

  // Estilos según el tema
  const getControlsStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
      color: 'white',
      fontSize: '14px',
      userSelect: 'none',
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto'
    };

    if (style === 'retro-90s') {
      return {
        ...baseStyle,
        fontFamily: 'monospace',
        background: 'linear-gradient(transparent, #000)',
        borderTop: '2px solid #333'
      };
    } else if (style === 'retro-00s') {
      return {
        ...baseStyle,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
        backdropFilter: 'blur(2px)'
      };
    }

    return baseStyle;
  };

  const getButtonStyle = (active = false): React.CSSProperties => {
    const backgroundColor = active 
      ? (style === 'retro-90s' ? '#333' : 'rgba(255,255,255,0.2)')
      : 'transparent';

    return {
      background: backgroundColor,
      border: style === 'retro-90s' ? '1px solid #666' : 'none',
      color: 'white',
      padding: style === 'retro-90s' ? '6px 8px' : '8px',
      cursor: 'pointer',
      fontSize: style === 'retro-90s' ? '12px' : '16px',
      fontFamily: style === 'retro-90s' ? 'monospace' : 'inherit',
      borderRadius: style === 'retro-90s' ? '0' : '4px',
      minWidth: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };
  };

  const getProgressStyle = (): React.CSSProperties => ({
    flex: 1,
    height: style === 'retro-90s' ? '8px' : '6px',
    backgroundColor: style === 'retro-90s' ? '#333' : 'rgba(255,255,255,0.3)',
    border: style === 'retro-90s' ? '1px solid #666' : 'none',
    borderRadius: style === 'retro-90s' ? '0' : '3px',
    position: 'relative',
    cursor: 'pointer'
  });

  const getProgressFillStyle = (): React.CSSProperties => {
    const percentage = playerState.duration > 0 ? (playerState.currentTime / playerState.duration) * 100 : 0;
    
    return {
      width: `${percentage}%`,
      height: '100%',
      backgroundColor: style === 'retro-90s' ? '#0f0' : '#fff',
      borderRadius: style === 'retro-90s' ? '0' : '3px',
      transition: isDragging ? 'none' : 'width 0.1s ease'
    };
  };

  const getVolumeStyle = (): React.CSSProperties => ({
    width: '60px',
    height: style === 'retro-90s' ? '6px' : '4px',
    backgroundColor: style === 'retro-90s' ? '#333' : 'rgba(255,255,255,0.3)',
    border: style === 'retro-90s' ? '1px solid #666' : 'none',
    borderRadius: style === 'retro-90s' ? '0' : '2px',
    position: 'relative',
    cursor: 'pointer'
  });

  const getVolumeFillStyle = (): React.CSSProperties => {
    const volume = playerState.muted ? 0 : playerState.volume;
    
    return {
      width: `${volume * 100}%`,
      height: '100%',
      backgroundColor: style === 'retro-90s' ? '#0f0' : '#fff',
      borderRadius: style === 'retro-90s' ? '0' : '2px'
    };
  };

  // Iconos según el estilo
  const getPlayIcon = () => {
    if (style === 'retro-90s') {
      return playerState.isPlaying ? '[||]' : '[>]';
    }
    return playerState.isPlaying ? '⏸️' : '▶️';
  };

  const getVolumeIcon = () => {
    if (style === 'retro-90s') {
      return playerState.muted ? '[X]' : '[♪]';
    }
    if (playerState.muted) return '🔇';
    if (playerState.volume > 0.7) return '🔊';
    if (playerState.volume > 0.3) return '🔉';
    return '🔈';
  };

  const controlsClasses = [
    'video-controls',
    `video-controls-${style}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={controlsClasses} style={getControlsStyle()}>
      {/* Botón Play/Pause */}
      <button
        onClick={handlePlayPause}
        style={getButtonStyle(playerState.isPlaying)}
        title={playerState.isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {getPlayIcon()}
      </button>

      {/* Tiempo actual */}
      <span style={{ minWidth: '45px', textAlign: 'center' }}>
        {formatTime(playerState.currentTime)}
      </span>

      {/* Barra de progreso */}
      <div
        ref={progressRef}
        style={getProgressStyle()}
        onMouseDown={handleProgressMouseDown}
        title="Buscar"
      >
        <div style={getProgressFillStyle()} />
        
        {/* Indicador de buffer */}
        {playerState.buffered && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              backgroundColor: style === 'retro-90s' ? '#666' : 'rgba(255,255,255,0.5)',
              width: playerState.buffered.length > 0 
                ? `${(playerState.buffered.end(playerState.buffered.length - 1) / playerState.duration) * 100}%`
                : '0%'
            }}
          />
        )}
      </div>

      {/* Tiempo total */}
      <span style={{ minWidth: '45px', textAlign: 'center' }}>
        {formatTime(playerState.duration)}
      </span>

      {/* Botón de volumen */}
      <button
        onClick={handleVolumeToggle}
        style={getButtonStyle(playerState.muted)}
        title={playerState.muted ? 'Activar sonido' : 'Silenciar'}
      >
        {getVolumeIcon()}
      </button>

      {/* Barra de volumen */}
      <div
        ref={volumeRef}
        style={getVolumeStyle()}
        onMouseDown={handleVolumeMouseDown}
        title="Volumen"
      >
        <div style={getVolumeFillStyle()} />
      </div>

      {/* Indicador de calidad */}
      {style !== 'retro-90s' && (
        <span style={{ fontSize: '12px', opacity: 0.7 }}>
          {playerState.quality.toUpperCase()}
        </span>
      )}

      {/* Loading indicator */}
      {playerState.isLoading && (
        <span style={{ fontSize: '12px', opacity: 0.8 }}>
          {style === 'retro-90s' ? '...' : '⏳'}
        </span>
      )}
    </div>
  );
};

export default VideoControls;