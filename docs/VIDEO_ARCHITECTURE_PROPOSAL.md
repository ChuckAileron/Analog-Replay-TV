# 🎬 Nueva Arquitectura de Video - AnalogReplayTV

## 🎯 Objetivo
Crear un sistema robusto de reproducción de video que maneje todos los formatos sin reproductores externos y con control total del diseño.

## 🏗️ Arquitectura Propuesta

### **Capa 1: Detección y Análisis**
```typescript
class VideoAnalyzer {
  async analyzeVideo(filePath: string): Promise<VideoInfo> {
    // Usar FFprobe para obtener metadata completa
    const metadata = await this.ffprobe(filePath);
    return {
      codec: metadata.streams[0].codec_name,
      resolution: `${metadata.streams[0].width}x${metadata.streams[0].height}`,
      duration: metadata.format.duration,
      bitrate: metadata.format.bit_rate,
      compatibility: this.checkHTML5Compatibility(metadata)
    };
  }
}
```

### **Capa 2: Conversión Inteligente**
```typescript
class VideoProcessor {
  async ensureCompatibility(videoPath: string): Promise<string> {
    const analysis = await this.analyzer.analyzeVideo(videoPath);
    
    if (analysis.compatibility.isHTML5Compatible) {
      return videoPath; // No conversion needed
    }
    
    // Background conversion with progress
    return await this.convertToWeb(videoPath, {
      codec: 'libx264',
      profile: 'baseline',
      level: '3.0',
      audioCodec: 'aac'
    });
  }
}
```

### **Capa 3: Reproductor Unificado**
```typescript
class UnifiedVideoPlayer {
  private canvas: HTMLCanvasElement;
  private audioContext: AudioContext;
  
  async loadVideo(videoPath: string) {
    const compatiblePath = await this.processor.ensureCompatibility(videoPath);
    
    if (this.supportsWebCodecs()) {
      return this.playWithWebCodecs(compatiblePath);
    } else {
      return this.playWithHTML5(compatiblePath);
    }
  }
  
  private async playWithWebCodecs(videoPath: string) {
    // Decodificación manual con WebCodecs
    const decoder = new VideoDecoder({
      output: (frame) => this.renderFrame(frame),
      error: (e) => this.handleError(e)
    });
    
    // Custom controls overlay
    this.createCustomControls();
  }
}
```

## 🎨 Ventajas de esta Arquitectura

### ✅ **Control Total del Diseño**
- Canvas personalizable al 100%
- Controles diseñados específicamente para la estética retro
- Overlays y efectos visuales sin limitaciones

### ✅ **Compatibilidad Universal**
- Conversión automática en background
- Cache de videos convertidos
- Fallback inteligente

### ✅ **Performance Optimizada**
- Renderizado directo en canvas
- Manejo de memoria eficiente
- Streaming chunks para videos grandes

### ✅ **Experiencia de Usuario**
- Loading progressivo durante conversión
- Preview inmediato con placeholder
- Controles responsive nativos

## 🔧 Implementación Fase 1

### **1. Reemplazar VideoPlayerVLCEmbedded**
```typescript
// Nuevo componente principal
<UnifiedVideoPlayer
  src={videoPath}
  style="retro-tv-90s"
  onLoadStart={handleLoadStart}
  onCanPlay={handleCanPlay}
  customControls={{
    theme: 'crt-scanlines',
    buttons: ['play', 'pause', 'volume', 'fullscreen'],
    overlay: 'channel-info'
  }}
/>
```

### **2. Backend FFmpeg Service**
```typescript
// Servicio en proceso principal de Electron
class FFmpegService {
  async convertVideo(input: string, output: string, options: ConvertOptions) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', input,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        output
      ]);
      
      ffmpeg.on('close', (code) => {
        code === 0 ? resolve(output) : reject(new Error(`FFmpeg failed: ${code}`));
      });
    });
  }
}
```

### **3. Cache System**
```typescript
// Sistema de cache para videos convertidos
class VideoCache {
  private cacheDir = path.join(app.getPath('userData'), 'video-cache');
  
  async getCachedVideo(originalPath: string): Promise<string | null> {
    const hash = crypto.createHash('md5').update(originalPath).digest('hex');
    const cachedPath = path.join(this.cacheDir, `${hash}.mp4`);
    
    if (await fs.pathExists(cachedPath)) {
      return cachedPath;
    }
    
    return null;
  }
}
```

## 🚀 Beneficios Inmediatos

1. **Sin reproductores externos** - Todo integrado en la aplicación
2. **Diseño 100% personalizable** - Canvas te da control total
3. **Compatibilidad universal** - FFmpeg maneja todos los formatos
4. **Performance superior** - Renderizado nativo optimizado
5. **Experiencia consistente** - No más problemas de VLC o iframe

## 📋 Plan de Implementación

### **Fase 1: Base (1-2 días)**
- [ ] Setup FFmpeg en Electron
- [ ] Crear VideoAnalyzer basic
- [ ] Canvas video renderer

### **Fase 2: Conversión (2-3 días)**
- [ ] Sistema de conversión automática
- [ ] Cache de videos convertidos
- [ ] Progress indicators

### **Fase 3: UI/UX (2-3 días)**
- [ ] Controles personalizados retro
- [ ] Efectos visuales (scanlines, etc.)
- [ ] Transiciones suaves

### **Fase 4: Optimización (1-2 días)**
- [ ] Performance tuning
- [ ] Memory management
- [ ] Error handling robusto

## 🎯 Resultado Final

Un reproductor de video completamente integrado que:
- ✅ Reproduce cualquier formato sin herramientas externas
- ✅ Mantiene la estética retro perfecta
- ✅ Ofrece performance superior
- ✅ Elimina todos los problemas actuales de duplicación
- ✅ Proporciona control total sobre la experiencia de usuario