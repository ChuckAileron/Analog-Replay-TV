# 📺 Analog Replay TV

Una aplicación nostálgica de simulación de televisión que recrea la experiencia de ver televisión en los años 90 y 2000s.

## ✨ Características

- 🎬 **Reproductor de video avanzado** con soporte para múltiples formatos
- 🔄 **Conversión automática de video** usando FFmpeg para máxima compatibilidad
- 📺 **Simulación auténtica de TV** con estilos de los 90s y 2000s
- 🎛️ **Controles de TV retro** con cambio de canales, volumen y configuración
- 📊 **Sistema de programación** para organizar tus shows favoritos
- 🎨 **Temas personalizables** con aspectos nostálgicos auténticos

## 🚀 Instalación y Configuración

### Prerrequisitos

1. **Node.js 18+** - [Descargar aquí](https://nodejs.org/)
2. **FFmpeg** - Requerido para procesamiento de video (instrucciones abajo)

### 1. Clonar el repositorio

```bash
git clone https://github.com/ChuckAileron/Analog-Replay-TV.git
cd Analog-Replay-TV
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Instalar FFmpeg (IMPORTANTE)

FFmpeg es **esencial** para el funcionamiento completo del reproductor de video. La aplicación puede funcionar sin él en modo básico, pero para la experiencia completa necesitas instalarlo.

#### Opción A: Script Automático (Recomendada)

```powershell
# Ejecutar en PowerShell (no requiere admin)
npm run install-ffmpeg
```

*Este script descarga FFmpeg desde GitHub y lo instala automáticamente en `C:\ffmpeg\` agregándolo al PATH del usuario.*

#### Opción B: Chocolatey (Requiere Administrador)

```powershell
# Ejecutar en PowerShell como Administrador
# Instalar Chocolatey si no lo tienes
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar FFmpeg
choco install ffmpeg -y
```

#### Opción C: Instalación Manual

1. **Crear directorio FFmpeg:**
```powershell
mkdir C:\ffmpeg
```

2. **Descargar FFmpeg:**
```powershell
Invoke-WebRequest -Uri "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile "C:\ffmpeg\ffmpeg.zip"
```

3. **Extraer archivos:**
```powershell
Expand-Archive -Path "C:\ffmpeg\ffmpeg.zip" -DestinationPath "C:\ffmpeg\" -Force
```

4. **Agregar al PATH del sistema:**
```powershell
# Para usuario actual (no requiere admin)
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User) + ";C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin", [EnvironmentVariableTarget]::User)

# Para todo el sistema (requiere admin)
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine) + ";C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin", [EnvironmentVariableTarget]::Machine)
```

5. **Verificar instalación:**
```powershell
# Reiniciar PowerShell/CMD y ejecutar
ffmpeg -version
```

### 4. Compilar y ejecutar

```bash
# Compilar módulos de Electron
npm run compile:electron

# Ejecutar en modo desarrollo
npm run dev

# O construir para producción
npm run build
npm run preview
```

## 🎮 Uso de la Aplicación

### Configuración Inicial

1. **Configurar Canales:**
   - Ve a configuración de canales
   - Importa o crea tus canales favoritos
   - Asigna números de canal

2. **Configurar Programas:**
   - Selecciona carpetas con tus videos
   - La aplicación detectará automáticamente videos compatibles
   - Organiza por temporadas y episodios

3. **Reproducir:**
   - Usa los controles de TV para cambiar canales
   - Los videos se reproducirán automáticamente
   - La conversión de formato se hace en segundo plano si es necesaria

### Controles de TV

- **🔼/🔽** - Cambiar canal arriba/abajo
- **🔊/🔇** - Control de volumen y silencio
- **⚙️** - Configuración de TV (brillo, contraste, estilo)
- **📋** - Guía de programación

### Formatos de Video Soportados

**Reproducción Directa (sin conversión):**
- MP4 (H.264 + AAC)
- WebM (VP8/VP9 + Vorbis/Opus)

**Conversión Automática (requiere FFmpeg):**
- AVI, MKV, MOV, WMV
- Cualquier códec de video (se convierte a H.264)
- Cualquier códec de audio (se convierte a AAC)

## 🛠️ Desarrollo

### Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── VideoPlayerNew.tsx    # Reproductor principal
│   ├── TVControls.tsx        # Controles de TV
│   └── ...
├── electron/           # Proceso principal de Electron
│   ├── main.ts               # Punto de entrada principal
│   ├── VideoEngineMain.ts    # Motor de video FFmpeg
│   └── preload.ts            # Script de preload
├── services/           # Lógica de negocio
├── types/             # Definiciones TypeScript
└── styles/            # Estilos CSS
```

### Scripts Disponibles

```bash
npm run dev              # Desarrollo con hot reload
npm run build           # Construir para producción
npm run preview         # Vista previa de producción
npm run compile:electron # Compilar TypeScript de Electron
npm run electron:dev    # Ejecutar Electron en desarrollo
npm run electron:build  # Construir aplicación Electron
npm run lint           # Linter de código
npm run type-check     # Verificación de tipos
```

### API del Motor de Video

El motor de video está construido sobre FFmpeg y proporciona:

- **Análisis de metadata** automático
- **Conversión de formato** inteligente
- **Cache de videos** convertidos
- **Aceleración por hardware** cuando está disponible
- **Progreso de conversión** en tiempo real

## ❗ Solución de Problemas

### Error: "Motor de video no inicializado"

**Causa:** FFmpeg no está instalado o no está en el PATH.

**Solución:**
1. Verificar instalación: `ffmpeg -version`
2. Si no funciona, seguir las instrucciones de instalación arriba
3. Reiniciar la aplicación después de instalar FFmpeg

### La aplicación no reproduce videos

**Diagnóstico:**
1. Verificar que FFmpeg está instalado
2. Comprobar que los archivos de video existen
3. Revisar la consola de desarrollador (F12) para errores

**Fallback:** La aplicación intentará reproducción directa sin conversión.

### Error de permisos al instalar FFmpeg

**Solución:** Usar la instalación para usuario en lugar del sistema:
```powershell
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User) + ";C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin", [EnvironmentVariableTarget]::User)
```

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama para tu característica (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Reconocimientos

- **FFmpeg** - Procesamiento de video
- **Electron** - Framework de aplicación de escritorio
- **React + Vite** - UI framework y herramientas de desarrollo
- **TypeScript** - Tipado estático

---

**¿Problemas?** Abre un [issue](https://github.com/ChuckAileron/Analog-Replay-TV/issues) en GitHub.
