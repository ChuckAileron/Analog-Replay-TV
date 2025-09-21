import { useState, useEffect, useCallback } from 'react';
import type { Channel } from '../../types/tv.types';
import { channelManager } from './channelManager';

interface UseChannelConfig {
  channels: Channel[];
  addChannel: (channel: Omit<Channel, 'id'>) => void;
  updateChannel: (id: number, updates: Partial<Channel>) => void;
  deleteChannel: (id: number) => void;
  isLoading: boolean;
  error: string | null;
}

export function useChannelConfig(): UseChannelConfig {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar canales al iniciar
  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const channels = await channelManager.getChannels();
      setChannels(channels);
    } catch (err) {
      setError('Error al cargar los canales');
      console.error('Error loading channels:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addChannel = useCallback(async (channel: Omit<Channel, 'id'>) => {
    try {
      await channelManager.addChannel(channel);
      await loadChannels();
      setError(null);
    } catch (err) {
      setError('Error al agregar el canal');
      console.error('Error adding channel:', err);
    }
  }, []);

  const updateChannel = useCallback(async (id: number, updates: Partial<Channel>) => {
    try {
      await channelManager.updateChannel(id, updates);
      await loadChannels();
      setError(null);
    } catch (err) {
      setError('Error al actualizar el canal');
      console.error('Error updating channel:', err);
    }
  }, []);

  const deleteChannel = useCallback(async (id: number) => {
    try {
      await channelManager.deleteChannel(id);
      await loadChannels();
      setError(null);
    } catch (err) {
      setError('Error al eliminar el canal');
      console.error('Error deleting channel:', err);
    }
  }, []);

  return {
    channels,
    addChannel,
    updateChannel,
    deleteChannel,
    isLoading,
    error
  };
}
