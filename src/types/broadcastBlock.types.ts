/**
 * Re-exporta la definición canónica de bloques de emisión que vive en el
 * proceso principal (`electron/services/broadcastBlocks.ts`).
 *
 * NO duplicar aquí los valores ni los límites: este archivo existe para que el
 * renderer y la aplicación externa de configuración consuman exactamente la
 * misma definición que usa el generador de programación.
 */
export * from '../../electron/services/broadcastBlocks';
