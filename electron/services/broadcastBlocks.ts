/**
 * DEFINICIÓN CANÓNICA de los bloques de emisión por horario.
 *
 * Este archivo es la única fuente de verdad. Lo consumen tanto el proceso
 * principal (`ScheduleService.ts`) como el renderer
 * (`src/types/broadcastBlock.types.ts`, que solo re-exporta lo de aquí), de
 * modo que la aplicación externa de configuración pueda alinearse exactamente
 * a estos mismos valores y límites.
 *
 * CONTRATO (no cambiar sin actualizar la otra aplicación):
 *   - `morning`   06:00 (inclusive) .. 14:00 (exclusive)
 *   - `afternoon` 14:00 (inclusive) .. 22:00 (exclusive)
 *   - `night`     22:00 (inclusive) .. 06:00 (exclusive)  -> cruza medianoche
 *   - `all`       elegible en cualquier momento (sin restricción de horario)
 *
 * Todos los límites se evalúan en hora local, igual que la programación
 * generada (`new Date(year, 0, 1, ...)`), de modo que el round-trip a ISO y
 * de vuelta conserva el mismo bloque.
 *
 * Módulo puro: sin dependencias de Node ni de Electron, para poder ser
 * importado tanto por el main como por el renderer.
 */

export type BroadcastBlock = 'morning' | 'afternoon' | 'night' | 'all';

/** Bloques concretos del día, sin el pseudo-bloque `all`. */
export type ConcreteBroadcastBlock = Exclude<BroadcastBlock, 'all'>;

/** Valor asumido cuando un show no define `broadcastBlock` (retrocompatible). */
export const DEFAULT_BROADCAST_BLOCK: BroadcastBlock = 'all';

export interface BroadcastBlockDefinition {
  id: ConcreteBroadcastBlock;
  /** Etiqueta lista para mostrar en la configuración. */
  label: string;
  /** Minutos desde medianoche, inclusive. */
  startMinutes: number;
  /** Minutos desde medianoche, exclusive. Si es menor que start, cruza medianoche. */
  endMinutes: number;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export const MORNING_START_MINUTES = 6 * MINUTES_PER_HOUR;
export const AFTERNOON_START_MINUTES = 14 * MINUTES_PER_HOUR;
export const NIGHT_START_MINUTES = 22 * MINUTES_PER_HOUR;
export const NIGHT_END_MINUTES = 6 * MINUTES_PER_HOUR;

/**
 * Límites de cada bloque del día. `night` envuelve la medianoche
 * (startMinutes > endMinutes), igual que el intervalo `[22:00, 06:00)`.
 */
export const BROADCAST_BLOCKS: readonly BroadcastBlockDefinition[] = [
  { id: 'morning', label: 'Mañana (06:00 - 14:00)', startMinutes: MORNING_START_MINUTES, endMinutes: AFTERNOON_START_MINUTES },
  { id: 'afternoon', label: 'Tarde (14:00 - 22:00)', startMinutes: AFTERNOON_START_MINUTES, endMinutes: NIGHT_START_MINUTES },
  { id: 'night', label: 'Noche (22:00 - 06:00)', startMinutes: NIGHT_START_MINUTES, endMinutes: NIGHT_END_MINUTES }
];

/** Todos los valores válidos del campo, en orden de presentación. */
export const BROADCAST_BLOCK_VALUES: readonly BroadcastBlock[] = ['morning', 'afternoon', 'night', 'all'];

export const BROADCAST_BLOCK_LABELS: Readonly<Record<BroadcastBlock, string>> = {
  morning: 'Mañana (06:00 - 14:00)',
  afternoon: 'Tarde (14:00 - 22:00)',
  night: 'Noche (22:00 - 06:00)',
  all: 'Todo el día (sin restricción)'
};

/**
 * Normaliza cualquier valorproveniente de la configuración (incluidos datos
 * viejos o mal escritos) a un `BroadcastBlock` válido. Ante un valor
 * desconocido devuelve `all`, que es el comportamiento previo a esta
 * funcionalidad.
 */
export function normalizeBroadcastBlock(value: unknown): BroadcastBlock {
  if (typeof value !== 'string') return DEFAULT_BROADCAST_BLOCK;
  const candidate = value.trim().toLowerCase();
  return (BROADCAST_BLOCK_VALUES as readonly string[]).includes(candidate)
    ? (candidate as BroadcastBlock)
    : DEFAULT_BROADCAST_BLOCK;
}

function isWithinBlock(block: BroadcastBlockDefinition, minutes: number): boolean {
  if (block.startMinutes < block.endMinutes) {
    return minutes >= block.startMinutes && minutes < block.endMinutes;
  }
  // Bloque que cruza la medianoche.
  return minutes >= block.startMinutes || minutes < block.endMinutes;
}

export function getBroadcastBlockDefinition(id: ConcreteBroadcastBlock): BroadcastBlockDefinition {
  const found = BROADCAST_BLOCKS.find((block) => block.id === id);
  if (!found) throw new Error(`Bloque de emisión desconocido: ${id}`);
  return found;
}

/** Devuelve el bloque concreto (sin `all`) en el que cae la hora local dada. */
export function getBroadcastBlockAt(date: Date): ConcreteBroadcastBlock {
  const minutes = date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
  for (const block of BROADCAST_BLOCKS) {
    if (isWithinBlock(block, minutes)) return block.id;
  }
  // Los bloques cubren el día completo;Morning es un ancla de seguridad.
  return 'morning';
}

/**
 * Instante exacto en el que termina el bloque que contiene a `date`
 * (es decir, el inicio del bloque siguiente).
 */
export function getBroadcastBlockEnd(date: Date): Date {
  const definition = getBroadcastBlockDefinition(getBroadcastBlockAt(date));
  const minutes = date.getHours() * MINUTES_PER_HOUR + date.getMinutes();

  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  // Si el bloque cruza medianoche y ya pasamos su inicio, el final cae al día
  // siguiente (23:00 -> 06:00 de mañana); si todavía estamos en la parte
  // post-medianoche, el final es el mismo día (02:00 -> 06:00 de hoy).
  const crossesMidnight = definition.endMinutes <= definition.startMinutes;
  const dayOffset = crossesMidnight && minutes >= definition.startMinutes ? MINUTES_PER_DAY : 0;
  end.setMinutes(end.getMinutes() + definition.endMinutes + dayOffset);
  return end;
}

/** Segundos que quedan hasta el fin del bloque actual. */
export function getRemainingBlockSeconds(date: Date): number {
  return Math.max(0, (getBroadcastBlockEnd(date).getTime() - date.getTime()) / 1000);
}

/**
 * Indica si un show puede emitirse a la hora dada según su bloque configurado.
 * `all` (o cualquier valor inválido, ya normalizado) siempre es elegible.
 */
export function isBroadcastBlockAllowed(showBlock: BroadcastBlock, at: Date): boolean {
  const normalized = normalizeBroadcastBlock(showBlock);
  return normalized === 'all' || normalized === getBroadcastBlockAt(at);
}
