import { useState, useEffect, useCallback } from 'react';
import type { ConversionJob, ChannelConversionStatus } from '../../electron/services/VideoConversionQueue';

export interface ConversionState {
  isActive: boolean;
  channelStatuses: ChannelConversionStatus[];
  overallProgress: number;
  currentConvertingJob: ConversionJob | null;
  readyChannels: Set<string>;
  totalJobs: number;
  completedJobs: number;
}

export interface UseVideoConversionsReturn {
  conversionState: ConversionState;
  isChannelReady: (channelId: string) => boolean;
  waitForChannelReady: (channelId: string) => Promise<void>;
  startConversions: (channelSchedules: any) => Promise<void>;
  queueNextEpisode: (currentShow: any, nextShow: any, channelId: string) => Promise<void>;
  stopConversions: () => void;
}

/**
 * Hook for managing video conversions state and interactions
 */
export const useVideoConversions = (): UseVideoConversionsReturn => {
  const [conversionState, setConversionState] = useState<ConversionState>({
    isActive: false,
    channelStatuses: [],
    overallProgress: 0,
    currentConvertingJob: null,
    readyChannels: new Set(),
    totalJobs: 0,
    completedJobs: 0
  });

  const [channelReadyPromises, setChannelReadyPromises] = useState<Map<string, {
    resolve: () => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // Setup IPC event listeners
  useEffect(() => {
    const setupEventListeners = async () => {
      // Listen for conversion queue events
      window.electronAPI?.onConversionQueueUpdate?.((data: {
        channelStatuses: ChannelConversionStatus[];
        overallProgress: number;
        currentJob?: ConversionJob;
        isActive: boolean;
      }) => {
        const readyChannels = new Set(
          data.channelStatuses
            .filter(status => status.isReady)
            .map(status => status.channelId)
        );

        const totalJobs = data.channelStatuses.reduce((sum, status) => sum + status.totalJobs, 0);
        const completedJobs = data.channelStatuses.reduce((sum, status) => sum + status.completedJobs, 0);

        setConversionState({
          isActive: data.isActive,
          channelStatuses: data.channelStatuses,
          overallProgress: data.overallProgress,
          currentConvertingJob: data.currentJob || null,
          readyChannels,
          totalJobs,
          completedJobs
        });
      });

      // Listen for individual channel ready events
      window.electronAPI?.onChannelConversionReady?.((channelId: string) => {
        setConversionState(prev => ({
          ...prev,
          readyChannels: new Set([...prev.readyChannels, channelId])
        }));

        // Resolve any waiting promises for this channel
        const promise = channelReadyPromises.get(channelId);
        if (promise) {
          promise.resolve();
          setChannelReadyPromises(prev => {
            const newMap = new Map(prev);
            newMap.delete(channelId);
            return newMap;
          });
        }
      });

      // Listen for conversion completion
      window.electronAPI?.onAllConversionsCompleted?.(() => {
        setConversionState(prev => ({
          ...prev,
          isActive: false,
          overallProgress: 100
        }));

        console.log('✅ [useVideoConversions] All conversions completed');
      });

      // Listen for conversion errors
      window.electronAPI?.onConversionError?.((error: {
        channelId: string;
        jobId: string;
        error: string;
      }) => {
        console.error(`🚨 [useVideoConversions] Conversion error for channel ${error.channelId}:`, error.error);
        
        // Reject waiting promises for this channel
        const promise = channelReadyPromises.get(error.channelId);
        if (promise) {
          promise.reject(new Error(`Conversion failed: ${error.error}`));
          setChannelReadyPromises(prev => {
            const newMap = new Map(prev);
            newMap.delete(error.channelId);
            return newMap;
          });
        }
      });
    };

    setupEventListeners();
  }, [channelReadyPromises]);

  const isChannelReady = useCallback((channelId: string): boolean => {
    return conversionState.readyChannels.has(channelId);
  }, [conversionState.readyChannels]);

  const waitForChannelReady = useCallback((channelId: string): Promise<void> => {
    // If channel is already ready, resolve immediately
    if (isChannelReady(channelId)) {
      return Promise.resolve();
    }

    // If there's already a promise for this channel, return it
    const existingPromise = channelReadyPromises.get(channelId);
    if (existingPromise) {
      return new Promise((resolve, reject) => {
        const originalResolve = existingPromise.resolve;
        const originalReject = existingPromise.reject;
        
        existingPromise.resolve = () => {
          originalResolve();
          resolve();
        };
        
        existingPromise.reject = (error: Error) => {
          originalReject(error);
          reject(error);
        };
      });
    }

    // Create new promise for this channel
    return new Promise<void>((resolve, reject) => {
      setChannelReadyPromises(prev => new Map(prev).set(channelId, {
        resolve,
        reject
      }));

      // Set timeout to avoid waiting forever
      setTimeout(() => {
        const promise = channelReadyPromises.get(channelId);
        if (promise) {
          promise.reject(new Error(`Timeout waiting for channel ${channelId} to be ready`));
          setChannelReadyPromises(prev => {
            const newMap = new Map(prev);
            newMap.delete(channelId);
            return newMap;
          });
        }
      }, 300000); // 5 minutes timeout
    });
  }, [isChannelReady, channelReadyPromises]);

  const startConversions = useCallback(async (channelSchedules: any): Promise<void> => {
    try {
      console.log('🚀 [useVideoConversions] Starting video conversions...');
      
      // Send IPC message to start conversions
      await window.electronAPI?.startVideoConversions?.(channelSchedules);
      
      setConversionState(prev => ({
        ...prev,
        isActive: true,
        overallProgress: 0
      }));
      
    } catch (error) {
      console.error('🚨 [useVideoConversions] Error starting conversions:', error);
      throw error;
    }
  }, []);

  const queueNextEpisode = useCallback(async (
    currentShow: any, 
    nextShow: any, 
    channelId: string
  ): Promise<void> => {
    try {
      console.log(`🎬 [useVideoConversions] Queuing next episode for channel ${channelId}`);
      
      await window.electronAPI?.queueNextEpisodeConversion?.({
        currentShow,
        nextShow,
        channelId
      });
      
    } catch (error) {
      console.error('🚨 [useVideoConversions] Error queuing next episode:', error);
      throw error;
    }
  }, []);

  const stopConversions = useCallback(() => {
    console.log('🛑 [useVideoConversions] Stopping conversions...');
    
    window.electronAPI?.stopVideoConversions?.();
    
    setConversionState(prev => ({
      ...prev,
      isActive: false
    }));

    // Reject all waiting promises
    channelReadyPromises.forEach((promise) => {
      promise.reject(new Error('Conversions stopped'));
    });
    setChannelReadyPromises(new Map());
  }, [channelReadyPromises]);

  return {
    conversionState,
    isChannelReady,
    waitForChannelReady,
    startConversions,
    queueNextEpisode,
    stopConversions
  };
};

/**
 * Hook specifically for channel-based conversion waiting
 */
export const useChannelConversion = (channelId: string) => {
  const { conversionState, isChannelReady, waitForChannelReady } = useVideoConversions();
  
  const channelStatus = conversionState.channelStatuses.find(
    status => status.channelId === channelId
  );
  
  const isReady = isChannelReady(channelId);
  
  const waitForReady = useCallback(() => {
    return waitForChannelReady(channelId);
  }, [channelId, waitForChannelReady]);
  
  return {
    isReady,
    channelStatus,
    waitForReady,
    isConverting: channelStatus ? !channelStatus.isReady : false,
    progress: channelStatus?.currentJob?.progress || 0,
    currentJob: channelStatus?.currentJob
  };
};

export default useVideoConversions;