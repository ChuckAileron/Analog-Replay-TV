import { ChannelConfig } from '../features/channels/channelsStorage';
import { TVProgram, ProgramConfig } from './program.types';

interface ElectronAPI {
  // Channels API
  saveChannelsConfig: (config: ChannelConfig) => Promise<boolean>;
  loadChannelsConfig: () => Promise<ChannelConfig>;
  selectChannelFile: () => Promise<string>;
  importChannelFile: (filePath: string) => Promise<ChannelConfig>;
  
  // Folder Selection
  selectFolder: () => Promise<string>;
  getFolderVideos: (folderPath: string) => Promise<Array<{
    episode: number;
    title: string;
    duration: string;
    fileName: string;
  }>>;
  
  // Programs API
  saveProgramsConfig: (config: ProgramConfig) => Promise<boolean>;
  loadProgramsConfig: () => Promise<ProgramConfig>;
  importProgramFile: (filePath: string) => Promise<TVProgram>;
  selectProgramFile: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}