import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script starting...');

try {
  // Exponer funcionalidades específicas de manera segura
  contextBridge.exposeInMainWorld(
    'electronAPI',
    {
      // Channels API
      saveChannelsConfig: async (config: any) => {
        console.log('Saving channels config:', config);
        try {
          const result = await ipcRenderer.invoke('save-channels-config', config);
          console.log('Save result:', result);
          return result;
        } catch (error) {
          console.error('Error in saveChannelsConfig:', error);
          throw error;
        }
      },
      loadChannelsConfig: async () => {
        console.log('Loading channels config');
        try {
          const result = await ipcRenderer.invoke('load-channels-config');
          console.log('Load result:', result);
          return result;
        } catch (error) {
          console.error('Error in loadChannelsConfig:', error);
          throw error;
        }
      },

      // Channel Import API
      selectChannelFile: async () => {
        console.log('Opening channel file dialog');
        try {
          const result = await ipcRenderer.invoke('select-channel-file');
          console.log('Selected channel file:', result);
          return result;
        } catch (error) {
          console.error('Error in selectChannelFile:', error);
          throw error;
        }
      },
      importChannelFile: async (filePath: string) => {
        console.log('Importing channel file:', filePath);
        try {
          const result = await ipcRenderer.invoke('import-channel-file', filePath);
          console.log('Channel import result:', result);
          return result;
        } catch (error) {
          console.error('Error in importChannelFile:', error);
          throw error;
        }
      },
      
      // Folder Selection API
      selectFolder: async () => {
        console.log('Opening folder selection dialog');
        try {
          const result = await ipcRenderer.invoke('select-folder');
          console.log('Selected folder:', result);
          return result;
        } catch (error) {
          console.error('Error in selectFolder:', error);
          throw error;
        }
      },

      getFolderVideos: async (folderPath: string) => {
        console.log('Getting videos from folder:', folderPath);
        try {
          const result = await ipcRenderer.invoke('get-folder-videos', folderPath);
          console.log('Found videos:', result);
          return result;
        } catch (error) {
          console.error('Error in getFolderVideos:', error);
          throw error;
        }
      },

      // Shows API
      saveShowsConfig: async (config: any) => {
        console.log('Saving programs config:', config);
        try {
          const result = await ipcRenderer.invoke('save-shows-config', config);
          console.log('Save result:', result);
          return result;
        } catch (error) {
          console.error('Error in saveShowsConfig:', error);
          throw error;
        }
      },
      loadShowsConfig: async () => {
        console.log('Loading programs config');
        try {
          const result = await ipcRenderer.invoke('load-shows-config');
          console.log('Load result:', result);
          return result;
        } catch (error) {
          console.error('Error in loadShowsConfig:', error);
          throw error;
        }
      },
      importShowFile: async (filePath: string) => {
        console.log('Importing program file:', filePath);
        try {
          const result = await ipcRenderer.invoke('import-show-file', filePath);
          console.log('Import result:', result);
          return result;
        } catch (error) {
          console.error('Error in importShowFile:', error);
          throw error;
        }
      },
      selectShowFile: async () => {
        console.log('Opening file dialog');
        try {
          const result = await ipcRenderer.invoke('select-show-file');
          console.log('Selected file:', result);
          return result;
        } catch (error) {
          console.error('Error in selectShowFile:', error);
          throw error;
        }
      },

      selectVideoFile: async () => {
        console.log('Opening video file dialog');
        try {
          const result = await ipcRenderer.invoke('select-video-file');
          console.log('Selected video file:', result);
          return result;
        } catch (error) {
          console.error('Error in selectVideoFile:', error);
          throw error;
        }
      },
      
      // Asset API
      getLocalFilePath: async (virtualPath: string) => {
        console.log('🔍 [Preload] Getting local file path for:', virtualPath);
        try {
          const result = await ipcRenderer.invoke('get-local-file-path', virtualPath);
          console.log('✅ [Preload] Local file path result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in getLocalFilePath:', error);
          throw error;
        }
      },

      getVideoUrl: async (filePath: string) => {
        console.log('🎬 [Preload] Getting video URL for:', filePath);
        try {
          const result = await ipcRenderer.invoke('get-video-url', filePath);
          console.log('🔗 [Preload] Video URL result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in getVideoUrl:', error);
          throw error;
        }
      },

      // External application API
      openExternal: async (filePath: string) => {
        console.log('🎬 [Preload] Opening external application for:', filePath);
        try {
          const result = await ipcRenderer.invoke('open-external', filePath);
          console.log('✅ [Preload] External open result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in openExternal:', error);
          throw error;
        }
      },

      // VLC Embedded API
      launchVLCEmbedded: async (config: {
        filePath: string;
        port: number;
        password: string;
      }) => {
        console.log('🎬 [Preload] Launching VLC embedded for:', config.filePath);
        try {
          const result = await ipcRenderer.invoke('launch-vlc-embedded', config);
          console.log('✅ [Preload] VLC launch result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in launchVLCEmbedded:', error);
          throw error;
        }
      },

      closeVLCEmbedded: async (processId: string) => {
        console.log('🔚 [Preload] Closing VLC embedded process:', processId);
        try {
          const result = await ipcRenderer.invoke('close-vlc-embedded', processId);
          console.log('✅ [Preload] VLC close result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in closeVLCEmbedded:', error);
          throw error;
        }
      },

      checkVLCInstallation: async () => {
        console.log('🔍 [Preload] Checking VLC installation');
        try {
          const result = await ipcRenderer.invoke('check-vlc-installation');
          console.log('✅ [Preload] VLC installation check result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in checkVLCInstallation:', error);
          throw error;
        }
      },

      // ===== NUEVO MOTOR DE VIDEO =====
      
      // Analizar video
      analyzeVideo: async (filePath: string) => {
        console.log('🔍 [Preload] Analyzing video:', filePath);
        try {
          const result = await ipcRenderer.invoke('analyze-video', filePath);
          console.log('✅ [Preload] Video analysis result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in analyzeVideo:', error);
          throw error;
        }
      },

      // Convertir video
      convertVideo: async (inputPath: string, options: any) => {
        console.log('🔄 [Preload] Converting video:', inputPath);
        try {
          const result = await ipcRenderer.invoke('convert-video', inputPath, options);
          console.log('✅ [Preload] Video conversion result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in convertVideo:', error);
          throw error;
        }
      },

      // Cancelar conversión
      cancelConversion: async (inputPath: string) => {
        console.log('🛑 [Preload] Cancelling conversion:', inputPath);
        try {
          const result = await ipcRenderer.invoke('cancel-conversion', inputPath);
          console.log('✅ [Preload] Cancellation result:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error in cancelConversion:', error);
          throw error;
        }
      },

      // ===== REPRODUCTOR NATIVO =====
      
      // Inicializar reproductor nativo
      initializeNativePlayer: async (playerId: string, config: any) => {
        console.log('🎬 [Preload] Initializing native player:', playerId);
        try {
          const result = await ipcRenderer.invoke('initialize-native-player', playerId, config);
          console.log('✅ [Preload] Native player initialized:', result);
          return result;
        } catch (error) {
          console.error('❌ [Preload] Error initializing native player:', error);
          throw error;
        }
      },

      // Controles del reproductor nativo
      nativePlayerPlay: async (playerId: string) => {
        return await ipcRenderer.invoke('native-player-play', playerId);
      },

      nativePlayerPause: async (playerId: string) => {
        return await ipcRenderer.invoke('native-player-pause', playerId);
      },

      nativePlayerStop: async (playerId: string) => {
        return await ipcRenderer.invoke('native-player-stop', playerId);
      },

      nativePlayerSeek: async (playerId: string, timeInSeconds: number) => {
        return await ipcRenderer.invoke('native-player-seek', playerId, timeInSeconds);
      },

      nativePlayerSetVolume: async (playerId: string, volume: number) => {
        return await ipcRenderer.invoke('native-player-set-volume', playerId, volume);
      },

      destroyNativePlayer: async (playerId: string) => {
        return await ipcRenderer.invoke('destroy-native-player', playerId);
      },

      // Listeners para frames de video
      onVideoFrame: (callback: (event: any, frame: any) => void) => {
        ipcRenderer.on('video-frame', callback);
      },

      removeVideoFrameListener: (callback: (event: any, frame: any) => void) => {
        ipcRenderer.removeListener('video-frame', callback);
      },

      onPlayerStateUpdate: (callback: (event: any, state: any) => void) => {
        ipcRenderer.on('player-state-update', callback);
      },

      removePlayerStateUpdateListener: (callback: (event: any, state: any) => void) => {
        ipcRenderer.removeListener('player-state-update', callback);
      },

      // ===== FIN REPRODUCTOR NATIVO =====

      // ===== WEBCODECS API =====
      
      webcodecs: {
        checkSupport: async () => {
          console.log('🔍 [Preload] Checking WebCodecs support');
          try {
            const result = await ipcRenderer.invoke('webcodecs:check-support');
            console.log('✅ [Preload] WebCodecs support result:', result);
            return result;
          } catch (error) {
            console.error('❌ [Preload] Error checking WebCodecs support:', error);
            throw error;
          }
        },

        play: async (filePath: string) => {
          console.log('🎬 [Preload] Playing with WebCodecs:', filePath);
          try {
            const result = await ipcRenderer.invoke('webcodecs:play', filePath);
            console.log('✅ [Preload] WebCodecs play result:', result);
            return result;
          } catch (error) {
            console.error('❌ [Preload] Error playing with WebCodecs:', error);
            throw error;
          }
        },

        stop: async () => {
          console.log('🛑 [Preload] Stopping WebCodecs playback');
          try {
            const result = await ipcRenderer.invoke('webcodecs:stop');
            console.log('✅ [Preload] WebCodecs stop result:', result);
            return result;
          } catch (error) {
            console.error('❌ [Preload] Error stopping WebCodecs:', error);
            throw error;
          }
        },

        togglePause: async () => {
          console.log('⏯️ [Preload] Toggling WebCodecs pause');
          try {
            const result = await ipcRenderer.invoke('webcodecs:toggle-pause');
            console.log('✅ [Preload] WebCodecs toggle pause result:', result);
            return result;
          } catch (error) {
            console.error('❌ [Preload] Error toggling WebCodecs pause:', error);
            throw error;
          }
        },

        // Event Listeners
        onWebCodecsVideoChunk: (callback: (event: any, data: { data: Buffer; timestamp: number }) => void) => {
          ipcRenderer.on('webcodecs:video-chunk', callback);
        },

        onWebCodecsAudioChunk: (callback: (event: any, data: { data: Buffer; timestamp: number }) => void) => {
          ipcRenderer.on('webcodecs:audio-chunk', callback);
        }
      },

      onWebCodecsStopped: (callback: () => void) => {
        ipcRenderer.on('webcodecs:stopped', callback);
      },

      removeAllListeners: (eventName: string) => {
        ipcRenderer.removeAllListeners(eventName);
      },

      // Logger para el HTML
      log: (message: string) => {
        console.log(message);
        // También enviar al main process si necesitas
        ipcRenderer.invoke('log-message', message).catch(() => {});
      },

      // ===== FIN WEBCODECS API =====

      // ===== VIDEOSTREAMMANAGER API =====
      
      testVideoStreamManager: async (config: any) => {
        console.log('Testing VideoStreamManager:', config);
        try {
          const result = await ipcRenderer.invoke('test-videostream-manager', config);
          console.log('VideoStreamManager test result:', result);
          return result;
        } catch (error) {
          console.error('Error in testVideoStreamManager:', error);
          throw error;
        }
      },

      stopVideoStreamManager: async () => {
        console.log('Stopping VideoStreamManager');
        try {
          const result = await ipcRenderer.invoke('stop-videostream-manager');
          console.log('VideoStreamManager stop result:', result);
          return result;
        } catch (error) {
          console.error('Error in stopVideoStreamManager:', error);
          throw error;
        }
      },

      cleanupTempFile: async (tempFilePath: string) => {
        console.log('Requesting temp file cleanup:', tempFilePath);
        try {
          const result = await ipcRenderer.invoke('cleanup-temp-file', tempFilePath);
          console.log('Temp file cleanup result:', result);
          return result;
        } catch (error) {
          console.error('Error in cleanupTempFile:', error);
        }
      },

      showOpenDialog: async () => {
        console.log('Opening file dialog');
        try {
          const result = await ipcRenderer.invoke('show-open-dialog');
          console.log('File dialog result:', result);
          return result;
        } catch (error) {
          console.error('Error in showOpenDialog:', error);
          throw error;
        }
      },

      executeScript: async (script: string) => {
        console.log('Executing script in renderer');
        try {
          const result = await ipcRenderer.invoke('execute-script', script);
          console.log('Script execution result:', result);
          return result;
        } catch (error) {
          console.error('Error in executeScript:', error);
          throw error;
        }
      },

      // ===== FIN VIDEOSTREAMMANAGER API =====

      // ===== RENDERER EVENTS API =====
      
      ipcRenderer: {
        on: (channel: string, callback: (...args: any[]) => void) => {
          // Lista de canales permitidos para seguridad
          const allowedChannels = ['transcoding-progress', 'transcoding-complete'];
          if (allowedChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
          }
        },
        removeListener: (channel: string, callback: (...args: any[]) => void) => {
          const allowedChannels = ['transcoding-progress', 'transcoding-complete'];
          if (allowedChannels.includes(channel)) {
            ipcRenderer.removeListener(channel, callback);
          }
        },
        removeAllListeners: (channel: string) => {
          ipcRenderer.removeAllListeners(channel);
        }
      },

      // ===== FIN RENDERER EVENTS API =====

      // ===== FIN MOTOR DE VIDEO =====
    }
  );
  console.log('Preload script finished loading - API exposed successfully');
} catch (error) {
  console.error('Error in preload script:', error);
}







