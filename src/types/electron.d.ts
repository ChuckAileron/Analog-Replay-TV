export {};

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
    
    // Programs API
    saveProgramsConfig: (config: ProgramConfig) => Promise<boolean>;
    loadProgramsConfig: () => Promise<ProgramConfig>;
    importProgramFile: (filePath: string) => Promise<{
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
    selectProgramFile: () => Promise<string>;
    
    // Asset API
    getLocalFilePath: (virtualPath: string) => Promise<string>;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}