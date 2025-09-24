# 🎬 Instalación de FFmpeg para Analog Replay TV

FFmpeg es **esencial** para el funcionamiento completo del reproductor de video. La aplicación puede funcionar sin él en modo básico, pero para la experiencia completa necesitas instalarlo.

## 🚀 Instalación Automática (Recomendada)

**Opción 1: Script Personalizado**
```bash
npm run install-ffmpeg
```
*Este script descarga e instala FFmpeg automáticamente desde GitHub.*

**Opción 2: Chocolatey (requiere admin)**
```powershell
# Ejecutar en PowerShell como Administrador
choco install ffmpeg -y
```

## 📋 Instalación Manual

Si prefieres instalar manualmente, sigue estos pasos:

### 1. Descargar FFmpeg

```powershell
# Crear directorio
mkdir C:\ffmpeg

# Descargar
Invoke-WebRequest -Uri "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile "C:\ffmpeg\ffmpeg.zip"

# Extraer
Expand-Archive -Path "C:\ffmpeg\ffmpeg.zip" -DestinationPath "C:\ffmpeg\" -Force
```

### 2. Agregar al PATH

```powershell
# Para usuario actual (recomendado)
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User) + ";C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin", [EnvironmentVariableTarget]::User)
```

### 3. Verificar instalación

```powershell
# Reiniciar terminal y ejecutar
ffmpeg -version
```

## 🔍 Verificación Rápida

```bash
npm run check-ffmpeg
```

## ❗ Solución de Problemas

- **Error de permisos**: Usa la instalación para usuario en lugar del sistema
- **FFmpeg no encontrado**: Verifica que esté en el PATH y reinicia la terminal
- **Aplicación no funciona**: La app funciona sin FFmpeg pero con funcionalidad limitada

---

**✅ Una vez instalado FFmpeg, ejecuta `npm run dev` para disfrutar de la experiencia completa de Analog Replay TV.**