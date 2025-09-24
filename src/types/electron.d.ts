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