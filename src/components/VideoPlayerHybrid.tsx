import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/video-player.css';

interface VideoPlayerHybridProps {
  src?: string;
  playing?: boolean;
  onCanPlay?: () => void;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
  currentTime?: number;
  volume?: number;
  muted?: boolean;
}

const VideoPlayerHybrid: React.FC<VideoPlayerHybridProps> = ({ 
  src, 
  // playing = false, // No usado
  onCanPlay,
  onError,
  // onTimeUpdate, // No usado
  // onDurationChange, // No usado
  // onEnded, // No usado
  // currentTime, // No usado
  // volume = 1, // No usado
  // muted = false // No usado
}) => {
  const [vlcProcessId, setVlcProcessId] = useState<string>('');
  const [isVlcReady, setIsVlcReady] = useState(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  // const [vlcControls, setVlcControls] = useState<any>(null); // No usado
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Función para limpiar VLC
  const cleanupVLC = useCallback(async () => {
    if (vlcProcessId) {
      try {
        await (window as any).electronAPI?.closeVLCEmbedded?.(vlcProcessId);
        setVlcProcessId('');
        setIsVlcReady(false);
        // setVlcControls(null); // No usado
      } catch (error) {
        console.error('Error cerrando VLC:', error);
      }
    }
  }, [vlcProcessId]);

  // Función para inicializar VLC
  const initializeVLC = useCallback(async (videoPath: string) => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log('🎬 [VideoPlayerHybrid] Inicializando VLC para:', videoPath);
      
      // Verificar instalación de VLC
      const vlcCheck = await (window as any).electronAPI?.checkVLCInstallation?.();
      if (!vlcCheck?.installed) {
        throw new Error('VLC no está instalado en el sistema');
      }

      // Obtener ruta real del archivo
      const realPath = await (window as any).electronAPI?.getLocalFilePath?.(videoPath);
      if (!realPath) {
        throw new Error('No se pudo obtener la ruta del archivo');
      }

      console.log('📁 [VideoPlayerHybrid] Ruta real del archivo:', realPath);

      // Lanzar VLC embebido
      const vlcConfig = {
        filePath: realPath,
        port: 8080,
        password: 'vlc123'
      };

      const result = await (window as any).electronAPI?.launchVLCEmbedded?.(vlcConfig);
      
      if (result?.success) {
        setVlcProcessId(result.processId);
        setIsVlcReady(true);
        setIsLoading(false);
        console.log('✅ [VideoPlayerHybrid] VLC lanzado exitosamente');
        onCanPlay?.();
      } else {
        throw new Error('No se pudo lanzar VLC');
      }

    } catch (error) {
      console.error('❌ [VideoPlayerHybrid] Error inicializando VLC:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    }
  }, [onCanPlay, onError]);

  // Efecto para manejar cambios en src
  useEffect(() => {
    if (!src) {
      cleanupVLC();
      return;
    }

    // Limpiar VLC anterior si existe
    if (vlcProcessId) {
      cleanupVLC().then(() => {
        // Inicializar nuevo VLC después de limpiar
        setTimeout(() => initializeVLC(src), 1000);
      });
    } else {
      initializeVLC(src);
    }

    return () => {
      cleanupVLC();
    };
  }, [src, initializeVLC, cleanupVLC, vlcProcessId]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      cleanupVLC();
    };
  }, [cleanupVLC]);

  if (!src) {
    return (
      <div className="video-player-hybrid no-video" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        backgroundColor: '#000',
        color: 'white',
        fontSize: '18px'
      }}>
        <div>
          <p>📺 No hay video seleccionado</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-player-hybrid error" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        backgroundColor: '#000',
        color: '#ff6b6b',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h3>❌ Error de Reproducción</h3>
          <p>{error}</p>
          <button 
            onClick={() => {
              setError('');
              if (src) initializeVLC(src);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4ecdc4',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="video-player-hybrid loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        backgroundColor: '#000',
        color: 'white',
        fontSize: '16px'
      }}>
        <div>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎬</div>
          <p>Iniciando reproductor VLC...</p>
          <p style={{ fontSize: '14px', opacity: 0.7 }}>
            Configurando interfaz HTTP en puerto 8080
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player-hybrid vlc-native" style={{
      position: 'relative',
      width: '100%',
      height: '400px',
      backgroundColor: '#000'
    }}>
      {isVlcReady && (
        <>
          <iframe
            ref={iframeRef}
            src="http://localhost:8080"
            width="100%"
            height="100%"
            style={{
              border: 'none',
              backgroundColor: '#000'
            }}
            title="VLC Media Player"
          />
          
          {/* Información del video */}
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '12px',
            zIndex: 10
          }}>
            🎥 VLC Player Nativo - Puerto 8080
          </div>
        </>
      )}
    </div>
  );
};

export default VideoPlayerHybrid;