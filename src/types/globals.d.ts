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

      // Folder API
      selectFolder: () => Promise<string>;
      getFolderVideos: (folderPath: string) => Promise<any>;

      // Asset API
      getLocalFilePath: (virtualPath: string) => Promise<string>;
      openExternal: (filePath: string) => Promise<any>;

      // Video Engine API
      analyzeVideo: (filePath: string) => Promise<any>;
      convertVideo: (filePath: string, options?: any) => Promise<any>;
      clearVideoCache: () => Promise<any>;
    }
  }
}

export {};