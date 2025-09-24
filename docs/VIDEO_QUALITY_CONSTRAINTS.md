# Video Quality Constraints - 480p Standard

## Descripción

Este documento describe la implementación del sistema de restricciones de calidad de video que garantiza una calidad estática de 480p para las conversiones de video, siguiendo las siguientes reglas:

- **Resolución >= 480p**: Se convierte a 480p manteniendo la relación de aspecto original
- **Resolución < 480p**: Se mantiene la resolución original sin modificaciones

## Funcionalidades Implementadas

### 1. Análisis Automático de Resolución

El sistema analiza automáticamente la resolución del video fuente antes de aplicar cualquier conversión:

```typescript
// En VideoConverter.ts y VideoEngineMain.ts
const sourceMetadata = await this.analyzeVideo(inputPath);
const constrainedOptions = this.applyQualityConstraints(options, sourceMetadata);
```

### 2. Aplicación de Restricciones de Calidad

#### Para videos >= 480p:
- **Objetivo**: Resolución de 480p (altura = 480 píxeles)
- **Relaciones de aspecto comunes**:
  - 16:9 → 854x480
  - 4:3 → 640x480
  - Otras → Cálculo proporcional manteniendo aspecto
- **Bitrate optimizado**: 1.5 Mbps para 480p

#### Para videos < 480p:
- **Objetivo**: Mantener resolución original
- **Bitrate adaptativo**:
  - ≤ 320x240: 500 kbps
  - ≤ 480x360: 800 kbps
  - Cerca de 480p: 1.2 Mbps

### 3. Ejemplos de Conversión

#### Ejemplo 1: Video HD → 480p
```
Entrada: 1920x1080 (1080p, 16:9)
Salida:  854x480   (480p, 16:9)
Bitrate: 1.5 Mbps
```

#### Ejemplo 2: Video 4:3 → 480p
```
Entrada: 720x576  (PAL, 4:3)
Salida:  640x480  (480p, 4:3)
Bitrate: 1.5 Mbps
```

#### Ejemplo 3: Video pequeño → Original
```
Entrada: 320x240  (240p, 4:3)
Salida:  320x240  (240p, 4:3) - Sin cambios
Bitrate: 500 kbps
```

#### Ejemplo 4: Video aspecto personalizado → 480p
```
Entrada: 1280x720 (720p, 16:9)
Salida:  854x480  (480p, 16:9)
Bitrate: 1.5 Mbps
```

## Implementación Técnica

### Archivos Modificados

1. **`electron/services/VideoConverter.ts`**
   - Método `convertToHTML5Compatible()` actualizado para recibir metadata
   - Nuevo método `applyQualityConstraints()` para aplicar restricciones

2. **`electron/VideoEngineMain.ts`**
   - Método `convertVideo()` actualizado para análisis previo
   - Nuevo método `applyQualityConstraints()` duplicado para consistencia
   - Bitrates ajustados a valores numéricos correctos

3. **`electron/main.ts`**
   - Handler `convert-video` actualizado para análisis previo
   - Logging mejorado para mostrar resoluciones de entrada y salida

### Algoritmo de Cálculo de Resolución

```typescript
const isSD480OrHigher = height >= 480;

if (isSD480OrHigher) {
  const aspectRatio = width / height;
  let targetWidth: number;
  let targetHeight = 480;
  
  // Relaciones de aspecto comunes
  if (Math.abs(aspectRatio - (16/9)) < 0.01) {
    targetWidth = 854; // 16:9
  } else if (Math.abs(aspectRatio - (4/3)) < 0.01) {
    targetWidth = 640; // 4:3
  } else {
    // Cálculo proporcional
    targetWidth = Math.round(480 * aspectRatio);
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
  }
}
```

## Beneficios

1. **Consistencia de Calidad**: Garantiza que todos los videos se reproduzcan con calidad estándar óptima
2. **Optimización de Recursos**: Reduce el tamaño de archivos sin sacrificar calidad visual
3. **Preservación de Contenido**: Mantiene videos pequeños en su resolución original
4. **Compatibilidad**: Mejora la compatibilidad con diferentes dispositivos de reproducción
5. **Rendimiento**: Optimiza el rendimiento de reproducción en hardware limitado

## Logging y Debugging

El sistema incluye logging detallado para facilitar el debugging:

```
🎯 [VideoConverter] Applying 480p constraint to 1920x1080 video
📐 [VideoConverter] Target resolution: 854x480
📊 [VideoConverter] Video metadata: resolution: 1920x1080, codec: h264, duration: 300
```

## Consideraciones Futuras

- **Configuración de Usuario**: Posible opción para personalizar la resolución objetivo
- **Profiles de Calidad**: Diferentes perfiles según el tipo de contenido (deportes, películas, etc.)
- **Detección Inteligente**: Análisis de contenido para determinar la mejor resolución
- **Optimización por Hardware**: Ajustes según las capacidades del dispositivo

## Pruebas Recomendadas

1. **Videos HD**: 1080p, 720p → Verificar conversión a 480p
2. **Videos SD**: 480p, 576p → Verificar conversión a 480p
3. **Videos Pequeños**: 240p, 360p → Verificar preservación de resolución
4. **Aspectos Diversos**: 16:9, 4:3, 21:9 → Verificar cálculo correcto de ancho
5. **Formatos Diversos**: MP4, AVI, MKV → Verificar funcionamiento universal