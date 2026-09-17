// Wrapper para adaptar TVShow a VideoStreamManager
import { useState, useEffect, useCallback } from 'react';
import type { TVShow } from '../types/show.types';
import { getEpisodeFileNames } from '../utils/episodeFiles';
import '../styles/loading-animations.css';

interface TVShowPlayerProps {
  show?: TVShow;
  seasonNumber?: number;
  episodeNumber?: number;      // Episodio específico a reproducir (por defecto: el primero de la temporada)
  seekTimeSeconds?: number;    // Segundos desde el inicio del episodio para reanudar la reproducción (según la programación real)
  style?: 'retro-90s' | 'retro-00s' | 'modern';
  className?: string;
  crtFilter?: boolean;
  volume?: number;  // 0-100
  muted?: boolean;
}

export const TVShowPlayer: React.FC<TVShowPlayerProps> = ({
  show,
  seasonNumber = 1,
  episodeNumber,
  seekTimeSeconds = 0,
  style = 'retro-90s',
  className = '',
  crtFilter = false,
  volume = 100,
  muted = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodingProgress, setTranscodingProgress] = useState<string>('');
  const [playbackStarting, setPlaybackStarting] = useState(false);
  
  console.log('🎮 [TVShowPlayer] Show:', show?.name, '| Season:', seasonNumber);

  // Función para reproducir el show usando VideoStreamManager
  const playShow = useCallback(async () => {
    if (!show) {
      setError('No hay show seleccionado');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setIsTranscoding(false);
      setTranscodingProgress('');
      setPlaybackStarting(false);

      console.log('🎬 [TVShowPlayer] Iniciando reproducción:', show.name);
      
      // LOGS DETALLADOS PARA DEBUG
      console.log('🎭 [TVShowPlayer] DETALLES DE REPRODUCCIÓN:');
      console.log(`   - Show: ${show.name}`);
      console.log(`   - Show ID: ${show.id}`);
      console.log(`   - Canales asignados: [${show.channel.join(', ')}]`);
      console.log(`   - Temporada solicitada: ${seasonNumber}`);

      // Encontrar la temporada solicitada (la que indica la programación real)
      const requestedSeason = show.seasons.find(s => s.season === seasonNumber) || show.seasons[0];
      if (!requestedSeason || !requestedSeason.episodes.length) {
        throw new Error('No se encontraron episodios para esta temporada');
      }

      // Intentar resolver el episodio exacto indicado por la programación;
      // si su carpeta de contenido no existe o no tiene el archivo, buscar
      // CUALQUIER otro episodio del mismo show (en cualquier temporada) que sí
      // tenga un archivo disponible, en vez de detener la reproducción con un
      // error. Esto evita quedarse "atascado" cuando solo algunas temporadas
      // tienen su carpeta de contenido configurada.
      console.log(`   - Temporada/episodio solicitados por programación: T${seasonNumber}E${episodeNumber ?? '(primero)'}`);

      const MAX_ATTEMPTS = 80; // límite de seguridad para no iterar catálogos enormes
      let attempts = 0;
      let resolved: { season: typeof requestedSeason; episode: typeof requestedSeason.episodes[number]; fullPath: string } | null = null;

      // Orden de temporadas a probar: primero la solicitada, luego el resto
      const orderedSeasons = [
        requestedSeason,
        ...show.seasons.filter(s => s !== requestedSeason)
      ];

      for (const season of orderedSeasons) {
        if (resolved || attempts >= MAX_ATTEMPTS) break;
        if (!season.episodes || season.episodes.length === 0) continue;

        const allPaths: string[] = [];
        if (season.contentPath) allPaths.push(season.contentPath);
        if (season.contentPaths) allPaths.push(...season.contentPaths);
        if (allPaths.length === 0) continue; // Sin carpetas configuradas, saltar esta temporada

        // Dentro de la temporada solicitada, probar primero el episodio exacto
        const orderedEpisodes = (season === requestedSeason && episodeNumber !== undefined)
          ? [
              ...season.episodes.filter(e => e.episode === episodeNumber),
              ...season.episodes.filter(e => e.episode !== episodeNumber)
            ]
          : season.episodes;

        for (const candidateEpisode of orderedEpisodes) {
          if (attempts >= MAX_ATTEMPTS) break;
          const candidateFileNames = getEpisodeFileNames(candidateEpisode);
          if (candidateFileNames.length === 0) continue;
          attempts++;

          const candidatePath = await window.electronAPI.resolveEpisodeFile(allPaths, candidateFileNames, season.season);
          if (candidatePath) {
            resolved = { season, episode: candidateEpisode, fullPath: candidatePath };
            break;
          }
        }
      }

      if (!resolved) {
        console.warn('⚠️ [TVShowPlayer] No se encontró ningún episodio disponible para este show en ninguna carpeta configurada.');
        // No mostramos el popup intrusivo de VideoStreamManager: usamos el estado
        // de error propio del componente, que es más discreto y consistente con la UI.
        throw new Error('Este episodio no está disponible actualmente. Verifica que el archivo se encuentre en alguna de las carpetas configuradas.');
      }

      const { season, episode, fullPath } = resolved;
      // Si no se especificó un episodio concreto (sin datos de programación),
      // no se considera "fallback" simplemente por no coincidir con `undefined`.
      const usedFallback = season !== requestedSeason || (episodeNumber !== undefined && episode.episode !== episodeNumber);

      console.log('📺 [TVShowPlayer] EPISODIO SELECCIONADO:');
      console.log(`   - Temporada usada: ${season.season} (año: ${season.year})${usedFallback ? ' [FALLBACK: el episodio programado no estaba disponible]' : ''}`);
      console.log(`   - Episodio: ${episode.episode} - ${episode.title}`);
      console.log(`   - Duración: ${episode.duration}`);
      console.log(`   - Archivo: ${getEpisodeFileNames(episode).join(', ')}`);
      console.log(`   - Seek time (según programación): ${usedFallback ? 0 : seekTimeSeconds}s`);
      console.log('📁 [TVShowPlayer] Archivo encontrado en:', fullPath);

      // Si tuvimos que usar un episodio distinto al programado (fallback), no
      // tiene sentido aplicar el seekTime calculado para el episodio original.
      const effectiveSeekTime = usedFallback ? 0 : seekTimeSeconds;

      // Verificar si es un formato que necesita transcoding (todo lo que no
      // sea nativamente reproducible por Chromium: mp4/webm/ogg/ogv)
      const extension = fullPath.split('.').pop()?.toLowerCase();
      const NATIVE_EXTENSIONS = ['mp4', 'webm', 'ogg', 'ogv'];
      if (extension && !NATIVE_EXTENSIONS.includes(extension)) {
        setIsTranscoding(true);
        setTranscodingProgress('Iniciando conversión...');
      }

      // Usar VideoStreamManager a través de la API de Electron
      if (!(window as any).electronAPI?.testVideoStreamManager) {
        throw new Error('VideoStreamManager API no disponible');
      }

      // Marcar que la reproducción está iniciando
      setPlaybackStarting(true);

      await (window as any).electronAPI.testVideoStreamManager({
        filePath: fullPath,
        seekTime: Math.max(0, Math.floor(effectiveSeekTime)),
        autoPlay: true,
        crtFilter: crtFilter  // Pasar la configuración CRT
      });

      console.log('✅ [TVShowPlayer] Reproducción iniciada exitosamente');
      setIsLoading(false);
      setIsTranscoding(false);

    } catch (error) {
      console.error('❌ [TVShowPlayer] Error en reproducción:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setIsLoading(false);
      setIsTranscoding(false);
      setPlaybackStarting(false);
    }
    // Nota: `seekTimeSeconds` se lee dentro de la función pero se omite
    // deliberadamente de las dependencias para no reiniciar la reproducción
    // en cada actualización periódica del progreso (solo se usa como valor
    // inicial al arrancar un episodio nuevo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, seasonNumber, episodeNumber]);

  // Efecto para limpiar y reproducir cuando cambien las props principales
  useEffect(() => {
    // Limpiar estado anterior cuando cambie el show o season
    setIsLoading(true);
    setError('');
    setIsTranscoding(false);
    setTranscodingProgress('');
    setPlaybackStarting(false);
    
    // Limpiar video anterior si existe
    if ((window as any).electronAPI?.stopVideoStreamManager) {
      (window as any).electronAPI.stopVideoStreamManager().catch(console.error);
    }
    
    // Dar un momento para la limpieza y luego reproducir
    const timer = setTimeout(() => {
      playShow();
    }, 100);
    
    return () => clearTimeout(timer);
    // Solo reiniciar la reproducción cuando cambie el show, la temporada o el
    // episodio (no en cada actualización de `seekTimeSeconds`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, seasonNumber, episodeNumber]);

  // Efecto separado para manejar solo el cambio de filtro CRT sin reiniciar video
  useEffect(() => {
    // Solo aplicar/remover la clase CRT al video existente
    const applyFilterToExistingVideo = async () => {
      try {
        const script = `
          (() => {
            const video = document.querySelector('#vsm-main-video');
            if (video) {
              if (${crtFilter}) {
                video.classList.add('crt-filter');
                console.log('🎨 [CRT] Filtro aplicado a video existente');
              } else {
                video.classList.remove('crt-filter');
                console.log('🎨 [CRT] Filtro removido de video existente');
              }
              return { success: true, hasVideo: true };
            }
            return { success: true, hasVideo: false };
          })();
        `;
        
        if ((window as any).electronAPI?.executeScript) {
          const result = await (window as any).electronAPI.executeScript(script);
          console.log('🎨 [TVShowPlayer] CRT filter toggle result:', result);
        }
      } catch {
        console.log('🎨 [TVShowPlayer] No video element to apply CRT filter to yet');
      }
    };

    // Solo ejecutar si no estamos cargando (es decir, hay un video ya reproduciendo)
    if (!isLoading && !error) {
      applyFilterToExistingVideo();
    }
  }, [crtFilter, isLoading, error]); // Solo cuando cambie el filtro CRT

  // Efecto separado para aplicar volumen/mute al video existente sin reiniciar la reproducción
  // (usado por el control remoto simulado y el ajuste de volumen del menú)
  useEffect(() => {
    const applyVolumeToExistingVideo = async () => {
      try {
        const clampedVolume = Math.max(0, Math.min(100, volume)) / 100;
        const script = `
          (() => {
            const video = document.querySelector('#vsm-main-video');
            if (video) {
              video.volume = ${clampedVolume};
              video.muted = ${muted};
              return { success: true, hasVideo: true };
            }
            return { success: true, hasVideo: false };
          })();
        `;

        if ((window as any).electronAPI?.executeScript) {
          await (window as any).electronAPI.executeScript(script);
        }
      } catch {
        console.log('🔊 [TVShowPlayer] No video element to apply volume to yet');
      }
    };

    if (!isLoading && !error) {
      applyVolumeToExistingVideo();
    }
  }, [volume, muted, isLoading, error]);

  // Escuchar eventos de progreso de transcodificación y completado
  useEffect(() => {
    if (!(window as any).electronAPI?.ipcRenderer) return;

    const handleTranscodingProgress = (_event: any, data: { time: string; message: string }) => {
      console.log('🔄 [TVShowPlayer] Progreso transcoding:', data);
      if (isTranscoding) {
        setTranscodingProgress(data.message || `Progreso: ${data.time}`);
      }
    };

    const handleTranscodingComplete = (_event: any, data: { success: boolean; message: string }) => {
      console.log('✅ [TVShowPlayer] Transcoding completado:', data);
      if (data.success) {
        setIsTranscoding(false);
        setTranscodingProgress('');
        setPlaybackStarting(true); // Cambiar a estado de "iniciando reproducción"
        
        // Dar un poco de tiempo para que se inicie el video y luego ocultar el loading
        setTimeout(() => {
          setIsLoading(false);
          setPlaybackStarting(false);
        }, 2000);
      }
    };

    (window as any).electronAPI.ipcRenderer.on('transcoding-progress', handleTranscodingProgress);
    (window as any).electronAPI.ipcRenderer.on('transcoding-complete', handleTranscodingComplete);

    return () => {
      if ((window as any).electronAPI?.ipcRenderer) {
        (window as any).electronAPI.ipcRenderer.removeListener('transcoding-progress', handleTranscodingProgress);
        (window as any).electronAPI.ipcRenderer.removeListener('transcoding-complete', handleTranscodingComplete);
      }
    };
  }, [isTranscoding]);

  // Renderizar estado de carga
  if (isLoading) {
    const is90s = style === 'retro-90s';
    
    return (
      <div 
        className={`tv-show-player loading ${className} ${is90s ? 'loading-90s' : 'loading-00s'}`}
      >
        {is90s ? (
          // Estilo 90s - SPINNER LIMPIO SIN CUADROS
          <>
            <div className="loading-90s-text">
              {isTranscoding ? '🔄 CONVIRTIENDO VIDEO...' : '🔄 CARGANDO...'}
            </div>
            
            {show && (
              <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '15px', color: '#00ff00' }}>
                {show.name} - Temporada {seasonNumber}
              </div>
            )}
            
            {/* SPINNER ESTILO 90s */}
            <div className="loading-spinner-90s"></div>
            
            {isTranscoding && (
              <div className="transcoding-progress-90s">
                {transcodingProgress || 'Convirtiendo formato de video...'}
              </div>
            )}
          </>
        ) : (
          // Estilo 2000s
          <>
            <div className="loading-00s-text">
              {isTranscoding ? '🔄 Convirtiendo video...' : '🔄 Cargando...'}
            </div>
            
            {show && (
              <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '15px', color: '#00ccff' }}>
                {show.name} - Temporada {seasonNumber}
              </div>
            )}
            
            <div className="loading-spinner-00s"></div>
            
            {isTranscoding && (
              <div className="transcoding-progress-00s">
                {transcodingProgress || 'Procesando formato de video...'}
              </div>
            )}
            
            {!isTranscoding && (
              <div className="progress-bar-container">
                <div className="progress-bar-00s"></div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Renderizar estado de error
  if (error) {
    return (
      <div 
        className={`tv-show-player error ${className}`}
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
          onClick={playShow}
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

  // Renderizar contenedor de video (el VideoStreamManager maneja la renderización del video)
  return (
    <div 
      className={`tv-show-player ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    >
      {/* Container donde el VideoStreamManager inyectará el video */}
      <div 
        id="video-container"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: style === 'retro-90s' ? '#00ff00' : '#00ccff',
          fontFamily: style === 'retro-90s' ? 'monospace' : 'sans-serif',
          textShadow: style === 'retro-90s' ? '0 0 10px #00ff00' : '0 0 8px rgba(0, 204, 255, 0.6)'
        }}
      >
        <p className={playbackStarting ? 'starting-playback' : ''}>
          {style === 'retro-90s' ? '📺 INICIANDO REPRODUCCION...' : '📺 Iniciando reproducción...'}
        </p>
      </div>
    </div>
  );
};

export default TVShowPlayer;