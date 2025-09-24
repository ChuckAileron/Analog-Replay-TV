// Sistema de cache inteligente para videos convertidos
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { CachedVideo, VideoMetadata, CacheState } from '../types/video.types';

interface CacheIndex {
  version: string;
  lastCleanup: Date;
  entries: Map<string, CachedVideo>;
}

export class VideoCacheManager {
  private cacheDir: string;
  private maxCacheSize: number; // MB
  private index: CacheIndex;
  private indexPath: string;

  constructor(cacheDir: string, maxCacheSize: number = 2048) {
    this.cacheDir = cacheDir;
    this.maxCacheSize = maxCacheSize;
    this.indexPath = path.join(cacheDir, '.cache-index.json');
    this.index = {
      version: '1.0.0',
      lastCleanup: new Date(),
      entries: new Map()
    };
  }

  // Inicializar cache
  async initialize(): Promise<void> {
    try {
      // Crear directorio de cache
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Cargar índice existente
      await this.loadIndex();
      
      // Verificar integridad
      await this.verifyIntegrity();
      
      // Limpiar si es necesario
      await this.cleanupIfNeeded();
      
      console.log('✅ Cache inicializado:', this.getStats());
    } catch (error) {
      console.error('❌ Error inicializando cache:', error);
      // Crear índice nuevo si hay error
      await this.createNewIndex();
    }
  }

  // Obtener video del cache
  async get(key: string): Promise<CachedVideo | null> {
    const cached = this.index.entries.get(key);
    
    if (!cached) {
      return null;
    }

    // Verificar que el archivo existe
    try {
      await fs.access(cached.convertedPath);
      
      // Actualizar último acceso (implícito)
      cached.createdAt = new Date();
      await this.saveIndex();
      
      return cached;
    } catch {
      // Archivo no existe, remover del cache
      this.index.entries.delete(key);
      await this.saveIndex();
      return null;
    }
  }

  // Guardar video en cache
  async set(key: string, originalPath: string, convertedPath: string, metadata: VideoMetadata): Promise<void> {
    try {
      // Obtener tamaño del archivo
      const stats = await fs.stat(convertedPath);
      
      // Crear entrada de cache
      const cached: CachedVideo = {
        originalPath,
        convertedPath,
        hash: key,
        createdAt: new Date(),
        size: stats.size,
        metadata
      };

      // Verificar espacio disponible
      await this.ensureSpace(stats.size);
      
      // Guardar en índice
      this.index.entries.set(key, cached);
      await this.saveIndex();
      
      console.log(`✅ Video cacheado: ${path.basename(convertedPath)} (${this.formatSize(stats.size)})`);
    } catch (error) {
      console.error('❌ Error guardando en cache:', error);
      throw error;
    }
  }

