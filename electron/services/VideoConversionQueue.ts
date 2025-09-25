import { EventEmitter } from 'events';
import { VideoConverter } from './VideoConverter';
import { VideoAnalyzer } from './VideoAnalyzer';
import type { ConversionProgress, VideoMetadata, ShowEntry } from '../types/video.types';
import * as path from 'path';

/**
 * Priority levels for video conversions
 */
export enum ConversionPriority {
  IMMEDIATE = 1,     // Currently playing show
  HIGH = 2,          // Next episode in queue
  NORMAL = 3,        // Background conversions
  LOW = 4            // Future episodes
}

/**
 * Conversion job interface
 */
export interface ConversionJob {
  id: string;
  inputPath: string;
  outputPath: string;
  channelId: string;
  showName: string;
  seasonNumber: number;
  episodeNumber: number;
  priority: ConversionPriority;
  metadata?: VideoMetadata;
  startTime: Date;
  progress: number;
  status: 'pending' | 'converting' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

/**
 * Channel conversion status
 */
export interface ChannelConversionStatus {
  channelId: string;
  channelName: string;
  totalJobs: number;
  completedJobs: number;
  currentJob?: ConversionJob;
  isReady: boolean; // Ready to play current show
}

/**
 * Video Conversion Queue Manager
 * Handles parallel video conversions with priority system
 */
export class VideoConversionQueue extends EventEmitter {
  private static instance: VideoConversionQueue;
  private converter: VideoConverter;
  private analyzer: VideoAnalyzer;
  
  private jobs: Map<string, ConversionJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private channelStatus: Map<string, ChannelConversionStatus> = new Map();
  
  private maxConcurrentConversions: number = 3; // Configurable
  private isProcessing: boolean = false;
  
  constructor() {
    super();
    this.converter = VideoConverter.getInstance();
    this.analyzer = new VideoAnalyzer();
  }

  static getInstance(): VideoConversionQueue {
    if (!VideoConversionQueue.instance) {
      VideoConversionQueue.instance = new VideoConversionQueue();
    }
    return VideoConversionQueue.instance;
  }

  /**
   * Queue conversions for all channels based on current schedule
   */
  async queueScheduleConversions(
    channelSchedules: Map<string, ShowEntry[]>,
    currentTime: Date = new Date()
  ): Promise<void> {
    console.log('🎬 [ConversionQueue] Queuing schedule conversions...');
    
    // Clear previous jobs
    this.clearAllJobs();
    
    for (const [channelId, schedule] of channelSchedules.entries()) {
      const channelJobs: ConversionJob[] = [];
      
      // Find current and upcoming shows that need conversion
      const currentShow = this.findCurrentShow(schedule, currentTime);
      const upcomingShows = this.findUpcomingShows(schedule, currentTime, 5); // Next 5 shows
      
      // Add current show with IMMEDIATE priority
      if (currentShow && await this.needsConversion(currentShow.videoPath)) {
        const job = await this.createConversionJob(currentShow, channelId, ConversionPriority.IMMEDIATE);
        if (job) {
          channelJobs.push(job);
          this.jobs.set(job.id, job);
        }
      }
      
      // Add upcoming shows with HIGH priority
      for (const show of upcomingShows) {
        if (await this.needsConversion(show.videoPath)) {
          const priority = upcomingShows.indexOf(show) === 0 ? ConversionPriority.HIGH : ConversionPriority.NORMAL;
          const job = await this.createConversionJob(show, channelId, priority);
          if (job) {
            channelJobs.push(job);
            this.jobs.set(job.id, job);
          }
        }
      }
      
      // Update channel status
      this.channelStatus.set(channelId, {
        channelId,
        channelName: `Channel ${channelId}`, // You can get this from ChannelManager
        totalJobs: channelJobs.length,
        completedJobs: 0,
        currentJob: channelJobs[0],
        isReady: channelJobs.length === 0 // Ready if no conversions needed
      });
    }
    
    console.log(`🎬 [ConversionQueue] Queued ${this.jobs.size} conversion jobs across ${channelSchedules.size} channels`);
    
    // Start processing
    this.startProcessing();
  }

