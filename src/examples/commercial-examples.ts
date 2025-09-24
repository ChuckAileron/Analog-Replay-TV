/**
 * Ejemplo de uso del Sistema de Comerciales
 * Este archivo demuestra cómo usar las diferentes funcionalidades
 * del sistema de comerciales implementado.
 */

import { CommercialService } from '../services/CommercialService';
import type { CommercialContext } from '../types/commercial.types';

// Ejemplo 1: Uso básico del servicio
export async function basicCommercialUsage() {
  console.log('=== Ejemplo 1: Uso básico del servicio ===');
  
  const commercialService = CommercialService.getInstance();
  
  try {
    // Cargar configuración
    const config = await commercialService.getConfig();
    console.log(`Configuración cargada: ${config.contexts.length} contextos`);
    
    // Obtener comerciales para Disney Channel del año 1995
    const disneyCommercials = await commercialService.getCommercialsByChannelAndYear(
      'Disney Channel',
      1995,
      3 // tolerancia de ±3 años
    );
    
    console.log(`Comerciales para Disney Channel (1995±3): ${disneyCommercials.length}`);
    disneyCommercials.forEach(commercial => {
      console.log(`  - ${commercial.contextName}: ${commercial.year} (${commercial.duration})`);
    });
    
    // Obtener comerciales aleatorios para rellenar 8 minutos
    const fillerCommercials = await commercialService.getRandomCommercialsForDuration(
      'Nickelodeon',
      480, // 8 minutos en segundos
      1997
    );
    
    console.log(`Comerciales de relleno para 8 minutos: ${fillerCommercials.length}`);
    let totalDuration = 0;
    fillerCommercials.forEach(commercial => {
      const seconds = parseDurationToSeconds(commercial.duration);
      totalDuration += seconds;
      console.log(`  - ${commercial.contextName}: ${commercial.duration}`);
    });
    console.log(`Duración total: ${formatSecondsToMMSS(totalDuration)}`);
    
  } catch (error) {
    console.error('Error en ejemplo básico:', error);
  }
}

// Ejemplo 2: Simulación de programación con comerciales
export async function programmingWithCommercials() {
  console.log('\n=== Ejemplo 2: Programación con comerciales ===');
  
  const commercialService = CommercialService.getInstance();
  
  // Simular un show de 22 minutos en un bloque de 30 minutos
  const showDurationMinutes = 22;
  const blockDurationMinutes = 30;
  const channelName = 'Cartoon Network';
  const year = 1996;
  
  const fillTimeSeconds = (blockDurationMinutes - showDurationMinutes) * 60;
  
  console.log(`Show: ${showDurationMinutes} min, Bloque: ${blockDurationMinutes} min`);
  console.log(`Tiempo a rellenar: ${fillTimeSeconds / 60} minutos`);
  
  try {
    const commercials = await commercialService.getRandomCommercialsForDuration(
      channelName,
      fillTimeSeconds,
      year
    );
    
    if (commercials.length === 0) {
      console.log('No hay comerciales disponibles, mostrando pantalla por defecto');
      showDefaultScreen();
    } else {
      console.log(`Programación de comerciales:`);
      commercials.forEach((commercial, index) => {
        console.log(`  ${index + 1}. ${commercial.contextName} (${commercial.year}) - ${commercial.duration}`);
      });
    }
    
  } catch (error) {
    console.error('Error en programación:', error);
  }
}

// Ejemplo 3: Análisis de contextos por canal
export async function analyzeContextsByChannel() {
  console.log('\n=== Ejemplo 3: Análisis de contextos por canal ===');
  
  const commercialService = CommercialService.getInstance();
  
  try {
    const config = await commercialService.getConfig();
    const channels = ['Disney Channel', 'Nickelodeon', 'Cartoon Network'];
    
    channels.forEach(channel => {
      const contextsForChannel = config.contexts.filter(context =>
        context.channel.includes(channel)
      );
      
      const totalCommercials = contextsForChannel.reduce(
        (sum, context) => sum + context.commercials.length,
        0
      );
      
      console.log(`\n${channel}:`);
      console.log(`  - Contextos: ${contextsForChannel.length}`);
      console.log(`  - Total comerciales: ${totalCommercials}`);
      
      contextsForChannel.forEach(context => {
        console.log(`    * ${context.name}: ${context.commercials.length} comerciales`);
      });
    });
    
  } catch (error) {
    console.error('Error en análisis:', error);
  }
}

// Ejemplo 4: Crear nuevo contexto programáticamente
export async function createNewContext() {
  console.log('\n=== Ejemplo 4: Crear nuevo contexto ===');
  
  const commercialService = CommercialService.getInstance();
  
  try {
    const config = await commercialService.getConfig();
    
    const newContext: CommercialContext = {
      id: `test-context-${Date.now()}`,
      name: 'Test Context',
      description: 'Contexto de prueba creado programáticamente',
      channel: ['Disney Channel'],
      commercials: [
        {
          year: 1995,
          duration: '00:30',
          fileName: 'test/test-commercial-30s.mp4'
        },
        {
          year: 1996,
          duration: '00:15',
          fileName: 'test/test-commercial-15s.mp4'
        }
      ]
    };
    
    const updatedConfig = {
      ...config,
      contexts: [...config.contexts, newContext]
    };
    
    await commercialService.updateConfig(updatedConfig);
    
    console.log(`Nuevo contexto creado: ${newContext.name}`);
    console.log(`ID: ${newContext.id}`);
    console.log(`Comerciales: ${newContext.commercials.length}`);
    
    // Opcional: eliminar el contexto de prueba después
    setTimeout(async () => {
      try {
        const currentConfig = await commercialService.getConfig();
        const filteredContexts = currentConfig.contexts.filter(
          context => context.id !== newContext.id
        );
        
        await commercialService.updateConfig({
          ...currentConfig,
          contexts: filteredContexts
        });
        
        console.log('Contexto de prueba eliminado');
      } catch (error) {
        console.error('Error eliminando contexto de prueba:', error);
      }
    }, 5000);
    
  } catch (error) {
    console.error('Error creando contexto:', error);
  }
}

// Funciones auxiliares
function showDefaultScreen() {
  console.log('📺 Mostrando pantalla: "Analog Replay TV"');
}

function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

function formatSecondsToMMSS(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Función principal para ejecutar todos los ejemplos
export async function runCommercialExamples() {
  console.log('🎬 Iniciando ejemplos del Sistema de Comerciales\n');
  
  await basicCommercialUsage();
  await programmingWithCommercials();
  await analyzeContextsByChannel();
  await createNewContext();
  
  console.log('\n✅ Ejemplos completados');
}

// Para uso en Node.js/desarrollo
if (typeof window === 'undefined') {
  // Ejecutar ejemplos si es llamado directamente
  runCommercialExamples().catch(console.error);
}