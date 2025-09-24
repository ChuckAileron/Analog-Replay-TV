import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron';
import path from 'path';
import os from 'os';
import isDev from 'electron-is-dev';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { spawn, ChildProcess } from 'child_process';
import { videoConverter } from './services/VideoConverter.js';
import { videoAnalyzer } from './services/VideoAnalyzer.js';
import { NativeVideoPlayerManager } from './services/NativeVideoPlayer.js';
import { VideoStreamManager } from './services/VideoStreamManager.js';

// Importar VideoEngineMain dinámicamente para evitar problemas de paths
let VideoEngineMain: any;

// Equivalente a __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instancia global del motor de video
let videoEngine: any;

// Instancia global del manager de reproductores nativos
const nativePlayerManager = NativeVideoPlayerManager.getInstance();

// Instancia global del VideoStreamManager
let videoStreamManager: VideoStreamManager | null = null;

// Prevenir múltiples instancias de la aplicación
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('🚫 [Main] Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window instead
    console.log('🔔 [Main] Second instance attempted. Focusing existing window...');
    // Focus existing window if it exists
  });
}

// Forzar hardware acceleration y configuración de video
if (!app.isReady()) {
  // Aceleración por hardware básica
  app.commandLine.appendSwitch('ignore-gpu-blacklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
  app.commandLine.appendSwitch('enable-hardware-overlays');
  
  // Soporte específico para video
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,UseChromeOSDirectVideoDecoder,VaapiVideoEncoder');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  
  // Decodificación de video acelerada
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
  app.commandLine.appendSwitch('enable-mpeg2-video-decode');
  
  // Prevenir suspensión de medios en background
  app.commandLine.appendSwitch('disable-background-media-suspend');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  
  // Configuración adicional para video
  app.commandLine.appendSwitch('enable-unsafe-webgpu'); // Para WebGL acceleration
  app.commandLine.appendSwitch('use-gl', 'desktop'); // Usar OpenGL desktop
  app.commandLine.appendSwitch('enable-webgl');
  app.commandLine.appendSwitch('enable-webgl2');
  
  // Mejorar compatibilidad con codecs
  app.commandLine.appendSwitch('enable-media-session-api');
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  
  // Debugging de video (temporal para diagnóstico)
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('log-level', '0');
  app.commandLine.appendSwitch('vmodule', 'media*=3');
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
    console.log('📂 [Main] Getting local file path for:', virtualPath);
    
    // Convertir la ruta virtual a una ruta real del sistema
    const realPath = path.resolve(virtualPath);
    console.log('🔍 [Main] Resolved path:', realPath);
    
    // Verificar que el archivo existe
    await fs.access(realPath);
    console.log('✅ [Main] File access verified');
    
    return realPath;
  } catch (error) {
    console.error('❌ [Main] Error accessing file:', error);
    console.error('❌ [Main] Virtual path was:', virtualPath);
    throw error;
  }
});

// Handler para obtener URL de archivo local (con diferentes protocolos)
ipcMain.handle('get-video-url', async (_, filePath) => {
  try {
    console.log('🎬 [Main] Getting video URL for:', filePath);
    
    // Verificar que el archivo existe
    await fs.access(filePath);
    
    // Usar asset:// protocol que está registrado y funciona mejor en Electron
    const encodedPath = encodeURIComponent(filePath);
    const assetUrl = `asset://${encodedPath}`;
    console.log('🔗 [Main] Generated asset URL:', assetUrl);
    
    return assetUrl;
  } catch (error) {
    console.error('❌ [Main] Error getting video URL:', error);
    throw error;
  }
});

// Handler para abrir archivos con aplicaciones externas
ipcMain.handle('open-external', async (_, filePath) => {
  try {
    console.log('🎬 [Main] Opening external application for:', filePath);
    await shell.openPath(filePath);
    console.log('✅ [Main] External application opened successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ [Main] Error opening external application:', error);
    throw error;
  }
});

