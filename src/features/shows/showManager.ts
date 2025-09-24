import type { TVShow, ShowConfig } from '../../types/show.types';

// Estado interno
let shows: TVShow[] = [];
let isInitialized: boolean = false;
let initializationPromise: Promise<void> | null = null;

export const showManager = {
  // Inicializar los shows
  initialize: async (): Promise<void> => {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        if (!isInitialized) {
          console.log('Initializing shows...');
          const config = await window.electronAPI.loadProgramsConfig();
          // Convertir programs a shows añadiendo IDs si no los tienen
          shows = (config.programs || []).map((program: any, index: number) => ({
            ...program,
            id: program.id || index + 1
          })) as TVShow[];
          isInitialized = true;
          console.log('Shows initialized:', shows);
        }
      } catch (error) {
        console.error('Error in show initialization:', error);
        shows = [];
        throw error;
      }
    })();

    return initializationPromise;
  },

  // Obtener todos los shows
  getShows: async (): Promise<TVShow[]> => {
    try {
      if (!isInitialized) {
        await showManager.initialize();
      }
      console.log('Returning shows:', shows);
      return shows || [];
    } catch (error) {
      console.error('Error getting shows:', error);
      return [];
    }
  },

  // Backward compatibility - mantener el método getPrograms para no romper código existente
  getPrograms: async (): Promise<TVShow[]> => {
    return await showManager.getShows();
  },

  // Obtener un show por nombre
  getShowByName: (name: string): TVShow | null => {
    return shows.find(show => show.name === name) || null;
  },

  // Obtener un show por ID
  getShow: async (id: number): Promise<TVShow | null> => {
    try {
      if (!isInitialized) {
        await showManager.initialize();
      }
      return shows.find(show => show.id === id) || null;
    } catch (error) {
      console.error('Error getting show by ID:', error);
      return null;
    }
  },

  // Agregar un nuevo show
  addShow: async (show: Omit<TVShow, 'id'>): Promise<void> => {
    try {
      const newShow = {
        ...show,
        id: Math.max(0, ...shows.map(s => s.id)) + 1
      };
      shows.push(newShow);
      await saveToFile();
    } catch (error) {
      console.error('Error adding show:', error);
      // Revertir cambios en memoria si hay error
      shows.pop();
      throw error;
    }
  },

  // Actualizar un show existente
  updateShow: async (id: number, updates: Partial<TVShow>): Promise<TVShow | null> => {
    const index = shows.findIndex(show => show.id === id);
    if (index === -1) return null;

    const oldShow = { ...shows[index] };
    shows[index] = { ...oldShow, ...updates, id: oldShow.id };

    try {
      await saveToFile();
    } catch (error) {
      console.error('Error updating show:', error);
      // Revertir cambios en memoria si hay error
      shows[index] = oldShow;
      throw error;
    }

    return shows[index];
  },

  // Eliminar un show
  deleteShow: async (id: number): Promise<boolean> => {
    const initialLength = shows.length;
    const oldShows = [...shows];

    shows = shows.filter(show => show.id !== id);

    try {
      await saveToFile();
    } catch (error) {
      console.error('Error deleting show:', error);
      // Revertir cambios en memoria si hay error
      shows = oldShows;
      throw error;
    }

    return shows.length !== initialLength;
  },

  // Importar un archivo de show
  importShowFile: async (filePath: string): Promise<void> => {
    try {
      const show = await window.electronAPI.importProgramFile(filePath);
      if (show) {
        await showManager.addShow(show);
      }
    } catch (error) {
      console.error('Error importing show file:', error);
      throw error;
    }
  }
};

// Función auxiliar para guardar en el archivo
async function saveToFile(): Promise<void> {
  const config: ShowConfig = {
    shows,
    lastUpdated: new Date().toISOString()
  };

  // Guardar usando el formato actual para mantener compatibilidad
  await window.electronAPI.saveProgramsConfig({
    programs: shows,
    lastUpdated: config.lastUpdated
  });
}