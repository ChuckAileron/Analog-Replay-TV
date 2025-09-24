# Script de instalación automática de FFmpeg para Analog Replay TV
# Este script descarga e instala FFmpeg y lo agrega al PATH del usuario

Write-Host "🎬 Instalando FFmpeg para Analog Replay TV..." -ForegroundColor Green
Write-Host ""

# Verificar si FFmpeg ya está instalado
try {
    $ffmpegVersion = & ffmpeg -version 2>$null
    if ($ffmpegVersion) {
        Write-Host "✅ FFmpeg ya está instalado:" -ForegroundColor Green
        Write-Host $ffmpegVersion[0] -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Si quieres reinstalar, elimina la carpeta C:\ffmpeg y ejecuta este script nuevamente."
        exit 0
    }
} catch {
    Write-Host "📥 FFmpeg no encontrado, procediendo con la instalación..." -ForegroundColor Yellow
}

# Crear directorio FFmpeg
$ffmpegDir = "C:\ffmpeg"
if (!(Test-Path $ffmpegDir)) {
    Write-Host "📁 Creando directorio $ffmpegDir..."
    New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null
}

# Descargar FFmpeg
$downloadUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$zipPath = "$ffmpegDir\ffmpeg.zip"

Write-Host "📥 Descargando FFmpeg desde GitHub..."
Write-Host "   URL: $downloadUrl"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "✅ Descarga completada" -ForegroundColor Green
} catch {
    Write-Host "❌ Error descargando FFmpeg: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Verificar que el archivo se descargó correctamente
if (!(Test-Path $zipPath) -or (Get-Item $zipPath).Length -eq 0) {
    Write-Host "❌ Error: El archivo descargado está vacío o no existe" -ForegroundColor Red
    exit 1
}

# Extraer archivos
Write-Host "📦 Extrayendo archivos..."
try {
    Expand-Archive -Path $zipPath -DestinationPath $ffmpegDir -Force
    Write-Host "✅ Extracción completada" -ForegroundColor Green
} catch {
    Write-Host "❌ Error extrayendo archivos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Encontrar el directorio bin de FFmpeg
$ffmpegBinDir = Get-ChildItem -Path $ffmpegDir -Directory | Where-Object { $_.Name -like "*ffmpeg*" } | Select-Object -First 1
if ($ffmpegBinDir) {
    $ffmpegBinPath = Join-Path $ffmpegBinDir.FullName "bin"
} else {
    Write-Host "❌ Error: No se encontró el directorio de FFmpeg extraído" -ForegroundColor Red
    exit 1
}

Write-Host "📍 FFmpeg extraído en: $ffmpegBinPath"

# Verificar que los ejecutables existen
$ffmpegExe = Join-Path $ffmpegBinPath "ffmpeg.exe"
$ffprobeExe = Join-Path $ffmpegBinPath "ffprobe.exe"

if (!(Test-Path $ffmpegExe) -or !(Test-Path $ffprobeExe)) {
    Write-Host "❌ Error: No se encontraron los ejecutables de FFmpeg" -ForegroundColor Red
    exit 1
}

# Agregar al PATH del usuario
Write-Host "🔧 Configurando PATH del usuario..."
try {
    $userPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    
    # Verificar si ya está en el PATH
    if ($userPath -notlike "*$ffmpegBinPath*") {
        $newUserPath = "$userPath;$ffmpegBinPath"
        [Environment]::SetEnvironmentVariable("Path", $newUserPath, [EnvironmentVariableTarget]::User)
        Write-Host "✅ FFmpeg agregado al PATH del usuario" -ForegroundColor Green
    } else {
        Write-Host "✅ FFmpeg ya estaba en el PATH del usuario" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error configurando PATH: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Puedes agregar manualmente esta ruta al PATH: $ffmpegBinPath" -ForegroundColor Yellow
}

# Actualizar PATH para esta sesión
$env:PATH += ";$ffmpegBinPath"

# Verificar instalación
Write-Host ""
Write-Host "🧪 Verificando instalación..."
try {
    $ffmpegVersion = & $ffmpegExe -version 2>$null
    if ($ffmpegVersion) {
        Write-Host "✅ ¡FFmpeg instalado correctamente!" -ForegroundColor Green
        Write-Host $ffmpegVersion[0] -ForegroundColor Yellow
    } else {
        throw "No se pudo ejecutar FFmpeg"
    }
} catch {
    Write-Host "❌ Error verificando instalación: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Limpiar archivo ZIP
Write-Host ""
Write-Host "🧹 Limpiando archivos temporales..."
try {
    Remove-Item $zipPath -Force
    Write-Host "✅ Limpieza completada" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No se pudo eliminar el archivo ZIP: $zipPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 ¡Instalación de FFmpeg completada exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Notas importantes:" -ForegroundColor Cyan
Write-Host "   • FFmpeg se instaló en: $ffmpegBinPath"
Write-Host "   • Se agregó al PATH del usuario (no requiere privilegios de admin)"
Write-Host "   • Reinicia VS Code/PowerShell para que tome efecto en nuevas sesiones"
Write-Host "   • Analog Replay TV ahora puede procesar todos los formatos de video"
Write-Host ""
Write-Host "🚀 Puedes ejecutar la aplicación con: npm run dev" -ForegroundColor Green