app.whenReady().then(async () => {
  // Inicializar motor de video
  try {
    await initializeVideoEngine();
    console.log('✅ [Main] Motor de video inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando motor de video:', error);
    // Continuar sin motor de video (fallback al reproductor simple)
  }

  // Crear ventana principal
  const mainWindow = createWindow();
  
  // Inicializar VideoStreamManager
  videoStreamManager = new VideoStreamManager(mainWindow);
  console.log('✅ [Main] VideoStreamManager inicializado correctamente');
  
  // Registrar el protocolo asset
  protocol.registerFileProtocol('asset', (request, callback) => {
    try {
      console.log('🎬 [Protocol] Asset request:', request.url);
      
      let filePath = decodeURIComponent(request.url.slice('asset://'.length));
      console.log('📁 [Protocol] Decoded file path:', filePath);
      
      // En Windows, asegurar que la ruta tiene el formato correcto
      if (process.platform === 'win32') {
        // Si la ruta no tiene el formato de drive correcto, añadir :\
        if (filePath.match(/^[a-zA-Z]\//) && !filePath.match(/^[a-zA-Z]:\\/)) {
          filePath = filePath.charAt(0) + ':\\' + filePath.slice(2);
        }
        // Si empieza con /, removerlo
        if (filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }
        console.log('🖥️ [Protocol] Windows path adjusted:', filePath);
      }
      
      console.log('✅ [Protocol] Final path for loading:', filePath);
      
      // Verificar que el archivo existe antes de servirlo
      fs.access(filePath)
        .then(() => {
          console.log('✅ [Protocol] File exists, serving:', filePath);
          callback({ path: filePath });
        })
        .catch((error) => {
          console.error('❌ [Protocol] File not found:', filePath, error);
          callback({ error: -6 }); // FILE_NOT_FOUND
        });
        
    } catch (error) {
      console.error('❌ [Protocol] Error loading asset:', error);
      callback({ error: -2 }); // GENERIC_FAILURE
    }
  });
});

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    center: true,
    show: false, // Don't show until ready-to-show
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
      // Habilitar características de video
      experimentalFeatures: true,
      // Permitir autoplay
      autoplayPolicy: 'no-user-gesture-required',
      // Configuraciones adicionales para video
      allowRunningInsecureContent: true,
      // Mejorar compatibilidad con protocolos personalizados
      additionalArguments: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--enable-media-stream',
        '--allow-file-access-from-files',
        '--disable-site-isolation-trials',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ]
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
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://localhost:* https://cdn.jsdelivr.net data: media: mediastream: filesystem: asset: file:",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:* https://localhost:* https://cdn.jsdelivr.net blob:",
          "script-src-elem 'self' 'unsafe-inline' http://localhost:* https://localhost:* https://cdn.jsdelivr.net",
          "media-src 'self' media: file: mediastream: filesystem: asset: blob: data: http://localhost:* https://localhost:* *.mp4 *.mpeg *.mpg *.m2v",
          "img-src 'self' media: file: data: mediastream: filesystem: blob: http://localhost:* https://localhost:*",
          "connect-src 'self' http://localhost:* https://localhost:* https://cdn.jsdelivr.net ws://localhost:* wss://localhost:* asset: blob:",
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "object-src 'none'",
          "frame-src 'self' http://localhost:* https://localhost:*"
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
  // Para testing: cargar archivo de prueba VideoStreamManager
  const useTestFile = process.env.TEST_VIDEOSTREAM === 'true';
  const useLocalFiles = !process.env.VITE_DEV_SERVER_URL;
  
  if (useTestFile) {
    const testFilePath = path.join(__dirname, '../test-videostream-manager.html');
    console.log('🧪 [Main] Cargando archivo de prueba VideoStreamManager:', testFilePath);
    mainWindow.loadFile(testFilePath);
  } else {
    mainWindow.loadURL(
      useLocalFiles
        ? `file://${path.join(__dirname, '../dist/index.html')}`
        : 'http://localhost:5173' // Vite dev server
      );
  }

  console.log('🌐 [Main] Loading from:', useTestFile ? 'VideoStreamManager Test' : useLocalFiles ? 'Local files' : 'Dev server');

  // Open the DevTools in development mode only
  if (!useLocalFiles) {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready to prevent layout issues
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Focus the window
    mainWindow.focus();
  });

  // Configurar manager de reproductores nativos
  nativePlayerManager.setWindow(mainWindow);
  
  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Note: Already handled in the app.whenReady() above

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

