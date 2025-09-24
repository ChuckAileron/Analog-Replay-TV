/**
 * Ejemplos de uso del Sistema de Shows
 * Este archivo demuestra cómo usar las diferentes funcionalidades
 * del sistema de shows implementado.
 */

import { ShowService } from '../services/ShowService';

// Ejemplo 1: Uso básico del servicio de shows
export async function basicShowUsage() {
  console.log('=== Ejemplo 1: Uso básico del servicio de shows ===');
  
  const showService = ShowService.getInstance();
  
  try {
    // Cargar configuración
    const config = await showService.getConfig();
    console.log(`Configuración cargada: ${config.shows.length} shows`);
    
    // Obtener shows para Disney Channel
    const disneyShows = await showService.getShowsByChannel('Disney Channel');
    console.log(`Shows para Disney Channel: ${disneyShows.length}`);
    disneyShows.forEach(show => {
      console.log(`  - ${show.name} (${show.seasons.length} temporadas)`);
    });
    
    // Obtener shows del año 1995 con tolerancia de 2 años
    const shows1995 = await showService.getShowsByYear(1995, 2);
    console.log(`Shows de 1995±2: ${shows1995.length}`);
    shows1995.forEach(show => {
      const years = show.seasons.map(s => s.year).join(', ');
      console.log(`  - ${show.name} (años: ${years})`);
    });
    
    // Obtener un show aleatorio para Cartoon Network
    const randomShow = await showService.getRandomShowByChannel('Cartoon Network');
    if (randomShow) {
      console.log(`Show aleatorio para Cartoon Network: ${randomShow.name}`);
    } else {
      console.log('No hay shows disponibles para Cartoon Network');
    }
    
  } catch (error) {
    console.error('Error en ejemplo básico:', error);
  }
}

// Ejemplo 2: Generación de programación (como menciona el TODO)
export async function generateProgrammingSchedule() {
  console.log('\n=== Ejemplo 2: Generación de programación ===');
  
  const showService = ShowService.getInstance();
  
  // Simular configuración del usuario
  const userSettings = {
    channel: 'Nickelodeon',
    baseYear: 1995,        // Año definido por el usuario
    maxCurrentYearShows: 6, // Máximo shows del año definido
    repeatSeasons: true     // Repetir temporadas
  };
  
  console.log(`Canal: ${userSettings.channel}`);
  console.log(`Año base: ${userSettings.baseYear}`);
  console.log(`Repetir temporadas: ${userSettings.repeatSeasons ? 'Sí' : 'No'}`);
  
  try {
    // Obtener shows para programación
    const programmingShows = await showService.getRandomShowsForSchedule(
      userSettings.channel,
      userSettings.baseYear,
      8, // Total de shows para la programación
      3  // Tolerancia de años
    );
    
    console.log(`\nShows seleccionados para programación: ${programmingShows.length}`);
    
    // Simular programación diaria (mañana, tarde, noche)
    const timeSlots = ['mañana', 'tarde', 'noche'];
    
    programmingShows.forEach((show, index) => {
      const timeSlot = timeSlots[index % 3];
      const firstSeason = show.seasons[0];
      const episodeCount = firstSeason.episodes.length;
      
      console.log(`  ${timeSlot.toUpperCase()}: ${show.name}`);
      console.log(`    - Temporada ${firstSeason.season} (${firstSeason.year})`);
      console.log(`    - ${episodeCount} episodios`);
      console.log(`    - Primer episodio: "${firstSeason.episodes[0].title}" (${firstSeason.episodes[0].duration})`);
      
      if (userSettings.repeatSeasons && show.seasons.length > 1) {
        console.log(`    - Temporada siguiente disponible: ${firstSeason.season + 1}`);
      }
    });
    
  } catch (error) {
    console.error('Error en generación de programación:', error);
  }
}

// Ejemplo 3: Cálculo de bloques de programación con comerciales
export async function calculateProgrammingBlocks() {
  console.log('\n=== Ejemplo 3: Cálculo de bloques de programación ===');
  
  const showService = ShowService.getInstance();
  
  try {
    const show = await showService.getShowById(1);
    if (!show) {
      console.log('Show no encontrado');
      return;
    }
    
    const episode = show.seasons[0].episodes[0];
    console.log(`Analizando: ${show.name} - ${episode.title}`);
    console.log(`Duración del episodio: ${episode.duration}`);
    
    // Convertir duración a minutos
    const durationMinutes = parseDurationToMinutes(episode.duration);
    console.log(`Duración en minutos: ${durationMinutes}`);
    
    // Determinar bloque según la duración (como menciona el TODO)
    let blockDuration: number;
    let commercialTime: number;
    
    if (durationMinutes < 30) {
      blockDuration = 30;
      commercialTime = 30 - durationMinutes;
      console.log('Bloque de 30 minutos asignado');
    } else if (durationMinutes >= 30 && durationMinutes < 60) {
      blockDuration = 60;
      commercialTime = 60 - durationMinutes;
      console.log('Bloque de 1 hora asignado');
    } else {
      blockDuration = Math.ceil(durationMinutes / 30) * 30; // Bloques de 30 min
      commercialTime = blockDuration - durationMinutes;
      console.log(`Bloque de ${blockDuration} minutos asignado`);
    }
    
    console.log(`Tiempo para comerciales: ${commercialTime} minutos`);
    
    if (commercialTime > 0) {
      console.log(`Se necesitan comerciales asociados al año ${show.seasons[0].year}`);
      console.log('Si no hay comerciales disponibles, mostrar: "Analog Replay TV"');
    }
    
  } catch (error) {
    console.error('Error en cálculo de bloques:', error);
  }
}

