# Sistema de Programación de Analog Replay TV

## Descripción General

El sistema de programación de Analog Replay TV es un sistema complejo que simula la programación de televisión analógica, donde cada canal tiene una programación predefinida que se ejecuta en tiempo real, sincronizada con la fecha y hora del dispositivo.

## Características Principales

### 🎯 Funcionalidades Core

1. **Programación Basada en Tiempo Real**: La programación está sincronizada con la fecha y hora del sistema
2. **Selección de Año Principal**: El usuario define un año que determina la prioridad de shows
3. **Generación Automática**: Programación completa generada para todo el año
4. **Persistencia Local**: Configuración guardada localmente para mantener estado entre sesiones
5. **Cálculo de Tiempo Transcurrido**: Cuando cambias de canal, el show se reproduce desde el punto correcto en el tiempo
6. **Rotación de Shows**: Sistema inteligente que maneja repeticiones y avance de episodios/temporadas

### 📅 Lógica de Programación

#### Selección de Año Principal
- En el primer uso, se solicita al usuario seleccionar un año de transmisión
- Este año determina la prioridad de shows en la programación
- Máximo 6 shows del año seleccionado, el resto son de años anteriores
- Configuración guarda opciones como repetición de temporadas

#### Generación de Programación Anual
- Se genera programación completa para todo el año (1 enero - 31 diciembre)
- Programación se regenera automáticamente el 1 de diciembre para el próximo año
- Si el usuario no usa la app por más de un año, se regenera automáticamente

#### Bloques de Programación
- Shows < 30 min = Bloque de 30 minutos
- Shows 30-60 min = Bloque de 60 minutos  
- Shows > 60 min = Múltiples bloques de 60 minutos
- Tiempo sobrante se llena con comerciales del año principal
- Sin comerciales = Mensaje "Analog Replay TV"

#### Horarios de Transmisión
- **Programación Normal**: 3 transmisiones (mañana, tarde, noche)
- **Programación Nocturna**: Solo 2 transmisiones (00:00-05:59)
- **Repetición de Temporadas**: Configurable 1x o 2x por el usuario

## Arquitectura del Sistema

### 🏗️ Estructura de Archivos

```
src/
├── types/
│   └── schedule.types.ts         # Tipos TypeScript completos
├── services/
│   └── ScheduleService.ts        # Servicio principal de programación
├── hooks/
│   └── useSchedule.ts           # Hook personalizado para React
├── components/
│   ├── YearSelection.tsx        # Selección inicial de año
│   ├── ScheduleDisplay.tsx      # Visualización de programación
│   └── ScheduleManager.tsx      # Componente principal integrador
├── styles/
│   ├── year-selection.css       # Estilos selección de año
│   ├── schedule-display.css     # Estilos visualización
│   └── schedule-manager.css     # Estilos manager principal
└── examples/
    └── TVWithScheduling.tsx     # Ejemplo de integración
```

### 🔧 Servicios y Clases Principales

#### ScheduleService
```typescript
class ScheduleService {
  // Singleton principal que maneja toda la lógica
  initialize(): Promise<ScheduleStatus>
  setPrimaryYear(year: number): Promise<void>
  generateYearlySchedule(): Promise<void>
  getCurrentScheduleEntry(channelId: string): Promise<ScheduleEntry | null>
  calculateCurrentShowTime(entry: ScheduleEntry): TimeCalculation
}
```

#### Tipos Principales
```typescript
interface ScheduleEntry {
  id: string
  showId: number
  seasonNumber: number
  episodeNumber: number
  channelId: string
  startTime: Date
  endTime: Date
  duration: number // minutos
  // ... más propiedades
}

interface TimeCalculation {
  currentTime: Date
  showStartTime: Date
  showEndTime: Date
  elapsedTime: number // minutos transcurridos
  remainingTime: number // minutos restantes
  seekPosition: number // posición en segundos para reproducción
}
```

## Flujo de Uso

### 🚀 Inicialización

1. **Primera Vez**: 
   - Sistema detecta que no hay configuración
   - Muestra componente `YearSelection`
   - Usuario selecciona año principal
   - Genera programación anual completa

2. **Usos Posteriores**:
   - Carga configuración existente
   - Verifica si necesita regenerar programación
   - Inicia directamente con programación lista

### 📺 Cambio de Canal

1. Usuario cambia de canal
2. Sistema obtiene `currentScheduleEntry` para ese canal
3. Calcula `TimeCalculation` basado en hora actual
4. Determina posición exacta donde debe comenzar el video
5. Inicia reproducción desde esa posición

### ⚙️ Configuración Dinámica

