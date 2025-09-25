export {};

import type { VideoMetadata } from './video.types';

declare global {
  interface ChannelConfig {
    channels: Array<{
      id: number;
      name: string;
      number: number;
      description?: string;
      isEnabled: boolean;
      currentProgram?: {
        id: number;
        name: string;
        description: string;
        startTime: string;
        endTime: string;
        channelId: number;
      };
    }>;
    lastUpdated: string;
  }

  interface ProgramConfig {
    programs: Array<{
      name: string;
      channel: string[];
      seasons: Array<{
        season: number;
        year: number;
        episodes: Array<{
          episode: number;
          title: string;
          duration: string;
        }>;
      }>;
    }>;
    lastUpdated: string;
  }

  interface ElectronAPI {
    // Schedule API
    schedule: {
      initialize: () => Promise<'needs_year_selection' | 'ready'>;
      setPrimaryYear: (year: number) => Promise<void>;
      getCurrentConfig: () => Promise<any>;
      getCurrentScheduleEntry: (channelId?: string) => Promise<any>;
      getScheduleEntryAt: (date: string, channelId?: string) => Promise<any>;
      getMonthSchedule: (year: number, month: number) => Promise<any>;
      generateYear: (year: number) => Promise<{ success: boolean; error?: string; generatedMonths?: number }>;
    };

    // Channels API
    saveChannelsConfig: (config: ChannelConfig) => Promise<boolean>;
    loadChannelsConfig: () => Promise<ChannelConfig>;
    selectChannelFile: () => Promise<string>;
    importChannelFile: (filePath: string) => Promise<ChannelConfig>;
    
    // Shows API
    saveShowsConfig: (config: ShowConfig) => Promise<boolean>;
    loadShowsConfig: () => Promise<ShowConfig>;
    importShowFile: (filePath: string) => Promise<{
      name: string;
      channel: string[];
      seasons: Array<{
        season: number;
        year: number;
        episodes: Array<{
          episode: number;
          title: string;
          duration: string;
        }>;
      }>;
    }>;
    selectShowFile: () => Promise<string>;
    selectVideoFile: () => Promise<string>;
    selectFolder: () => Promise<string>;
    getFolderVideos: (folderPath: string) => Promise<Array<{
      episode: number;
      title: string;
      duration: string;
      fileName: string;
    }>>;
    
    // Asset API
    getLocalFilePath: (virtualPath: string) => Promise<string>;
    getVideoUrl: (filePath: string) => Promise<string>;
    
    // Video Analysis & Conversion API
    analyzeVideo: (filePath: string) => Promise<{
      success: boolean;
      metadata?: VideoMetadata;
      compatibilityReport?: {
        canPlayNatively: boolean;
        recommendedAction: 'play' | 'convert' | 'unsupported';
        conversionNeeded: boolean;
        estimatedConversionTime: number;
      };
      error?: string;
    }>;
    convertVideo: (inputPath: string, options?: any) => Promise<{
      success: boolean;
      outputPath?: string;
      error?: string;
    }>;
    
    // External applications API
    openExternal: (filePath: string) => Promise<any>;

    // Video Conversion Queue API
    startVideoConversions: (channelSchedules: any) => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>;
    queueNextEpisodeConversion: (data: {
      currentShow: any;
      nextShow: any;
      channelId: string;
    }) => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>;
    stopVideoConversions: () => Promise<{
      success: boolean;
      message?: string;
    }>;
    getConversionQueueStatus: () => Promise<{
      isActive: boolean;
      channelStatuses: any[];
      overallProgress: number;
      currentJob?: any;
    }>;

    // Conversion Event Listeners
    onConversionQueueUpdate: (callback: (data: {
      channelStatuses: any[];
      overallProgress: number;
      currentJob?: any;
      isActive: boolean;
    }) => void) => void;
    onChannelConversionReady: (callback: (channelId: string) => void) => void;
    onAllConversionsCompleted: (callback: () => void) => void;
    onConversionError: (callback: (error: {
      channelId: string;
      jobId: string;
      error: string;
    }) => void) => void;

    // VLC Embedded API
    launchVLCEmbedded: (config: {
      filePath: string;
      port: number;
      password: string;
    }) => Promise<{
      success: boolean;
      processId: string;
      port: number;
    }>;
    closeVLCEmbedded: (processId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    checkVLCInstallation: () => Promise<{
      installed: boolean;
    }>;

    // WebCodecs API
    webcodecs: {
      checkSupport: () => Promise<{
        support: {
          supported: boolean;
          features: {
            videoDecoder: boolean;
            audioDecoder: boolean;
            videoEncoder: boolean;
            audioEncoder: boolean;
          };
        };
        codecs: {
          video: string[];
          audio: string[];
        };
      }>;
      play: (filePath: string) => Promise<void>;
      stop: () => Promise<void>;
      togglePause: () => Promise<boolean>;
    };

    // WebCodecs Event Listeners
    onWebCodecsVideoChunk: (callback: (event: any, data: { data: Buffer; timestamp: number }) => void) => void;
    onWebCodecsAudioChunk: (callback: (event: any, data: { data: Buffer; timestamp: number }) => void) => void;
    onWebCodecsStopped: (callback: () => void) => void;
    removeAllListeners?: (eventName: string) => void;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}