// Ejemplo 4: Búsqueda y filtrado avanzado
export async function advancedSearchAndFilter() {
  console.log('\n=== Ejemplo 4: Búsqueda y filtrado avanzado ===');
  
  const showService = ShowService.getInstance();
  
  try {
    // Buscar shows por título
    const searchResults = await showService.searchShows('adventure');
    console.log(`Resultados de búsqueda para "adventure": ${searchResults.length}`);
    searchResults.forEach(show => {
      console.log(`  - ${show.name}`);
    });
    
    // Obtener shows por rango de años (década de los 90s)
    const nineties = await showService.getShowsByYearRange(1990, 1999);
    console.log(`\nShows de los 90s: ${nineties.length}`);
    nineties.forEach(show => {
      const years = [...new Set(show.seasons.map(s => s.year))].sort();
      console.log(`  - ${show.name} (${years.join(', ')})`);
    });
    
    // Obtener estadísticas
    const stats = await showService.getStats();
    console.log('\n=== Estadísticas del Sistema ===');
    console.log(`Total de shows: ${stats.totalShows}`);
    console.log(`Total de temporadas: ${stats.totalSeasons}`);
    console.log(`Total de episodios: ${stats.totalEpisodes}`);
    console.log(`Canales únicos: ${stats.channelsCount}`);
    console.log(`Canales: ${stats.channels.join(', ')}`);
    console.log(`Rango de años: ${stats.yearsRange.min} - ${stats.yearsRange.max}`);
    console.log(`Promedio episodios por show: ${stats.averageEpisodesPerShow}`);
    console.log(`Promedio temporadas por show: ${stats.averageSeasonsPerShow}`);
    console.log(`Duración promedio por episodio: ${stats.averageEpisodeDuration} minutos`);
    
  } catch (error) {
    console.error('Error en búsqueda avanzada:', error);
  }
}

// Ejemplo 5: Simulación de programación nocturna exclusiva
export async function nightlyProgramming() {
  console.log('\n=== Ejemplo 5: Programación nocturna exclusiva ===');
  
  const showService = ShowService.getInstance();
  
  try {
    // Simular canal con programación nocturna exclusiva (00:00 - 05:59)
    const channel = 'Cartoon Network';
    const year = 1997;
    
    console.log(`Programación nocturna para ${channel} (${year})`);
    console.log('Horario: 00:00 AM - 05:59 AM');
    
    // Obtener shows disponibles
    const availableShows = await showService.getShowsByChannelAndYear(channel, year, 2);
    
    if (availableShows.length === 0) {
      console.log('No hay shows disponibles para programación nocturna');
      return;
    }
    
    // Simular 2 repeticiones durante la noche
    const nightSlots = [
      { time: '00:00 - 03:00', label: 'Primera transmisión nocturna' },
      { time: '03:00 - 06:00', label: 'Segunda transmisión nocturna' }
    ];
    
    nightSlots.forEach((slot) => {
      console.log(`\n${slot.time} - ${slot.label}:`);
      
      // Seleccionar shows aleatorios para este slot
      const slotShows = [...availableShows].sort(() => 0.5 - Math.random()).slice(0, 3);
      
      slotShows.forEach((show, showIndex) => {
        const season = show.seasons[0];
        const episode = season.episodes[0];
        console.log(`  ${String(showIndex + 1).padStart(2, '0')}:00 - ${show.name}`);
        console.log(`         "${episode.title}" (${episode.duration})`);
      });
    });
    
  } catch (error) {
    console.error('Error en programación nocturna:', error);
  }
}

// Función auxiliar para parsear duración
function parseDurationToMinutes(duration: string): number {
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  } else if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  
  return 0;
}

// Función principal para ejecutar todos los ejemplos
export async function runShowExamples() {
  console.log('📺 Iniciando ejemplos del Sistema de Shows\n');
  
  await basicShowUsage();
  await generateProgrammingSchedule();
  await calculateProgrammingBlocks();
  await advancedSearchAndFilter();
  await nightlyProgramming();
  
  console.log('\n✅ Ejemplos de shows completados');
}

// Para uso en Node.js/desarrollo
if (typeof window === 'undefined') {
  // Ejecutar ejemplos si es llamado directamente
  runShowExamples().catch(console.error);
}