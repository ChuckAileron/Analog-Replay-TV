# Sistema de Shows - Analog Replay TV

Este documento describe el sistema de configuración por defecto de shows implementado en Analog Replay TV, incluyendo su estructura, uso e integración con el sistema de programación.

## Estructura del Sistema

### 1. Tipos de Datos

#### `TVEpisode`
Representa un episodio individual:
```typescript
interface TVEpisode {
  episode: number;           // Número del episodio
  title: string;             // Título del episodio
  description?: string;      // Descripción opcional
  duration: string;          // Duración en formato "mm:ss" o "hh:mm:ss"
  airDate?: string;          // Fecha de emisión original
  commercialBreaks?: string[]; // Puntos de corte comercial
  fileName?: string;         // Nombre del archivo de video
}
```

#### `TVSeason`
Representa una temporada de un show:
```typescript
interface TVSeason {
  season: number;            // Número de temporada
  year: number;              // Año de la temporada
  episodes: TVEpisode[];     // Array de episodios
  contentPath?: string;      // Ruta donde se encuentran los archivos
}
```

#### `TVShow`
Representa un show completo:
```typescript
interface TVShow {
  id: number;                // ID único del show
  name: string;              // Nombre del show
  channel: string[];         // Canales asociados (múltiples permitidos)
  seasons: TVSeason[];       // Array de temporadas
}
```

#### `ShowConfig`
Configuración principal del sistema:
```typescript
interface ShowConfig {
  shows: TVShow[];           // Lista de shows
  lastUpdated: string;       // Fecha de última actualización
}
```

### 2. Archivos y Ubicaciones

```
src/
├── config/
│   └── shows/
│       ├── shows.config.json          # Configuración principal existente
│       ├── default.shows.ts           # Configuración por defecto (NUEVO)
│       └── shows.example.json         # Ejemplo con más shows (NUEVO)
├── services/
│   └── ShowService.ts                 # Servicio principal (NUEVO)
├── hooks/
│   └── useShows.ts                    # Hook personalizado (NUEVO)
└── examples/
    └── show-examples.ts               # Ejemplos de uso (NUEVO)
```

## Configuración por Defecto

### Shows Incluidos

1. **Show Demo 90s** (Disney Channel) - 1995
   - Show de demostración con episodios típicos de 22 minutos

2. **Cartoon Clásico** (Cartoon Network, Nickelodeon) - 1992-1993
   - Cartoon tradicional con episodios de 11 minutos, 2 temporadas

3. **Aventuras Espaciales** (Disney Channel, Cartoon Network) - 1998
   - Show de aventuras con episodios de 24-25 minutos

4. **Colegiales 90s** (Disney Channel, Nickelodeon) - 1996
   - Comedia escolar con episodios de 22 minutos

5. **Detectives Jóvenes** (Disney Channel) - 1994
   - Series de misterio con episodios de 21-23 minutos

6. **Robots y Gadgets** (Cartoon Network) - 1997
   - Show de ciencia ficción con episodios de 11-12 minutos

### Ejemplo Extendido

El archivo `shows.example.json` incluye shows clásicos reales como:
- **Rugrats**, **Hey Arnold!** (Nickelodeon)
- **Dexter's Laboratory**, **The Powerpuff Girls** (Cartoon Network)
- **Darkwing Duck**, **TaleSpin**, **Gargoyles** (Disney Channel)

## Funcionalidades del Sistema

### 1. Servicio de Shows (`ShowService`)

```typescript
import { ShowService } from '../services/ShowService';

const showService = ShowService.getInstance();

// Obtener shows por canal
const disneyShows = await showService.getShowsByChannel('Disney Channel');

// Obtener shows por año con tolerancia
const shows1995 = await showService.getShowsByYear(1995, 3);

// Obtener shows para programación
const programmingShows = await showService.getRandomShowsForSchedule(
  'Nickelodeon',
  1995,
  6, // máximo 6 shows del año definido
  3  // tolerancia de años
);
```

### 2. Hook Personalizado (`useShows`)

```typescript
import { useShows } from '../hooks/useShows';

function MyComponent() {
  const {
    config,
    loading,
    getShowsForChannel,
    getRandomShowsForSchedule,
    getStats
  } = useShows();

  // Uso del hook...
}
```

### 3. Funciones Auxiliares

La configuración por defecto incluye funciones de utilidad:

```typescript
import {
  getShowsByChannel,
  getShowsByYear,
  getShowsByChannelAndYear,
  getRandomShowByChannel,
  getDefaultShowsStats
} from '../config/shows/default.shows';
```

## Integración con el Sistema de Programación

### Implementación según el TODO

El sistema está diseñado para implementar la lógica de programación mencionada en el TODO:

#### 1. **Configuración del Año Base**
```typescript
// El usuario define un año base (ej. 1995)
const userBaseYear = 1995;

// Obtener shows priorizando el año definido
const programmingShows = await showService.getRandomShowsForSchedule(
  'Disney Channel',
  userBaseYear,
  8, // total de shows
  3  // tolerancia de años
);
```

