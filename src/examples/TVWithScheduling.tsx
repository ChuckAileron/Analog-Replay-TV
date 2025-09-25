/**
 * Ejemplo de integración del sistema de programación con el componente TV principal
 * Este archivo muestra cómo usar los nuevos componentes de programación
 */

import React, { useState, useEffect } from 'react';
import { ScheduleManager, useScheduleManager } from '../components/ScheduleManager';
import { SimpleScheduleDisplay } from '../components/ScheduleManager';
import type { ScheduleEntry } from '../types/schedule.types';
// import TVControls from '../components/TVControls'; // Descomentar cuando exista

/**
 * Ejemplo de componente TV que integra el sistema de programación
 */
export const TVWithScheduling: React.FC = () => {
  const [currentChannel, setCurrentChannel] = useState(1);
  const [currentChannelId, setCurrentChannelId] = useState<string>('1');
  const [currentChannelName, setCurrentChannelName] = useState<string>('Canal 1');
  const [showScheduleManager, setShowScheduleManager] = useState(false);
  
  const { 
    isScheduleReady, 
    needsSetup, 
    isProcessing,
    getCurrentShow,
    status 
  } = useScheduleManager();

  // Efectos para manejo del estado
  useEffect(() => {
    // Mostrar el ScheduleManager si necesita configuración
    if (needsSetup || isProcessing) {
      setShowScheduleManager(true);
    } else if (isScheduleReady) {
      setShowScheduleManager(false);
    }
  }, [needsSetup, isProcessing, isScheduleReady]);

  // Función para cambiar de canal
  const handleChannelChange = async (newChannel: number, channelId: string, channelName: string) => {
    console.log(`📺 Cambiando a canal ${newChannel} (ID: ${channelId})`);
    
    setCurrentChannel(newChannel);
    setCurrentChannelId(channelId);
    setCurrentChannelName(channelName);
    
    // Si la programación está lista, obtener el show actual
    if (isScheduleReady) {
      try {
        const currentShow = await getCurrentShow(channelId);
        if (currentShow) {
          console.log(`🎬 Show actual: ${currentShow.showId} T${currentShow.seasonNumber}E${currentShow.episodeNumber}`);
          // Aquí se iniciaría la reproducción del video desde la posición calculada
        }
      } catch (error) {
        console.error('Error obteniendo show actual:', error);
      }
    }
  };

  const handleScheduleReady = () => {
    console.log('✅ Sistema de programación listo');
    setShowScheduleManager(false);
  };

  const handleScheduleError = (error: string) => {
    console.error('❌ Error en programación:', error);
    // Aquí podrías mostrar una notificación al usuario
  };

  // Renderizar el manager de programación si es necesario
  if (showScheduleManager) {
    return (
      <div className="tv-with-scheduling full-screen">
        <ScheduleManager
          currentChannelId={currentChannelId}
          currentChannelName={currentChannelName}
          onScheduleReady={handleScheduleReady}
          onError={handleScheduleError}
        />
      </div>
    );
  }

  // Renderizar la TV normal con información de programación
  return (
    <div className="tv-with-scheduling">
      {/* Área principal de video */}
      <div className="tv-main-area">
        <div className="video-container">
          {/* Aquí iría el reproductor de video */}
          <div className="video-placeholder">
            <h2>📺 Canal {currentChannel}</h2>
            <p>Estado de programación: {status}</p>
            {isScheduleReady ? (
              <p>✅ Programación activa</p>
            ) : (
              <p>🔄 Configurando programación...</p>
            )}
          </div>
          
          {/* Overlay de información de programación */}
          {isScheduleReady && (
            <div className="schedule-overlay">
              <SimpleScheduleDisplay
                channelId={currentChannelId}
                channelName={currentChannelName}
                compact={true}
              />
            </div>
          )}
        </div>
      </div>

        {/* Área de controles */}
        <div className="tv-controls-area">
          {/* TVControls component cuando esté disponible */}
          <div className="controls-placeholder">
            <button onClick={() => handleChannelChange(currentChannel + 1, (currentChannel + 1).toString(), `Canal ${currentChannel + 1}`)}>
              Canal ▲
            </button>
            <span>Canal {currentChannel}</span>
            <button onClick={() => handleChannelChange(currentChannel - 1, (currentChannel - 1).toString(), `Canal ${currentChannel - 1}`)}>
              Canal ▼
            </button>
          </div>        {/* Información detallada de programación */}
        {isScheduleReady && (
          <div className="detailed-schedule-info">
            <SimpleScheduleDisplay
              channelId={currentChannelId}
              channelName={currentChannelName}
              compact={false}
            />
          </div>
        )}
      </div>

      {/* Botón para reabrir configuración de programación */}
      <div className="schedule-controls">
        <button
          onClick={() => setShowScheduleManager(true)}
          className="schedule-settings-btn"
          title="Configuración de programación"
        >
          ⚙️ Programación
        </button>
      </div>
    </div>
  );
};

/**
 * Ejemplo más simple para mostrar solo la programación actual en un canal
 */
interface ChannelScheduleViewProps {
  channelId: string;
  channelName?: string;
}

export const ChannelScheduleView: React.FC<ChannelScheduleViewProps> = ({
  channelId,
  channelName
}) => {
  const { isScheduleReady } = useScheduleManager();

  if (!isScheduleReady) {
    return (
      <div className="channel-schedule-loading">
        <div className="loading-message">
          <span className="loading-icon">⏳</span>
          <span>Cargando programación...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="channel-schedule-view">
      <SimpleScheduleDisplay
        channelId={channelId}
        channelName={channelName}
      />
    </div>
  );
};

/**
 * Hook personalizado para manejar cambios de canal con programación
 */
export const useChannelWithSchedule = (initialChannel: number = 1) => {
  const [currentChannel, setCurrentChannel] = useState(initialChannel);
  const [currentShow, setCurrentShow] = useState<ScheduleEntry | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { getCurrentShow, isScheduleReady } = useScheduleManager();

  const changeChannel = async (newChannel: number, channelId: string) => {
    setLoading(true);
    setCurrentChannel(newChannel);
    
    try {
      if (isScheduleReady) {
        const show = await getCurrentShow(channelId);
        setCurrentShow(show);
        
        if (show) {
          console.log(`📺 Canal ${newChannel}: ${show.showId} T${show.seasonNumber}E${show.episodeNumber}`);
          // Aquí se podría disparar la lógica para comenzar la reproducción
          // desde la posición correcta basada en el cálculo de tiempo
        }
      }
    } catch (error) {
      console.error('Error cambiando de canal:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    currentChannel,
    currentShow,
    loading,
    changeChannel,
    isReady: isScheduleReady
  };
};

export default TVWithScheduling;