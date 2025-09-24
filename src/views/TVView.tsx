import { useEffect, useState } from 'react';
import { TVShowPlayer } from '../components/TVShowPlayer';
import { showManager } from '../features/shows/showManager';
import { channelManager } from '../features/channels/channelManager';
import type { TVShow, TVSeason } from '../types/show.types';
import '../styles/views.css';

interface TVViewProps {
  channelNumber: number;
  decadeStyle?: '90s' | '00s';
}

export function TVView({ channelNumber, decadeStyle = '90s' }: TVViewProps) {
  const [currentShow, setCurrentShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProgram = async () => {
      console.log('🔄 [TVView] Iniciando búsqueda de programa para canal', channelNumber);
      
      try {
        setLoading(true);
        setError(null);
        
        // Inicializar channel manager y show manager
        await Promise.all([
          channelManager.initialize(),
          showManager.initialize()
        ]);
        
        const channelInfo = await channelManager.getChannelInfo(channelNumber);
        console.log('🔍 [TVView] Información del canal:', channelInfo ? {
          id: channelInfo.id,
          nombre: channelInfo.name,
          número: channelInfo.number,
          habilitado: channelInfo.isEnabled
        } : 'No encontrado');
        
        if (!channelInfo) {
          const error = `Canal ${channelNumber} no encontrado`;
          console.log('❌ [TVView]', error);
          setError(error);
          setCurrentShow(null);
          return;
        }

        // Obtener todos los shows y encontrar el que corresponde al canal por nombre
        const shows = await showManager.getShows();
        console.log('📺 [TVView] Shows disponibles:', shows.map(p => ({
          id: p.id,
          nombre: p.name,
          canales: p.channel,
          temporadas: p.seasons.length
        })));
        
        console.log('🔍 [TVView] Buscando show para canal:', channelInfo.name);
        
        const matchingShow = shows.find(show => 
          show.channel.some(ch => ch.toLowerCase() === channelInfo.name.toLowerCase())
        );

        if (matchingShow) {
          console.log('✅ [TVView] Show encontrado:', {
            id: matchingShow.id,
            nombre: matchingShow.name,
            canalesConfigurados: matchingShow.channel,
            temporadas: matchingShow.seasons.length,
            episodiosTotales: matchingShow.seasons.reduce((total, season) => total + season.episodes.length, 0)
          });

          // Verificar si el show tiene episodios disponibles
          const hasAvailableEpisodes = matchingShow.seasons.some(
            (season: TVSeason) => season.episodes.length > 0 && season.contentPath
          );

          if (hasAvailableEpisodes) {
            setCurrentShow(matchingShow);
            
            // TVShowPlayer procesará automáticamente el video
          } else {
            const error = 'El programa no tiene episodios disponibles';
            console.log('❌ [TVView]', error);
            setError(error);
            setCurrentShow(null);
          }
        } else {
          const error = `No se encontró programa para el canal ${channelInfo.name}`;
          console.log('❌ [TVView]', error);
          setError(error);
          setCurrentShow(null);
        }
      } catch (error) {
        console.error('❌ [TVView] Error al cargar programa:', error);
        setError(`Error al cargar programa: ${error instanceof Error ? error.message : String(error)}`);
        setCurrentShow(null);
      } finally {
        setLoading(false);
      }
    };

    loadProgram();
  }, [channelNumber]);

  if (loading) {
    return (
      <div className={`tv-view style-${decadeStyle}`}>
        <div className="loading-message">Cargando programa...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`tv-view style-${decadeStyle}`}>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!currentShow) {
    return (
      <div className={`tv-view style-${decadeStyle}`}>
        <div className="error-message">No hay programas disponibles</div>
      </div>
    );
  }

  return (
    <div className={`tv-view style-${decadeStyle}`}>
      <TVShowPlayer 
        show={currentShow}
        seasonNumber={1}
        style={decadeStyle === '90s' ? 'retro-90s' : 'retro-00s'}
      />
    </div>
  );
}