#### 2. **Priorización de Shows**
- **Máximo 6 shows** del año definido por el usuario
- **Resto completado** con shows de años anteriores aleatorios
- **Filtrado por canal** automático

#### 3. **Programación por Bloques de Tiempo**
```typescript
// Según duración promedio del show
const episode = show.seasons[0].episodes[0];
const durationMinutes = parseDurationToMinutes(episode.duration);

let blockDuration: number;
if (durationMinutes < 30) {
  blockDuration = 30; // Bloque de 30 min
} else if (durationMinutes < 60) {
  blockDuration = 60; // Bloque de 1 hora  
}

const commercialTime = blockDuration - durationMinutes;
// Tiempo restante se llena con comerciales del año asociado
```

#### 4. **Repeticiones Diarias**
- **3 repeticiones**: mañana, tarde, noche
- **Programación nocturna exclusiva**: 2 repeticiones (00:00-05:59)

#### 5. **Repetición de Temporadas**
- Configuración de usuario: "repetir temporadas"
- Una temporada se repite **2 veces** si está habilitado
- Al terminar, se actualiza automáticamente a la siguiente temporada

### Ejemplo de Programación Diaria

```typescript
const timeSlots = [
  { time: '08:00-12:00', label: 'mañana' },
  { time: '14:00-18:00', label: 'tarde' },
  { time: '20:00-24:00', label: 'noche' }
];

// Para canal con programación nocturna exclusiva
const nightSlots = [
  { time: '00:00-03:00', label: 'primera transmisión' },
  { time: '03:00-06:00', label: 'segunda transmisión' }
];
```

## Características Especiales

### 1. **Múltiples Canales por Show**
Un show puede estar asociado a varios canales:
```typescript
{
  "name": "Cartoon Clásico",
  "channel": ["Cartoon Network", "Nickelodeon"]
}
```

### 2. **Filtrado Inteligente por Año**
```typescript
// Shows del año específico + tolerancia
const targetYear = 1995;
const tolerance = 3; // ±3 años (1992-1998)
```

### 3. **Estadísticas Automáticas**
```typescript
const stats = await showService.getStats();
// Retorna: total shows, temporadas, episodios, canales, 
//          rango de años, promedios, etc.
```

### 4. **Búsqueda Avanzada**
```typescript
// Buscar por nombre de show o episodio
const results = await showService.searchShows('adventure');

// Buscar por rango de años
const nineties = await showService.getShowsByYearRange(1990, 1999);
```

### 5. **Fallback Inteligente**
- Si no hay shows del año específico, busca por canal
- Si no hay shows del canal, usa configuración por defecto
- Garantiza que siempre haya contenido disponible

## Casos de Uso Prácticos

### 1. **Primera Configuración**
```typescript
// Usuario configura año base: 1995
// Sistema genera programación con shows de 1995 y anteriores
const schedule = await showService.getRandomShowsForSchedule('Disney Channel', 1995);
```

### 2. **Cambio de Canal**
```typescript
// Usuario cambia a otro canal
// Sistema calcula qué show debe estar activo según hora actual
const currentShow = calculateCurrentShow(channel, currentTime);
const approximatePlaybackTime = calculatePlaybackTime(currentShow, currentTime);
```

### 3. **Actualización de Programación**
```typescript
// Al terminar una temporada, actualizar a la siguiente
if (seasonFinished) {
  const nextSeason = getNextSeason(show, currentSeason);
  if (nextSeason) {
    updateProgrammingSchedule(show, nextSeason);
  }
}
```

### 4. **Programación Nocturna**
```typescript
// Para canales con programación exclusivamente nocturna
const isNightChannel = checkNightlyExclusive(channel);
if (isNightChannel && isNightTime(currentTime)) {
  const nightSchedule = generateNightlySchedule(channel, shows);
}
```

## Rendimiento y Optimización

### 1. **Servicio Singleton**
- Una sola instancia del servicio en toda la aplicación
- Configuración cargada una vez y mantenida en memoria

### 2. **Filtrado Eficiente**
- Filtros optimizados para conjuntos de datos medianos
- Índices automáticos por canal y año

### 3. **Carga Lazy**
- Configuración se carga solo cuando es necesaria
- Fallback automático a configuración por defecto

### 4. **Cache de Resultados**
- Resultados de búsqueda y filtros pueden ser cacheados
- Invalidación automática al actualizar configuración

## Extensibilidad

### 1. **Nuevos Shows**
Fácil agregar shows manteniendo la estructura:
```typescript
const newShow: TVShow = {
  id: uniqueId,
  name: "Nuevo Show",
  channel: ["Canal"],
  seasons: [/* temporadas */]
};
```

### 2. **Metadatos Adicionales**
Los tipos soportan campos opcionales para extensión:
- `description` en episodios
- `airDate` para fechas originales
- `commercialBreaks` para puntos de corte
- `contentPath` para rutas de archivos

### 3. **Integraciones Externas**
- Posibilidad de conectar con APIs de metadatos
- Importación desde fuentes externas
- Exportación a otros formatos

Este sistema proporciona la base sólida necesaria para implementar la lógica compleja de generación de programación mencionada en el TODO, manteniendo flexibilidad y facilidad de uso.