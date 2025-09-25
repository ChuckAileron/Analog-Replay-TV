import React, { useEffect, useState } from 'react';
import { useSchedule } from '../hooks/useSchedule';
import { YearSelection, ScheduleGenerationLoading } from './YearSelection';
import { ScheduleDisplay } from './ScheduleDisplay';
import type { ScheduleStatus } from '../types/schedule.types';
import '../styles/schedule-manager.css';

interface ScheduleManagerProps {
  currentChannelId?: string;
  currentChannelName?: string;
  onScheduleReady?: () => void;
  onError?: (error: string) => void;
}

/**
 * Componente principal que maneja toda la lógica de programación
 * Se encarga de mostrar el flujo completo desde la selección de año hasta la programación activa
 */
export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  currentChannelId,
  currentChannelName,
  onScheduleReady,
  onError
}) => {
  const {
    status,
    isInitialized,
    needsYearSelection,
    config,
    loading,
    error,
    initialize,
    setPrimaryYear
  } = useSchedule();

  const [hasInitialized, setHasInitialized] = useState(false);

  // Inicializar el servicio al montar el componente
  useEffect(() => {
    if (!hasInitialized) {
      console.log('🚀 [ScheduleManager] Inicializando sistema de programación...');
      setHasInitialized(true);
      initialize().catch((err) => {
        console.error('❌ [ScheduleManager] Error en inicialización:', err);
        onError?.(err.message || 'Error inicializando programación');
      });
    }
  }, [hasInitialized, initialize, onError]);

  // Notificar cuando la programación esté lista
  useEffect(() => {
    if (status === 'ready' && onScheduleReady) {
      onScheduleReady();
    }
  }, [status, onScheduleReady]);

  // Notificar errores
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleYearSelection = async (year: number) => {
    try {
      console.log(`📅 [ScheduleManager] Usuario seleccionó año: ${year}`);
      await setPrimaryYear(year);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error estableciendo año';
      console.error('❌ [ScheduleManager] Error estableciendo año:', errorMessage);
      onError?.(errorMessage);
    }
  };

  const getStatusMessage = (currentStatus: ScheduleStatus): string => {
    switch (currentStatus) {
      case 'not_initialized':
        return 'Inicializando sistema...';
      case 'initializing':
        return 'Configurando programación...';
      case 'needs_year_selection':
        return 'Esperando selección de año';
      case 'generating':
        return 'Generando programación anual...';
      case 'converting_videos':
        return 'Convirtiendo videos...';
      case 'ready':
        return 'Programación lista';
      case 'error':
        return 'Error en programación';
      default:
        return 'Estado desconocido';
    }
  };

  // Renderizar componente según el estado
  const renderContent = () => {
    // Estados de carga inicial
    if (!hasInitialized || status === 'not_initialized' || status === 'initializing') {
      return (
        <div className="schedule-manager-loading">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2>Inicializando Analog Replay TV</h2>
            <p>{getStatusMessage(status)}</p>
          </div>
        </div>
      );
    }

    // Necesita selección de año
    if (needsYearSelection || status === 'needs_year_selection') {
      return (
        <YearSelection
          onYearSelected={handleYearSelection}
          isLoading={loading}
          error={error}
        />
      );
    }

    // Generando programación
    if (status === 'generating') {
      return (
        <ScheduleGenerationLoading 
          message="Generando programación para tu año seleccionado"
        />
      );
    }

    // Convirtiendo videos
    if (status === 'converting_videos') {
      return (
        <div className="schedule-manager-converting">
          <div className="converting-content">
            <div className="converting-animation">
              <div className="converting-spinner"></div>
              <div className="video-icons">
                <span className="video-icon">🎬</span>
                <span className="arrow">→</span>
                <span className="video-icon converted">📺</span>
              </div>
            </div>
            <h2>Preparando videos...</h2>
            <p>Convirtiendo archivos de video para optimizar la reproducción.</p>
            <p className="converting-note">
              Puedes cambiar de canal mientras se completan las conversiones.
            </p>
          </div>
        </div>
      );
    }

    // Error
    if (status === 'error') {
      return (
        <div className="schedule-manager-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <h2>Error en la programación</h2>
            <p>{error || 'Ha ocurrido un error desconocido'}</p>
            <button 
              onClick={() => initialize()}
              className="retry-button"
              disabled={loading}
            >
              {loading ? 'Reintentando...' : 'Reintentar'}
            </button>
          </div>
        </div>
      );
    }

    // Programación lista - mostrar la programación del canal actual
    if (status === 'ready' && currentChannelId) {
      return (
        <div className="schedule-manager-ready">
          <ScheduleDisplay 
            channelId={currentChannelId}
            channelName={currentChannelName}
            showTimeInfo={true}
            className="main-schedule-display"
          />
          
          {config && (
            <div className="schedule-info">
              <div className="config-summary">
                <h3>📅 Configuración actual</h3>
                <div className="config-details">
                  <div className="config-item">
                    <span className="config-label">Año principal:</span>
                    <span className="config-value">{config.primaryYear}</span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Repetir temporadas:</span>
                    <span className="config-value">
                      {config.repeatSeasons ? 'Sí (2 veces)' : 'No (1 vez)'}
                    </span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Canales programados:</span>
                    <span className="config-value">{config.schedules.size}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Estado por defecto
    return (
      <div className="schedule-manager-default">
        <div className="default-content">
          <h2>📺 Analog Replay TV</h2>
          <p>Sistema de programación iniciado</p>
          <p className="status-text">Estado: {getStatusMessage(status)}</p>
          {!isInitialized && (
            <button 
              onClick={() => initialize()}
              className="init-button"
              disabled={loading}
            >
              {loading ? 'Inicializando...' : 'Inicializar programación'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="schedule-manager">
      {renderContent()}
    </div>
  );
};

/**
 * Componente más simple para mostrar solo la programación actual
 * Útil cuando ya se sabe que la programación está lista
 */
interface SimpleScheduleDisplayProps {
  channelId: string;
  channelName?: string;
  compact?: boolean;
}

export const SimpleScheduleDisplay: React.FC<SimpleScheduleDisplayProps> = ({
  channelId,
  channelName,
  compact = false
}) => {
  const { status, isInitialized } = useSchedule();

  if (!isInitialized || status !== 'ready') {
    return (
      <div className={`simple-schedule-loading ${compact ? 'compact' : ''}`}>
        <div className="loading-spinner-small"></div>
        <span>Cargando programación...</span>
      </div>
    );
  }

  return (
    <ScheduleDisplay 
      channelId={channelId}
      channelName={channelName}
      compact={compact}
      showTimeInfo={!compact}
    />
  );
};

/**
 * Hook para usar el estado del schedule manager desde otros componentes
 */
export const useScheduleManager = () => {
  const scheduleHook = useSchedule();
  
  return {
    ...scheduleHook,
    isScheduleReady: scheduleHook.status === 'ready',
    needsSetup: scheduleHook.status === 'needs_year_selection' || !scheduleHook.isInitialized,
    isProcessing: scheduleHook.status === 'generating' || scheduleHook.status === 'converting_videos'
  };
};

export default ScheduleManager;