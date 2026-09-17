import { useState, useEffect, useRef } from 'react';
import type { TVSettings } from './types/tv.types';
import type { TVShow } from './types/show.types';
import type { ScheduleStatus } from './types/schedule.types';
import { channelManager } from './features/channels/channelManager';
import type { ChannelChangeResult } from './features/channels/channelManager';
import { showManager } from './features/shows/showManager';
import { settingsManager } from './features/settings/settingsManager';
import { TVGuide } from './components/TVGuide';
import { Menu90s } from './components/Menu90s';
import { Menu00s } from './components/Menu00s';
import { TVShowPlayer } from './components/TVShowPlayer';
import { ScheduleSetup } from './components/ScheduleSetup';
import { RemoteControl } from './components/RemoteControl';
import { AnalogReplayFiller } from './components/AnalogReplayFiller';

import './styles/common-90s.css';
import './styles/tv-1990s.css';
import './styles/tv-2000s.css';
import './styles/menu-90s.css';
import './styles/menu-00s.css';
import './styles/menu.css';
import './styles/channel-display.css';
import './styles/controls-00s.css';
import './styles/loading-animations.css';

function App() {
  // Restaurar el último canal sintonizado (persistido en settings) en vez de
  // siempre iniciar en el canal 1.
  const [currentChannel, setCurrentChannel] = useState<number>(() => settingsManager.getCurrentSettings().lastChannel || 1);
  const [currentShow, setCurrentShow] = useState<TVShow | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [settings, setSettings] = useState<TVSettings>(settingsManager.getCurrentSettings());
  const [channelDisplayKey, setChannelDisplayKey] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  // Controla la visibilidad de los botones inferiores (Channel Up/Down, Menu, TV Guide).
  // Ocultos por defecto; se muestran con Enter/flechas y se ocultan con Escape.
  const [controlsVisible, setControlsVisible] = useState<boolean>(false);
  // Controla la visibilidad del panel de control remoto simulado
  const [remoteVisible, setRemoteVisible] = useState<boolean>(false);
  // Estado de encendido/apagado de la TV (simulado por el control remoto)
  const [isPoweredOn, setIsPoweredOn] = useState<boolean>(true);
  // Recuerda el canal anterior para el botón "LAST" del control remoto
  const [previousChannel, setPreviousChannel] = useState<number>(1);
  // Estado de pantalla completa de la ventana de la aplicación
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  // Temporada, episodio y punto de reanudación (segundos) determinados por la
  // programación real según la hora actual del dispositivo.
  const [currentSeason, setCurrentSeason] = useState<number>(1);
  const [currentEpisode, setCurrentEpisode] = useState<number | undefined>(undefined);
  const [currentSeekTime, setCurrentSeekTime] = useState<number>(0);
  // Tipo de lo que corresponde transmitir ahora mismo según la programación:
  // 'show' = un episodio real, 'filler' = espacio de relleno (logo animado
  // AnalogReplayTV, mientras se implementan los comerciales), 'empty' = sin programación.
  const [currentProgramType, setCurrentProgramType] = useState<'show' | 'filler' | 'empty'>('empty');
  // Recuerda el id de la última entrada de programación aplicada, para detectar
  // cuándo la programación avanzó a un episodio distinto durante el sondeo periódico
  const lastScheduleEntryIdRef = useRef<string | null>(null);

  // Estados del sistema de programación
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>('not_initialized');

  // Debug log para scheduleStatus
  useEffect(() => {
    console.log('🔍 [App] Schedule Status changed to:', scheduleStatus);
  }, [scheduleStatus]);

  // Sincronizar el estado de pantalla completa: leer el estado inicial y
  // escuchar cambios externos (p.ej. si el usuario sale con Esc/F11 del SO)
  useEffect(() => {
    window.electronAPI.getFullscreenStatus()
      .then(({ isFullscreen: current }) => setIsFullscreen(current))
      .catch(() => {});

    window.electronAPI.onFullscreenChanged((current) => setIsFullscreen(current));
  }, []);

  // Mostrar/ocultar los botones de control (Channel Up/Down, Menu, TV Guide) con el teclado:
  // Enter o cualquier flecha los muestra; Escape los oculta.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // No interferir si el usuario está escribiendo en un campo de texto
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // No interferir mientras el menú de configuración o la guía de programación
      // están abiertos, ya que ellos manejan sus propios atajos de teclado.
      if (isMenuOpen || showGuide) {
        return;
      }

      // Cuando el control remoto está abierto, las flechas y Enter las maneja
      // su propio listener interno (navegación entre botones del remoto).
      if (remoteVisible && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) {
        return;
      }

      switch (event.key) {
        case 'Enter':
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          setControlsVisible(true);
          break;
        case 'Escape':
          // Escape cierra primero el control remoto si está abierto;
          // si no, oculta los botones inferiores.
          if (remoteVisible) {
            setRemoteVisible(false);
          } else {
            setControlsVisible(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, showGuide, remoteVisible]);

  // Inicializar canales y configuración al montar el componente
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🚀 [App] Starting initialization...');
        
        // Cargar configuración
        setSettings(settingsManager.getCurrentSettings());
        
        // Inicializar canales
        await channelManager.initialize();
        
        // Inicializar sistema de programación
        console.log('🔄 [App] Inicializando sistema de programación...');
        const status = await window.electronAPI.schedule.initialize();
        setScheduleStatus(status);
        
        console.log(`✅ [App] Schedule status: ${status}`);
        
        // Si no necesita selección de año, sintonizar automáticamente el
        // último canal que el usuario tenía abierto (persistido en settings).
        if (status === 'ready') {
          console.log('✅ [App] Sistema de programación listo, restaurando último canal:', currentChannel);
          const result = await channelManager.goToChannel(currentChannel);
          // Se pasa `true` explícitamente porque `scheduleStatus` del estado
          // del componente aún no refleja 'ready' en este mismo ciclo (closure).
          await applyChannelChangeResult(result, true);
        }
        
        // Forzar actualización del display
        setChannelDisplayKey(prev => prev + 1);
        
        console.log('✅ [App] Initialization complete');
      } catch (error) {
        console.error('❌ [App] Error initializing:', error);
        setScheduleStatus('ready'); // Fallback al comportamiento anterior
      }
    };

    init();
  }, []);

  const handleChannelChange = async (direction: 'up' | 'down'): Promise<void> => {
    try {
      const result = await channelManager.changeChannel(currentChannel, direction);
      await applyChannelChangeResult(result);
    } catch (error) {
      console.error('❌ [App] Error al cambiar canal:', error);
      setChannelError(`Error al cambiar canal: ${error instanceof Error ? error.message : String(error)}`);
      setCurrentShow(null);
    }
  };

  const handleGoToChannel = async (channelNumber: number): Promise<void> => {
    try {
      const result = await channelManager.goToChannel(channelNumber);
      await applyChannelChangeResult(result);
    } catch (error) {
      console.error('❌ [App] Error al ir al canal:', error);
      setChannelError(`Error al ir al canal: ${error instanceof Error ? error.message : String(error)}`);
      setCurrentShow(null);
    }
  };

  interface ResolvedSchedule {
    show: TVShow | null;
    season: number;
    episode?: number;
    seekTime: number;
    entryId: string | null;
    type: 'show' | 'filler' | 'empty';
  }

  /**
   * Determina qué corresponde transmitir AHORA MISMO en un canal dado, según
   * la hora real del dispositivo cruzada con la programación generada:
   * - Un episodio real de un show (type: 'show'), con el show resuelto y el
   *   seekTime calculado para reanudar en el punto correcto.
   * - Un espacio de relleno (type: 'filler'), cuando el episodio anterior
   *   terminó antes de completar su slot de 30 minutos.
   * - Nada programado (type: 'empty').
   */
  const resolveScheduleForChannel = async (channelNumber: number): Promise<ResolvedSchedule> => {
    const fallback: ResolvedSchedule = { show: null, season: 1, episode: undefined, seekTime: 0, entryId: null, type: 'empty' };

    try {
      const channelInfo = channelManager.getChannelInfo(channelNumber);
      if (!channelInfo || (!channelInfo.uuid && !channelInfo.id)) {
        return fallback;
      }

      // La programación persistida puede usar el UUID actual, el ID numérico
      // legacy o el nombre del canal. Probarlos en ese orden mantiene válidas
      // las programaciones generadas antes de asignar un UUID al canal.
      const channelIdentifiers = [
        channelInfo.uuid,
        String(channelInfo.id),
        channelInfo.name
      ].filter((identifier, index, identifiers): identifier is string =>
        !!identifier && identifiers.indexOf(identifier) === index
      );

      let scheduleEntry = null;
      for (const channelIdentifier of channelIdentifiers) {
        scheduleEntry = await window.electronAPI.schedule.getCurrentScheduleEntry(channelIdentifier);
        if (scheduleEntry) break;
      }

      if (!scheduleEntry) {
        console.log(`ℹ️ [App] No hay programación actual para el canal ${channelNumber}`);
        return fallback;
      }

      // Espacio de relleno: no hay show real que resolver, solo mostrar el logo animado
      if (scheduleEntry.type === 'filler') {
        console.log('📺 [App] Espacio de relleno (AnalogReplayTV) en emisión para este canal');
        return { show: null, season: 0, episode: undefined, seekTime: 0, entryId: scheduleEntry.id, type: 'filler' };
      }

      const show = await showManager.getShowByIdentifier(scheduleEntry.showId);
      if (!show) {
        console.warn('⚠️ [App] La entrada de programación referencia un show que ya no existe:', scheduleEntry.showId);
        return { ...fallback, entryId: scheduleEntry.id };
      }

      const startTimeMs = new Date(scheduleEntry.startTime).getTime();
      const seekTime = Math.max(0, (Date.now() - startTimeMs) / 1000);

      console.log('📺 [App] Programación actual resuelta:', {
        show: show.name,
        season: scheduleEntry.season,
        episode: scheduleEntry.episode,
        seekTime: Math.round(seekTime)
      });

      return {
        show,
        season: scheduleEntry.season,
        episode: scheduleEntry.episode,
        seekTime,
        entryId: scheduleEntry.id,
        type: 'show'
      };
    } catch (error) {
      console.warn('⚠️ [App] Error resolviendo la programación del canal:', error);
      return fallback;
    }
  };

  const applyChannelChangeResult = async (result: ChannelChangeResult, scheduleReadyOverride?: boolean): Promise<void> => {
    // Recordar el canal anterior para el botón "LAST" del control remoto
    setPreviousChannel(currentChannel);

    // Actualizar el canal actual
    setCurrentChannel(result.channelNumber);

    // Persistir el canal para restaurarlo automáticamente la próxima vez que se abra la app
    settingsManager.setLastChannel(result.channelNumber);

    // Reiniciar la animación cambiando la key
    setChannelDisplayKey(prev => prev + 1);

    // `scheduleReadyOverride` permite indicar explícitamente que la programación
    // ya está lista en casos donde el estado `scheduleStatus` del componente
    // todavía no se actualizó en este mismo ciclo (closure obsoleta), como
    // justo después de completar la selección de año inicial.
    const isScheduleReady = scheduleReadyOverride ?? (scheduleStatus === 'ready');

    if (isScheduleReady) {
      // La programación real es la fuente de verdad: determina qué show,
      // temporada, episodio y punto de reanudación corresponden ahora mismo.
      const resolved = await resolveScheduleForChannel(result.channelNumber);
      lastScheduleEntryIdRef.current = resolved.entryId;

      setCurrentShow(resolved.show);
      setCurrentSeason(resolved.season);
      setCurrentEpisode(resolved.episode);
      setCurrentSeekTime(resolved.seekTime);
      setCurrentProgramType(resolved.type);
      setChannelError(resolved.type === 'empty' ? (result.error || null) : null);

      console.log(`🎬 [App] ESTABLECIENDO CURRENT SHOW (desde programación): ${resolved.show ? resolved.show.name : `[${resolved.type}]`}`);
    } else {
      // Fallback (no debería ocurrir en condiciones normales, ya que el canal
      // solo puede cambiarse cuando scheduleStatus === 'ready')
      lastScheduleEntryIdRef.current = null;
      setCurrentShow(result.show);
      setCurrentSeason(1);
      setCurrentEpisode(undefined);
      setCurrentSeekTime(0);
      setCurrentProgramType(result.show ? 'show' : 'empty');
      setChannelError(result.error || null);
    }

    if (result.error) {
      console.log('⚠️ [App]', result.error);
    }
  };

  // Sondeo periódico: mientras la TV esté encendida y sintonizada en un canal,
  // revisa cada cierto tiempo si la programación avanzó a un episodio distinto
  // (según la hora real) y, de ser así, actualiza el reproductor automáticamente
  // sin que el usuario tenga que cambiar de canal manualmente.
  useEffect(() => {
    if (scheduleStatus !== 'ready' || !isPoweredOn) {
      return;
    }

    const POLL_INTERVAL_MS = 30000;

    const interval = setInterval(async () => {
      try {
        const resolved = await resolveScheduleForChannel(currentChannel);
        const entryChanged = resolved.entryId !== lastScheduleEntryIdRef.current;

        if (entryChanged) {
          console.log('🔄 [App] La programación avanzó a un nuevo bloque, actualizando reproductor...');
          lastScheduleEntryIdRef.current = resolved.entryId;
          setCurrentShow(resolved.show);
          setCurrentSeason(resolved.season);
          setCurrentEpisode(resolved.episode);
          setCurrentSeekTime(resolved.seekTime);
          setCurrentProgramType(resolved.type);
          setChannelError(resolved.type === 'empty' ? null : null);
          setChannelDisplayKey(prev => prev + 1);
        }
      } catch (error) {
        console.warn('⚠️ [App] Error en sondeo periódico de programación:', error);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [scheduleStatus, isPoweredOn, currentChannel]);

  const toggleGuide = (): void => {
    setShowGuide(prev => !prev);
  };

  const handleAspectRatioToggle = (): void => {
    const newSettings = settingsManager.toggleAspectRatio();
    setSettings(newSettings);
  };

  const handleStyleToggle = (): void => {
    const newSettings = settingsManager.toggleTVStyle();
    setSettings(newSettings);
  };

  const handleCRTFilterToggle = (): void => {
    const newSettings = settingsManager.toggleCRTFilter();
    setSettings(newSettings);
  };

  // Alterna la pantalla completa de la ventana de la aplicación
  const handleToggleFullscreen = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.toggleFullscreen();
      if (result.success) {
        setIsFullscreen(result.isFullscreen);
      }
    } catch (error) {
      console.error('❌ [App] Error alternando pantalla completa:', error);
    }
  };

  // ===== Handlers del control remoto simulado =====

  const handleVolumeUp = (): void => {
    const current = settingsManager.getCurrentSettings();
    const newVolume = Math.min(100, current.volume + 10);
    const newSettings = settingsManager.updateSettings({ volume: newVolume, isMuted: false });
    setSettings(newSettings);
  };

  const handleVolumeDown = (): void => {
    const current = settingsManager.getCurrentSettings();
    const newVolume = Math.max(0, current.volume - 10);
    const newSettings = settingsManager.updateSettings({ volume: newVolume });
    setSettings(newSettings);
  };

  const handleMuteToggle = (): void => {
    const current = settingsManager.getCurrentSettings();
    const newSettings = settingsManager.updateSettings({ isMuted: !current.isMuted });
    setSettings(newSettings);
  };

  const handlePowerToggle = (): void => {
    setIsPoweredOn(prev => !prev);
  };

  const handleLastChannel = (): void => {
    handleGoToChannel(previousChannel);
  };

  // Resetea completamente la programación generada, forzando que el usuario
  // vuelva a elegir un año de transmisión desde cero.
  const handleResetSchedule = async (): Promise<void> => {
    const confirmMessage = settings.tvStyle === '90s'
      ? '¿ESTÁS SEGURO DE QUE QUIERES RESETEAR LA PROGRAMACIÓN?\n\nSE BORRARÁ TODA LA PROGRAMACIÓN GENERADA Y DEBERÁS ELEGIR UN AÑO NUEVAMENTE.'
      : '¿Estás seguro de que quieres resetear la programación?\n\nSe borrará toda la programación generada y deberás elegir un año nuevamente.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const result = await window.electronAPI.schedule.reset();
      if (!result.success) {
        throw new Error(result.error || 'Error desconocido al resetear la programación');
      }

      console.log('✅ [App] Programación reseteada correctamente');
      setIsMenuOpen(false);
      setCurrentShow(null);
      setChannelError(null);
      lastScheduleEntryIdRef.current = null;
      setScheduleStatus('needs_year_selection');
    } catch (error) {
      console.error('❌ [App] Error reseteando la programación:', error);
      alert(
        settings.tvStyle === '90s'
          ? 'ERROR AL RESETEAR LA PROGRAMACIÓN. INTENTA DE NUEVO.'
          : 'Ocurrió un error al resetear la programación. Intenta de nuevo.'
      );
    }
  };

  return (
    <div className={`tv-container style-${settings.tvStyle}`}>
      {/* Pantalla de configuración inicial */}
      {scheduleStatus === 'needs_year_selection' && (
        <ScheduleSetup
          onSetupComplete={async (year: number) => {
            console.log(`✅ [App] Configuración completada para el año: ${year}`);
            setScheduleStatus('ready');
            
            try {
              // Reinicializar el sistema
              const status = await window.electronAPI.schedule.initialize();
              setScheduleStatus(status);
              
              // Cargar show actual después de configurar la programación
              if (status === 'ready') {
                const result = await channelManager.changeChannel(currentChannel, 'up');
                console.log('🔄 [App] Cambio de canal después de configuración:', {
                  canalAnterior: currentChannel,
                  canalNuevo: result.channelNumber,
                  show: result.show?.name || 'No show'
                });
                // Usar applyChannelChangeResult para resolver también la programación
                // real (temporada/episodio/seekTime), no solo el show estático.
                // Se pasa `true` explícitamente porque `scheduleStatus` del estado
                // del componente aún no refleja 'ready' en este mismo ciclo (closure).
                await applyChannelChangeResult(result, true);
              }
            } catch (error) {
              console.error('❌ [App] Error después de configuración:', error);
              setScheduleStatus('ready'); // Fallback
            }
          }}
          onCancel={() => {
            console.log('⚠️ [App] Configuración cancelada - usando modo básico');
            setScheduleStatus('ready');
          }}
        />
      )}

      {/* Pantalla de carga */}
      {(scheduleStatus === 'initializing' || scheduleStatus === 'generating' || scheduleStatus === 'converting_videos') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#000',
          color: settings.tvStyle === '90s' ? '#00ff00' : '#00ccff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: settings.tvStyle === '90s' ? 'monospace' : 'sans-serif',
          fontSize: '18px',
          zIndex: 2000
        }}>
          <div style={{ marginBottom: '20px' }}>
            {scheduleStatus === 'initializing' && '🔄 Inicializando sistema de programación...'}
            {scheduleStatus === 'generating' && '📺 Generando programación anual...'}
            {scheduleStatus === 'converting_videos' && '⚙️ Convirtiendo videos...'}
          </div>
          <div style={{ 
            width: '200px', 
            height: '4px', 
            backgroundColor: '#333',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '50%',
              height: '100%',
              backgroundColor: settings.tvStyle === '90s' ? '#00ff00' : '#00ccff',
              animation: 'progress-bar 2s infinite linear'
            }} />
          </div>
        </div>
      )}

      {scheduleStatus === 'ready' && (
        <>
          {isMenuOpen && (
            <div 
              className={`menu-overlay ${settings.tvStyle === '90s' ? 'style-90s' : ''}`}
              onClick={() => setIsMenuOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 1500
              }}
            />
          )}
          <div className={`tv-screen aspect-${settings.aspectRatio.replace(':', '-')}`}>
            {/* Overlay de "TV apagada" simulando el botón de encendido/apagado del control remoto */}
            {!isPoweredOn && (
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 900
              }}>
                <div style={{
                  color: '#444',
                  fontFamily: settings.tvStyle === '90s' ? 'monospace' : 'sans-serif',
                  fontSize: '14px',
                  letterSpacing: '2px'
                }}>
                  {settings.tvStyle === '90s' ? 'TV APAGADA' : 'TV Apagada'}
                </div>
              </div>
            )}

            {/* Display del canal (oculto mientras la guía está abierta para que no quede flotando sobre ella) */}
            {!showGuide && (
              <div 
                key={channelDisplayKey} 
                className="channel-display"
              >
                {(() => {
                  console.log('🖥️ [App] Current Channel:', currentChannel);
                  const channelInfo = channelManager.getChannelInfo(currentChannel);
                  console.log('🖥️ [App] Channel Info:', channelInfo);
                  return (
                    <>
                      <span className="channel-number">{currentChannel}</span>
                      {channelInfo?.name && <span className="channel-name">{channelInfo.name}</span>}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Reproductor de video, relleno "AnalogReplayTV", o mensaje de canal vacío */}
            {currentProgramType === 'show' && currentShow ? (
              <TVShowPlayer 
                show={currentShow}
                seasonNumber={currentSeason}
                episodeNumber={currentEpisode}
                seekTimeSeconds={currentSeekTime}
                style={settings.tvStyle === '90s' ? 'retro-90s' : 'retro-00s'}
                crtFilter={settings.tvStyle === '90s' && settings.crtFilter}
                volume={settings.volume}
                muted={settings.isMuted || !isPoweredOn}
              />
            ) : currentProgramType === 'filler' ? (
              <AnalogReplayFiller tvStyle={settings.tvStyle} crtFilter={settings.crtFilter} />
            ) : (
              <div className="empty-channel" style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000',
                color: settings.tvStyle === '90s' ? '#00ff00' : '#00ccff',
                fontFamily: settings.tvStyle === '90s' ? 'monospace' : 'sans-serif',
                textAlign: 'center',
                padding: '20px'
              }}>
                <div style={{ 
                  fontSize: '24px', 
                  marginBottom: '10px',
                  textShadow: settings.tvStyle === '90s' ? '0 0 10px #00ff00' : '0 0 8px rgba(0, 204, 255, 0.6)'
                }}>
                  {settings.tvStyle === '90s' ? '📺 CANAL SIN PROGRAMACION' : '📺 Canal Sin Programación'}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  opacity: 0.8,
                  lineHeight: '1.5'
                }}>
                  {settings.tvStyle === '90s' 
                    ? 'ESTE CANAL NO TIENE CONTENIDO CONFIGURADO\nCAMBIE DE CANAL PARA CONTINUAR' 
                    : 'Este canal no tiene contenido configurado.\nCambie de canal para continuar.'
                  }
                </div>
              </div>
            )}

            {/* Mostrar error del canal si existe */}
            {channelError && (
              <div className="channel-error">
                {channelError}
              </div>
            )}
          </div>

          {/* Guía de programación (fuera de .tv-screen para que cubra toda la ventana) */}
          {showGuide && (
            <TVGuide
              tvStyle={settings.tvStyle}
              onClose={() => setShowGuide(false)}
              onChannelSelect={(channelNumber) => {
                handleGoToChannel(channelNumber);
              }}
              onSelectProgram={(program, channel) => {
                console.log('🎯 [App] Programa seleccionado:', program.showName, 'en canal:', channel.channelName);
                // TODO: Navegar al canal y programa seleccionado
                setShowGuide(false);
              }}
            />
          )}

          {controlsVisible && (
            <div className="tv-controls">
              <div className="channel-buttons">
                <button onClick={() => handleChannelChange('up')} disabled={!isPoweredOn}>
                  Channel Up
                </button>
                <button onClick={() => handleChannelChange('down')} disabled={!isPoweredOn}>
                  Channel Down
                </button>
                <button
                  className={`menu-button ${settings.tvStyle === '90s' ? 'menu-button-90s' : 'menu-button-00s'}`}
                  onClick={() => setIsMenuOpen(prev => !prev)}
                >
                  MENU
                </button>
                <button
                  className={settings.tvStyle === '90s' ? 'menu-button-90s' : 'menu-button-00s'}
                  onClick={() => window.electronAPI.openAdminWindow()}
                >
                  {settings.tvStyle === '90s' ? 'CONFIGURACIÓN' : 'Configuración'}
                </button>
                <button
                  className={settings.tvStyle === '90s' ? 'menu-button-90s' : 'menu-button-00s'}
                  onClick={toggleGuide}
                  disabled={!isPoweredOn}
                >
                  {settings.tvStyle === '90s' ? 'TV GUIDE' : 'Program Guide'}
                </button>
                <button
                  className={settings.tvStyle === '90s' ? 'menu-button-90s' : 'menu-button-00s'}
                  onClick={() => setRemoteVisible(prev => !prev)}
                >
                  {settings.tvStyle === '90s' ? 'CONTROL REMOTO' : 'Control Remoto'}
                </button>
                <button
                  className={settings.tvStyle === '90s' ? 'menu-button-90s' : 'menu-button-00s'}
                  onClick={handleToggleFullscreen}
                >
                  {isFullscreen
                    ? (settings.tvStyle === '90s' ? 'SALIR DE PANTALLA COMPLETA' : 'Salir de Pantalla Completa')
                    : (settings.tvStyle === '90s' ? 'PANTALLA COMPLETA' : 'Pantalla Completa')}
                </button>
                <button
                  className={settings.tvStyle === '90s' ? 'menu-button-90s' : 'menu-button-00s'}
                  onClick={() => setControlsVisible(false)}
                >
                  {settings.tvStyle === '90s' ? 'OCULTAR BOTONES' : 'Ocultar Botones'}
                </button>
              </div>
            </div>
          )}

          {/* Control remoto flotante sobre la parte inferior de la reproducción */}
          {remoteVisible && (
            <RemoteControl
              tvStyle={settings.tvStyle}
              isPoweredOn={isPoweredOn}
              isMuted={settings.isMuted}
              onClose={() => setRemoteVisible(false)}
              onPowerToggle={handlePowerToggle}
              onChannelUp={() => handleChannelChange('up')}
              onChannelDown={() => handleChannelChange('down')}
              onVolumeUp={handleVolumeUp}
              onVolumeDown={handleVolumeDown}
              onMuteToggle={handleMuteToggle}
              onMenuToggle={() => setIsMenuOpen(prev => !prev)}
              onGuideToggle={toggleGuide}
              onGoToChannel={handleGoToChannel}
              onLastChannel={handleLastChannel}
            />
          )}

          {/* Menús de configuración */}
          <Menu90s
            settings={settings}
            onAspectRatioToggle={handleAspectRatioToggle}
            onStyleToggle={handleStyleToggle}
            onCRTFilterToggle={handleCRTFilterToggle}
            onResetSchedule={handleResetSchedule}
            isMenuOpen={isMenuOpen && settings.tvStyle === '90s'}
          />
          <Menu00s
            settings={settings}
            onAspectRatioToggle={handleAspectRatioToggle}
            onStyleToggle={handleStyleToggle}
            onResetSchedule={handleResetSchedule}
            isMenuOpen={isMenuOpen && settings.tvStyle === '00s'}
          />
        </>
      )}
    </div>
  );
}

export default App;
