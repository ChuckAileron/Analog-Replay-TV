import { useState, useEffect } from 'react';
import type { TVSettings } from './types/tv.types';
import type { TVShow } from './types/show.types';
import { channelManager } from './features/channels/channelManager';
import { settingsManager } from './features/settings/settingsManager';
import { Menu90s } from './components/Menu90s';
import { Menu00s } from './components/Menu00s';
import { TVShowPlayer } from './components/TVShowPlayer';

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
  const [currentChannel, setCurrentChannel] = useState<number>(1);
  const [currentShow, setCurrentShow] = useState<TVShow | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [settings, setSettings] = useState<TVSettings>(settingsManager.getCurrentSettings());
  const [channelDisplayKey, setChannelDisplayKey] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Inicializar canales y configuración al montar el componente
  useEffect(() => {
    const init = async () => {
      try {
        console.log('Starting initialization...');
        
        // Cargar configuración
        setSettings(settingsManager.getCurrentSettings());
        
        // Inicializar canales
        await channelManager.initialize();
        
        // Forzar actualización del display
        setChannelDisplayKey(prev => prev + 1);
        
        console.log('Initialization complete');
      } catch (error) {
        console.error('Error initializing:', error);
      }
    };

    init();
  }, []);

  const handleChannelChange = async (direction: 'up' | 'down'): Promise<void> => {
    try {
      const result = await channelManager.changeChannel(currentChannel, direction);
      
      // Actualizar el canal actual
      setCurrentChannel(result.channelNumber);
      
      // Actualizar el show si se encontró uno
      setCurrentShow(result.show);
      
      // Actualizar mensaje de error si hay alguno
      setChannelError(result.error || null);
      
      // Reiniciar la animación cambiando la key
      setChannelDisplayKey(prev => prev + 1);

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
            const channelInfo = channelManager.getChannelInfo(currentChannel);
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
          <div className="program-guide">
            <h2>TV Guide</h2>
            <p>Coming soon...</p>
          </div>
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
    </div>
  );
}

export default App;
