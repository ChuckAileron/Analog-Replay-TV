export interface TVShow {
  id:       number;
  name:     string;
  channel:  string[];
  seasons:  TVSeason[];
}

export interface TVSeason {
  season:   number;
  year:     number;
  episodes: TVEpisode[];
  contentPath?: string; // Ruta donde se encuentran los archivos de la temporada
}

export interface TVEpisode {
  episode:            number;
  title:              string;
  description?:       string;
  duration:           string;
  airDate?:           string;
  commercialBreaks?:  string[];
  fileName?:          string;  // Nombre del archivo de video
}

export interface ShowConfig {
  shows:        TVShow[];
  lastUpdated:  string;
}