import { LiveTranscriptSegment, RecognitionStatus } from '../types';

export interface SpeechRecognitionAdapterOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionCallbacks {
  onInterimText?: (text: string) => void;
  onFinalSegment?: (segment: LiveTranscriptSegment) => void;
  onStatusChange?: (status: RecognitionStatus, errorMessage?: string) => void;
  onError?: (error: string) => void;
}

/**
 * Universal interface for speech-to-text providers so that
 * streaming cloud providers (Deepgram, AssemblyAI, Twilio Audio Streams)
 * can easily substitute the browser Web Speech API implementation.
 */
export interface ITranscriptionProvider {
  isSupported(): boolean;
  start(callId?: string): Promise<void>;
  stop(): void;
  destroy(): void;
  getStatus(): RecognitionStatus;
}

// Browser Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

type BrowserSpeechRecognition = any;

/**
 * Robust Web Speech API adapter for live incremental microphone transcription.
 * Features:
 * - Explicit microphone permission acquisition.
 * - Live interim feedback updates.
 * - Deduplication across recognition engine auto-restarts.
 * - Stable timestamps and unique segment IDs.
 * - Audio track cleanup on stop/unmount.
 */
export class BrowserSpeechRecognitionAdapter implements ITranscriptionProvider {
  private recognition: BrowserSpeechRecognition | null = null;
  private mediaStream: MediaStream | null = null;
  private status: RecognitionStatus = 'idle';
  private callbacks: SpeechRecognitionCallbacks;
  private activeCallId: string | null = null;
  private isExplicitlyStopped: boolean = true;
  private finalizedSegmentHashes = new Set<string>();
  private segmentIndexCounter: number = 0;
  private options: SpeechRecognitionAdapterOptions;

  constructor(callbacks: SpeechRecognitionCallbacks, options: SpeechRecognitionAdapterOptions = {}) {
    this.callbacks = callbacks;
    this.options = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      ...options,
    };

    if (!this.isSupported()) {
      this.setStatus('unsupported', 'Live Speech Recognition is not supported by this browser. Chrome, Edge, or Safari is recommended.');
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return Boolean(SpeechRecognitionAPI && navigator?.mediaDevices?.getUserMedia);
  }

  public getStatus(): RecognitionStatus {
    return this.status;
  }

  public async start(callId?: string): Promise<void> {
    if (!this.isSupported()) {
      this.setStatus('unsupported', 'Your browser does not support the Web Speech API. Chrome, Edge, or Safari recommended.');
      return;
    }

    if (this.status === 'listening') {
      return;
    }

    this.activeCallId = callId || null;
    this.isExplicitlyStopped = false;
    this.setStatus('requesting_permission');

    try {
      // 1. Explicitly request microphone stream to verify permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Initialize browser SpeechRecognition
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();

      this.recognition.continuous = this.options.continuous ?? true;
      this.recognition.interimResults = this.options.interimResults ?? true;
      this.recognition.lang = this.options.language || 'en-US';
      this.recognition.maxAlternatives = 1;

      this.setupEventHandlers();
      this.recognition.start();
      this.setStatus('listening');
    } catch (err: any) {
      this.isExplicitlyStopped = true;
      this.cleanupMediaStream();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const errorMsg = 'Microphone permission was denied. Please allow microphone access in your browser settings to enable live transcription.';
        this.setStatus('error', errorMsg);
        this.callbacks.onError?.(errorMsg);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        const errorMsg = 'No microphone device was detected on your system. Please connect an audio input device.';
        this.setStatus('error', errorMsg);
        this.callbacks.onError?.(errorMsg);
      } else {
        const errorMsg = `Microphone initialization failed: ${err.message || 'Unknown error'}`;
        this.setStatus('error', errorMsg);
        this.callbacks.onError?.(errorMsg);
      }
    }
  }

  public stop(): void {
    this.isExplicitlyStopped = true;
    this.cleanupMediaStream();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }

    this.setStatus('stopped');
    this.callbacks.onInterimText?.('');
  }

  public destroy(): void {
    this.stop();
    this.recognition = null;
    this.finalizedSegmentHashes.clear();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      if (!this.isExplicitlyStopped) {
        this.setStatus('listening');
      }
    };

    this.recognition.onaudiostart = () => {
      if (this.status === 'listening') {
        // audio stream receiving packets
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (this.isExplicitlyStopped) return;

      let interimAccumulator = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const transcriptText = result[0]?.transcript?.trim() || '';

        if (!transcriptText) continue;

        if (result.isFinal) {
          this.handleFinalResult(transcriptText);
        } else {
          interimAccumulator += `${transcriptText} `;
        }
      }

      // Dispatch interim text for real-time visual feedback
      this.callbacks.onInterimText?.(interimAccumulator.trim());
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore routine 'no-speech' silence events in continuous mode
      if (event.error === 'no-speech') {
        return;
      }

      if (event.error === 'aborted' && this.isExplicitlyStopped) {
        return;
      }

      if (event.error === 'not-allowed') {
        const msg = 'Microphone permission was denied by the browser.';
        this.setStatus('error', msg);
        this.callbacks.onError?.(msg);
        return;
      }

      if (event.error === 'network') {
        const msg = 'Speech recognition network connection interrupted. Grounded fallback active.';
        this.callbacks.onError?.(msg);
        return;
      }

      console.warn('[Speech Recognition] Error encountered:', event.error, event.message);
    };

    this.recognition.onend = () => {
      // Web Speech API continuous mode automatically pauses after long silences
      // If the caller has not clicked Stop, automatically restart recognition seamlessly
      if (!this.isExplicitlyStopped && this.status === 'listening') {
        try {
          this.recognition?.start();
        } catch (_) {
          // If restart fails, set state to stopped gracefully
          this.setStatus('stopped');
        }
      } else {
        this.setStatus('stopped');
        this.callbacks.onInterimText?.('');
      }
    };
  }

  private handleFinalResult(rawText: string): void {
    const cleanText = rawText.trim();
    if (!cleanText || cleanText.length < 2) return;

    // Deduplication key based on normalized text and timestamp window
    const normalizedKey = cleanText.toLowerCase().replace(/\s+/g, ' ');
    if (this.finalizedSegmentHashes.has(normalizedKey)) {
      return; // Prevent duplicate segment creation on restart
    }
    this.finalizedSegmentHashes.add(normalizedKey);

    // Limit memory footprint of deduplication hash set
    if (this.finalizedSegmentHashes.size > 200) {
      const entries = Array.from(this.finalizedSegmentHashes);
      this.finalizedSegmentHashes = new Set(entries.slice(-100));
    }

    this.segmentIndexCounter += 1;
    const segmentId = `seg-${Date.now()}-${this.segmentIndexCounter}`;
    const timestamp = new Date().toISOString();

    const segment: LiveTranscriptSegment = {
      id: segmentId,
      segmentId,
      callId: this.activeCallId || undefined,
      text: cleanText,
      speaker: 'unknown', // Will be labeled or inferred in panel
      isFinal: true,
      timestamp,
      createdAt: timestamp,
    };

    // Clear interim buffer since this segment has finalized
    this.callbacks.onInterimText?.('');

    // Emit finalized segment
    this.callbacks.onFinalSegment?.(segment);
  }

  private cleanupMediaStream(): void {
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
      } catch (_) {}
      this.mediaStream = null;
    }
  }

  private setStatus(newStatus: RecognitionStatus, errorMsg?: string): void {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus, errorMsg);
  }
}
