import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { getVideoDurationInSeconds } from 'get-video-duration';

// Equivalente a __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Forzar hardware acceleration
if (!app.isReady()) {
  app.commandLine.appendSwitch('ignore-gpu-blacklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
}

// Registrar protocolo personalizado para assets
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      stream: true,
    }
  }
]);

// Handler para obtener una ruta de archivo local
ipcMain.handle('get-local-file-path', async (_, virtualPath) => {
  try {
    // Convertir la ruta virtual a una ruta real del sistema
    const realPath = path.resolve(virtualPath);
    // Verificar que el archivo existe
    await fs.access(realPath);
    return realPath;
  } catch (error) {
    console.error('Error accessing file:', error);
    throw error;
  }
});

app.whenReady().then(() => {
  // Registrar el protocolo asset
  protocol.registerFileProtocol('asset', (request, callback) => {
    try {
      let filePath = decodeURIComponent(request.url.slice('asset://'.length));
      // Remover la barra inicial en Windows si existe
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      console.log('Loading asset:', filePath);
      callback({ path: filePath });
    } catch (error) {
      console.error('Error loading asset:', error);
      callback({ error: -2 });
    }
  });
});

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../dist-electron/preload.js'),
      sandbox: false,
      // Deshabilitar características que no usamos para evitar errores en la consola
      spellcheck: false,
      // Permitir reproducción de archivos locales
      webSecurity: false,
      // Opciones para mejorar el rendimiento del video
      backgroundThrottling: false,
      // Habilitar aceleración por hardware
      offscreen: false,
      webgl: true,
    },
    frame: false, // Removes the default window frame
    backgroundColor: '#000000', // Black background for TV effect
    resizable: true,
    fullscreenable: true,
  });

  // Set CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* data: media: mediastream: filesystem: asset:",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:* blob:",
          "media-src 'self' media: file: mediastream: filesystem: asset: blob:",
          "img-src 'self' media: file: data: mediastream: filesystem: blob:",
          "connect-src 'self' http://localhost:* ws://localhost:* asset: blob:",
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline'"
        ]
      }
    });
  });

  // Suprimir mensajes de error específicos
  mainWindow.webContents.on('console-message', (_, level, message) => {
    // Ignorar mensajes específicos de Autofill y otros que no afectan la funcionalidad
    if (message.includes('Autofill.') || 
        message.includes("'Autofill.") ||
        message.includes('DevTools') ||
        message.includes('Extension')) {
      return;
    }
    // Mostrar otros mensajes de error/advertencia importantes
    if (level === 2) { // ERROR
      console.error(message);
    } else if (level === 1) { // WARNING
      console.warn(message);
    }
  });

  // Load the app
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:5173' // Vite dev server
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );

  // Open the DevTools in development mode.
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Lista de extensiones de video soportadas
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv'];

async function getVideoFiles(folderPath: string) {
  try {
    const files = await fs.readdir(folderPath);
    const videoFiles = files
      .filter(file => VIDEO_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const videoInfoPromises = videoFiles.map(async (file, index) => {
      const filePath = path.join(folderPath, file);
      const stats = await fs.stat(filePath);
      let duration;
      try {
        const durationInSeconds = await getVideoDurationInSeconds(filePath);
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = Math.floor(durationInSeconds % 60);
        duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } catch (error) {
        console.error(`Error getting duration for ${file}:`, error);
        duration = '00:00';
      }

      // Obtener el nombre del episodio del nombre del archivo (sin extensión)
      const title = path.basename(file, path.extname(file))
        .replace(/^[0-9]+[-_.\s]*/g, '') // Remover números y separadores del inicio
        .replace(/[-_.]/g, ' ') // Reemplazar separadores por espacios
        .trim();

      return {
        episode: index + 1,
        title,
        duration,
        fileName: file
      };
    });

    return await Promise.all(videoInfoPromises);
  } catch (error) {
    console.error('Error reading video files:', error);
    throw error;
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Manejo de eventos IPC para canales
ipcMain.handle('save-channels-config', async (_, config) => {
  try {
    const configPath = path.join(process.cwd(), 'src/config/channels/channels.config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  }
  catch (error) {
    console.error('Error saving channels config:', error);
    throw error;
  }
});

ipcMain.handle('load-channels-config', async () => {
  try {
    const configPath = path.join(process.cwd(), 'src/config/channels/channels.config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  }
  catch (error) {
    console.error('Error loading channels config:', error);
    throw error;
  }
});

// Manejadores de importación de canales
ipcMain.handle('select-channel-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: path.join(process.cwd(), 'src/config/channels')
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }
  catch (error) {
    console.error('Error selecting channel file:', error);
    throw error;
  }
});

ipcMain.handle('import-channel-file', async (_, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const importedConfig = JSON.parse(data);
    
    // Guardar en el archivo de configuración
    const configPath = path.join(process.cwd(), 'src/config/channels/channels.config.json');
    await fs.writeFile(configPath, JSON.stringify(importedConfig, null, 2), 'utf-8');
    
    return importedConfig;
  }
  catch (error) {
    console.error('Error importing channel file:', error);
    throw error;
  }
});

// Manejo de eventos IPC para programas
ipcMain.handle('save-programs-config', async (_, config) => {
  try {
    const configPath = path.join(process.cwd(), 'src/config/programs/programs.config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  }
  catch (error) {
    console.error('Error saving programs config:', error);
    throw error;
  }
});

ipcMain.handle('load-programs-config', async () => {
  try {
    const configPath = path.join(process.cwd(), 'src/config/programs/programs.config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // Si el archivo no existe, devolver una configuración vacía
      return { programs: [], lastUpdated: new Date().toISOString() };
    }
    console.error('Error loading programs config:', error);
    throw error;
  }
});

ipcMain.handle('import-program-file', async (_, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }
  catch (error) {
    console.error('Error importing program file:', error);
    throw error;
  }
});

// Manejador para selección de carpeta
ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: process.cwd()
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }
  catch (error) {
    console.error('Error selecting folder:', error);
    throw error;
  }
});

// Manejador para obtener información de los videos de una carpeta
ipcMain.handle('get-folder-videos', async (_, folderPath) => {
  try {
    return await getVideoFiles(folderPath);
  } catch (error) {
    console.error('Error in get-folder-videos:', error);
    throw error;
  }
});

ipcMain.handle('select-program-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: path.join(process.cwd(), 'src/config/programs')
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }
  catch (error) {
    console.error('Error selecting program file:', error);
    throw error;
  }
});