  // Generar clave de cache
  generateKey(originalPath: string, options: any): string {
    const input = JSON.stringify({
      path: originalPath,
      options,
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60)) // Cambiar cada hora
    });
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  // Verificar si necesita conversión
  async needsConversion(originalPath: string, options: any): Promise<boolean> {
    const key = this.generateKey(originalPath, options);
    const cached = await this.get(key);
    return !cached;
  }

  // Obtener estadísticas del cache
  getStats(): CacheState {
    const entries = Array.from(this.index.entries.values());
    
    if (entries.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: new Date(),
        newestFile: new Date(),
        cacheHitRate: 0
      };
    }

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const dates = entries.map(entry => entry.createdAt).sort();

    return {
      totalFiles: entries.length,
      totalSize,
      oldestFile: dates[0],
      newestFile: dates[dates.length - 1],
      cacheHitRate: this.calculateHitRate()
    };
  }

  // Limpiar cache completo
  async clear(): Promise<void> {
    try {
      // Eliminar todos los archivos
      for (const cached of this.index.entries.values()) {
        try {
          await fs.unlink(cached.convertedPath);
        } catch {
          // Ignorar errores de archivos que no existen
        }
      }

      // Limpiar índice
      this.index.entries.clear();
      await this.saveIndex();
      
      console.log('✅ Cache limpiado completamente');
    } catch (error) {
      console.error('❌ Error limpiando cache:', error);
      throw error;
    }
  }

  // Limpiar archivos antiguos
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    let removedCount = 0;

    for (const [key, cached] of this.index.entries.entries()) {
      if (cached.createdAt < cutoffDate) {
        try {
          await fs.unlink(cached.convertedPath);
          this.index.entries.delete(key);
          removedCount++;
        } catch {
          // Si no se puede eliminar, remover del índice anyway
          this.index.entries.delete(key);
        }
      }
    }

    if (removedCount > 0) {
      await this.saveIndex();
      console.log(`✅ Cache cleanup: ${removedCount} archivos eliminados`);
    }

    return removedCount;
  }

  // Métodos privados
  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.index = {
        version: parsed.version || '1.0.0',
        lastCleanup: new Date(parsed.lastCleanup),
        entries: new Map(Object.entries(parsed.entries || {}).map(([key, value]: [string, any]) => [
          key,
          {
            ...value,
            createdAt: new Date(value.createdAt)
          }
        ]))
      };
    } catch {
      // Si no existe o hay error, crear nuevo
      await this.createNewIndex();
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const data = {
        version: this.index.version,
        lastCleanup: this.index.lastCleanup.toISOString(),
        entries: Object.fromEntries(
          Array.from(this.index.entries.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              createdAt: value.createdAt.toISOString()
            }
          ])
        )
      };

      await fs.writeFile(this.indexPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Error guardando índice de cache:', error);
    }
  }

  private async createNewIndex(): Promise<void> {
    this.index = {
      version: '1.0.0',
      lastCleanup: new Date(),
      entries: new Map()
    };
    await this.saveIndex();
  }

  private async verifyIntegrity(): Promise<void> {
    const toRemove: string[] = [];

    for (const [key, cached] of this.index.entries.entries()) {
      try {
        await fs.access(cached.convertedPath);
      } catch {
        toRemove.push(key);
      }
    }

    if (toRemove.length > 0) {
      toRemove.forEach(key => this.index.entries.delete(key));
      await this.saveIndex();
      console.log(`🧹 Limpieza de integridad: ${toRemove.length} entradas huérfanas eliminadas`);
    }
  }

  private async cleanupIfNeeded(): Promise<void> {
    const now = new Date();
    const daysSinceCleanup = (now.getTime() - this.index.lastCleanup.getTime()) / (1000 * 60 * 60 * 24);
    
    // Cleanup automático cada 3 días
    if (daysSinceCleanup >= 3) {
      await this.cleanup();
      this.index.lastCleanup = now;
      await this.saveIndex();
    }

    // Verificar tamaño del cache
    const stats = this.getStats();
    const sizeMB = stats.totalSize / (1024 * 1024);
    
    if (sizeMB > this.maxCacheSize) {
      await this.cleanupBySize();
    }
  }

  private async ensureSpace(newFileSize: number): Promise<void> {
    const stats = this.getStats();
    const currentSizeMB = stats.totalSize / (1024 * 1024);
    const newFileSizeMB = newFileSize / (1024 * 1024);
    
    if (currentSizeMB + newFileSizeMB > this.maxCacheSize) {
      await this.cleanupBySize(newFileSizeMB);
    }
  }

  private async cleanupBySize(requiredSpaceMB: number = 0): Promise<void> {
    const entries = Array.from(this.index.entries.entries())
      .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime()); // Más antiguos primero

    let removedSize = 0;
    let removedCount = 0;
    const targetSize = this.maxCacheSize * 0.8; // Limpiar hasta 80% del límite
    const currentSizeMB = this.getStats().totalSize / (1024 * 1024);

    for (const [key, cached] of entries) {
      if (currentSizeMB - (removedSize / (1024 * 1024)) <= targetSize - requiredSpaceMB) {
        break;
      }

      try {
        await fs.unlink(cached.convertedPath);
        this.index.entries.delete(key);
        removedSize += cached.size;
        removedCount++;
      } catch {
        // Si no se puede eliminar, remover del índice anyway
        this.index.entries.delete(key);
      }
    }

    if (removedCount > 0) {
      await this.saveIndex();
      console.log(`🧹 Cleanup por tamaño: ${removedCount} archivos (${this.formatSize(removedSize)}) eliminados`);
    }
  }

  private calculateHitRate(): number {
    // Esta es una implementación simplificada
    // En una implementación real, mantendrías contadores de hits/misses
    return 0.85; // 85% placeholder
  }

  private formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}