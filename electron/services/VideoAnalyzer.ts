import { spawn } from 'child_process';
import * as path from 'path';
import type { VideoMetadata, VideoAnalysisResult } from '../types/video.types';

export class VideoAnalyzer {
  private static readonly SUPPORTED_HTML5_CODECS = [
    'h264', 'avc1', 'mp4v', 'vp8', 'vp9', 'av01'
  ];

  private static readonly SUPPORTED_HTML5_CONTAINERS = [
    'mp4', 'webm', 'ogg'
  ];

  async analyzeVideo(filePath: string): Promise<VideoAnalysisResult> {
    try {
      console.log(`🔍 [VideoAnalyzer] Analyzing: ${filePath}`);
      
      const metadata = await this.extractMetadata(filePath);
      const compatibilityReport = this.assessCompatibility(metadata);
      
      console.log(`✅ [VideoAnalyzer] Analysis complete:`, {
        videoCodec: metadata.videoCodec,
        compatible: compatibilityReport.canPlayNatively,
        action: compatibilityReport.recommendedAction
      });

      return {
        metadata,
        compatibilityReport,
        needsConversion: !compatibilityReport.canPlayNatively,
        compatibilityIssues: []
      };
    } catch (error) {
      console.error(`❌ [VideoAnalyzer] Error analyzing ${filePath}:`, error);
      throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async extractMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed: ${errorOutput}`));
          return;
        }

        try {
          const probeData = JSON.parse(output);
          const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video');
          const audioStream = probeData.streams.find((s: any) => s.codec_type === 'audio');

          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          const metadata: VideoMetadata = {
            filename: path.basename(filePath),
            duration: parseFloat(probeData.format.duration) || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            videoCodec: videoStream.codec_name || 'unknown',
            audioCodec: audioStream?.codec_name || 'none',
            bitrate: parseInt(probeData.format.bit_rate) || 0,
            fps: this.parseFrameRate(videoStream.r_frame_rate),
            format: path.extname(filePath).toLowerCase().slice(1),
            size: parseInt(probeData.format.size) || 0,
            isHTML5Compatible: false, // Will be set in assessCompatibility
            needsConversion: false     // Will be set in assessCompatibility
          };

          resolve(metadata);
        } catch (parseError) {
          reject(new Error(`Failed to parse FFprobe output: ${parseError}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe spawn error: ${error.message}`));
      });
    });
  }

  private parseFrameRate(frameRateStr: string): number {
    if (!frameRateStr || frameRateStr === '0/0') return 0;
    
    const [num, den] = frameRateStr.split('/').map(Number);
    return den ? Math.round((num / den) * 100) / 100 : 0;
  }

  private assessCompatibility(metadata: VideoMetadata): VideoAnalysisResult['compatibilityReport'] {
    const { videoCodec, audioCodec, width, height } = metadata;
    const fileExt = path.extname(metadata.filename).toLowerCase().slice(1);

    // Check codec compatibility
    const videoCodecSupported = VideoAnalyzer.SUPPORTED_HTML5_CODECS.some(
      supportedCodec => videoCodec.toLowerCase().includes(supportedCodec)
    );

    const audioCodecSupported = !audioCodec || audioCodec === 'none' || 
      ['aac', 'mp3', 'vorbis', 'opus'].includes(audioCodec.toLowerCase());

    const containerSupported = VideoAnalyzer.SUPPORTED_HTML5_CONTAINERS.includes(fileExt);

    // Determine if native playback is possible
    const canPlayNatively = videoCodecSupported && audioCodecSupported && containerSupported;

    // Update metadata flags
    metadata.isHTML5Compatible = canPlayNatively;
    metadata.needsConversion = !canPlayNatively;

    // Estimate conversion time (rough calculation)
    const estimatedConversionTime = this.estimateConversionTime(metadata);

    let recommendedAction: 'play' | 'convert' | 'unsupported';
    
    if (canPlayNatively) {
      recommendedAction = 'play';
    } else if (videoCodec !== 'unknown' && width > 0 && height > 0) {
      recommendedAction = 'convert';
    } else {
      recommendedAction = 'unsupported';
    }

    return {
      canPlayNatively,
      recommendedAction,
      conversionNeeded: !canPlayNatively,
      estimatedConversionTime
    };
  }

  private estimateConversionTime(metadata: VideoMetadata): number {
    // Rough estimation: 1 minute of video = 10-30 seconds conversion time
    // Factors: resolution, bitrate, codec complexity
    const baseTime = metadata.duration * 0.3; // 30% of video duration
    
    // Resolution factor
    const pixelCount = metadata.width * metadata.height;
    const resolutionFactor = pixelCount > (1920 * 1080) ? 1.5 : 1.0;
    
    // Codec complexity factor
    const codecFactor = ['mpeg2', 'mpeg1'].includes(metadata.videoCodec.toLowerCase()) ? 0.8 : 1.0;
    
    return Math.max(5, Math.round(baseTime * resolutionFactor * codecFactor));
  }
}

export const videoAnalyzer = new VideoAnalyzer();