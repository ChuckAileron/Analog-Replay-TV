/// <reference types="electron" />

declare global {
  interface Window {
    electronAPI: {
      // Channels API
      saveChannelsConfig: (config: any) => Promise<boolean>;
      loadChannelsConfig: () => Promise<any>;
      selectChannelFile: () => Promise<string>;
      importChannelFile: (filePath: string) => Promise<any>;
      
      // Programs API
      saveProgramsConfig: (config: any) => Promise<boolean>;
      loadProgramsConfig: () => Promise<any>;
      importProgramFile: (filePath: string) => Promise<any>;
      selectProgramFile: () => Promise<string>;
    }
  }
}

export {};