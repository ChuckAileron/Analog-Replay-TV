import type { CommercialConfig, CommercialContext } from '../../types/commercial.types';

/**
 * Configuración por defecto de comerciales
 * Esta configuración se usa cuando no existe un archivo de configuración personalizado
 */
export const defaultCommercialConfig: CommercialConfig = {
  contexts: [
    {
      id: 'generic-90s',
      name: 'Comerciales Genéricos 90s',
      description: 'Comerciales genéricos de la década de los 90',
      channel: ['Disney Channel', 'Nickelodeon', 'Cartoon Network'],
      commercials: [
        {
          year: 1995,
          duration: '00:30',
          fileName: 'commercials/generic/generic-90s-30s.mp4'
        }
      ]
    }
  ],
  lastUpdated: new Date().toISOString()
};

/**
 * Obtiene comerciales filtrados por canal y año
 * @param config Configuración de comerciales
 * @param channel Canal del que se quieren obtener comerciales
 * @param year Año de referencia para filtrar comerciales (opcional)
 * @param maxYearDifference Diferencia máxima de años permitida (por defecto 5)
 * @returns Array de comerciales que coinciden con los criterios
 */
export function getCommercialsByChannelAndYear(
  config: CommercialConfig,
  channel: string,
  year?: number,
  maxYearDifference: number = 5
) {
  const relevantContexts = config.contexts.filter(context =>
    context.channel.includes(channel)
  );

  const commercials = relevantContexts.flatMap(context =>
    context.commercials
      .filter(commercial => {
        if (!year) return true;
        return Math.abs(commercial.year - year) <= maxYearDifference;
      })
      .map(commercial => ({
        ...commercial,
        contextId: context.id,
        contextName: context.name
      }))
  );

  return commercials;
}

/**
 * Obtiene comerciales aleatorios para rellenar tiempo
 * @param config Configuración de comerciales
 * @param channel Canal del que se quieren obtener comerciales
 * @param targetDuration Duración objetivo en segundos
 * @param year Año de referencia (opcional)
 * @returns Array de comerciales que suman aproximadamente la duración objetivo
 */
export function getRandomCommercialsForDuration(
  config: CommercialConfig,
  channel: string,
  targetDuration: number,
  year?: number
) {
  const availableCommercials = getCommercialsByChannelAndYear(config, channel, year);
  
  if (availableCommercials.length === 0) {
    return [];
  }

  const selectedCommercials = [];
  let remainingDuration = targetDuration;

  // Convertir duraciones a segundos para cálculos
  const commercialsWithSeconds = availableCommercials.map(commercial => ({
    ...commercial,
    durationInSeconds: parseDurationToSeconds(commercial.duration)
  }));

  // Seleccionar comerciales hasta llenar la duración objetivo
  while (remainingDuration > 0 && commercialsWithSeconds.length > 0) {
    // Filtrar comerciales que no excedan demasiado la duración restante
    const viableCommercials = commercialsWithSeconds.filter(
      commercial => commercial.durationInSeconds <= remainingDuration + 10 // 10 segundos de tolerancia
    );

    if (viableCommercials.length === 0) {
      // Si no hay comerciales viables, tomar el más corto disponible
      const shortest = commercialsWithSeconds.reduce((prev, current) =>
        prev.durationInSeconds < current.durationInSeconds ? prev : current
      );
      selectedCommercials.push(shortest);
      remainingDuration -= shortest.durationInSeconds;
    } else {
      // Seleccionar un comercial viable aleatoriamente
      const randomCommercial = viableCommercials[Math.floor(Math.random() * viableCommercials.length)];
      selectedCommercials.push(randomCommercial);
      remainingDuration -= randomCommercial.durationInSeconds;
    }
  }

  return selectedCommercials;
}

/**
 * Convierte una duración en formato "mm:ss" o "hh:mm:ss" a segundos
 * @param duration Duración en formato string
 * @returns Duración en segundos
 */
function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 2) {
    // Formato mm:ss
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // Formato hh:mm:ss
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

/**
 * Convierte segundos a formato "mm:ss"
 * @param seconds Duración en segundos
 * @returns Duración en formato "mm:ss"
 */
export function formatSecondsToMMSS(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Obtiene todos los contextos de comerciales disponibles
 * @param config Configuración de comerciales
 * @returns Array de contextos de comerciales
 */
export function getAllCommercialContexts(config: CommercialConfig): CommercialContext[] {
  return config.contexts;
}

/**
 * Obtiene un contexto de comerciales por su ID
 * @param config Configuración de comerciales
 * @param contextId ID del contexto a buscar
 * @returns El contexto encontrado o undefined
 */
export function getCommercialContextById(config: CommercialConfig, contextId: string): CommercialContext | undefined {
  return config.contexts.find(context => context.id === contextId);
}

/**
 * Filtra contextos de comerciales por canal
 * @param config Configuración de comerciales
 * @param channel Canal por el que filtrar
 * @returns Array de contextos que incluyen el canal especificado
 */
export function getCommercialContextsByChannel(config: CommercialConfig, channel: string): CommercialContext[] {
  return config.contexts.filter(context => context.channel.includes(channel));
}