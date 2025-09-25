import React, { useState, useEffect } from 'react';
import type { ScheduleEntry, TimeCalculation } from '../types/schedule.types';
import { useChannelSchedule } from '../hooks/useSchedule';
import '../styles/schedule-display.css';

interface ScheduleDisplayProps {
  channelId: string;
  channelName?: string;
  showTimeInfo?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Componente que muestra la programación actual de un canal
 */
export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({
  channelId,
  channelName,
  showTimeInfo = true,
  compact = false,
  className = ''
}) => {
  const { currentShow, timeInfo, loading } = useChannelSchedule(channelId);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar reloj cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: showTimeInfo ? '2-digit' : undefined
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getProgressPercentage = (timeCalc: TimeCalculation) => {
    const total = timeCalc.elapsedTime + timeCalc.remainingTime;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (timeCalc.elapsedTime / total) * 100));
  };

  if (loading) {
    return (
      <div className={`schedule-display loading ${compact ? 'compact' : ''} ${className}`}>
        <div className="loading-content">
          <div className="loading-spinner-small"></div>
          <span>Cargando programación...</span>
        </div>
      </div>
    );
  }

  if (!currentShow || !timeInfo) {
    return (
      <div className={`schedule-display no-show ${compact ? 'compact' : ''} ${className}`}>
        <div className="no-show-content">
          <span className="no-show-icon">📺</span>
          <div className="no-show-text">
            <div className="channel-name">{channelName || `Canal ${channelId}`}</div>
            <div className="no-show-message">Sin programación disponible</div>
            {showTimeInfo && (
              <div className="current-time">{formatTime(currentTime)}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const progress = getProgressPercentage(timeInfo);
  const isEnding = timeInfo.remainingTime <= 5; // Últimos 5 minutos
  const isStarting = timeInfo.elapsedTime <= 2; // Primeros 2 minutos

  return (
    <div className={`schedule-display active ${compact ? 'compact' : ''} ${className}`}>
      {showTimeInfo && !compact && (
        <div className="schedule-header">
          <div className="channel-info">
            <span className="channel-name">{channelName || `Canal ${channelId}`}</span>
          </div>
          <div className="current-time">{formatTime(currentTime)}</div>
        </div>
      )}

      <div className="show-info">
        <div className="show-header">
          <h3 className="show-title">{currentShow.showId}</h3>
          <div className="show-episode">
            T{currentShow.seasonNumber}E{currentShow.episodeNumber}
          </div>
        </div>

        {!compact && (
          <div className="time-info">
            <div className="time-row">
              <span className="time-label">Inicio:</span>
              <span className="time-value">
                {formatTime(new Date(currentShow.startTime))}
              </span>
            </div>
            <div className="time-row">
              <span className="time-label">Final:</span>
              <span className="time-value">
                {formatTime(new Date(currentShow.endTime))}
              </span>
            </div>
            <div className="time-row">
              <span className="time-label">Duración:</span>
              <span className="time-value">
                {formatDuration(currentShow.duration)}
              </span>
            </div>
          </div>
        )}

        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className={`progress-fill ${isEnding ? 'ending' : isStarting ? 'starting' : ''}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="progress-info">
            <span className="elapsed-time">
              {formatDuration(timeInfo.elapsedTime)}
            </span>
            <span className="progress-percentage">
              {Math.round(progress)}%
            </span>
            <span className="remaining-time">
              -{formatDuration(timeInfo.remainingTime)}
            </span>
          </div>
        </div>

        {isEnding && (
          <div className="ending-notice">
            <span className="ending-icon">⏰</span>
            <span>Programa terminando pronto</span>
          </div>
        )}

        {currentShow.conversionRequired && (
          <div className={`conversion-status ${currentShow.conversionStatus}`}>
            <span className="conversion-icon">
              {currentShow.conversionStatus === 'completed' ? '✅' : 
               currentShow.conversionStatus === 'converting' ? '🔄' : 
               currentShow.conversionStatus === 'error' ? '❌' : '⏳'}
            </span>
            <span className="conversion-text">
              {currentShow.conversionStatus === 'completed' ? 'Convertido' :
               currentShow.conversionStatus === 'converting' ? 'Convirtiendo...' :
               currentShow.conversionStatus === 'error' ? 'Error en conversión' :
               'Conversión pendiente'}
            </span>
          </div>
        )}
      </div>

      {compact && showTimeInfo && (
        <div className="compact-time">
          {formatTime(currentTime)}
        </div>
      )}
    </div>
  );
};

/**
 * Componente que muestra una vista previa de la programación del día
 */
interface DaySchedulePreviewProps {
  channelId: string;
  date?: Date;
  maxEntries?: number;
}

export const DaySchedulePreview: React.FC<DaySchedulePreviewProps> = ({
  channelId,
  date = new Date(),
  maxEntries = 5
}) => {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Implementar carga de programación del día desde ScheduleService
    const loadDaySchedule = async () => {
      setLoading(true);
      try {
        // Aquí se cargaría la programación del día desde el servicio
        // const scheduleService = ScheduleService.getInstance();
        // const daySchedule = await scheduleService.getDaySchedule(channelId, date);
        // setEntries(daySchedule?.entries.slice(0, maxEntries) || []);
        setEntries([]); // Por ahora vacío hasta implementar el método
      } catch (error) {
        console.error('Error cargando programación del día:', error);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    loadDaySchedule();
  }, [channelId, date, maxEntries]);

  if (loading) {
    return (
      <div className="day-schedule-preview loading">
        <div className="loading-spinner-small"></div>
        <span>Cargando programación...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="day-schedule-preview empty">
        <span className="empty-icon">📅</span>
        <span>Sin programación disponible</span>
      </div>
    );
  }

  return (
    <div className="day-schedule-preview">
      <div className="preview-header">
        <h4>Programación de hoy</h4>
        <span className="preview-date">
          {date.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </span>
      </div>
      
      <div className="preview-entries">
        {entries.map((entry) => (
          <div key={entry.id} className="preview-entry">
            <div className="entry-time">
              {new Date(entry.startTime).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className="entry-show">
              <span className="entry-title">Show {entry.showId}</span>
              <span className="entry-episode">
                T{entry.seasonNumber}E{entry.episodeNumber}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleDisplay;