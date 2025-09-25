import type { ShowConfig, TVShow } from '../../types/show.types';

/**
 * Shows por defecto del sistema
 * Estos shows se usan cuando no existe un archivo de configuración personalizado
 */
export const defaultShows: TVShow[] = [
  {
    id: 1,
    name: "Show Demo 90s",
    channel: ["Disney Channel"],
    seasons: [
      {
        season: 1,
        year: 1995,
        episodes: [
          {
            episode: 1,
            title: "Episodio Piloto",
            description: "El primer episodio del show demo",
            duration: "22:00",
            airDate: "1995-01-01",
            fileName: "demo-show-s01e01-pilot.mp4"
          },
          {
            episode: 2,
            title: "Segunda Aventura",
            description: "Los personajes viven una nueva aventura",
            duration: "22:30",
            airDate: "1995-01-08",
            fileName: "demo-show-s01e02-adventure.mp4"
          },
          {
            episode: 3,
            title: "El Misterio",
            description: "Un misterio que resolver",
            duration: "23:00",
            airDate: "1995-01-15",
            fileName: "demo-show-s01e03-mystery.mp4"
          }
        ],
        contentPath: "shows/demo-90s/season-1"
      }
    ]
  },
  {
    id: 2,
    name: "Cartoon Clásico",
    channel: ["Cartoon Network", "Nickelodeon"],
    seasons: [
      {
        season: 1,
        year: 1992,
        episodes: [
          {
            episode: 1,
            title: "El Comienzo",
            description: "Todo empieza aquí",
            duration: "11:00",
            airDate: "1992-09-01",
            fileName: "cartoon-clasico-s01e01-beginning.mp4"
          },
          {
            episode: 2,
            title: "Diversión y Caos",
            description: "Los personajes causan problemas divertidos",
            duration: "11:30",
            airDate: "1992-09-08",
            fileName: "cartoon-clasico-s01e02-chaos.mp4"
          },
          {
            episode: 3,
            title: "La Gran Travesura",
            description: "Una travesura épica",
            duration: "12:00",
            airDate: "1992-09-15",
            fileName: "cartoon-clasico-s01e03-prank.mp4"
          },
          {
            episode: 4,
            title: "Amigos Para Siempre",
            description: "Una lección sobre la amistad",
            duration: "11:45",
            airDate: "1992-09-22",
            fileName: "cartoon-clasico-s01e04-friendship.mp4"
          }
        ],
        contentPath: "shows/cartoon-clasico/season-1"
      },
      {
        season: 2,
        year: 1993,
        episodes: [
          {
            episode: 1,
            title: "Nuevas Aventuras",
            description: "Segunda temporada con más aventuras",
            duration: "11:15",
            airDate: "1993-09-01",
            fileName: "cartoon-clasico-s02e01-new-adventures.mp4"
          },
          {
            episode: 2,
            title: "El Villano Aparece",
            description: "Un nuevo antagonista entra en escena",
            duration: "11:30",
            airDate: "1993-09-08",
            fileName: "cartoon-clasico-s02e02-villain.mp4"
          },
          {
            episode: 3,
            title: "La Batalla Final",
            description: "Enfrentamiento épico",
            duration: "12:30",
            airDate: "1993-09-15",
            fileName: "cartoon-clasico-s02e03-final-battle.mp4"
          }
        ],
        contentPath: "shows/cartoon-clasico/season-2"
      }
    ]
  },
  {
    id: 3,
    name: "Aventuras Espaciales",
    channel: ["Disney Channel", "Cartoon Network"],
    seasons: [
      {
        season: 1,
        year: 1998,
        episodes: [
          {
            episode: 1,
            title: "Despegue",
            description: "La aventura espacial comienza",
            duration: "24:00",
            airDate: "1998-03-15",
            fileName: "aventuras-espaciales-s01e01-liftoff.mp4"
          },
          {
            episode: 2,
            title: "Primera Misión",
            description: "La primera misión en el espacio",
            duration: "24:30",
            airDate: "1998-03-22",
            fileName: "aventuras-espaciales-s01e02-first-mission.mp4"
          },
          {
            episode: 3,
            title: "Planeta Misterioso",
            description: "Descubrimiento de un planeta desconocido",
            duration: "25:00",
            airDate: "1998-03-29",
            fileName: "aventuras-espaciales-s01e03-mystery-planet.mp4"
          },
          {
            episode: 4,
            title: "Aliens Amigables",
            description: "Encuentro con vida extraterrestre",
            duration: "24:15",
            airDate: "1998-04-05",
            fileName: "aventuras-espaciales-s01e04-friendly-aliens.mp4"
          },
          {
            episode: 5,
            title: "Regreso a Casa",
            description: "El viaje de vuelta a la Tierra",
            duration: "25:30",
            airDate: "1998-04-12",
            fileName: "aventuras-espaciales-s01e05-return-home.mp4"
          }
        ],
        contentPath: "shows/aventuras-espaciales/season-1"
      }
    ]
  },
  {
    id: 4,
    name: "Colegiales 90s",
    channel: ["Disney Channel", "Nickelodeon"],
    seasons: [
      {
        season: 1,
        year: 1996,
        episodes: [
          {
            episode: 1,
            title: "Primer Día de Clases",
            description: "Nervios del primer día en una nueva escuela",
            duration: "22:00",
            airDate: "1996-09-02",
            fileName: "colegiales-90s-s01e01-first-day.mp4"
          },
          {
            episode: 2,
            title: "El Examen Sorpresa",
            description: "Un examen inesperado causa pánico",
            duration: "22:30",
            airDate: "1996-09-09",
            fileName: "colegiales-90s-s01e02-surprise-test.mp4"
          },
          {
            episode: 3,
            title: "La Obra Escolar",
            description: "Preparativos para la obra de teatro",
            duration: "23:15",
            airDate: "1996-09-16",
            fileName: "colegiales-90s-s01e03-school-play.mp4"
          },
          {
            episode: 4,
            title: "El Baile de Graduación",
            description: "Preparativos para el gran baile",
            duration: "23:00",
            airDate: "1996-09-23",
            fileName: "colegiales-90s-s01e04-prom-dance.mp4"
          },
          {
            episode: 5,
            title: "Vacaciones de Verano",
            description: "Planes para las vacaciones",
            duration: "22:45",
            airDate: "1996-09-30",
            fileName: "colegiales-90s-s01e05-summer-vacation.mp4"
          }
        ],
        contentPath: "shows/colegiales-90s/season-1"
      }
    ]
  },
  {
    id: 5,
    name: "Detectives Jóvenes",
    channel: ["Disney Channel"],
    seasons: [
      {
        season: 1,
        year: 1994,
        episodes: [
          {
            episode: 1,
            title: "El Misterio del Parque",
            description: "Un caso misterioso en el parque local",
            duration: "21:30",
            airDate: "1994-10-01",
            fileName: "detectives-jovenes-s01e01-park-mystery.mp4"
          },
          {
            episode: 2,
            title: "La Mascota Perdida",
            description: "Búsqueda de una mascota desaparecida",
            duration: "22:00",
            airDate: "1994-10-08",
            fileName: "detectives-jovenes-s01e02-lost-pet.mp4"
          },
          {
            episode: 3,
            title: "El Tesoro Escondido",
            description: "Siguiendo las pistas de un tesoro",
            duration: "23:30",
            airDate: "1994-10-15",
            fileName: "detectives-jovenes-s01e03-hidden-treasure.mp4"
          },
          {
            episode: 4,
            title: "El Fantasma de la Biblioteca",
            description: "Investigando sucesos extraños",
            duration: "22:15",
            airDate: "1994-10-22",
            fileName: "detectives-jovenes-s01e04-library-ghost.mp4"
          }
        ],
        contentPath: "shows/detectives-jovenes/season-1"
      }
    ]
  },
  {
    id: 6,
    name: "Robots y Gadgets",
    channel: ["Cartoon Network"],
    seasons: [
      {
        season: 1,
        year: 1997,
        episodes: [
          {
            episode: 1,
            title: "El Robot Defectuoso",
            description: "Un robot no funciona como debería",
            duration: "11:00",
            airDate: "1997-05-10",
            fileName: "robots-gadgets-s01e01-defective-robot.mp4"
          },
          {
            episode: 2,
            title: "Invasión de Gadgets",
            description: "Los gadgets cobran vida propia",
            duration: "11:30",
            airDate: "1997-05-17",
            fileName: "robots-gadgets-s01e02-gadget-invasion.mp4"
          },
          {
            episode: 3,
            title: "El Laboratorio Loco",
            description: "Experimentos fuera de control",
            duration: "12:00",
            airDate: "1997-05-24",
            fileName: "robots-gadgets-s01e03-crazy-lab.mp4"
          },
          {
            episode: 4,
            title: "Robots Buenos vs Malos",
            description: "Una batalla entre robots",
            duration: "11:45",
            airDate: "1997-05-31",
            fileName: "robots-gadgets-s01e04-good-vs-bad-robots.mp4"
          },
          {
            episode: 5,
            title: "El Futuro es Ahora",
            description: "Viaje al futuro tecnológico",
            duration: "12:15",
            airDate: "1997-06-07",
            fileName: "robots-gadgets-s01e05-future-now.mp4"
          },
          {
            episode: 6,
            title: "Amistad Artificial",
            description: "La amistad entre humanos y robots",
            duration: "11:50",
            airDate: "1997-06-14",
            fileName: "robots-gadgets-s01e06-artificial-friendship.mp4"
          }
        ],
        contentPath: "shows/robots-gadgets/season-1"
      }
    ]
  }
];

/**
 * Configuración por defecto de shows
 * Esta configuración se usa cuando no existe un archivo de configuración personalizado
 */
export const defaultShowConfig: ShowConfig = {
  shows: defaultShows,
  lastUpdated: new Date().toISOString()
};

/**
 * Obtiene shows filtrados por canal
 * @param channel Canal del que se quieren obtener shows
 * @returns Array de shows que incluyen el canal especificado
 */
export function getShowsByChannel(channel: string): TVShow[] {
  return defaultShows.filter(show => show.channel.includes(channel));
}

/**
 * Obtiene shows filtrados por año
 * @param year Año de referencia
 * @param tolerance Tolerancia en años (por defecto 3)
 * @returns Array de shows que tienen temporadas en el rango de años
 */
export function getShowsByYear(year: number, tolerance: number = 3): TVShow[] {
  return defaultShows.filter(show =>
    show.seasons.some(season =>
      Math.abs(season.year - year) <= tolerance
    )
  );
}

/**
 * Obtiene shows por canal y año
 * @param channel Canal específico
 * @param year Año de referencia
 * @param tolerance Tolerancia en años (por defecto 3)
 * @returns Array de shows que coinciden con ambos criterios
 */
export function getShowsByChannelAndYear(
  channel: string,
  year: number,
  tolerance: number = 3
): TVShow[] {
  return defaultShows.filter(show =>
    show.channel.includes(channel) &&
    show.seasons.some(season =>
      Math.abs(season.year - year) <= tolerance
    )
  );
}

/**
 * Obtiene un show aleatorio por canal
 * @param channel Canal específico
 * @returns Show aleatorio del canal o null si no hay shows
 */
export function getRandomShowByChannel(channel: string): TVShow | null {
  const channelShows = getShowsByChannel(channel);
  if (channelShows.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * channelShows.length);
  return channelShows[randomIndex];
}

/**
 * Obtiene estadísticas de los shows por defecto
 * @returns Objeto con estadísticas generales
 */
export function getDefaultShowsStats() {
  const totalShows = defaultShows.length;
  const totalSeasons = defaultShows.reduce((sum, show) => sum + show.seasons.length, 0);
  const totalEpisodes = defaultShows.reduce((sum, show) =>
    sum + show.seasons.reduce((seasonSum, season) => seasonSum + season.episodes.length, 0), 0
  );

  const allChannels = new Set(defaultShows.flatMap(show => show.channel));
  const channelsCount = allChannels.size;

  const allYears = defaultShows.flatMap(show => show.seasons.map(season => season.year));
  const yearsRange = allYears.length > 0
    ? { min: Math.min(...allYears), max: Math.max(...allYears) }
    : { min: 0, max: 0 };

  const averageEpisodesPerShow = Math.round(totalEpisodes / totalShows);
  const averageSeasonsPerShow = Math.round(totalSeasons / totalShows);

  return {
    totalShows,
    totalSeasons,
    totalEpisodes,
    channelsCount,
    channels: Array.from(allChannels),
    yearsRange,
    averageEpisodesPerShow,
    averageSeasonsPerShow
  };
}