// Manejo de eventos IPC para shows
ipcMain.handle('save-shows-config', async (_, config) => {
  try {
    const configPath = path.join(process.cwd(), 'src/config/shows/shows.config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  }
  catch (error) {
    console.error('Error saving shows config:', error);
    throw error;
  }
});

ipcMain.handle('load-shows-config', async () => {
  try {
    const configPath = path.join(process.cwd(), 'src/config/shows/shows.config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // Si el archivo no existe, devolver una configuración vacía
      return { shows: [], lastUpdated: new Date().toISOString() };
    }
    console.error('Error loading shows config:', error);
    throw error;
  }
});

ipcMain.handle('import-show-file', async (_, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }
  catch (error) {
    console.error('Error importing show file:', error);
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

// Handler para logs del HTML
ipcMain.handle('log-message', async (_, message) => {
  console.log(message);
  return true;
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

ipcMain.handle('select-show-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: path.join(process.cwd(), 'src/config/shows')
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }
  catch (error) {
    console.error('Error selecting show file:', error);
    throw error;
  }
});

// Handler para seleccionar archivos de video
ipcMain.handle('select-video-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { 
          name: 'Video Files', 
          extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'] 
        },
        { name: 'All Files', extensions: ['*'] }
      ],
      defaultPath: os.homedir()
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }
  catch (error) {
    console.error('Error selecting video file:', error);
    throw error;
  }
});

// Variable global para almacenar procesos de VLC
let vlcProcesses: Map<string, ChildProcess> = new Map();

// Función para encontrar la ruta de VLC
async function getVLCPath(): Promise<string> {
  // Rutas comunes de VLC en Windows
  const commonPaths = [
    'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
    'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs\\VideoLAN\\VLC\\vlc.exe'),
    path.join(process.env.PROGRAMFILES || '', 'VideoLAN\\VLC\\vlc.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'VideoLAN\\VLC\\vlc.exe')
  ];

  // Verificar cada ruta común
  for (const vlcPath of commonPaths) {
    try {
      await fs.access(vlcPath);
      console.log('✅ [Main] Found VLC at:', vlcPath);
      return vlcPath;
    } catch {
      // Continuar con la siguiente ruta
    }
  }

  // Si no se encuentra en rutas comunes, intentar desde PATH
  console.log('⚠️ [Main] VLC not found in common paths, trying from PATH');
  return 'vlc';
}

