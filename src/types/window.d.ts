import { ChannelConfig } from '../features/channels/channelsStorage';
import { TVProgram, ProgramConfig } from './program.types';

declare global {
  interface ElectronAPI {
    // Channels API
    saveChannelsConfig: (config: ChannelConfig) => Promise<boolean>;
    loadChannelsConfig: () => Promise<ChannelConfig>;
    selectChannelFile: () => Promise<string>;
    importChannelFile: (filePath: string) => Promise<ChannelConfig>;
    
    // Programs API
    saveProgramsConfig: (config: ProgramConfig) => Promise<boolean>;
    loadProgramsConfig: () => Promise<ProgramConfig>;
    importProgramFile: (filePath: string) => Promise<TVProgram>;
    selectProgramFile: () => Promise<string>;
  }

  interface Window {
    electronAPI: ElectronAPI
  }
}