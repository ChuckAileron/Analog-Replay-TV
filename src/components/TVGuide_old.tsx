import React, { useState, useEffect, useRef } from 'react';
import { useTVGuide } from '../hooks/useTVGuide';
import type { TVGuideProgram, TVGuideChannel } from '../types/schedule.types';
import '../styles/tv-guide.css';

interface TVGuideProps {
  onClose: () => void;
  onSelectProgram?: (program: TVGuideProgram, channel: TVGuideChannel) => void;
  initialDate?: Date;
  className?: string;
}

/**
 * Componente TV Guide completo con navegación por teclado
 * Permite navegar por canales, días y programas usando las flechas del teclado
 */
export const TVGuide: React.FC<TVGuideProps> = ({
  onClose,
  onSelectProgram,
  initialDate,
  className = ''
}) => {
  const {
    guideData,
    navigationState,
    loading,
    error,
    goToDate,
    goToToday,
    goToChannel,
    refreshData,
    searchPrograms,
    getSelectedProgram,
    searchResults,
    isSearching,
    clearSearch,
    stats
  } = useTVGuide();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [tvStyle, setTVStyle] = useState<'90s' | '00s'>('00s'); // Default to 00s style

  // Detectar el estilo de la aplicación principal
  useEffect(() => {
    const checkAppStyle = () => {
      const body = document.body;
      if (body.classList.contains('style-90s') || body.style.backgroundColor === 'rgb(0, 0, 0)') {
        setTVStyle('90s');
      } else {
        setTVStyle('00s');
      }
    };
    
    checkAppStyle();
    // También escuchar cambios en el DOM
    const observer = new MutationObserver(checkAppStyle);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    
    return () => observer.disconnect();
  }, []);

  // Ir a fecha inicial si se proporciona
  useEffect(() => {
    if (initialDate) {
      goToDate(initialDate.getFullYear(), initialDate.getMonth() + 1, initialDate.getDate());
    }
  }, [initialDate, goToDate]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      await searchPrograms(query);
    } else {
      clearSearch();
    }
  };

  const handleSelectProgram = () => {
    const selectedProgram = getSelectedProgram();
    if (selectedProgram && guideData && onSelectProgram) {
      const selectedChannel = guideData.channels[navigationState.selectedChannel];
      onSelectProgram(selectedProgram, selectedChannel);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  };

  // Generar horarios para la grilla (cada 2 horas desde las 6:00)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 24; hour += 2) {
      slots.push({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`
      });
    }
    return slots;
  };

  const isToday = (year: number, month: number, day: number) => {
    const today = new Date();
    return year === today.getFullYear() && 
           month === today.getMonth() + 1 && 
           day === today.getDate();
  };

  if (error) {
    return (
      <div className={`tv-guide error-state ${className}`}>
        <div className="guide-header">
          <h1>📺 TV Guide</h1>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h2>Error cargando la guía</h2>
          <p>{error}</p>
          <button onClick={refreshData} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`tv-guide ${className}`}>
      {/* Header */}
      <div className="guide-header">
        <div className="header-left">
          <h1>📺 TV Guide</h1>
          <div className="current-date">
            {formatDate(navigationState.selectedYear, navigationState.selectedMonth, navigationState.selectedDay)}
            {isToday(navigationState.selectedYear, navigationState.selectedMonth, navigationState.selectedDay) && (
              <span className="today-badge">HOY</span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={`search-toggle ${showSearch ? 'active' : ''}`}
            title="Buscar programas"
          >
            🔍
          </button>
          <button 
            onClick={() => setShowStats(!showStats)}
            className={`stats-toggle ${showStats ? 'active' : ''}`}
            title="Estadísticas"
          >
            📊
          </button>
          <button 
            onClick={goToToday}
            className="today-button"
            title="Ir a hoy (Home)"
          >
            Hoy
          </button>
          <button 
            onClick={refreshData}
            className="refresh-button"
            title="Actualizar (F5)"
            disabled={loading}
          >
            🔄
          </button>
          <button 
            onClick={onClose}
            className="close-button"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="search-bar">
          <div className="search-input-container">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar programas, shows o episodios..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            {isSearching && <div className="search-loading">🔍</div>}
          </div>
          
          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Resultados de búsqueda ({searchResults.length})</h3>
              <div className="search-results-list">
                {searchResults.slice(0, 10).map((result) => (
                  <div key={`${result.date}-${result.program.id}`} className="search-result-item">
                    <div className="result-date">{result.date}</div>
                    <div className="result-channel">{result.channel.channelName}</div>
                    <div className="result-program">
                      <strong>{result.program.showName}</strong>
                      <span>T{result.program.seasonNumber}E{result.program.episodeNumber}</span>
                      <span>{formatTime(result.program.startTime)}</span>
                    </div>
                  </div>
                ))}
                {searchResults.length > 10 && (
                  <div className="more-results">Y {searchResults.length - 10} resultados más...</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="stats-panel">
          <h3>📊 Estadísticas de Programación</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Programas totales:</span>
              <span className="stat-value">{stats.totalPrograms}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Shows únicos:</span>
              <span className="stat-value">{stats.uniqueShows}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Canales únicos:</span>
              <span className="stat-value">{stats.uniqueChannels}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Duración total:</span>
              <span className="stat-value">{stats.totalDurationHours}h</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="guide-navigation">
        <div className="day-navigation">
          <button 
            onClick={() => {
              const { prevDay } = getDayNavigation();
              goToDate(prevDay.getFullYear(), prevDay.getMonth() + 1, prevDay.getDate());
            }}
            className="nav-button prev-day"
          >
            ← Día anterior
          </button>
          
          <div className="current-day-info">
            <div className="day-display">
              {formatDate(navigationState.selectedYear, navigationState.selectedMonth, navigationState.selectedDay)}
            </div>
          </div>

          <button 
            onClick={() => {
              const { nextDay } = getDayNavigation();
              goToDate(nextDay.getFullYear(), nextDay.getMonth() + 1, nextDay.getDate());
            }}
            className="nav-button next-day"
          >
            Día siguiente →
          </button>
        </div>

        <div className="keyboard-help">
          <span>🎮 Usa las flechas ↑↓ (canales) ←→ (días/programas) | Home (hoy) | F5 (actualizar)</span>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="guide-loading">
          <div className="loading-spinner-large"></div>
          <p>Cargando programación...</p>
        </div>
      ) : !guideData || guideData.channels.length === 0 ? (
        <div className="guide-empty">
          <div className="empty-icon">📺</div>
          <h2>Sin programación disponible</h2>
          <p>No hay datos de programación para esta fecha.</p>
          <button onClick={goToToday} className="goto-today-btn">
            Ir a hoy
          </button>
        </div>
      ) : (
        <div className="guide-content">
          {/* Channels List */}
          <div className="channels-sidebar">
            <div className="channels-header">
              <h3>Canales</h3>
            </div>
            <div className="channels-list">
              {guideData.channels.map((channel, index) => (
                <div 
                  key={channel.channelId}
                  className={`channel-item ${index === navigationState.selectedChannel ? 'selected' : ''}`}
                  onClick={() => goToChannel(index)}
                >
                  <div className="channel-number">{channel.channelNumber}</div>
                  <div className="channel-name">{channel.channelName}</div>
                  <div className="channel-programs-count">
                    {channel.programs.length} programas
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Programs Grid */}
          <div className="programs-area">
            {guideData.channels[navigationState.selectedChannel] && (
              <ChannelProgramsView
                channel={guideData.channels[navigationState.selectedChannel]}
                selectedProgramIndex={navigationState.selectedProgram}
                onSelectProgram={handleSelectProgram}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Componente para mostrar los programas de un canal específico
 */
interface ChannelProgramsViewProps {
  channel: TVGuideChannel;
  selectedProgramIndex: number;
  onSelectProgram: () => void;
}

const ChannelProgramsView: React.FC<ChannelProgramsViewProps> = ({
  channel,
  selectedProgramIndex,
  onSelectProgram
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="channel-programs">
      <div className="channel-header">
        <div className="channel-info">
          <h2>Canal {channel.channelNumber} - {channel.channelName}</h2>
          <div className="programs-count">{channel.programs.length} programas</div>
        </div>
      </div>

      <div className="programs-timeline">
        {channel.programs.map((program, index) => (
          <div 
            key={program.id}
            className={`program-block ${index === selectedProgramIndex ? 'selected' : ''} ${program.isCurrentlyPlaying ? 'currently-playing' : ''}`}
            onClick={onSelectProgram}
          >
            <div className="program-time">
              <span className="start-time">{formatTime(program.startTime)}</span>
              <span className="end-time">{formatTime(program.endTime)}</span>
            </div>
            
            <div className="program-content">
              <h4 className="program-title">{program.showName}</h4>
              <div className="program-episode">
                Temporada {program.seasonNumber}, Episodio {program.episodeNumber}
                {program.episodeTitle && <span className="episode-title">: {program.episodeTitle}</span>}
              </div>
              
              {program.description && (
                <p className="program-description">{program.description}</p>
              )}
              
              <div className="program-meta">
                <span className="duration">{formatDuration(program.duration)}</span>
                {program.isCurrentlyPlaying && (
                  <span className="live-indicator">🔴 EN VIVO</span>
                )}
              </div>
            </div>

            {program.isCurrentlyPlaying && program.progress !== undefined && (
              <div className="program-progress">
                <div 
                  className="progress-bar"
                  style={{ width: `${program.progress}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TVGuide;
