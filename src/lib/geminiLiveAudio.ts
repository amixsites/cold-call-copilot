import { LiveTranscriptSegment, RecognitionStatus } from '../types';

export interface GeminiLiveAudioOptions {
  onInterimText: (text: string) => void;
  onFinalSegment: (segment: LiveTranscriptSegment) => void;
  onStatusChange: (status: RecognitionStatus, message?: string | null) => void;
  onError: (errorMessage: string) => void;
  onSpeakerChangePending?: (pending: boolean) => void;
  pauseThresholdSeconds?: number;
}

export class GeminiLiveAudioClient {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private isSpeaking: boolean = false;
  private activeCallId: string | null = null;
  private pcmSampleBuffer: number[] = [];
  private options: GeminiLiveAudioOptions;

  // Pause detection & Speaker Alternation Heuristic (frontend-only)
  private pauseThresholdSeconds: number = 1.5;
  private currentSpeaker: 'agent' | 'prospect' = 'agent';
  private hasEmittedFirstSegment: boolean = false;
  private speakerSwitchPending: boolean = false;
  private speechDetectedInCurrentTurn: boolean = false;
  private consecutiveSilenceAudioSeconds: number = 0;

  // Target audio specifications: 16kHz, 16-bit signed PCM mono
  private readonly TARGET_SAMPLE_RATE = 16000;
  private readonly SAMPLES_PER_CHUNK = 1600; // ~100ms at 16kHz

  constructor(options: GeminiLiveAudioOptions) {
    this.options = options;
    if (typeof options.pauseThresholdSeconds === 'number') {
      this.pauseThresholdSeconds = Math.max(1, Math.min(5, options.pauseThresholdSeconds));
    }
  }

  public setPauseThreshold(seconds: number): void {
    this.pauseThresholdSeconds = Math.max(1, Math.min(5, seconds));
  }

  public getPauseThreshold(): number {
    return this.pauseThresholdSeconds;
  }

  public isSpeakerSwitchPending(): boolean {
    return this.speakerSwitchPending;
  }

  public getCurrentSpeaker(): 'agent' | 'prospect' {
    return this.currentSpeaker;
  }

  public async start(callId: string): Promise<void> {
    if (this.isRunning) {
      console.warn('[GeminiLiveAudio] Already running');
      return;
    }

    this.activeCallId = callId;
    // Reset heuristic state on start: first segment must be Agent by default
    this.hasEmittedFirstSegment = false;
    this.currentSpeaker = 'agent';
    this.speakerSwitchPending = false;
    this.speechDetectedInCurrentTurn = false;
    this.consecutiveSilenceAudioSeconds = 0;
    this.options.onSpeakerChangePending?.(false);
    this.options.onStatusChange('requesting_permission', 'Requesting microphone permission...');

    // 1. Request microphone permission
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      console.error('[GeminiLiveAudio] Microphone permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.options.onStatusChange('permission_denied', 'Microphone access denied. Please click the camera/mic icon in the browser address bar to allow.');
      } else {
        this.options.onStatusChange('error', `Microphone hardware access failed: ${err.message}`);
      }
      return;
    }

    this.options.onStatusChange('connecting', 'Connecting to Gemini Live streaming backend...');

    // 2. Establish WebSocket connection to backend
    try {
      await this.connectWebSocket(callId);
    } catch (wsErr: any) {
      console.error('[GeminiLiveAudio] WebSocket connection error:', wsErr);
      this.options.onStatusChange('connection_lost', `Could not connect to transcription WebSocket: ${wsErr.message}`);
      this.stop();
      return;
    }

