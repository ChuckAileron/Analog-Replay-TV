import type { TVProgram, ProgramConfig } from '../../types/program.types';

// Estado interno
let programs: TVProgram[] = [];
let isInitialized: boolean = false;
let initializationPromise: Promise<void> | null = null;

export const programManager = {
  // Inicializar los programas
  initialize: async (): Promise<void> => {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        if (!isInitialized) {
          console.log('Initializing programs...');
          const config = await window.electronAPI.loadProgramsConfig();
          programs = config.programs;
          isInitialized = true;
          console.log('Programs initialized:', programs);
        }
      } catch (error) {
        console.error('Error in program initialization:', error);
        programs = [];
        throw error;
      }
    })();

    return initializationPromise;
  },

  // Obtener todos los programas
  getPrograms: async (): Promise<TVProgram[]> => {
    try {
      if (!isInitialized) {
        await programManager.initialize();
      }
      console.log('Returning programs:', programs);
      return programs || [];
    } catch (error) {
      console.error('Error getting programs:', error);
      return [];
    }
  },

  // Obtener un programa por nombre
  getProgramByName: (name: string): TVProgram | null => {
    return programs.find(prog => prog.name === name) || null;
  },

  // Obtener un programa por ID
  getProgram: async (id: number): Promise<TVProgram | null> => {
    try {
      if (!isInitialized) {
        await programManager.initialize();
      }
      return programs.find(prog => prog.id === id) || null;
    } catch (error) {
      console.error('Error getting program by ID:', error);
      return null;
    }
  },

  // Agregar un nuevo programa
  addProgram: async (program: Omit<TVProgram, 'id'>): Promise<void> => {
    try {
      const newProgram = {
        ...program,
        id: Math.max(0, ...programs.map(p => p.id)) + 1
      };
      programs.push(newProgram);
      await saveToFile();
    } catch (error) {
      console.error('Error adding program:', error);
      // Revertir cambios en memoria si hay error
      programs.pop();
      throw error;
    }
  },

  // Actualizar un programa existente
  updateProgram: async (id: number, updates: Partial<TVProgram>): Promise<TVProgram | null> => {
    const index = programs.findIndex(prog => prog.id === id);
    if (index === -1) return null;

    const oldProgram = { ...programs[index] };
    programs[index] = { ...oldProgram, ...updates, id: oldProgram.id };

    try {
      await saveToFile();
    } catch (error) {
      console.error('Error updating program:', error);
      // Revertir cambios en memoria si hay error
      programs[index] = oldProgram;
      throw error;
    }

    return programs[index];
  },

  // Eliminar un programa
  deleteProgram: async (id: number): Promise<boolean> => {
    const initialLength = programs.length;
    const oldPrograms = [...programs];

    programs = programs.filter(prog => prog.id !== id);

    try {
      await saveToFile();
    } catch (error) {
      console.error('Error deleting program:', error);
      // Revertir cambios en memoria si hay error
      programs = oldPrograms;
      throw error;
    }

    return programs.length !== initialLength;
  },

  // Importar un archivo de programa
  importProgramFile: async (filePath: string): Promise<void> => {
    try {
      const program = await window.electronAPI.importProgramFile(filePath);
      if (program) {
        await programManager.addProgram(program);
      }
    } catch (error) {
      console.error('Error importing program file:', error);
      throw error;
    }
  }
};

// Función auxiliar para guardar en el archivo
async function saveToFile(): Promise<void> {
  const config: ProgramConfig = {
    programs,
    lastUpdated: new Date().toISOString()
  };

  await window.electronAPI.saveProgramsConfig(config);
}