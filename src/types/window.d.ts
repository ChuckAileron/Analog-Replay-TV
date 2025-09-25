import { ChannelConfig } from '../features/channels/channelsStorage';
import type { VideoMetadata, ConversionOptions } from './video.types';

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

    // File Management API
    openExternal: (path: string) => Promise<{ success: boolean }>;
    getLocalFilePath: (virtualPath: string) => Promise<string>;
    getVideoUrl: (filePath: string) => Promise<string>;
    
    // VLC Legacy API (deprecated - será removido)
    launchVLCEmbedded?: (config: { filePath: string; port: number; password: string }) => Promise<any>;
    closeVLCEmbedded?: (processId: string) => Promise<{ success: boolean }>;
    checkVLCInstallation?: () => Promise<{ installed: boolean; path: string; error?: string }>;

    // ===== NUEVO MOTOR DE VIDEO =====
    
    // Analizar video para compatibilidad
    analyzeVideo: (filePath: string) => Promise<{
      success: boolean;
      metadata?: VideoMetadata;
      error?: string;
    }>;

    // Convertir video a formato compatible
    convertVideo: (inputPath: string, options: ConversionOptions) => Promise<{
      success: boolean;
      outputPath?: string;
      error?: string;
      metadata?: VideoMetadata;
    }>;

    // Cancelar conversión en progreso
    cancelConversion: (inputPath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;

    // ===== REPRODUCTOR NATIVO =====
    
    // Inicializar reproductor nativo
    initializeNativePlayer: (playerId: string, config: any) => Promise<{
      success: boolean;
      error?: string;
    }>;

    // Controles de reproducción nativa
    nativePlayerPlay: (playerId: string) => Promise<{ success: boolean; error?: string }>;
    nativePlayerPause: (playerId: string) => Promise<{ success: boolean; error?: string }>;
    nativePlayerStop: (playerId: string) => Promise<{ success: boolean; error?: string }>;
    nativePlayerSeek: (playerId: string, timeInSeconds: number) => Promise<{ success: boolean; error?: string }>;
    nativePlayerSetVolume: (playerId: string, volume: number) => Promise<{ success: boolean; error?: string }>;
    destroyNativePlayer: (playerId: string) => Promise<{ success: boolean; error?: string }>;

    // Eventos de video frames
    onVideoFrame: (callback: (event: any, frame: any) => void) => void;
    removeVideoFrameListener: (callback: (event: any, frame: any) => void) => void;
    onPlayerStateUpdate: (callback: (event: any, state: any) => void) => void;
    removePlayerStateUpdateListener: (callback: (event: any, state: any) => void) => void;

    // ===== FIN REPRODUCTOR NATIVO =====
  }

  interface Window {
    electronAPI: ElectronAPI
  }
}