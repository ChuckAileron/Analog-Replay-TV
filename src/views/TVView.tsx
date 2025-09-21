import { useEffect, useState } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { programManager } from '../features/programs/programManager';
import { channelManager } from '../features/channels/channelManager';
import type { TVProgram, TVSeason } from '../types/program.types';
import { MediaProvider } from '@vidstack/react';
import '../styles/views.css';

interface TVViewProps {
  channelNumber: number;
  decadeStyle?: '90s' | '00s';
}

export function TVView({ channelNumber, decadeStyle = '90s' }: TVViewProps) {
  const [currentProgram, setCurrentProgram] = useState<TVProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSeason, setCurrentSeason] = useState<number>(1);



  useEffect(() => {
    const loadProgram = async () => {
      console.log('🔄 [TVView] Iniciando búsqueda de programa para canal', channelNumber);
      
      try {
        setLoading(true);
        setError(null);
        
        // Inicializar channel manager y program manager
        await Promise.all([
          channelManager.initialize(),
          programManager.initialize()
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
          setCurrentProgram(null);
          return;
        }

        // Obtener todos los programas y encontrar el que corresponde al canal por nombre
        const programs = await programManager.getPrograms();
        console.log('📺 [TVView] Programas disponibles:', programs.map(p => ({
          id: p.id,
          nombre: p.name,
          canales: p.channel,
          temporadas: p.seasons.length
        })));
        
        console.log('🔍 [TVView] Buscando programa para canal:', channelInfo.name);
        
        const matchingProgram = programs.find(program => 
          program.channel.some(ch => ch.toLowerCase() === channelInfo.name.toLowerCase())
        );

        if (matchingProgram) {
          console.log('✅ [TVView] Programa encontrado:', {
            id: matchingProgram.id,
            nombre: matchingProgram.name,
            canalesConfigurados: matchingProgram.channel,
            temporadas: matchingProgram.seasons.length,
            episodiosTotales: matchingProgram.seasons.reduce((total, season) => total + season.episodes.length, 0)
          });

          // Verificar si el programa tiene episodios disponibles
          const hasAvailableEpisodes = matchingProgram.seasons.some(
            (season: TVSeason) => season.episodes.length > 0 && season.contentPath
          );

          if (hasAvailableEpisodes) {
            // Encontrar la primera temporada con episodios disponibles
            const firstAvailableSeason = matchingProgram.seasons.find(
              (season: TVSeason) => season.episodes.length > 0 && season.contentPath
            )?.season ?? 1;

            setCurrentProgram(matchingProgram);
            setCurrentSeason(firstAvailableSeason);
          } else {
            const error = 'El programa no tiene episodios disponibles';
            console.log('❌ [TVView]', error);
            setError(error);
            setCurrentProgram(null);
          }
        } else {
          const error = `No se encontró programa para el canal ${channelInfo.name}`;
          console.log('❌ [TVView]', error);
          setError(error);
          setCurrentProgram(null);
        }
      } catch (error) {
        console.error('❌ [TVView] Error al cargar programa:', error);
        setError(`Error al cargar programa: ${error instanceof Error ? error.message : String(error)}`);
        setCurrentProgram(null);
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

  if (!currentProgram) {
    return (
      <div className={`tv-view style-${decadeStyle}`}>
        <div className="error-message">No hay programas disponibles</div>
      </div>
    );
  }

  return (
    <div className={`tv-view style-${decadeStyle}`}>
      <MediaProvider>
        <VideoPlayer 
          program={currentProgram}
          seasonNumber={currentSeason}
          decadeStyle={decadeStyle}
        />
      </MediaProvider>
    </div>
  );
}