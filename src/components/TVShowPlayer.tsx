// Wrapper para adaptar TVShow a VideoStreamManager
import { useState, useEffect, useCallback, useRef } from 'react';
import type { TVShow, TVSeason, TVEpisode } from '../types/show.types';
import { getEpisodeFileNames } from '../utils/episodeFiles';
import { groupEpisodesIntoBlocks, parseDurationToSeconds } from '../utils/episodeBlocks';
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

// Referencia mutable a la "lista de partes" del episodio actualmente en
// reproducción (relevante para episodios multi-parte tipo "01a"+"01b", donde
// ambos segmentos deben reproducirse en secuencia como si fueran un único
// episodio).
interface PartsPlaylist {
  season: TVSeason;
  parts: TVEpisode[];
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

  // Lista de partes del episodio actual (1 elemento si es un episodio
  // normal; 2-3 si es un episodio multi-parte tipo "01a"+"01b"+"01c").
  const playlistRef = useRef<PartsPlaylist | null>(null);
  // Función para limpiar el listener 'ended' actualmente adjunto al <video>
  const endedListenerCleanupRef = useRef<(() => void) | null>(null);

  console.log('🎮 [TVShowPlayer] Show:', show?.name, '| Season:', seasonNumber);

  // Adjunta un listener 'ended' al elemento <video> inyectado por
  // VideoStreamManager (vive en el mismo documento/renderer, ya que
  // `executeJavaScript` corre en el mismo contexto de página) para avanzar
  // automáticamente a la siguiente parte cuando un segmento termina.
  const attachEndedListenerForAutoAdvance = useCallback((totalParts: number, partIndex: number, onEnded: () => void) => {
    if (endedListenerCleanupRef.current) {
      endedListenerCleanupRef.current();
      endedListenerCleanupRef.current = null;
    }

    if (partIndex + 1 >= totalParts) return; // era la última parte, no hay nada que encadenar

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~4s buscando el elemento de video recién creado

    const tryAttach = () => {
      if (cancelled) return;
      const video = document.getElementById('vsm-main-video') as HTMLVideoElement | null;
      if (video) {
        const handleEnded = () => {
          console.log('🔁 [TVShowPlayer] Parte finalizada, avanzando a la siguiente parte del episodio...');
          onEnded();
        };
        video.addEventListener('ended', handleEnded);
        endedListenerCleanupRef.current = () => {
          video.removeEventListener('ended', handleEnded);
        };
        return;
      }
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryAttach, 100);
      }
    };

    tryAttach();