    // 3. Initialize Web Audio Pipeline with AudioWorklet and ScriptProcessor fallback
    try {
      await this.setupAudioPipeline();
      this.isRunning = true;
    } catch (audioErr: any) {
      console.error('[GeminiLiveAudio] Audio processing error:', audioErr);
      this.options.onStatusChange('error', `Audio processing setup failed: ${audioErr.message}`);
      this.stop();
    }
  }

  private connectWebSocket(callId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Determine WebSocket URL from environment or current location
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
      const wsHost = apiBase.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${wsHost}/api/calls/${callId}/transcription/live`;

      console.log(`[GeminiLiveAudio] Connecting WebSocket to: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      const connectTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error('Connection timed out after 10 seconds'));
        }
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectTimeout);
        console.log('[GeminiLiveAudio] WebSocket connection established');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
          if (msg.type === 'status' && msg.status === 'listening') {
            resolve();
          }
        } catch (e) {
          console.warn('[GeminiLiveAudio] Error parsing server message:', e);
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(connectTimeout);
        console.error('[GeminiLiveAudio] WebSocket error event:', err);
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectTimeout);
        console.log(`[GeminiLiveAudio] WebSocket closed: code ${event.code}, reason: ${event.reason}`);
        if (this.isRunning) {
          this.options.onStatusChange('connection_lost', 'Transcription stream disconnected.');
        }
      };
    });
  }

  private handleServerMessage(msg: any): void {
    if (msg.type === 'status') {
      this.options.onStatusChange(msg.status as RecognitionStatus, msg.message);
    } else if (msg.type === 'interim') {
      if (msg.text) {
        this.options.onStatusChange('processing_transcript');
        this.options.onInterimText(msg.text);
      }
    } else if (msg.type === 'final') {
      if (msg.text && typeof msg.text === 'string' && msg.text.trim()) {
        let assignedSpeaker: 'agent' | 'prospect';

        if (!this.hasEmittedFirstSegment) {
          // Requirement 1: The first finalized transcript segment must be labeled Agent by default
          assignedSpeaker = 'agent';
          this.currentSpeaker = 'agent';
          this.hasEmittedFirstSegment = true;
          this.speakerSwitchPending = false;
          this.options.onSpeakerChangePending?.(false);
        } else if (this.speakerSwitchPending) {
          // Requirement 3: When a qualifying silence occurs, assign next segment to the other speaker
          this.currentSpeaker = this.currentSpeaker === 'agent' ? 'prospect' : 'agent';
          assignedSpeaker = this.currentSpeaker;
          this.speakerSwitchPending = false;
          this.options.onSpeakerChangePending?.(false);
          console.log(`[Speaker Heuristic] Alternating speaker to "${assignedSpeaker}" on finalized segment`);
        } else {
          // If no qualifying pause occurs, keep the current speaker label
          assignedSpeaker = this.currentSpeaker;
        }

        const seg: LiveTranscriptSegment = {
          id: msg.segmentId || `seg-${crypto.randomUUID().substring(0, 8)}`,
          segmentId: msg.segmentId || `seg-${crypto.randomUUID().substring(0, 8)}`,
          callId: this.activeCallId || undefined,
          text: msg.text.trim(),
          speaker: assignedSpeaker,
          isFinal: true,
          timestamp: msg.timestamp || new Date().toISOString(),
          createdAt: msg.timestamp || new Date().toISOString(),
        };
        this.options.onFinalSegment(seg);
        this.options.onInterimText('');
        this.options.onStatusChange('listening');
      }
    } else if (msg.type === 'error') {
      this.options.onError(msg.message || 'Gemini Live transcription error');
      this.options.onStatusChange('error', msg.message);
    }
  }

  private silenceNode: GainNode | null = null;
  private framesCaptured: number = 0;
  private chunksSent: number = 0;
  private lastRms: number = 0;

  public get currentRms(): number {
    return this.lastRms;
  }

  private async setupAudioPipeline(): Promise<void> {
    if (!this.mediaStream) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({
      sampleRate: this.TARGET_SAMPLE_RATE,
    });

    // CRITICAL: In Chrome, AudioContext starts suspended until resume() is explicitly awaited!
    if (this.audioContext.state === 'suspended') {
      console.log('[GeminiLiveAudio] AudioContext initial state suspended. Awaiting resume()...');
      await this.audioContext.resume();
      console.log('[GeminiLiveAudio] AudioContext resumed successfully. State:', this.audioContext.state);
    }

    console.log(`[Diagnostic B1: Microphone] Initialized hardware AudioContext at native ${this.audioContext.sampleRate}Hz (Target: ${this.TARGET_SAMPLE_RATE}Hz mono)`);

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.framesCaptured = 0;
    this.chunksSent = 0;

    let workletInitialized = false;

    // Try AudioWorklet first for low-latency modern processing
    if (this.audioContext.audioWorklet) {
      try {
        const workletCode = `
          class PCMProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input && input.length > 0) {
                const channel = input[0];
                this.port.postMessage(channel);
              }
              return true;
            }
          }
          registerProcessor('pcm-processor', PCMProcessor);
        `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(blobUrl);
        URL.revokeObjectURL(blobUrl);

        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
        this.workletNode.port.onmessage = (event) => {
          this.processAudioFrame(event.data);
        };
        this.sourceNode.connect(this.workletNode);

        // Connect worklet to a zero-gain silence sink so Chrome's audio engine keeps actively pulling frames
        this.silenceNode = this.audioContext.createGain();
        this.silenceNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.workletNode.connect(this.silenceNode);
        this.silenceNode.connect(this.audioContext.destination);

        workletInitialized = true;
        console.log(`[Diagnostic B1: Microphone] AudioWorklet low-latency processor active on live processing path`);
      } catch (workletErr) {
        console.warn('[GeminiLiveAudio] AudioWorklet initialization failed, falling back to ScriptProcessor:', workletErr);
      }
    }

    // Fallback to ScriptProcessorNode if AudioWorklet unavailable or failed
    if (!workletInitialized) {
      this.scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        this.processAudioFrame(inputData);
      };
      this.sourceNode.connect(this.scriptNode);
      this.scriptNode.connect(this.audioContext.destination);
      console.log('[Diagnostic B1: Microphone] ScriptProcessor fallback active and connected to destination');
    }
  }

  private processAudioFrame(inputChannel: Float32Array): void {
    if (!this.isRunning || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.framesCaptured += inputChannel.length;

    // 1. Calculate RMS volume to detect active speech and verify non-zero samples
    let sumSquares = 0;
    for (let i = 0; i < inputChannel.length; i++) {
      sumSquares += inputChannel[i] * inputChannel[i];
    }
    const rms = Math.sqrt(sumSquares / inputChannel.length);
    this.lastRms = rms;

    const sampleRate = this.audioContext ? this.audioContext.sampleRate : this.TARGET_SAMPLE_RATE;
    const frameSeconds = inputChannel.length / sampleRate;

    const SPEECH_RMS_THRESHOLD = 0.012;
    const SILENCE_RMS_THRESHOLD = 0.008;

    if (rms >= SPEECH_RMS_THRESHOLD) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        console.log(`[Diagnostic B1: Microphone] Speech energy detected! RMS: ${rms.toFixed(4)}`);
        this.options.onStatusChange('receiving_speech');
      }
      this.speechDetectedInCurrentTurn = true;
      this.consecutiveSilenceAudioSeconds = 0;
    } else if (rms <= SILENCE_RMS_THRESHOLD) {
      if (this.isSpeaking) {
        this.isSpeaking = false;
        this.options.onStatusChange('listening');
      }
      // Measure silence in actual captured audio
      if (this.speechDetectedInCurrentTurn) {
        this.consecutiveSilenceAudioSeconds += frameSeconds;
        if (this.consecutiveSilenceAudioSeconds >= this.pauseThresholdSeconds) {
          if (!this.speakerSwitchPending) {
            this.speakerSwitchPending = true;
            // Avoid repeatedly triggering speaker switches during the same silent period
            this.speechDetectedInCurrentTurn = false;
            this.consecutiveSilenceAudioSeconds = 0;
            console.log(`[Speaker Heuristic] Qualifying audio silence of ${this.pauseThresholdSeconds.toFixed(1)}s detected. Next speaker switch pending.`);
            this.options.onSpeakerChangePending?.(true);
          }
        }
      }
    }

    // 2. Resample if hardware AudioContext did not run at 16000 Hz
    let samples = inputChannel;
    if (this.audioContext && this.audioContext.sampleRate !== this.TARGET_SAMPLE_RATE) {
      samples = this.downsampleBuffer(inputChannel, this.audioContext.sampleRate, this.TARGET_SAMPLE_RATE);
    }

    // 3. Buffer samples to send approximately 100ms chunks (1600 samples = 3200 bytes)
    for (let i = 0; i < samples.length; i++) {
      this.pcmSampleBuffer.push(samples[i]);
    }

    while (this.pcmSampleBuffer.length >= this.SAMPLES_PER_CHUNK) {
      const chunkSamples = this.pcmSampleBuffer.splice(0, this.SAMPLES_PER_CHUNK);
      const pcm16Buffer = this.floatTo16BitPCM(chunkSamples);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.chunksSent++;
        this.ws.send(pcm16Buffer);

        if (this.chunksSent % 25 === 1 || this.isSpeaking) {
          console.log(`[Diagnostic B2: Browser->App WS] Chunk #${this.chunksSent} sent (${pcm16Buffer.byteLength} bytes) | RMS: ${rms.toFixed(4)} | Frames: ${this.framesCaptured}`);
        }
      }
    }
  }

  private downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (inputRate === outputRate) return buffer;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const startIdx = Math.floor(i * ratio);
      const endIdx = Math.min(Math.floor((i + 1) * ratio), buffer.length);
      let sum = 0;
      let count = 0;
      for (let j = startIdx; j < endIdx; j++) {
        sum += buffer[j];
        count++;
      }
      result[i] = count > 0 ? sum / count : buffer[startIdx];
    }
    return result;
  }

  private floatTo16BitPCM(samples: number[]): ArrayBuffer {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // true = Little-Endian
    }
    return buffer;
  }

  public stop(): void {
    this.isRunning = false;
    this.isSpeaking = false;
    this.speechDetectedInCurrentTurn = false;
    this.consecutiveSilenceAudioSeconds = 0;
    this.speakerSwitchPending = false;
    this.hasEmittedFirstSegment = false;
    this.currentSpeaker = 'agent';
    this.options.onSpeakerChangePending?.(false);

    // Send stop control command to WebSocket before closing
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'stop' }));
        this.ws.close(1000, 'User stopped listening');
      } catch (_) {}
    }
    this.ws = null;

    // Disconnect audio nodes
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (_) {}
      this.sourceNode = null;
    }
    if (this.silenceNode) {
      try { this.silenceNode.disconnect(); } catch (_) {}
      this.silenceNode = null;
    }
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch (_) {}
      this.workletNode = null;
    }
    if (this.scriptNode) {
      try { this.scriptNode.disconnect(); } catch (_) {}
      this.scriptNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }

    // Stop MediaStream microphone tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (_) {}
      });
      this.mediaStream = null;
    }

    this.pcmSampleBuffer = [];
    this.options.onStatusChange('stopped', 'Microphone capture stopped');
  }

  public destroy(): void {
    this.stop();
  }
}
