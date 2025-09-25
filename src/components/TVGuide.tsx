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
 * TV Guide con estilo retro de grilla clásica de los 90s/00s
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
    refreshData,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight
  } = useTVGuide();

  // Estados para navegación por celdas
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const timeHeaderRef = useRef<HTMLDivElement>(null);

  const [tvStyle, setTVStyle] = useState<'90s' | '00s'>('00s');

  // Manejar navegación por teclado personalizada
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Evitar que interfiera con inputs y otros elementos
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      const maxChannels = guideData?.channels.length || 0;
      const maxTimeSlots = 36; // 18 horas * 2 slots por hora

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setSelectedChannel(prev => prev > 0 ? prev - 1 : maxChannels - 1);
          break;
        
        case 'ArrowDown':
          event.preventDefault();
          setSelectedChannel(prev => prev < maxChannels - 1 ? prev + 1 : 0);
          break;
        
        case 'ArrowLeft':
          event.preventDefault();
          setSelectedTimeSlot(prev => prev > 0 ? prev - 1 : maxTimeSlots - 1);
          break;
        
        case 'ArrowRight':
          event.preventDefault();
          setSelectedTimeSlot(prev => prev < maxTimeSlots - 1 ? prev + 1 : 0);
          break;
        
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        
        case 'F5':
          event.preventDefault();
          refreshData();
          break;
        
        case 'Home':
          event.preventDefault();
          goToToday();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideData, onClose, refreshData, goToToday]);

  // Auto scroll para mantener la celda seleccionada visible
  useEffect(() => {
    if (gridRef.current && timeHeaderRef.current) {
      const slotWidth = 80; // minimo width de cada slot según CSS
      const scrollLeft = selectedTimeSlot * slotWidth - 200; // offset para visibilidad
      
      gridRef.current.scrollLeft = Math.max(0, scrollLeft);
      timeHeaderRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [selectedTimeSlot]);

  // Detectar el estilo de la aplicación principal
  useEffect(() => {
    const checkAppStyle = () => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      if (body.classList.contains('style-90s') || 
          computedStyle.backgroundColor === 'rgb(0, 0, 0)' ||
          computedStyle.color === 'rgb(0, 255, 0)') {
        setTVStyle('90s');
      } else {
        setTVStyle('00s');
      }
    };
    
    checkAppStyle();
  }, []);

  // Ir a fecha inicial si se proporciona
  useEffect(() => {
    if (initialDate) {
      goToDate(initialDate.getFullYear(), initialDate.getMonth() + 1, initialDate.getDate());
    }
  }, [initialDate, goToDate]);

  const formatDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  };

  // Generar slots de tiempo (cada 30 minutos)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 24; hour++) {
      slots.push({
        hour,
        minute: 0,
        label: `${hour.toString().padStart(2, '0')}:00`
      });
      slots.push({
        hour,
        minute: 30,
        label: `${hour.toString().padStart(2, '0')}:30`
      });
    }
    return slots;
  };

  // Obtener el programa que está en un slot de tiempo específico
  const getProgramForTimeSlot = (channel: TVGuideChannel, timeSlot: { hour: number; minute: number; label: string }) => {
    const slotStart = new Date(navigationState.selectedYear, navigationState.selectedMonth - 1, navigationState.selectedDay, timeSlot.hour, timeSlot.minute);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000); // 30 minutos después

    return channel.programs.find(program => {
      const programStart = new Date(program.startTime);
      const programEnd = new Date(program.endTime);
      
      // El programa debe estar activo durante este slot de tiempo
      return programStart < slotEnd && programEnd > slotStart;
    });
  };

  const isCurrentTimeSlot = (timeSlot: { hour: number; minute: number; label: string }) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Verificar si estamos en este slot de 30 minutos
    return timeSlot.hour === currentHour && 
           ((timeSlot.minute === 0 && currentMinute < 30) || 
            (timeSlot.minute === 30 && currentMinute >= 30));
  };

  const timeSlots = generateTimeSlots();

  if (error) {
    return (
      <div className={`tv-guide style-${tvStyle} error-state ${className}`}>
        <div className="guide-header">
          <h1>TV GUIDE</h1>
          <button onClick={onClose} className="close-button">X</button>
        </div>
        <div className="error-content">
          <div>ERROR: {error}</div>
          <button onClick={refreshData}>RETRY</button>
        </div>
      </div>
    );
  }

  if (loading || !guideData) {
    return (
      <div className={`tv-guide style-${tvStyle} ${className}`}>
        <div className="guide-header">
          <h1>TV GUIDE</h1>
          <button onClick={onClose} className="close-button">X</button>
        </div>
        <div className="guide-loading">
          <div>LOADING GUIDE...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`tv-guide style-${tvStyle} ${className}`}>
      {/* Header */}
      <div className="guide-header">
        <div className="header-left">
          <h1>TV GUIDE</h1>
          <div className="current-date">
            {formatDate(navigationState.selectedYear, navigationState.selectedMonth, navigationState.selectedDay)}
          </div>
        </div>

        <div className="header-actions">
          <button 
            onClick={goToToday} 
            title="Go to today"
            className="action-button"
          >
            TODAY
          </button>
          <button 
            onClick={refreshData} 
            title="Refresh guide data"
            className="action-button"
          >
            REFRESH
          </button>
          <button 
            onClick={onClose} 
            className="close-button"
            title="Close TV Guide"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="guide-content">
        {/* Time Header - sincronizado con scroll */}
        <div 
          className="time-header"
          ref={timeHeaderRef}
        >
          <div className="channel-column-header">CHANNEL</div>
          {timeSlots.map((slot, index) => (
            <div 
              key={`${slot.hour}-${slot.minute}`} 
              className={`time-slot ${isCurrentTimeSlot(slot) ? 'current' : ''} ${
                selectedTimeSlot === index ? 'selected' : ''
              }`}
            >
              {slot.label}
            </div>
          ))}
        </div>

        {/* Grid Content - con scroll de contenido */}
        <div 
          className="guide-grid"
          ref={gridRef}
          onScroll={(e) => {
            // Sincronizar el scroll del header con el contenido
            if (timeHeaderRef.current) {
              timeHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        >
          {guideData.channels.map((channel, channelIndex) => (
            <div 
              key={channel.channelId} 
              className={`grid-row ${channelIndex === selectedChannel ? 'selected-row' : ''}`}
            >
              {/* Channel Info */}
              <div className="channel-info">
                <div className="channel-number">{channel.channelNumber}</div>
                <div className="channel-name">{channel.channelName}</div>
              </div>

              {/* Program Slots - one for each time slot */}
              {timeSlots.map((slot, slotIndex) => {
                const program = getProgramForTimeSlot(channel, slot);
                const isCurrent = isCurrentTimeSlot(slot);
                const isSelected = channelIndex === selectedChannel && slotIndex === selectedTimeSlot;
                
                return (
                  <div 
                    key={`${slot.hour}-${slot.minute}`}
                    className={`program-slot ${isCurrent ? 'current' : ''} ${
                      !program ? 'empty' : ''
                    } ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedChannel(channelIndex);
                      setSelectedTimeSlot(slotIndex);
                      if (program && onSelectProgram) {
                        onSelectProgram(program, channel);
                      }
                    }}
                    title={program ? `${program.showName}${program.episodeTitle ? ': ' + program.episodeTitle : ''}` : 'Sin programación'}
                  >
                    <div className="program-title">
                      {program ? program.showName : '---'}
                    </div>
                    {program?.episodeTitle && (
                      <div className="episode-title">
                        {program.episodeTitle}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};