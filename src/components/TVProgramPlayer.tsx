// Wrapper para adaptar TVProgram a diferentes reproductores
import { useState, useEffect, useCallback } from 'react';
import VideoPlayerHybrid from './VideoPlayerHybrid';
import type { TVProgram } from '../types/program.types';

interface TVProgramPlayerProps {
  program?: TVProgram;
  seasonNumber?: number;
  style?: 'retro-90s' | 'retro-00s' | 'modern';
  className?: string;
}

export const TVProgramPlayer: React.FC<TVProgramPlayerProps> = ({
  program,
  seasonNumber = 1,
  style = 'retro-90s',
  className = ''
}) => {
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  console.log('🎮 [TVProgramPlayer] Programa:', program?.name);

  // Construir src del video desde el programa
  const buildVideoSrc = useCallback(async () => {
    if (!program) {
      setError('No hay programa seleccionado');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      console.log('🎬 [TVProgramPlayer] Construyendo src para:', program.name);

      // Encontrar la temporada
      const season = program.seasons.find(s => s.season === seasonNumber) || program.seasons[0];
      if (!season || !season.episodes.length) {
        throw new Error('No se encontraron episodios para esta temporada');
      }

      // Usar el primer episodio
      const episode = season.episodes[0];
      const contentPath = season.contentPath;
      const fileName = episode.fileName;

      if (!contentPath || !fileName) {
        throw new Error('Ruta de contenido o nombre de archivo no válido');
      }

      // Construir ruta completa
      const fullPath = `${contentPath}\\${fileName}`;
      console.log('📁 [TVProgramPlayer] Ruta completa del video:', fullPath);

      // Obtener ruta local usando Electron API
      const localPath = await (window as any).electronAPI?.getLocalFilePath?.(fullPath);
      
      if (!localPath) {
        throw new Error('No se pudo obtener la ruta local del archivo');
      }

      console.log('✅ [TVProgramPlayer] Ruta local obtenida:', localPath);
      setVideoSrc(localPath);
      setIsLoading(false);

    } catch (error) {
      console.error('❌ [TVProgramPlayer] Error construyendo src:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [program, seasonNumber]);

  // Efecto para construir src cuando cambien las props
  useEffect(() => {
    buildVideoSrc();
  }, [buildVideoSrc]);

  // Manejar errores del reproductor
  const handleVideoError = useCallback((errorMessage: string) => {
    console.error('❌ [TVProgramPlayer] Error en reproductor:', errorMessage);
    setError(`Error de reproducción: ${errorMessage}`);
  }, []);

  // Renderizar estado de carga
  if (isLoading) {
    return (
      <div 
        className={`tv-program-player loading ${className}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          color: 'white',
          fontFamily: style === 'retro-90s' ? 'monospace' : 'sans-serif'
        }}
      >
        <div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>
            {style === 'retro-90s' ? '⬜⬛⬜⬛ CARGANDO...' : '🔄 Cargando...'}
          </div>
          {program && (
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {program.name} - Temporada {seasonNumber}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Renderizar estado de error
  if (error) {
    return (
      <div 
        className={`tv-program-player error ${className}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a0000',
          color: '#ff4444',
          fontFamily: style === 'retro-90s' ? 'monospace' : 'sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>
          {style === 'retro-90s' ? '❌ ERROR' : '⚠️ Error'}
        </div>
        <div style={{ marginBottom: '16px' }}>
          {error}
        </div>
        <button
          onClick={buildVideoSrc}
          style={{
            padding: '8px 16px',
            backgroundColor: style === 'retro-90s' ? '#333' : 'rgba(255,255,255,0.1)',
            border: style === 'retro-90s' ? '1px solid #666' : '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            cursor: 'pointer',
            fontFamily: style === 'retro-90s' ? 'monospace' : 'inherit',
            fontSize: '12px'
          }}
        >
          {style === 'retro-90s' ? '[REINTENTAR]' : 'Reintentar'}
        </button>
      </div>
    );
  }

  // Renderizar reproductor
  if (!videoSrc) {
    return (
      <div 
        className={`tv-program-player no-content ${className}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          color: '#666',
          fontFamily: style === 'retro-90s' ? 'monospace' : 'sans-serif'
        }}
      >
        <div>
          {style === 'retro-90s' ? '📺 SIN CONTENIDO' : '📺 Sin contenido disponible'}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`tv-program-player ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    >
      <VideoPlayerHybrid
        src={videoSrc}
        onError={handleVideoError}
      />
    </div>
  );
};

export default TVProgramPlayer;