/**
 * Utilidades para trabajar con los nombres de archivo de un episodio,
 * soportando tanto el campo legacy `fileName` (string único) como el nuevo
 * `fileNames` (arreglo de candidatos, uno por carpeta de contenido detectada).
 */

interface EpisodeFileNameFields {
  fileName?: string;
  fileNames?: string[];
}

/**
 * Retorna la lista de nombres de archivo conocidos para un episodio,
 * priorizando `fileNames` si existe y cayendo de vuelta a `fileName` (legacy)
 * si no. Nunca retorna duplicados.
 */
export function getEpisodeFileNames(episode: EpisodeFileNameFields): string[] {
  const names: string[] = [];

  if (episode.fileNames && episode.fileNames.length > 0) {
    names.push(...episode.fileNames);
  }

  if (episode.fileName && !names.includes(episode.fileName)) {
    names.push(episode.fileName);
  }

  return names;
}
