import type { Program } from '../../types/tv.types';

export const guideManager = {
  // Obtener la programación actual para un canal específico
  getCurrentProgram: (_channelNumber: number): Program | null => {
    // TODO: Implementar la lógica para obtener el programa actual
    return null;
  },

  // Obtener la lista de programas para un canal específico
  getChannelPrograms: (_channelNumber: number): Program[] => {
    // TODO: Implementar la lógica para obtener la lista de programas
    return [];
  },

  // Verificar si un canal tiene guía de programación disponible
  hasGuideAvailable: (_channelNumber: number): boolean => {
    // TODO: Implementar la lógica para verificar disponibilidad de guía
    return false;
  }
};
