// Verificar compatibilidad con WebCodecs API
export const checkWebCodecsSupport = (): {
  supported: boolean;
  features: {
    videoDecoder: boolean;
    audioDecoder: boolean;
    videoEncoder: boolean;
    audioEncoder: boolean;
  };
} => {
  const features = {
    videoDecoder: 'VideoDecoder' in window,
    audioDecoder: 'AudioDecoder' in window,
    videoEncoder: 'VideoEncoder' in window,
    audioEncoder: 'AudioEncoder' in window,
  };

  return {
    supported: features.videoDecoder && features.audioDecoder,
    features
  };
};

// Verificar códecs soportados
export const getSupportedCodecs = async (): Promise<{
  video: string[];
  audio: string[];
}> => {
  const videoCodecs = [
    'avc1.42E01E', // H.264 Baseline
    'avc1.4D401E', // H.264 Main
    'avc1.640028', // H.264 High
    'hev1.1.6.L93.B0', // H.265/HEVC
    'vp09.00.10.08', // VP9
    'av01.0.04M.08' // AV1
  ];

  const audioCodecs = [
    'mp4a.40.2', // AAC-LC
    'mp4a.40.5', // AAC-HE
    'opus', // Opus
    'mp3' // MP3
  ];

  const supportedVideo = [];
  const supportedAudio = [];

  // Verificar video
  for (const codec of videoCodecs) {
    try {
      const config = { codec };
      const support = await VideoDecoder.isConfigSupported(config);
      if (support.supported) {
        supportedVideo.push(codec);
      }
    } catch {
      // Codec no soportado
    }
  }

  // Verificar audio
  for (const codec of audioCodecs) {
    try {
      const config = { codec, sampleRate: 48000, numberOfChannels: 2 };
      const support = await AudioDecoder.isConfigSupported(config);
      if (support.supported) {
        supportedAudio.push(codec);
      }
    } catch {
      // Codec no soportado
    }
  }

  return {
    video: supportedVideo,
    audio: supportedAudio
  };
};