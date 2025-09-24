# Sistema de Comerciales - Analog Replay TV

Este documento describe el sistema de comerciales implementado en Analog Replay TV, incluyendo su configuración, uso y estructura.

## Estructura del Sistema

### 1. Tipos de Datos

#### `Commercial`
Representa un comercial individual:
```typescript
interface Commercial {
  year: number;        // Año de emisión del comercial
  duration: string;    // Duración en formato "mm:ss" o "hh:mm:ss"
  fileName: string;    // Ruta del archivo de video
}
```

#### `CommercialContext`
Agrupa comerciales por contexto (marca, producto, canal, etc.):
```typescript
interface CommercialContext {
  id: string;          // ID único del contexto
  name: string;        // Nombre del contexto (ej. "Coca-Cola 90s")
  description?: string; // Descripción opcional
  channel: string[];   // Canales asociados (múltiples permitidos)
  commercials: Commercial[]; // Array de comerciales
}
```

#### `CommercialConfig`
Configuración principal del sistema:
```typescript
interface CommercialConfig {
  contexts: CommercialContext[]; // Lista de contextos
  lastUpdated: string;          // Fecha de última actualización
}
```

### 2. Archivos y Ubicaciones

```
src/
├── config/
│   └── commercials/
│       ├── commercials.config.json    # Configuración principal
│       └── default.commercials.ts     # Configuración por defecto
├── services/
│   └── CommercialService.ts           # Servicio principal
├── components/
│   └── CommercialConfig.tsx           # Componente de configuración UI
├── hooks/
│   └── useCommercials.ts              # Hook personalizado
└── types/
    └── commercial.types.ts            # Definiciones de tipos
```

## Configuración

### Archivo de Configuración

El archivo `commercials.config.json` contiene la configuración principal:

```json
{
  "contexts": [
    {
      "id": "coca-cola-90s",
      "name": "Coca-Cola",
      "description": "Comerciales de Coca-Cola de los años 90",
      "channel": ["Disney Channel", "Nickelodeon", "Cartoon Network"],
      "commercials": [
        {
          "year": 1995,
          "duration": "00:30",
          "fileName": "commercials/coca-cola/coca-cola-1995-30s.mp4"
        }
      ]
    }
  ],
  "lastUpdated": "2025-09-24T19:45:00.000Z"
}
```

### Contextos Incluidos por Defecto

- **Coca-Cola**: Comerciales de diferentes años
- **McDonald's**: Promociones de comida rápida
- **Disney Channel Promos**: Promocionales del canal
- **Nickelodeon Promos**: Promocionales del canal
- **Cartoon Network Promos**: Promocionales del canal
- **Juguetes de los 90s**: Comerciales de juguetes populares

## Uso del Sistema

### 1. Servicio de Comerciales

```typescript
import { CommercialService } from '../services/CommercialService';

const commercialService = CommercialService.getInstance();

// Cargar configuración
const config = await commercialService.getConfig();

// Obtener comerciales por canal y año
const commercials = await commercialService.getCommercialsByChannelAndYear(
  'Disney Channel',
  1995,
  5 // tolerancia de años
);

// Obtener comerciales para rellenar tiempo específico
const fillerCommercials = await commercialService.getRandomCommercialsForDuration(
  'Nickelodeon',
  900, // 15 minutos en segundos
  1992
);
```

### 2. Hook Personalizado

```typescript
import { useCommercials } from '../hooks/useCommercials';

function MyComponent() {
  const {
    config,
    loading,
    getCommercialsForChannel,
    getRandomCommercialsForDuration,
    getStats
  } = useCommercials();

  // Uso del hook...
}
```

### 3. Componente de Configuración

El componente `CommercialConfig` proporciona una interfaz visual para:

- Ver contextos de comerciales existentes
- Crear nuevos contextos
- Editar contextos existentes
- Agregar/eliminar comerciales
- Gestionar asociaciones de canales

## Funcionalidades

### 1. Filtrado por Canal y Año

Los comerciales pueden filtrarse por:
- Canal específico (debe estar en la lista de canales del contexto)
- Año con tolerancia configurable (por defecto ±5 años)

### 2. Selección Aleatoria para Duración

El sistema puede seleccionar comerciales aleatorios que sumen aproximadamente una duración objetivo:
- Prioriza comerciales que se ajusten bien a la duración restante
- Usa tolerancia de 10 segundos para decisiones
- Selecciona el comercial más corto si no hay opciones viables

### 3. Gestión de Formatos

- Soporta duraciones en formato "mm:ss" y "hh:mm:ss"
- Convierte automáticamente entre segundos y formato de tiempo
- Valida formatos de entrada

### 4. Asociaciones Múltiples

Un contexto puede estar asociado a múltiples canales, permitiendo:
- Comerciales genéricos que aparecen en varios canales
- Promocionales específicos del canal
- Flexibilidad en la programación

## Integración con el Sistema de Programación

### Casos de Uso

1. **Relleno de Tiempo**: Cuando un show dura menos que su bloque de tiempo asignado
2. **Pausas Comerciales**: Durante episodios largos
3. **Transiciones**: Entre programas diferentes
4. **Fallback**: Cuando no hay comerciales específicos disponibles

### Ejemplo de Integración

```typescript
// En el generador de programación
const showDuration = 22; // minutos
const blockDuration = 30; // minutos
const fillTimeNeeded = (blockDuration - showDuration) * 60; // segundos

const fillerCommercials = await commercialService.getRandomCommercialsForDuration(
  channelName,
  fillTimeNeeded,
  programmingYear
);

if (fillerCommercials.length === 0) {
  // Mostrar pantalla con "Analog Replay TV"
  showDefaultScreen();
} else {
  // Reproducir comerciales seleccionados
  playCommercials(fillerCommercials);
}
```

## Consideraciones Técnicas

### 1. Rendimiento

- El servicio usa patrón Singleton para evitar múltiples instancias
- La configuración se carga una vez y se mantiene en memoria
- Los filtros y búsquedas son optimizados para conjuntos de datos pequeños a medianos

### 2. Persistencia

- Los cambios se guardan automáticamente en el archivo JSON
- Se mantiene timestamp de última actualización
- Backup automático de configuración por defecto si el archivo se corrompe

### 3. Validación

- Validación de formatos de duración
- Verificación de existencia de canales
- Prevención de contextos duplicados

### 4. Extensibilidad

- Fácil agregar nuevos tipos de comerciales
- Soporte para metadatos adicionales
- Posibilidad de integrar con sistemas externos de gestión de medios

## Troubleshooting

### Problemas Comunes

1. **Archivo de configuración no encontrado**: Se usa configuración por defecto
2. **Formato de duración inválido**: Se ignora el comercial con formato incorrecto
3. **Canal no encontrado**: Se filtran los comerciales de canales inexistentes
4. **No hay comerciales disponibles**: Se muestra pantalla por defecto

### Logs y Debug

El sistema registra información importante en consola:
- Carga de configuración
- Errores de formato
- Advertencias de archivos faltantes
- Operaciones de guardado