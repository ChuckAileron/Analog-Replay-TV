import type { BroadcastBlock } from './broadcastBlock.types';

export interface TVShow {
  id:             number;
  name:           string;
  channel:        string[];
  seasons:        TVSeason[];
  airYears?:      number[];   // Años en los que se transmitió el programa
  airUntilToDate?: boolean;   // Si es true, siempre aparece en la programación independientemente del año
  /**
   * Controla cómo se repite el episodio del show a lo largo del día en la
   * programación generada. Opciones mutuamente excluyentes:
   * - 'daily-repeat' (por defecto): el mismo episodio se transmite en todos
   *   los turnos del show durante el día; recién al día siguiente pasa al
   *   siguiente episodio ("un episodio por día").
   * - 'once-per-day': el show aparece una única vez en el día (un solo
   *   turno); también avanza al siguiente episodio al día siguiente
   *   ("emitir episodio solo una vez al día").
   */
  episodeAiringMode?: 'daily-repeat' | 'once-per-day';
  /**
   * Restringe la emisión del programa a un único bloque horario del día.
   * La definición canónica (límites y etiquetas) está en
   * `broadcastBlock.types.ts`:
   * - 'morning'   06:00 (inclusive) .. 14:00 (exclusive)
   * - 'afternoon' 14:00 (inclusive) .. 22:00 (exclusive)
   * - 'night'     22:00 (inclusive) .. 06:00 (exclusive)
   * - 'all'       sin restricción de horario (valor por defecto)
   *
   * Un programa restringido nunca se emite fuera de su bloque ni más allá del
   * límite de este; si su episodio completo no cabe, se salta y el hueco se
   * rellena con el logo de estación.
   */
  broadcastBlock?: BroadcastBlock;
}

export interface TVSeason {
  season:        number;
  year:          number;
  episodes:      TVEpisode[];
  contentPath?:  string;   // Ruta primaria donde se encuentran los archivos de la temporada
  contentPaths?: string[]; // Rutas adicionales de contenido (discos externos, etc.)
}

export interface TVEpisode {
  episode:            number;
  title:              string;
  description?:       string;
  duration:           string;
  airDate?:           string;
  commercialBreaks?:  string[];
  /** @deprecated Usar `fileNames`. Se mantiene por compatibilidad con datos antiguos. */
  fileName?:          string;
  /**
   * Lista de nombres de archivo candidatos para este episodio, uno por cada
   * carpeta de contenido en la que se haya detectado (pueden variar entre
   * carpetas si provienen de fuentes/calidades distintas). Al reproducir, se
   * prueba cada nombre en cada carpeta configurada hasta encontrar uno que
   * exista realmente en disco.
   */
  fileNames?:         string[];
}

export interface ShowConfig {
  shows:        TVShow[];
  lastUpdated:  string;
}