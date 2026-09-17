/**
 * Utilidades para detectar y agrupar "bloques" de episodios multi-parte.
 *
 * Muchas series clásicas (ej. Bob Esponja) publican cada episodio real como
 * 2 o 3 segmentos cortos con nombres tipo "01a", "01b", "01c" — donde el
 * número identifica el episodio real y la letra identifica el segmento
 * dentro de ese episodio. El sistema de shows almacena cada segmento como
 * una entrada de episodio independiente (con su propio número secuencial de
 * archivo), así que estas utilidades permiten reconstruir la agrupación real
 * a partir del patrón en el título (ej. "01a: Se Busca Ayuda").
 */

export interface EpisodeBlockInfo {
  /** Número de episodio "real" (el que antecede a la letra en el título) */
  group: number;
  /** Letra de segmento ('a', 'b', 'c'...) o null si es un episodio independiente */
  part: string | null;
}

/**
 * Analiza el título de un episodio buscando el patrón "<número><letra?>"
 * al inicio (ej. "01a: Se Busca Ayuda", "01b - La Aspiradora", "51 La Fiesta...").
 * Retorna null si el título no comienza con un número reconocible.
 */
export function parseEpisodeBlockInfo(title: string | undefined | null): EpisodeBlockInfo | null {
  if (!title) return null;
  const match = title.trim().match(/^(\d+)\s*([a-zA-Z])?(?=[\s:.\-]|$)/);
  if (!match) return null;
  return {
    group: parseInt(match[1], 10),
    part: match[2] ? match[2].toLowerCase() : null
  };
}

/**
 * Elimina el código de bloque inicial del título (ej. "01a: Se Busca Ayuda"
 * -> "Se Busca Ayuda"), dejando solo el nombre descriptivo del episodio/segmento.
 */
export function stripEpisodeBlockCode(title: string): string {
  return title.replace(/^\d+[a-zA-Z]?[\s:.\-]*\s*/, '').trim() || title;
}

export interface EpisodeBlock<T> {
  groupNumber: number;
  parts: T[];
}

/**
 * Agrupa una lista ordenada de episodios en "bloques" según el patrón
 * detectado en sus títulos: episodios consecutivos que comparten el mismo
 * número de grupo Y tienen letra de segmento (a/b/c...) se combinan en un
 * solo bloque; los episodios sin letra (independientes/especiales) forman
 * su propio bloque de una sola parte.
 *
 * Requiere que los episodios estén en su orden original (tal como se
 * almacenan), ya que solo agrupa entradas CONSECUTIVAS.
 */
export function groupEpisodesIntoBlocks<T extends { episode: number; title: string }>(
  episodes: T[]
): EpisodeBlock<T>[] {
  const blocks: EpisodeBlock<T>[] = [];
  let currentBlock: EpisodeBlock<T> | null = null;

  for (const ep of episodes) {
    const info = parseEpisodeBlockInfo(ep.title);
    const groupNumber = info ? info.group : ep.episode;
    const hasPart = info?.part != null;

    if (currentBlock && hasPart && currentBlock.groupNumber === groupNumber) {
      currentBlock.parts.push(ep);
    } else {
      currentBlock = { groupNumber, parts: [ep] };
      blocks.push(currentBlock);
    }
  }

  return blocks;
}

/**
 * Convierte una duración en formato "mm:ss" o "hh:mm:ss" a segundos.
 * Retorna 0 si el formato es inválido.
 */
export function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const parts = duration.split(':').map(p => parseInt(p, 10));
  if (parts.some(p => isNaN(p))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
