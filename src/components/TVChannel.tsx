import React, { useEffect, useState } from 'react';
import { TVView } from '../views/TVView';
import { channelManager } from '../features/channels/channelManager';
import type { Channel } from '../types/tv.types';

interface TVChannelProps {
  channelNumber: number;
  decadeStyle?: '90s' | '00s';
}

const TVChannel: React.FC<TVChannelProps> = ({ channelNumber, decadeStyle = '90s' }) => {
  const [channelInfo, setChannelInfo] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChannel = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 [TVChannel] Inicializando canales...');
        await channelManager.initialize();
        
        console.log('🔍 [TVChannel] Buscando canal:', channelNumber);
        const info = await channelManager.getChannelInfo(channelNumber);
        console.log('📺 [TVChannel] Información del canal:', info);
        
        setChannelInfo(info);
      } catch (err) {
        console.error('❌ [TVChannel] Error cargando información del canal:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadChannel();
  }, [channelNumber]);

  if (isLoading) {
    return (
      <div className={`tv-channel style-${decadeStyle}`}>
        <div className="channel-static">
          <div className="loading-text">Sintonizando canal {channelNumber}...</div>
        </div>
      </div>
    );
  }

  if (!channelInfo || !channelInfo.isEnabled) {
    return (
      <div className={`tv-channel style-${decadeStyle}`}>
        <div className="channel-static">
          <div className="no-signal-text">Sin señal - Canal {channelNumber}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`tv-channel style-${decadeStyle}`}>
      <div className="channel-content">
        <div className="channel-info">
          <span className="channel-number">{channelNumber}</span>
          <span className="channel-name">{channelInfo.name}</span>
        </div>

        <TVView 
          channelNumber={channelNumber} 
          decadeStyle={decadeStyle}
        />
      </div>
    </div>
  );
};

export default TVChannel;
