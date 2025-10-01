/**
 * Audio processing utilities for noise reduction and voice enhancement
 */

export interface AudioProcessingConfig {
  enableNoiseSuppression: boolean;
  enableEchoCancellation: boolean;
  enableAutoGainControl: boolean;
  highpassFrequency: number;
  lowpassFrequency: number;
  volumeThreshold: number;
  sampleRate: number;
  channelCount: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioProcessingConfig = {
  enableNoiseSuppression: true,
  enableEchoCancellation: true,
  enableAutoGainControl: true,
  highpassFrequency: 100, // Remove low-frequency noise
  lowpassFrequency: 8000, // Remove high-frequency noise
  volumeThreshold: 0.01, // Volume gate threshold
  sampleRate: 44100,
  channelCount: 1,
};

/**
 * Web Audio API-based noise reduction processor
 */
export class NoiseReduction {
  private audioContext: AudioContext;
  private highpassFilter!: BiquadFilterNode;
  private lowpassFilter!: BiquadFilterNode;
  private gainNode!: GainNode;
  private config: AudioProcessingConfig;

  constructor(audioContext: AudioContext, config: Partial<AudioProcessingConfig> = {}) {
    this.audioContext = audioContext;
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
    this.setupFilters();
  }

  private setupFilters(): void {
    // High-pass filter to remove low-frequency noise (fans, AC, traffic)
    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.setValueAtTime(
      this.config.highpassFrequency,
      this.audioContext.currentTime
    );
    this.highpassFilter.Q.setValueAtTime(1, this.audioContext.currentTime);

    // Low-pass filter to remove high-frequency noise
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.setValueAtTime(
      this.config.lowpassFrequency,
      this.audioContext.currentTime
    );
    this.lowpassFilter.Q.setValueAtTime(1, this.audioContext.currentTime);

    // Gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);

    // Connect filters in series
    this.highpassFilter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.gainNode);
  }

  /**
   * Process audio source through noise reduction filters
   */
  process(sourceNode: AudioNode): AudioNode {
    sourceNode.connect(this.highpassFilter);
    return this.gainNode;
  }

  /**
   * Update filter frequencies dynamically
   */
  updateConfig(newConfig: Partial<AudioProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    this.highpassFilter.frequency.setValueAtTime(
      this.config.highpassFrequency,
      this.audioContext.currentTime
    );
    this.lowpassFilter.frequency.setValueAtTime(
      this.config.lowpassFrequency,
      this.audioContext.currentTime
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.highpassFilter.disconnect();
    this.lowpassFilter.disconnect();
    this.gainNode.disconnect();
  }
}

/**
 * Simple volume-based noise gate to mute audio below threshold
 */
export class VolumeGate {
  private threshold: number;
  private isOpen: boolean = false;
  private holdTime: number;
  private lastOpenTime: number = 0;

  constructor(threshold: number = 0.01, holdTime: number = 100) {
    this.threshold = threshold;
    this.holdTime = holdTime; // milliseconds to keep gate open after volume drops
  }

  /**
   * Process audio data through volume gate
   */
  process(audioData: Float32Array): Float32Array {
    const volume = this.calculateRMS(audioData);
    const now = Date.now();
    
    if (volume > this.threshold) {
      this.isOpen = true;
      this.lastOpenTime = now;
    } else if (now - this.lastOpenTime > this.holdTime) {
      this.isOpen = false;
    }

    // Mute audio if gate is closed
    if (!this.isOpen) {
      audioData.fill(0);
    }
    
    return audioData;
  }

  /**
   * Calculate RMS (Root Mean Square) volume
   */
  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Update threshold
   */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /**
   * Get current gate state
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }
}

/**
 * Voice Activity Detection for smarter speech processing
 */
export class VoiceActivityDetector {
  private threshold: number;
  private holdTime: number;
  private isUserSpeaking: boolean = false;
  private lastSpeechTime: number = 0;
  private volumeHistory: number[] = [];
  private maxHistoryLength: number = 10;

  constructor(threshold: number = 0.01, holdTime: number = 1000) {
    this.threshold = threshold;
    this.holdTime = holdTime;
  }

  /**
   * Analyze audio data for voice activity
   */
  analyze(audioData: Float32Array): boolean {
    const volume = this.calculateRMS(audioData);
    const now = Date.now();
    
    // Add to volume history for adaptive threshold
    this.volumeHistory.push(volume);
    if (this.volumeHistory.length > this.maxHistoryLength) {
      this.volumeHistory.shift();
    }

    // Calculate adaptive threshold based on recent volume history
    const avgVolume = this.volumeHistory.reduce((sum, v) => sum + v, 0) / this.volumeHistory.length;
    const adaptiveThreshold = Math.max(this.threshold, avgVolume * 1.5);
    
    if (volume > adaptiveThreshold) {
      this.isUserSpeaking = true;
      this.lastSpeechTime = now;
    } else if (now - this.lastSpeechTime > this.holdTime) {
      this.isUserSpeaking = false;
    }
    
    return this.isUserSpeaking;
  }

  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.isUserSpeaking = false;
    this.lastSpeechTime = 0;
    this.volumeHistory = [];
  }
}

/**
 * Enhanced media stream with noise reduction
 */
export class EnhancedMediaStream {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private noiseReduction: NoiseReduction | null = null;
  private volumeGate: VolumeGate | null = null;
  private vadDetector: VoiceActivityDetector | null = null;
  private config: AudioProcessingConfig;

  constructor(config: Partial<AudioProcessingConfig> = {}) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  /**
   * Get enhanced media stream with noise reduction
   */
  async getEnhancedStream(): Promise<MediaStream> {
    try {
      // Request media stream with noise suppression enabled
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.config.enableEchoCancellation,
          noiseSuppression: this.config.enableNoiseSuppression,
          autoGainControl: this.config.enableAutoGainControl,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
        }
      });

      // Set up audio processing chain
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Initialize audio processors
      this.noiseReduction = new NoiseReduction(this.audioContext, this.config);
      this.volumeGate = new VolumeGate(this.config.volumeThreshold);
      this.vadDetector = new VoiceActivityDetector(this.config.volumeThreshold);

      // Process audio through noise reduction
      const processedNode = this.noiseReduction.process(this.sourceNode);
      
      // Create output stream
      const destination = this.audioContext.createMediaStreamDestination();
      processedNode.connect(destination);

      return destination.stream;
    } catch (error) {
      console.error('Error creating enhanced media stream:', error);
      throw error;
    }
  }

  /**
   * Cleanup audio resources
   */
  cleanup(): void {
    if (this.noiseReduction) {
      this.noiseReduction.destroy();
      this.noiseReduction = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.volumeGate = null;
    this.vadDetector = null;
  }

  /**
   * Get voice activity detection status
   */
  isVoiceActive(audioData: Float32Array): boolean {
    return this.vadDetector?.analyze(audioData) ?? false;
  }

  /**
   * Update audio processing configuration
   */
  updateConfig(newConfig: Partial<AudioProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.noiseReduction?.updateConfig(this.config);
    this.volumeGate?.setThreshold(this.config.volumeThreshold);
  }
}