  /**
   * Queue conversion for next episode while current one is playing
   */
  async queueNextEpisode(
    currentShow: ShowEntry,
    nextShow: ShowEntry,
    channelId: string
  ): Promise<void> {
    if (!await this.needsConversion(nextShow.videoPath)) {
      return;
    }
    
    const job = await this.createConversionJob(nextShow, channelId, ConversionPriority.HIGH);
    if (job) {
      this.jobs.set(job.id, job);
      console.log(`🎬 [ConversionQueue] Queued next episode: ${nextShow.showName} S${nextShow.seasonNumber}E${nextShow.episodeNumber}`);
      
      // Start processing if not already processing
      if (!this.isProcessing) {
        this.startProcessing();
      }
    }
  }

  /**
   * Check if a video file needs conversion
   */
  private async needsConversion(videoPath: string): Promise<boolean> {
    try {
      // Check if already converted (cached)
      const converter = VideoConverter.getInstance();
      const cachedFile = await (converter as any).getCachedConversion(videoPath);
      if (cachedFile) {
        return false;
      }
      
      // Check if video format needs conversion
      const analysisResult = await this.analyzer.analyzeVideo(videoPath);
      const metadata = analysisResult.metadata;
      
      // Check format compatibility
      const compatibleFormats = ['mp4', 'webm', 'ogg'];
      const currentFormat = path.extname(videoPath).toLowerCase().slice(1);
      
      return !compatibleFormats.includes(currentFormat) || 
             metadata.width >= 480 || // May need quality constraint
             !metadata.isHTML5Compatible;
             
    } catch (error) {
      console.error('🚨 [ConversionQueue] Error checking conversion need:', error);
      return false;
    }
  }

  /**
   * Create a conversion job from schedule entry
   */
  private async createConversionJob(
    show: ShowEntry,
    channelId: string,
    priority: ConversionPriority
  ): Promise<ConversionJob | null> {
    try {
      const analysisResult = await this.analyzer.analyzeVideo(show.videoPath);
      const jobId = this.generateJobId(show, channelId);
      
      const job: ConversionJob = {
        id: jobId,
        inputPath: show.videoPath,
        outputPath: this.generateOutputPath(show.videoPath),
        channelId,
        showName: show.showName,
        seasonNumber: show.seasonNumber,
        episodeNumber: show.episodeNumber,
        priority,
        metadata: analysisResult.metadata,
        startTime: show.startTime,
        progress: 0,
        status: 'pending'
      };
      
      return job;
    } catch (error) {
      console.error('🚨 [ConversionQueue] Error creating conversion job:', error);
      return null;
    }
  }

