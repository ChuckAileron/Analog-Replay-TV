import { useState, useEffect } from 'react';
import type { TVSettings } from './types/tv.types';
import type { TVProgram } from './types/program.types';
import { channelManager } from './features/channels/channelManager';
import { settingsManager } from './features/settings/settingsManager';
import { Menu90s } from './components/Menu90s';
import { Menu00s } from './components/Menu00s';
import { VideoPlayer } from './components/VideoPlayer';

import './styles/common-90s.css';
import './styles/tv-1990s.css';
import './styles/tv-2000s.css';
import './styles/menu-90s.css';
import './styles/menu-00s.css';
import './styles/tv-components.css';
import './styles/menu.css';
import './styles/channel-display.css';
import './styles/controls-00s.css';

function App() {
  const [currentChannel, setCurrentChannel] = useState<number>(1);
  const [currentProgram, setCurrentProgram] = useState<TVProgram | null>(null);
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
      
      // Actualizar el programa si se encontró uno
      setCurrentProgram(result.program);
      
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
      setCurrentProgram(null);
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

        {/* Reproductor de video */}
        {currentProgram && (
          <VideoPlayer 
            program={currentProgram}
            seasonNumber={1}  // Por defecto empezamos con la primera temporada
            decadeStyle={settings.tvStyle}
          />
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
