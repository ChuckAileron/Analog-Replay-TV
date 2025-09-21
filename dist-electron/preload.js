import { contextBridge, ipcRenderer } from 'electron';
console.log('Preload script starting...');
try {
    // Exponer funcionalidades específicas de manera segura
    contextBridge.exposeInMainWorld('electronAPI', {
        // Channels API
        saveChannelsConfig: async (config) => {
            console.log('Saving channels config:', config);
            try {
                const result = await ipcRenderer.invoke('save-channels-config', config);
                console.log('Save result:', result);
                return result;
            }
            catch (error) {
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
            }
            catch (error) {
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
            }
            catch (error) {
                console.error('Error in selectChannelFile:', error);
                throw error;
            }
        },
        importChannelFile: async (filePath) => {
            console.log('Importing channel file:', filePath);
            try {
                const result = await ipcRenderer.invoke('import-channel-file', filePath);
                console.log('Channel import result:', result);
                return result;
            }
            catch (error) {
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
            }
            catch (error) {
                console.error('Error in selectFolder:', error);
                throw error;
            }
        },
        getFolderVideos: async (folderPath) => {
            console.log('Getting videos from folder:', folderPath);
            try {
                const result = await ipcRenderer.invoke('get-folder-videos', folderPath);
                console.log('Found videos:', result);
                return result;
            }
            catch (error) {
                console.error('Error in getFolderVideos:', error);
                throw error;
            }
        },
        // Programs API
        saveProgramsConfig: async (config) => {
            console.log('Saving programs config:', config);
            try {
                const result = await ipcRenderer.invoke('save-programs-config', config);
                console.log('Save result:', result);
                return result;
            }
            catch (error) {
                console.error('Error in saveProgramsConfig:', error);
                throw error;
            }
        },
        loadProgramsConfig: async () => {
            console.log('Loading programs config');
            try {
                const result = await ipcRenderer.invoke('load-programs-config');
                console.log('Load result:', result);
                return result;
            }
            catch (error) {
                console.error('Error in loadProgramsConfig:', error);
                throw error;
            }
        },
        importProgramFile: async (filePath) => {
            console.log('Importing program file:', filePath);
            try {
                const result = await ipcRenderer.invoke('import-program-file', filePath);
                console.log('Import result:', result);
                return result;
            }
            catch (error) {
                console.error('Error in importProgramFile:', error);
                throw error;
            }
        },
        selectProgramFile: async () => {
            console.log('Opening file dialog');
            try {
                const result = await ipcRenderer.invoke('select-program-file');
                console.log('Selected file:', result);
                return result;
            }
            catch (error) {
                console.error('Error in selectProgramFile:', error);
                throw error;
            }
        },
        // Asset API
        getLocalFilePath: async (virtualPath) => {
            console.log('Getting local file path for:', virtualPath);
            try {
                const result = await ipcRenderer.invoke('get-local-file-path', virtualPath);
                console.log('Local file path:', result);
                return result;
            }
            catch (error) {
                console.error('Error in getLocalFilePath:', error);
                throw error;
            }
        }
    });
    console.log('Preload script finished loading - API exposed successfully');
}
catch (error) {
    console.error('Error in preload script:', error);
}
//# sourceMappingURL=preload.js.map