  /**
   * Start processing conversion queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    console.log('🚀 [ConversionQueue] Starting conversion processing...');
    
    while (this.hasJobsToProcess() && this.isProcessing) {
      // Get next jobs to process (based on priority and concurrency limit)
      const jobsToStart = this.getNextJobs();
      
      // Start conversions in parallel
      const conversionPromises = jobsToStart.map(job => this.processJob(job));
      
      if (conversionPromises.length > 0) {
        await Promise.allSettled(conversionPromises);
      }
      
      // Small delay before checking for more jobs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isProcessing = false;
    console.log('✅ [ConversionQueue] Conversion processing completed');
    this.emit('allCompleted');
  }

  /**
   * Process a single conversion job
   */
  private async processJob(job: ConversionJob): Promise<void> {
    console.log(`🎬 [ConversionQueue] Starting conversion: ${job.showName} S${job.seasonNumber}E${job.episodeNumber}`);
    
    this.activeJobs.add(job.id);
    job.status = 'converting';
    
    this.emit('jobStarted', job);
    this.updateChannelStatus(job.channelId);
    
    try {
      const result = await this.converter.convertToHTML5Compatible(
        job.inputPath,
        {},
        (progress: ConversionProgress) => {
          job.progress = progress.percentage;
          this.emit('jobProgress', job, progress);
          
          // Check if this is the current show for the channel - emit special event
          const channelStatus = this.channelStatus.get(job.channelId);
          if (channelStatus?.currentJob?.id === job.id) {
            this.emit('currentShowProgress', job.channelId, progress);
          }
        },
        job.metadata
      );
      
      if (result.success) {
        job.status = 'completed';
        job.progress = 100;
        job.outputPath = result.outputPath!;
        
        console.log(`✅ [ConversionQueue] Completed: ${job.showName} S${job.seasonNumber}E${job.episodeNumber}`);
        
        this.emit('jobCompleted', job);
        this.updateChannelStatus(job.channelId, true);
        
        // Special event for current show completion
        const channelStatus = this.channelStatus.get(job.channelId);
        if (channelStatus?.currentJob?.id === job.id) {
          channelStatus.isReady = true;
          this.emit('channelReady', job.channelId);
        }
        
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
      
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      
      console.error(`🚨 [ConversionQueue] Failed: ${job.showName} S${job.seasonNumber}E${job.episodeNumber}:`, error);
      
      this.emit('jobFailed', job);
      this.updateChannelStatus(job.channelId, true);
      
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Get next jobs to process based on priority and concurrency
   */
  private getNextJobs(): ConversionJob[] {
    const availableSlots = this.maxConcurrentConversions - this.activeJobs.size;
    if (availableSlots <= 0) {
      return [];
    }
    
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => {
        // Sort by priority first, then by start time
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.startTime.getTime() - b.startTime.getTime();
      });
    
    return pendingJobs.slice(0, availableSlots);
  }

  /**
   * Check if there are jobs to process
   */
  private hasJobsToProcess(): boolean {
    return Array.from(this.jobs.values()).some(job => 
      job.status === 'pending' || job.status === 'converting'
    );
  }

  /**
   * Update channel status after job completion
   */
  private updateChannelStatus(channelId: string, jobCompleted: boolean = false): void {
    const status = this.channelStatus.get(channelId);
    if (!status) return;
    
    if (jobCompleted) {
      status.completedJobs++;
    }
    
    // Find next current job
    const channelJobs = Array.from(this.jobs.values())
      .filter(job => job.channelId === channelId)
      .sort((a, b) => a.priority - b.priority);
    
    status.currentJob = channelJobs.find(job => 
      job.status === 'converting' || job.status === 'pending'
    );
    
    // Update ready status
    if (!status.currentJob || status.completedJobs === status.totalJobs) {
      status.isReady = true;
    }
    
    this.emit('channelStatusUpdated', status);
  }

  // Utility methods for finding shows in schedule
  private findCurrentShow(schedule: ShowEntry[], currentTime: Date): ShowEntry | null {
    return schedule.find(entry => 
      entry.startTime <= currentTime && entry.endTime > currentTime
    ) || null;
  }

  private findUpcomingShows(schedule: ShowEntry[], currentTime: Date, limit: number): ShowEntry[] {
    return schedule
      .filter(entry => entry.startTime > currentTime)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, limit);
  }

  // Utility methods
  private generateJobId(show: ShowEntry, channelId: string): string {
    return `${channelId}_${show.showName}_S${show.seasonNumber}E${show.episodeNumber}_${Date.now()}`;
  }

  private generateOutputPath(inputPath: string): string {
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    return path.join('temp/converted', `${baseName}_converted.mp4`);
  }

  private clearAllJobs(): void {
    this.jobs.clear();
    this.activeJobs.clear();
    this.channelStatus.clear();
  }

  // Public API methods
  public getChannelStatus(channelId: string): ChannelConversionStatus | undefined {
    return this.channelStatus.get(channelId);
  }

  public getAllChannelStatuses(): ChannelConversionStatus[] {
    return Array.from(this.channelStatus.values());
  }

  public getJobStatus(jobId: string): ConversionJob | undefined {
    return this.jobs.get(jobId);
  }

  public isChannelReady(channelId: string): boolean {
    const status = this.channelStatus.get(channelId);
    return status?.isReady || false;
  }

  public stopProcessing(): void {
    this.isProcessing = false;
    console.log('🛑 [ConversionQueue] Stopping conversion processing...');
  }

  public setMaxConcurrentConversions(max: number): void {
    this.maxConcurrentConversions = Math.max(1, Math.min(max, 10)); // Between 1 and 10
  }
}

export default VideoConversionQueue;