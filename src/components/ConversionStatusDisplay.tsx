import React, { useState, useEffect } from 'react';
import type { ConversionJob, ChannelConversionStatus } from '../../electron/services/VideoConversionQueue';
import '../styles/conversion-status.css';

interface ConversionStatusDisplayProps {
  onChannelReady?: (channelId: string) => void;
  onAllCompleted?: () => void;
  className?: string;
}

/**
 * Component to display video conversion status with loading screens
 */
export const ConversionStatusDisplay: React.FC<ConversionStatusDisplayProps> = ({
  onChannelReady,
  onAllCompleted,
  className = ''
}) => {
  const [channelStatuses, setChannelStatuses] = useState<ChannelConversionStatus[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [currentConvertingJob, setCurrentConvertingJob] = useState<ConversionJob | null>(null);

  useEffect(() => {
    // Listen for conversion events from main process
    const handleConversionEvents = () => {
      // These would be IPC events from the VideoConversionQueue
      window.electronAPI?.onConversionQueueUpdate?.((data: any) => {
        updateProgress(data);
      });

      window.electronAPI?.onChannelConversionReady?.((channelId: string) => {
        handleChannelReady(channelId);
      });

      window.electronAPI?.onAllConversionsCompleted?.(() => {
        handleAllCompleted();
      });
    };

    handleConversionEvents();
  }, []);

  const updateProgress = (data: { 
    channelStatuses: ChannelConversionStatus[],
    overallProgress: number,
    currentJob?: ConversionJob 
  }) => {
    setChannelStatuses(data.channelStatuses);
    setCurrentConvertingJob(data.currentJob || null);
    setIsVisible(data.channelStatuses.some(status => !status.isReady));
  };

  const handleChannelReady = (channelId: string) => {
    setChannelStatuses(prev => 
      prev.map(status => 
        status.channelId === channelId 
          ? { ...status, isReady: true }
          : status
      )
    );
    
    if (onChannelReady) {
      onChannelReady(channelId);
    }
  };

  const handleAllCompleted = () => {
    setIsVisible(false);
    if (onAllCompleted) {
      onAllCompleted();
    }
  };

  const getOverallStats = () => {
    const totalJobs = channelStatuses.reduce((sum, status) => sum + status.totalJobs, 0);
    const completedJobs = channelStatuses.reduce((sum, status) => sum + status.completedJobs, 0);
    const readyChannels = channelStatuses.filter(status => status.isReady).length;
    const totalChannels = channelStatuses.length;

    return {
      totalJobs,
      completedJobs,
      readyChannels,
      totalChannels,
      percentage: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
    };
  };

  if (!isVisible || channelStatuses.length === 0) {
    return null;
  }

  const stats = getOverallStats();

  return (
    <div className={`conversion-status-overlay ${className}`}>
      <div className="conversion-status-container">
        {/* Header */}
        <div className="conversion-header">
          <div className="header-icon">🎬</div>
          <div className="header-content">
            <h1>Preparando Videos</h1>
            <p>Convirtiendo videos para mejor reproducción...</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="overall-progress">
          <div className="progress-header">
            <span className="progress-label">Progreso General</span>
            <span className="progress-percentage">{stats.percentage}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar overall"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
          <div className="progress-stats">
            <span>{stats.completedJobs}/{stats.totalJobs} videos completados</span>
            <span>{stats.readyChannels}/{stats.totalChannels} canales listos</span>
          </div>
        </div>

        {/* Current Converting Job */}
        {currentConvertingJob && (
          <div className="current-job">
            <div className="job-header">
              <span className="job-label">Convirtiendo Ahora:</span>
              <span className="job-channel">Canal {currentConvertingJob.channelId}</span>
            </div>
            <div className="job-details">
              <h3>{currentConvertingJob.showName}</h3>
              <p>Temporada {currentConvertingJob.seasonNumber}, Episodio {currentConvertingJob.episodeNumber}</p>
            </div>
            <div className="job-progress">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar current"
                  style={{ width: `${currentConvertingJob.progress}%` }}
                />
              </div>
              <span className="job-percentage">{Math.round(currentConvertingJob.progress)}%</span>
            </div>
          </div>
        )}

        {/* Channels List */}
        <div className="channels-list">
          <h3>Estado por Canal</h3>
          <div className="channels-grid">
            {channelStatuses.map(status => (
              <ChannelStatusCard key={status.channelId} status={status} />
            ))}
          </div>
        </div>

        {/* Loading Animation */}
        <div className="loading-animation">
          <div className="loading-spinner"></div>
          <p>Por favor espera mientras preparamos los videos...</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Individual channel status card
 */
interface ChannelStatusCardProps {
  status: ChannelConversionStatus;
}

const ChannelStatusCard: React.FC<ChannelStatusCardProps> = ({ status }) => {
  const progressPercentage = status.totalJobs > 0 
    ? Math.round((status.completedJobs / status.totalJobs) * 100) 
    : 100;

  return (
    <div className={`channel-status-card ${status.isReady ? 'ready' : 'converting'}`}>
      <div className="channel-header">
        <div className="channel-info">
          <h4>{status.channelName}</h4>
          <span className="channel-id">Canal {status.channelId}</span>
        </div>
        <div className="channel-status-icon">
          {status.isReady ? '✅' : '🔄'}
        </div>
      </div>

      <div className="channel-progress">
        <div className="progress-bar-container small">
          <div 
            className="progress-bar channel"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="channel-stats">
          <span>{status.completedJobs}/{status.totalJobs} videos</span>
          <span className={`status-text ${status.isReady ? 'ready' : 'converting'}`}>
            {status.isReady ? 'Listo' : 'Convirtiendo...'}
          </span>
        </div>
      </div>

      {status.currentJob && !status.isReady && (
        <div className="current-channel-job">
          <div className="job-name">
            {status.currentJob.showName}
          </div>
          <div className="job-episode">
            S{status.currentJob.seasonNumber}E{status.currentJob.episodeNumber}
          </div>
          <div className="job-progress-mini">
            {Math.round(status.currentJob.progress)}%
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Simple loading screen for individual channels
 */
export const ChannelLoadingScreen: React.FC<{ 
  channelId: string;
  channelName?: string;
  currentJob?: ConversionJob;
}> = ({ 
  channelId, 
  channelName = `Canal ${channelId}`,
  currentJob
}) => {
  return (
    <div className="channel-loading-screen">
      <div className="loading-content">
        <div className="channel-loading-header">
          <h2>📺 {channelName}</h2>
          <p>Preparando video...</p>
        </div>

        {currentJob && (
          <div className="loading-job-info">
            <h3>{currentJob.showName}</h3>
            <p>Temporada {currentJob.seasonNumber}, Episodio {currentJob.episodeNumber}</p>
            
            <div className="loading-progress">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar loading"
                  style={{ width: `${currentJob.progress}%` }}
                />
              </div>
              <span>{Math.round(currentJob.progress)}%</span>
            </div>
          </div>
        )}

        <div className="loading-spinner-container">
          <div className="loading-spinner large"></div>
          <p>Por favor espera...</p>
        </div>
      </div>
    </div>
  );
};

export default ConversionStatusDisplay;