// Handler para lanzar VLC con HTTP interface
ipcMain.handle('launch-vlc-embedded', async (_, config: {
  filePath: string;
  port: number;
  password: string;
}) => {
  try {
    console.log('🎬 [Main] Launching VLC embedded for:', config.filePath);
    
    const processId = `vlc-${Date.now()}`;
    
    // Obtener la ruta de VLC
    const vlcPath = await getVLCPath();
    console.log('📍 [Main] Using VLC path:', vlcPath);
    
    const vlcArgs = [
      '--intf', 'http',
      '--http-host', 'localhost',
      '--http-port', config.port.toString(),
      // Removed --http-password for iframe compatibility
      '--no-video-title-show',
      '--no-video-deco',
      '--no-qt-privacy-ask',
      '--no-qt-error-dialogs',
      '--quiet',
      config.filePath
    ];

    console.log('🔧 [Main] VLC arguments:', vlcArgs);

    const vlcProcess = spawn(vlcPath, vlcArgs, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Almacenar el proceso
    vlcProcesses.set(processId, vlcProcess);

    vlcProcess.on('error', (error: any) => {
      console.error('❌ [Main] VLC Process error:', error);
      vlcProcesses.delete(processId);
    });

    vlcProcess.on('close', (code: any) => {
      console.log(`🔚 [Main] VLC Process closed with code ${code}`);
      vlcProcesses.delete(processId);
    });

    vlcProcess.on('spawn', () => {
      console.log('✅ [Main] VLC Process spawned successfully');
    });

    return { 
      success: true, 
      processId: processId,
      port: config.port 
    };

  } catch (error) {
    console.error('❌ [Main] Error launching VLC embedded:', error);
    throw error;
  }
});

// Handler para cerrar VLC
ipcMain.handle('close-vlc-embedded', async (_, processId: string) => {
  try {
    const vlcProcess = vlcProcesses.get(processId);
    
    if (vlcProcess) {
      console.log('🔚 [Main] Closing VLC process:', processId);
      vlcProcess.kill('SIGTERM');
      vlcProcesses.delete(processId);
      return { success: true };
    }
    
    return { success: false, error: 'Process not found' };
    
  } catch (error) {
    console.error('❌ [Main] Error closing VLC embedded:', error);
    throw error;
  }
});

// Handler para verificar si VLC está instalado
ipcMain.handle('check-vlc-installation', async () => {
  try {
    const vlcPath = await getVLCPath();
    console.log('🔍 [Main] Checking VLC installation at:', vlcPath);
    
    const vlcProcess = spawn(vlcPath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return new Promise((resolve) => {
      vlcProcess.on('error', (error: any) => {
        console.log('❌ [Main] VLC not found at:', vlcPath, 'Error:', error.message);
        resolve({ installed: false, path: vlcPath, error: error.message });
      });

      vlcProcess.on('close', (code: any) => {
        const isInstalled = code === 0;
        console.log(`${isInstalled ? '✅' : '❌'} [Main] VLC check result: ${isInstalled ? 'installed' : 'not installed'}`);
        resolve({ installed: isInstalled, path: vlcPath });
      });

      // Timeout después de 5 segundos
      setTimeout(() => {
        vlcProcess.kill();
        console.log('⏰ [Main] VLC check timed out');
        resolve({ installed: false, path: vlcPath, error: 'timeout' });
      }, 5000);
    });

  } catch (error) {
    console.error('❌ [Main] Error checking VLC installation:', error);
    return { installed: false, error: (error as Error).message };
  }
});

// ===== NUEVO MOTOR DE VIDEO =====

// Inicializar motor de video
async function initializeVideoEngine() {
  try {
    console.log('🔧 [VideoEngine] Iniciando inicialización del motor de video...');
    
    // Importar VideoEngineMain desde el archivo compilado
    const modulePath = path.join(__dirname, 'VideoEngineMain.js');
    console.log('🔧 [VideoEngine] Cargando desde:', modulePath);
    
    // Verificar que el archivo existe
    try {
      await fs.access(modulePath);
      console.log('✅ [VideoEngine] Archivo encontrado');
    } catch (error) {
      throw new Error(`Archivo VideoEngineMain.js no encontrado en: ${modulePath}`);
    }
    
    // Importar el módulo
    const module = await import(`file://${modulePath.replace(/\\/g, '/')}`);
    VideoEngineMain = module.VideoEngineMain;
    console.log('✅ [VideoEngine] Módulo cargado correctamente');
    
    // Configurar directorios
    const userDataPath = app.getPath('userData');
    const tempDir = path.join(userDataPath, 'temp');
    const cacheDir = path.join(userDataPath, 'video-cache');
    
    console.log('📁 [VideoEngine] Directorios:', { tempDir, cacheDir });
    
    // Crear instancia del motor
    videoEngine = new VideoEngineMain({
      binaryPath: undefined, // Usar FFmpeg del PATH
      tempDir,
      cacheDir,
      maxCacheSize: 2048, // 2GB
      enableHardwareAcceleration: true,
      logLevel: 'info'
    });
    
    console.log('✅ [VideoEngine] Motor de video inicializado correctamente');
  } catch (error) {
    console.error('❌ [VideoEngine] Error inicializando motor de video:', error);
    // No lanzar el error - la aplicación puede funcionar sin el motor de video
    videoEngine = null;
  }
}

// Handler para analizar video
ipcMain.handle('analyze-video', async (_, filePath: string) => {
  try {
    console.log('🔍 [VideoAnalyzer] Analizando video:', filePath);
    
    const result = await videoAnalyzer.analyzeVideo(filePath);
    console.log('✅ [VideoAnalyzer] Análisis completado:', result);
    
    return { success: true, ...result };
  } catch (error) {
    console.error('❌ [VideoAnalyzer] Error analizando video:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para convertir video
ipcMain.handle('convert-video', async (_, inputPath: string, options: any) => {
  try {
    console.log('🔄 [VideoConverter] Iniciando conversión:', inputPath);
    
    // Analyze video first to get metadata for quality constraints
    const analysisResult = await videoAnalyzer.analyzeVideo(inputPath);
    const sourceMetadata = analysisResult.metadata;
    
    console.log(`📊 [VideoConverter] Video metadata:`, {
      resolution: `${sourceMetadata.width}x${sourceMetadata.height}`,
      codec: sourceMetadata.videoCodec,
      duration: sourceMetadata.duration
    });
    
    const result = await videoConverter.convertToHTML5Compatible(inputPath, options, undefined, sourceMetadata);
    
    if (result.success) {
      console.log('✅ [VideoConverter] Conversión completada:', result.outputPath);
    } else {
      console.error('❌ [VideoConverter] Error en conversión:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ [VideoConverter] Error convirtiendo video:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para cancelar conversión
ipcMain.handle('cancel-conversion', async (_, inputPath: string) => {
  try {
    console.log('🛑 [VideoEngine] Cancelando conversión:', inputPath);
    
    if (!videoEngine) {
      console.error('❌ [VideoEngine] Motor de video no inicializado');
      return { success: false, error: 'Motor de video no inicializado' };
    }
    
    const cancelled = await videoEngine.cancelConversion(inputPath);
    console.log(`${cancelled ? '✅' : '❌'} [VideoEngine] Cancelación: ${cancelled ? 'exitosa' : 'falló'}`);
    
    return { success: cancelled };
  } catch (error) {
    console.error('❌ [VideoEngine] Error cancelando conversión:', error);
    return { success: false, error: (error as Error).message };
  }
});

// ===== FIN MOTOR DE VIDEO =====

// ===== REPRODUCTOR NATIVO =====

// Handler para inicializar reproductor nativo
ipcMain.handle('initialize-native-player', async (_, playerId: string, config: any) => {
  try {
    console.log('🎬 [NativePlayer] Initializing player:', playerId, config);
    
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) {
      throw new Error('No active window found');
    }
    
    const initialized = await nativePlayerManager.createPlayer(playerId, {
      videoPath: config.videoPath,
      width: config.width,
      height: config.height,
      controls: config.controls
    });
    
    if (initialized) {
      const player = nativePlayerManager.getPlayer(playerId);
      if (player) {
        const state = player.getState();
        return { success: true, duration: state.duration };
      }
    }
    
    throw new Error('Failed to initialize native player');
  } catch (error) {
    console.error('❌ [NativePlayer] Initialization failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para reproducir
ipcMain.handle('native-player-play', async (_, playerId: string) => {
  try {
    const player = nativePlayerManager.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    await player.play();
    return { success: true };
  } catch (error) {
    console.error('❌ [NativePlayer] Play failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para pausar
ipcMain.handle('native-player-pause', async (_, playerId: string) => {
  try {
    const player = nativePlayerManager.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    player.pause();
    return { success: true };
  } catch (error) {
    console.error('❌ [NativePlayer] Pause failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para detener
ipcMain.handle('native-player-stop', async (_, playerId: string) => {
  try {
    const player = nativePlayerManager.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    player.stop();
    return { success: true };
  } catch (error) {
    console.error('❌ [NativePlayer] Stop failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para buscar
ipcMain.handle('native-player-seek', async (_, playerId: string, timeInSeconds: number) => {
  try {
    const player = nativePlayerManager.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    player.seek(timeInSeconds);
    return { success: true };
  } catch (error) {
    console.error('❌ [NativePlayer] Seek failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para establecer volumen
ipcMain.handle('native-player-set-volume', async (_, playerId: string, volume: number) => {
  try {
    const player = nativePlayerManager.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    player.setVolume(volume);
    return { success: true };
  } catch (error) {
    console.error('❌ [NativePlayer] Set volume failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para destruir reproductor
ipcMain.handle('destroy-native-player', async (_, playerId: string) => {
  try {
    nativePlayerManager.destroyPlayer(playerId);
    return { success: true };
  } catch (error) {
    console.error('❌ [NativePlayer] Destroy failed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// ===== VIDEOSTREAMMANAGER HANDLERS =====

// Handler para probar VideoStreamManager
ipcMain.handle('test-videostream-manager', async (_, config) => {
  try {
    if (!videoStreamManager) {
      throw new Error('VideoStreamManager no inicializado');
    }
    
    console.log('🧪 [Main] Probando VideoStreamManager:', config);
    
    await videoStreamManager.playVideo(config);
    
    return { success: true, message: 'Video reproducido correctamente' };
  } catch (error) {
    console.error('❌ [Main] Error en VideoStreamManager:', error);
    return { success: false, error: String(error) };
  }
});

// Handler para detener VideoStreamManager
ipcMain.handle('stop-videostream-manager', async () => {
  try {
    if (!videoStreamManager) {
      throw new Error('VideoStreamManager no inicializado');
    }
    
    console.log('🛑 [Main] Deteniendo VideoStreamManager');
    
    await videoStreamManager.stopCurrentPlayback();
    
    return { success: true, message: 'Reproducción detenida correctamente' };
  } catch (error) {
    console.error('❌ [Main] Error deteniendo VideoStreamManager:', error);
    return { success: false, error: String(error) };
  }
});

// Handler para ejecutar script en el renderer
ipcMain.handle('execute-script', async (_, script: string) => {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) {
      throw new Error('Ventana principal no disponible');
    }
    
    console.log('📝 [Main] Ejecutando script en renderer');
    
    const result = await mainWindow.webContents.executeJavaScript(script);
    
    return { success: true, result };
  } catch (error) {
    console.error('❌ [Main] Error ejecutando script:', error);
    return { success: false, error: String(error) };
  }
});

// Handler para limpiar archivos temporales
ipcMain.handle('cleanup-temp-file', async (event, tempFilePath: string) => {
  try {
    if (!videoStreamManager) {
      throw new Error('VideoStreamManager no inicializado');
    }
    
    console.log('🧹 [Main] Limpiando archivo temporal:', tempFilePath);
    
    // Llamar al método de limpieza del VideoStreamManager
    await videoStreamManager.cleanupTempFile(tempFilePath);
    
    return { success: true, message: 'Archivo temporal limpiado' };
  } catch (error) {
    console.error('❌ [Main] Error limpiando archivo temporal:', error);
    return { success: false, error: String(error) };
  }
});

// Handler para diálogo de selección de archivos
ipcMain.handle('show-open-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { 
          name: 'Video Files', 
          extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'] 
        },
        { name: 'All Files', extensions: ['*'] }
      ],
      defaultPath: os.homedir()
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false, message: 'Selección cancelada' };
  } catch (error) {
    console.error('❌ [Main] Error en diálogo de archivos:', error);
    return { success: false, error: String(error) };
  }
});

// Limpiar reproductores al cerrar la aplicación
app.on('before-quit', async () => {
  nativePlayerManager.destroyAll();
  if (videoStreamManager) {
    await videoStreamManager.destroy();
  }
});

// ===== FIN REPRODUCTOR NATIVO =====