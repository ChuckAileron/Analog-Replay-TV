// WebCodecs API Types
// Basado en: https://www.w3.org/TR/webcodecs/

interface VideoDecoder {
  readonly state: 'unconfigured' | 'configured' | 'closed';
  readonly decodeQueueSize: number;
  
  configure(config: VideoDecoderConfig): Promise<void>;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  
  static isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
}

interface VideoDecoderConfig {
  codec: string;
  description?: BufferSource;
  codedWidth?: number;
  codedHeight?: number;
  displayAspectWidth?: number;
  displayAspectHeight?: number;
  colorSpace?: VideoColorSpaceInit;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
}

interface VideoDecoderSupport {
  supported: boolean;
  config?: VideoDecoderConfig;
}

interface VideoDecoderInit {
  output: VideoFrameOutputCallback;
  error: WebCodecsErrorCallback;
}

interface AudioDecoder {
  readonly state: 'unconfigured' | 'configured' | 'closed';
  readonly decodeQueueSize: number;
  
  configure(config: AudioDecoderConfig): Promise<void>;
  decode(chunk: EncodedAudioChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  
  static isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
}

interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: BufferSource;
}

interface AudioDecoderSupport {
  supported: boolean;
  config?: AudioDecoderConfig;
}

interface AudioDecoderInit {
  output: AudioDataOutputCallback;
  error: WebCodecsErrorCallback;
}

interface EncodedVideoChunk {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration?: number;
  readonly byteLength: number;
  
  copyTo(destination: BufferSource): void;
}

interface EncodedVideoChunkInit {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: BufferSource;
}

interface EncodedAudioChunk {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration?: number;
  readonly byteLength: number;
  
  copyTo(destination: BufferSource): void;
}

interface EncodedAudioChunkInit {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: BufferSource;
}

interface VideoFrame {
  readonly format: VideoPixelFormat | null;
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly codedRect: DOMRectReadOnly | null;
  readonly visibleRect: DOMRectReadOnly | null;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly duration: number | null;
  readonly timestamp: number;
  readonly colorSpace: VideoColorSpace;
  
  clone(): VideoFrame;
  close(): void;
  copyTo(destination: BufferSource, options?: VideoFrameCopyToOptions): Promise<PlaneLayout[]>;
}

interface AudioData {
  readonly format: AudioSampleFormat | null;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  readonly timestamp: number;
  
  clone(): AudioData;
  close(): void;
  copyTo(destination: BufferSource, options: AudioDataCopyToOptions): void;
}

interface AudioDataCopyToOptions {
  planeIndex: number;
  frameOffset?: number;
  frameCount?: number;
  format?: AudioSampleFormat;
}

interface VideoFrameCopyToOptions {
  rect?: DOMRectInit;
  layout?: PlaneLayout[];
}

interface PlaneLayout {
  offset: number;
  stride: number;
}

interface VideoColorSpaceInit {
  primaries?: VideoColorPrimaries;
  transfer?: VideoTransferCharacteristics;
  matrix?: VideoMatrixCoefficients;
  fullRange?: boolean;
}

interface VideoColorSpace {
  readonly primaries: VideoColorPrimaries | null;
  readonly transfer: VideoTransferCharacteristics | null;
  readonly matrix: VideoMatrixCoefficients | null;
  readonly fullRange: boolean | null;
  
  toJSON(): VideoColorSpaceInit;
}

type VideoFrameOutputCallback = (output: VideoFrame) => void;
type AudioDataOutputCallback = (output: AudioData) => void;
type WebCodecsErrorCallback = (error: DOMException) => void;

type HardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software';
type VideoPixelFormat = 'I420' | 'I420A' | 'I422' | 'I444' | 'NV12' | 'RGBA' | 'RGBX' | 'BGRA' | 'BGRX';
type AudioSampleFormat = 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';
type VideoColorPrimaries = 'bt709' | 'bt470bg' | 'smpte170m' | 'bt2020' | 'smpte432';
type VideoTransferCharacteristics = 'bt709' | 'smpte170m' | 'iec61966-2-1' | 'linear' | 'pq' | 'hlg';
type VideoMatrixCoefficients = 'rgb' | 'bt709' | 'bt470bg' | 'smpte170m' | 'bt2020-ncl';

// Constructores globales
declare const VideoDecoder: {
  prototype: VideoDecoder;
  new(init: VideoDecoderInit): VideoDecoder;
  isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
};

declare const AudioDecoder: {
  prototype: AudioDecoder;
  new(init: AudioDecoderInit): AudioDecoder;
  isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
};

declare const EncodedVideoChunk: {
  prototype: EncodedVideoChunk;
  new(init: EncodedVideoChunkInit): EncodedVideoChunk;
};

declare const EncodedAudioChunk: {
  prototype: EncodedAudioChunk;
  new(init: EncodedAudioChunkInit): EncodedAudioChunk;
};

declare const VideoFrame: {
  prototype: VideoFrame;
  new(source: CanvasImageSource, init?: VideoFrameInit): VideoFrame;
  new(data: BufferSource, init: VideoFrameBufferInit): VideoFrame;
};

declare const AudioData: {
  prototype: AudioData;
  new(init: AudioDataInit): AudioData;
};

interface VideoFrameInit {
  duration?: number;
  timestamp?: number;
  alpha?: AlphaOption;
  visibleRect?: DOMRectInit;
  displayWidth?: number;
  displayHeight?: number;
}

interface VideoFrameBufferInit {
  format: VideoPixelFormat;
  codedWidth: number;
  codedHeight: number;
  timestamp: number;
  duration?: number;
  layout?: PlaneLayout[];
  visibleRect?: DOMRectInit;
  displayWidth?: number;
  displayHeight?: number;
  colorSpace?: VideoColorSpaceInit;
}

interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: BufferSource;
}

type AlphaOption = 'keep' | 'discard';