- **Repetir Temporadas**: Toggle entre 1x y 2x repeticiones
- **Regenerar Año**: Botón para regenerar con nuevo año
- **Ver Programación**: Vista previa de programación del día

## Estados del Sistema

### 📊 ScheduleStatus

- `not_initialized`: Sistema sin inicializar
- `initializing`: Proceso de inicialización
- `needs_year_selection`: Requiere selección de año
- `generating`: Generando programación anual
- `converting_videos`: Convirtiendo archivos de video
- `ready`: Sistema listo para uso
- `error`: Error en el sistema

## Componentes de UI

### 🎨 YearSelection
- Interfaz para selección de año principal
- Años populares como botones rápidos
- Información sobre el sistema de programación
- Estados de carga durante generación

### 📺 ScheduleDisplay
- Muestra programación actual del canal
- Información de tiempo transcurrido/restante
- Barra de progreso visual
- Estados de conversión de video
- Modo compacto y completo

### 🎛️ ScheduleManager
- Componente principal que orquesta todo
- Maneja todos los estados del sistema
- Flujo completo desde configuración hasta uso
- Integración con otros sistemas

## Integración con Sistemas Existentes

### 🔗 Sistema de Canales
```typescript
// Integración con channelManager existente
private async getAvailableChannels(): Promise<Channel[]> {
  const { channelManager } = await import('../features/channels/channelManager');
  await channelManager.initialize();
  return await channelManager.getChannels();
}
```

### 🎬 Sistema de Shows
```typescript
// Uso de ShowService existente
const availableShows = await this.showService.getRandomShowsForSchedule(
  channel.name,
  this.config.primaryYear,
  this.config.maxShowsFromPrimaryYear + 4,
  this.config.yearTolerance
);
```

## Configuración y Persistencia

### 💾 Estructura de Configuración
```json
{
  "primaryYear": 1990,
  "allowYearSelection": false,
  "repeatSeasons": true,
  "lastYearCheck": "2025-09-24T10:00:00.000Z",
  "yearTolerance": 3,
  "maxShowsFromPrimaryYear": 6,
  "schedules": {
    "channel1": {
      "channelId": "1",
      "year": 1990,
      "dailySchedules": {
        "2025-01-01": { /* programación del día */ }
      }
    }
  }
}
```

### 📁 Ubicación de Archivos
- Configuración: `src/config/schedule/schedule.config.json`
- Se crea automáticamente si no existe
- Backup automático en cada actualización

## Características Avanzadas

### 🔄 Regeneración Automática
- Verifica necesidad de nueva programación
- Regenera el 1 de diciembre para el próximo año
- Manejo de años expirados automáticamente

### 🎯 Cálculo de Tiempo Preciso
```typescript
// Ejemplo de cálculo
const now = new Date();
const elapsedMs = now.getTime() - showStart.getTime();
const elapsedMinutes = elapsedMs / (1000 * 60);
const seekPosition = elapsedMinutes * 60; // segundos para video
```

### 📈 Rotación Inteligente
- Avance automático de episodios
- Repetición de temporadas configurable
- Transición automática entre temporadas
- Detección de shows completados

## Ejemplos de Uso

### 🔌 Integración Básica
```tsx
import { ScheduleManager } from './components/ScheduleManager';

function TVApp() {
  const [channelId, setChannelId] = useState('1');
  
  return (
    <ScheduleManager
      currentChannelId={channelId}
      currentChannelName={`Canal ${channelId}`}
      onScheduleReady={() => console.log('Programación lista!')}
      onError={(error) => console.error(error)}
    />
  );
}
```

### 🎣 Hook Personalizado
```tsx
function ChannelComponent({ channelId }: { channelId: string }) {
  const { currentShow, timeInfo } = useChannelSchedule(channelId);
  
  return (
    <div>
      {currentShow && (
        <p>Reproduciendo: {currentShow.showId} desde minuto {timeInfo?.elapsedTime}</p>
      )}
    </div>
  );
}
```

## Pendientes de Implementación

### 🚧 Sistema de Conversiones
- Cola de conversiones en paralelo
- Priorización por canal actual
- Conversión preventiva del próximo episodio
- Integración con VideoConverter existente

### 🎯 Comerciales Dinámicos
- Integración completa con CommercialService
- Selección inteligente por año y canal
- Fallback a pantalla "Analog Replay TV"

### ⚡ Optimizaciones
- Cache de programación en memoria
- Lazy loading de configuraciones
- Optimización de cálculos de tiempo
- Background tasks para mantenimiento

Este sistema implementa la mayoría de los requerimientos especificados en el TODO y proporciona una base sólida para la simulación de programación televisiva analógica en tiempo real.