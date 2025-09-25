import { useState, useEffect } from 'react';
import type { TVSettings } from './types/tv.types';
import type { TVShow } from './types/show.types';
import type { ScheduleStatus } from './types/schedule.types';
import { channelManager } from './features/channels/channelManager';
import { settingsManager } from './features/settings/settingsManager';
import { TVGuide } from './components/TVGuide';
import { Menu90s } from './components/Menu90s';
import { Menu00s } from './components/Menu00s';
import { TVShowPlayer } from './components/TVShowPlayer';
import { ScheduleSetup } from './components/ScheduleSetup';

import './styles/common-90s.css';
import './styles/tv-1990s.css';
import './styles/tv-2000s.css';
import './styles/menu-90s.css';
import './styles/menu-00s.css';
import './styles/tv-components.css';
import './styles/menu.css';
import './styles/channel-display.css';
import './styles/controls-00s.css';
import './styles/loading-animations.css';
import './styles/loading-animations.css';

function App() {
  const [currentChannel, setCurrentChannel] = useState<number>(1); // Iniciar en canal 1
  const [currentShow, setCurrentShow] = useState<TVShow | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [settings, setSettings] = useState<TVSettings>(settingsManager.getCurrentSettings());
  const [channelDisplayKey, setChannelDisplayKey] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  
  // Estados del sistema de programación
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>('not_initialized');

  // Debug log para scheduleStatus
  useEffect(() => {
    console.log('🔍 [App] Schedule Status changed to:', scheduleStatus);
  }, [scheduleStatus]);

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
        
        // Si no necesita selección de año, configuración completa
        if (status === 'ready') {
          console.log('✅ [App] Sistema de programación listo');
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
      
      // Actualizar el canal actual
      setCurrentChannel(result.channelNumber);
      
      // LOGS DETALLADOS PARA DEBUG
      console.log('📺 [App] RESULTADO DE CAMBIO DE CANAL:');
      console.log(`   - Canal anterior: ${currentChannel}`);
      console.log(`   - Canal nuevo: ${result.channelNumber}`);
      console.log(`   - Show encontrado: ${result.show ? result.show.name : 'NINGUNO'}`);
      if (result.show) {
        console.log(`   - Canales del show: [${result.show.channel.join(', ')}]`);
      }
      console.log(`   - Error: ${result.error || 'NINGUNO'}`);
      
      // Actualizar el show si se encontró uno
      setCurrentShow(result.show);
      console.log(`🎬 [App] ESTABLECIENDO CURRENT SHOW: ${result.show ? result.show.name : 'NULL'}`);
      
      // Actualizar mensaje de error si hay alguno
      setChannelError(result.error || null);
      
      // Reiniciar la animación cambiando la key
      setChannelDisplayKey(prev => prev + 1);

      // Si la programación está lista, intentar obtener el show actual desde la programación
      if (scheduleStatus === 'ready' && result.channelNumber) {
        try {
          // Obtener información del canal para conseguir el UUID
          const channelInfo = channelManager.getChannelInfo(result.channelNumber);
          if (channelInfo && (channelInfo.uuid || channelInfo.id)) {
            const channelId = channelInfo.uuid || channelInfo.id.toString();
            console.log(`🔍 [App] Buscando programación para canal ${result.channelNumber} (ID: ${channelId})`);
            
            const scheduleEntry = await window.electronAPI.schedule.getCurrentScheduleEntry(channelId);
            if (scheduleEntry) {
              console.log('📺 [App] Entrada de programación encontrada:', scheduleEntry);
              // Aquí podrías convertir ScheduleEntry a TVShow si fuera necesario
            } else {
              console.log('ℹ️ [App] No hay programación actual para este canal');
            }
          }
        } catch (scheduleError) {
          console.warn('⚠️ [App] Error obteniendo programación:', scheduleError);
          // Continúa con el show del channel manager como fallback
        }
      }

      if (result.error) {
        console.log('⚠️ [App]', result.error);
      }
    } catch (error) {
      console.error('❌ [App] Error al cambiar canal:', error);
      setChannelError(`Error al cambiar canal: ${error instanceof Error ? error.message : String(error)}`);
      setCurrentShow(null);
    }
  };

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
                setCurrentChannel(result.channelNumber); // ✅ Actualizar el estado del canal
                setCurrentShow(result.show);
                setChannelDisplayKey(prev => prev + 1);
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
            {/* Display del canal */}
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

            {/* Reproductor de video o mensaje de canal vacío */}
            {currentShow ? (
              <TVShowPlayer 
                show={currentShow}
                seasonNumber={1}  // Por defecto empezamos con la primera temporada
                style={settings.tvStyle === '90s' ? 'retro-90s' : 'retro-00s'}
                crtFilter={settings.tvStyle === '90s' && settings.crtFilter}
              />
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
            
            {/* Guía de programación */}
            {showGuide && (
              <TVGuide 
                onClose={() => setShowGuide(false)}
                onSelectProgram={(program, channel) => {
                  console.log('🎯 [App] Programa seleccionado:', program.showName, 'en canal:', channel.channelName);
                  // TODO: Navegar al canal y programa seleccionado
                  setShowGuide(false);
                }}
              />
            )}
          </div>

          <div className="tv-controls">
            <div className="channel-buttons">
              <button onClick={() => handleChannelChange('up')}>
                Channel Up
              </button>
              <button onClick={() => handleChannelChange('down')}>
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
                onClick={toggleGuide}
              >
                {settings.tvStyle === '90s' ? 'TV GUIDE' : 'Program Guide'}
              </button>
            </div>
          </div>

          {/* Menús de configuración */}
          <Menu90s
            settings={settings}
            onAspectRatioToggle={handleAspectRatioToggle}
            onStyleToggle={handleStyleToggle}
            onCRTFilterToggle={handleCRTFilterToggle}
            isMenuOpen={isMenuOpen && settings.tvStyle === '90s'}
          />
          <Menu00s
            settings={settings}
            onAspectRatioToggle={handleAspectRatioToggle}
            onStyleToggle={handleStyleToggle}
            isMenuOpen={isMenuOpen && settings.tvStyle === '00s'}
          />
        </>
      )}
    </div>
  );
}

export default App;