    // Envolver la limpieza para también cancelar la búsqueda si el
    // componente cambia de episodio antes de que el <video> llegue a existir.
    const cleanupBeforeFound = () => { cancelled = true; };
    const previousCleanup = endedListenerCleanupRef.current;
    endedListenerCleanupRef.current = () => {
      cleanupBeforeFound();
      if (previousCleanup) previousCleanup();
    };
  }, []);

  // Reproduce una parte específica (por índice) del episodio actualmente
  // resuelto en `playlistRef`. `localSeekSeconds` es el punto de inicio
  // DENTRO de esa parte (no acumulado con las partes anteriores).
  const playPart = useCallback(async (partIndex: number, localSeekSeconds: number) => {
    const playlist = playlistRef.current;
    if (!playlist || !playlist.parts[partIndex]) {
      return;
    }

    const { season, parts } = playlist;
    const part = parts[partIndex];

    try {
      setIsLoading(true);
      setError('');
      setIsTranscoding(false);
      setTranscodingProgress('');
      setPlaybackStarting(false);

      const allPaths: string[] = [];
      if (season.contentPath) allPaths.push(season.contentPath);
      if (season.contentPaths) allPaths.push(...season.contentPaths);

      const fileNames = getEpisodeFileNames(part);
      const fullPath = (allPaths.length > 0 && fileNames.length > 0)
        ? await window.electronAPI.resolveEpisodeFile(allPaths, fileNames, season.season)
        : null;

      if (!fullPath) {
        console.warn(`⚠️ [TVShowPlayer] No se encontró el archivo de la parte ${partIndex + 1}/${parts.length}: ${part.title}`);
        throw new Error('Este episodio no está disponible actualmente. Verifica que el archivo se encuentre en alguna de las carpetas configuradas.');
      }

      console.log(`📺 [TVShowPlayer] Reproduciendo parte ${partIndex + 1}/${parts.length}: ${part.title}`);
      console.log(`📁 [TVShowPlayer] Archivo:`, fullPath);
      console.log(`   - Seek local: ${localSeekSeconds}s`);

      // Verificar si es un formato que necesita transcoding (todo lo que no
      // sea nativamente reproducible por Chromium: mp4/webm/ogg/ogv)
      const extension = fullPath.split('.').pop()?.toLowerCase();
      const NATIVE_EXTENSIONS = ['mp4', 'webm', 'ogg', 'ogv'];
      if (extension && !NATIVE_EXTENSIONS.includes(extension)) {
        setIsTranscoding(true);
        setTranscodingProgress('Iniciando conversión...');
      }

      if (!window.electronAPI?.testVideoStreamManager) {
        throw new Error('VideoStreamManager API no disponible');
      }

      setPlaybackStarting(true);

      await window.electronAPI.testVideoStreamManager({
        filePath: fullPath,
        seekTime: Math.max(0, Math.floor(localSeekSeconds)),
        autoPlay: true,
        crtFilter: crtFilter
      });

      console.log('✅ [TVShowPlayer] Reproducción iniciada exitosamente');
      setIsLoading(false);
      setIsTranscoding(false);

      // Si el episodio tiene más de una parte, encadenar automáticamente la
      // siguiente cuando esta termine (ej. "01a" -> "01b").
      attachEndedListenerForAutoAdvance(parts.length, partIndex, () => {
        playPart(partIndex + 1, 0);
      });

    } catch (error) {
      console.error('❌ [TVShowPlayer] Error en reproducción:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setIsLoading(false);
      setIsTranscoding(false);
      setPlaybackStarting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crtFilter, attachEndedListenerForAutoAdvance]);

  // Función principal: resuelve qué episodio corresponde reproducir (con
  // fallback a otro episodio disponible si el programado no tiene archivo),
  // arma la lista de partes si es un episodio multi-segmento, y comienza la
  // reproducción desde la parte y el segundo local que correspondan según
  // `seekTimeSeconds`.
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
      console.log('🎭 [TVShowPlayer] DETALLES DE REPRODUCCIÓN:');
      console.log(`   - Show: ${show.name}`);
      console.log(`   - Show ID: ${show.id}`);
      console.log(`   - Canales asignados: [${show.channel.join(', ')}]`);
      console.log(`   - Temporada solicitada: ${seasonNumber}`);
      console.log(`   - Temporada/episodio solicitados por programación: T${seasonNumber}E${episodeNumber ?? '(primero)'}`);

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
      const MAX_ATTEMPTS = 80; // límite de seguridad para no iterar catálogos enormes
      let attempts = 0;
      let resolved: { season: TVSeason; episode: TVEpisode; fullPath: string } | null = null;

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

      const { season, episode } = resolved;
      // Si no se especificó un episodio concreto (sin datos de programación),
      // no se considera "fallback" simplemente por no coincidir con `undefined`.
      const usedFallback = season !== requestedSeason || (episodeNumber !== undefined && episode.episode !== episodeNumber);

      console.log('📺 [TVShowPlayer] EPISODIO SELECCIONADO:');
      console.log(`   - Temporada usada: ${season.season} (año: ${season.year})${usedFallback ? ' [FALLBACK: el episodio programado no estaba disponible]' : ''}`);
      console.log(`   - Episodio: ${episode.episode} - ${episode.title}`);
      console.log(`   - Duración: ${episode.duration}`);

      // Determinar si el episodio resuelto forma parte de un bloque
      // multi-segmento (ej. "01a"+"01b" son la misma "episodio" real). Solo
      // se arma la secuencia cuando NO hubo fallback, para no complicar el
      // camino de sustitución de episodios no disponibles.
      let parts: TVEpisode[] = [episode];
      if (!usedFallback) {
        const blocks = groupEpisodesIntoBlocks(season.episodes);
        const ownerBlock = blocks.find(block => block.parts.some(p => p.episode === episode.episode));
        if (ownerBlock && ownerBlock.parts.length > 1) {
          parts = ownerBlock.parts;
          console.log(`   - Episodio multi-parte detectado: ${parts.length} segmentos (${parts.map(p => p.title).join(' / ')})`);
        }
      }

      playlistRef.current = { season, parts };

      // Determinar en qué parte (y con qué desplazamiento local) cae el
      // seekTime acumulado calculado por la programación real.
      let startPartIndex = 0;
      let localSeek = 0;

      if (!usedFallback) {
        if (parts.length > 1) {
          let remaining = Math.max(0, seekTimeSeconds);
          for (let i = 0; i < parts.length; i++) {
    const partDuration = parseDurationToSeconds(parts[i].duration);
    if (remaining < partDuration || i === parts.length - 1) {
      startPartIndex = i;
      localSeek = Math.min(remaining, partDuration);
      break;
    }
            remaining -= partDuration;
          }
        } else {
          localSeek = seekTimeSeconds;
        }
      }
      // Si hubo fallback, se reproduce desde el inicio (localSeek = 0, startPartIndex = 0)

      await playPart(startPartIndex, localSeek);

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
  }, [show, seasonNumber, episodeNumber, playPart]);

  // Efecto para limpiar y reproducir cuando cambien las props principales
  useEffect(() => {
    // Limpiar estado anterior cuando cambie el show o season
    setIsLoading(true);
    setError('');
    setIsTranscoding(false);
    setTranscodingProgress('');
    setPlaybackStarting(false);

    // Cancelar cualquier listener de auto-avance de parte pendiente
    if (endedListenerCleanupRef.current) {
      endedListenerCleanupRef.current();
      endedListenerCleanupRef.current = null;
    }
    playlistRef.current = null;

    // Limpiar video anterior si existe
    if (window.electronAPI?.stopVideoStreamManager) {
      window.electronAPI.stopVideoStreamManager().catch(console.error);
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

  // Limpiar el listener de auto-avance al desmontar el componente
  useEffect(() => {
    return () => {
      if (endedListenerCleanupRef.current) {
        endedListenerCleanupRef.current();
        endedListenerCleanupRef.current = null;
      }
    };
  }, []);

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

  // La vista de TV mantiene el `#video-container` SIEMPRE montado: es el destino
  // donde VideoStreamManager inyecta el <video> desde el proceso principal vía
  // `executeJavaScript`. Los estados de carga y error se renderizan como overlays
  // absolutos ENCIMA del contenedor (nunca reemplazándolo), de modo que el script
  // inyectado siempre encuentre `#video-container` en cuanto arranca.
  //
  // ANTES: durante la carga/error el contenedor se desmontaba y el script del
  // proceso principal (que espera `#video-container` con un poll de ~1s) fallaba:
  // al encadenar episodios multi-parte (ej. Bob Esponja "20a" -> "20b") el nodo se
  // volvía a montar cuando el poll ya había terminado y la pantalla quedaba en negro.
  const is90s = style === 'retro-90s';

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
          color: is90s ? '#00ff00' : '#00ccff',
          fontFamily: is90s ? 'monospace' : 'sans-serif',
          textShadow: is90s ? '0 0 10px #00ff00' : '0 0 8px rgba(0, 204, 255, 0.6)'
        }}
      >
        <p className={playbackStarting ? 'starting-playback' : ''}>
          {is90s ? '📺 INICIANDO REPRODUCCION...' : '📺 Iniciando reproducción...'}
        </p>
      </div>

      {/* Overlay de carga (encima del video-container, sin desmontarlo) */}
      {isLoading && (
        <div
          className={is90s ? 'loading-90s' : 'loading-00s'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10
          }}
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
      )}

      {/* Overlay de error (encima del video-container, sin desmontarlo) */}
      {!isLoading && error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a0000',
            color: '#ff4444',
            fontFamily: is90s ? 'monospace' : 'sans-serif',
            padding: '20px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>
            {is90s ? '❌ ERROR' : '⚠️ Error'}
          </div>
          <div style={{ marginBottom: '16px' }}>
            {error}
          </div>
          <button
            onClick={playShow}
            style={{
              padding: '8px 16px',
              backgroundColor: is90s ? '#333' : 'rgba(255,255,255,0.1)',
              border: is90s ? '1px solid #666' : '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              cursor: 'pointer',
              fontFamily: is90s ? 'monospace' : 'inherit',
              fontSize: '12px'
            }}
          >
            {is90s ? '[REINTENTAR]' : 'Reintentar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TVShowPlayer;
