import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { config, MANDATORY_GEMINI_MODEL } from '../config/env.js';
import crypto from 'crypto';

export type GeminiErrorCategory = 
  | 'QUOTA_EXCEEDED'
  | 'AUTHENTICATION_ERROR'
  | 'MODEL_AVAILABILITY_ERROR'
  | 'NETWORK_ERROR'
  | 'TRANSCRIPTION_ERROR';

export function classifyGeminiError(errMsg: string, code?: number): { category: GeminiErrorCategory; message: string } {
  const lower = (errMsg || '').toLowerCase();
  
  if (code === 429 || lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit')) {
    return {
      category: 'QUOTA_EXCEEDED',
      message: `Gemini API quota exceeded for ${MANDATORY_GEMINI_MODEL}. Text-generation models are stopped to protect transcription quota. Please wait before reconnecting.`,
    };
  }
  if (code === 401 || code === 403 || lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('unauthenticated')) {
    return {
      category: 'AUTHENTICATION_ERROR',
      message: 'Authentication failed for Gemini Live API. Please verify server API key configuration.',
    };
  }
  if (code === 404 || code === 503 || lower.includes('not_found') || lower.includes('unavailable') || lower.includes('model unavailable')) {
    return {
      category: 'MODEL_AVAILABILITY_ERROR',
      message: `Model ${MANDATORY_GEMINI_MODEL} is currently unavailable.`,
    };
  }
  if (lower.includes('econnrefused') || lower.includes('econnreset') || lower.includes('etimedout') || lower.includes('enotfound') || lower.includes('network')) {
    return {
      category: 'NETWORK_ERROR',
      message: 'Network connection to Google Gemini Live endpoint failed or timed out.',
    };
  }
  return {
    category: 'TRANSCRIPTION_ERROR',
    message: errMsg || 'An error occurred during Gemini Live speech transcription.',
  };
}

interface ClientSession {
  clientWs: WebSocket;
  geminiWs: WebSocket | null;
  callId: string;
  isAlive: boolean;
  isSetupComplete: boolean;
  audioChunkCount: number;
  pendingAudioChunks: Buffer[];
}

export class LiveTranscriptionService {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<WebSocket, ClientSession>();
  private activeSessionsByCallId = new Map<string, ClientSession>();

  public initialize(server: any): void {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests on the server
    server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
      const url = request.url || '';
      // Match /api/calls/:call_id/transcription/live or with query params
      const match = url.match(/^\/api\/calls\/([a-zA-Z0-9_-]+)\/transcription\/live(\?.*)?$/);

      if (match) {
        const callId = match[1];
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.handleClientConnection(ws as WebSocket, callId);
        });
      }
    });

    console.log(`[LiveTranscriptionService] WebSocket initialized. Enforced model: ${MANDATORY_GEMINI_MODEL}`);
  }

  private handleClientConnection(clientWs: WebSocket, callId: string): void {
    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      clientWs.send(JSON.stringify({
        type: 'error',
        errorCategory: 'AUTHENTICATION_ERROR',
        message: 'GEMINI_API_KEY is not configured on the server.',
        model: MANDATORY_GEMINI_MODEL,
      }));
      clientWs.close(1011, 'Missing Gemini API Key');
      return;
    }

    // 1. Concurrency & Collision Prevention:
    // If a session already exists for this callId, cleanly terminate and close it first
    // to prevent Google AI Studio from returning 409 Conflict (ALREADY_EXISTS / concurrent session limit).
    const existingSession = this.activeSessionsByCallId.get(callId);
    if (existingSession) {
      console.log(`[LiveTranscriptionService] Closing existing session for callId=${callId} before starting new one to prevent 409 Conflict`);
      this.cleanupSession(existingSession);
      try {
        existingSession.clientWs.close(1000, 'Superseded by new connection for call');
      } catch (_) {}
      this.sessions.delete(existingSession.clientWs);
      this.activeSessionsByCallId.delete(callId);
    }

    // Diagnostics: log selected model ID and call purpose without exposing secrets, raw audio, or transcripts
    console.log(`[Model Enforcement Diagnostic] Session initiated for callId=${callId} | Model: ${MANDATORY_GEMINI_MODEL} | Purpose: Live Speech-to-Text Audio Streaming | Fallbacks: NONE`);

    const session: ClientSession = {
      clientWs,
      geminiWs: null,
      callId,
      isAlive: true,
      isSetupComplete: false,
      audioChunkCount: 0,
      pendingAudioChunks: [],
    };
    this.sessions.set(clientWs, session);
    this.activeSessionsByCallId.set(callId, session);

    clientWs.send(JSON.stringify({
      type: 'status',
      status: 'connecting',
      message: `Connecting to Gemini Live Transcription (${MANDATORY_GEMINI_MODEL})...`
    }));

    // Connect to Google's Gemini Live API WebSocket endpoint
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const geminiWs = new WebSocket(geminiWsUrl);
    session.geminiWs = geminiWs;

    geminiWs.on('open', () => {
      // Send initial setup payload with strictly enforced gemini-3.5-transcribe-live
      // Google Protobuf schema: inputAudioTranscription is on 'setup', NOT 'setup.generation_config'
      const setupMessage = {
        setup: {
          model: `models/${MANDATORY_GEMINI_MODEL}`,
          generationConfig: {
            responseModalities: ['TEXT']
          },
          inputAudioTranscription: {
            languageCodes: ['en-US'],
            mode: 'VERBATIM'
          }
        }
      };
      geminiWs.send(JSON.stringify(setupMessage));
    });

    geminiWs.on('message', (raw: WebSocket.Data) => {
      try {
        const msg = JSON.parse(raw.toString());
        const msgKeys = Object.keys(msg);

        // Check for setup completion
        if (msg.setupComplete) {
          session.isSetupComplete = true;
          console.log(`[Diagnostic B4: Gemini->App WS] setupComplete received from ${MANDATORY_GEMINI_MODEL}`);

          // Drain any buffered audio chunks received while waiting for setupComplete
          if (session.pendingAudioChunks.length > 0 && geminiWs.readyState === WebSocket.OPEN) {
            console.log(`[Diagnostic B3: App->Gemini WS] Draining ${session.pendingAudioChunks.length} queued audio chunks via realtimeInput.audio`);
            for (const chunk of session.pendingAudioChunks) {
              const audioPayload = {
                realtimeInput: {
                  audio: {
                    data: chunk.toString('base64'),
                    mimeType: 'audio/pcm;rate=16000'
                  }
                }
              };
              geminiWs.send(JSON.stringify(audioPayload));
            }
            session.pendingAudioChunks = [];
          }

          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'status',
              status: 'listening',
              message: 'Gemini Live session active. Ready for streaming audio.'
            }));
          }
          return;
        }

        if (msg.error) {
          console.error(`[Diagnostic B4: Gemini->App WS] Error payload returned from Gemini:`, msg.error);
        }

        const serverContent = msg.serverContent || msg.server_content;
        if (!serverContent) {
          console.log(`[Diagnostic B4: Gemini->App WS] Message received with fields: [${msgKeys.join(', ')}]`);
          return;
        }

        const scKeys = Object.keys(serverContent);
        console.log(`[Diagnostic B4: Gemini->App WS] serverContent received. Fields: [${scKeys.join(', ')}]`);

        // 1. Check for interim input transcription
        const interimObj = serverContent.interimInputTranscription || serverContent.interim_input_transcription;
        if (interimObj && typeof interimObj.text === 'string' && interimObj.text.trim()) {
          const interimText = interimObj.text.trim();
          console.log(`[Diagnostic B4: Gemini->App WS] Interim transcription received: ${interimText.length} chars`);
          if (clientWs.readyState === WebSocket.OPEN) {
            console.log(`[Diagnostic B5: App->Browser WS] Forwarded interim event (${interimText.length} chars)`);
            clientWs.send(JSON.stringify({
              type: 'interim',
              text: interimText,
              timestamp: new Date().toISOString()
            }));
          }
        }

        // 2. Check for finalized input transcription
        const finalObj = serverContent.inputTranscription || serverContent.input_transcription;
        if (finalObj && typeof finalObj.text === 'string' && finalObj.text.trim()) {
          const finalText = finalObj.text.trim();
          console.log(`[Diagnostic B4: Gemini->App WS] Finalized inputTranscription received: ${finalText.length} chars`);
          if (clientWs.readyState === WebSocket.OPEN) {
            const segId = `seg-${crypto.randomUUID().substring(0, 8)}`;
            console.log(`[Diagnostic B5: App->Browser WS] Forwarded final segment ${segId} (${finalText.length} chars)`);
            clientWs.send(JSON.stringify({
              type: 'final',
              segmentId: segId,
              text: finalText,
              timestamp: new Date().toISOString()
            }));
          }
        }

        // 3. Fallback for model turns containing parts text
        const modelTurn = serverContent.modelTurn || serverContent.model_turn;
        if (modelTurn && Array.isArray(modelTurn.parts)) {
          for (const part of modelTurn.parts) {
            if (part && typeof part.text === 'string' && part.text.trim()) {
              const partText = part.text.trim();
              console.log(`[Diagnostic B4: Gemini->App WS] modelTurn part text received: ${partText.length} chars`);
              if (clientWs.readyState === WebSocket.OPEN) {
                const segId = `seg-${crypto.randomUUID().substring(0, 8)}`;
                console.log(`[Diagnostic B5: App->Browser WS] Forwarded modelTurn final segment ${segId} (${partText.length} chars)`);
                clientWs.send(JSON.stringify({
                  type: 'final',
                  segmentId: segId,
                  text: partText,
                  timestamp: new Date().toISOString()
                }));
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[LiveTranscriptionService] Failed to parse message from Gemini Live:', err.message);
      }
    });

    geminiWs.on('error', (err: Error) => {
      const { category, message: classifiedMsg } = classifyGeminiError(err.message);
      console.error(`[LiveTranscriptionService] Gemini Live error [Category: ${category}]:`, err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          errorCategory: category,
          message: classifiedMsg,
          model: MANDATORY_GEMINI_MODEL,
        }));
      }
    });

    geminiWs.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.toString();
      console.log(`[LiveTranscriptionService] Gemini Live closed with code ${code}: ${reasonStr}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        if (code !== 1000 && reasonStr) {
          const { category, message: classifiedMsg } = classifyGeminiError(reasonStr, code);
          clientWs.send(JSON.stringify({
            type: 'error',
            errorCategory: category,
            message: classifiedMsg,
            model: MANDATORY_GEMINI_MODEL,
          }));
        } else {
          clientWs.send(JSON.stringify({
            type: 'status',
            status: 'stopped',
            message: 'Gemini Live transcription session ended.'
          }));
        }
      }
    });

    // Handle incoming client messages (binary audio or control commands)
    clientWs.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary || Buffer.isBuffer(data)) {
        // Raw 16-bit PCM binary chunk from microphone (16000 Hz, mono)
        session.audioChunkCount++;
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

        // Compute RMS energy of incoming PCM samples for boundary diagnostics
        const sampleCount = Math.floor(buffer.length / 2);
        let sumSquares = 0;
        for (let i = 0; i < sampleCount; i++) {
          const sample = buffer.readInt16LE(i * 2) / 32768.0;
          sumSquares += sample * sample;
        }
        const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;

        if (session.audioChunkCount % 25 === 1 || rms > 0.02) {
          console.log(`[Diagnostic B2: Browser->App WS] Chunk #${session.audioChunkCount} | ${buffer.length} bytes | ${sampleCount} samples | RMS: ${rms.toFixed(4)} | CallId: ${callId}`);
        }

        if (session.isSetupComplete && geminiWs.readyState === WebSocket.OPEN) {
          // Send supported realtimeInput.audio message format per Google Live API spec
          const audioPayload = {
            realtimeInput: {
              audio: {
                data: buffer.toString('base64'),
                mimeType: 'audio/pcm;rate=16000'
              }
            }
          };
          geminiWs.send(JSON.stringify(audioPayload));

          if (session.audioChunkCount % 25 === 1 || rms > 0.02) {
            console.log(`[Diagnostic B3: App->Gemini WS] Streamed realtimeInput.audio chunk #${session.audioChunkCount} (${buffer.length} bytes, 16kHz PCM) to ${MANDATORY_GEMINI_MODEL}`);
          }
        } else if (!session.isSetupComplete) {
          // Buffer audio received while setup completes (up to 50 chunks = ~5s)
          if (session.pendingAudioChunks.length < 50) {
            session.pendingAudioChunks.push(buffer);
          }
        }
      } else {
        // JSON control command from client
        try {
          const text = data.toString();
          const cmd = JSON.parse(text);
          if (cmd.type === 'stop') {
            this.cleanupSession(session);
            if (this.activeSessionsByCallId.get(callId) === session) {
              this.activeSessionsByCallId.delete(callId);
            }
          } else if (cmd.type === 'ping') {
            clientWs.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (_) {
          // Ignore malformed text packets
        }
      }
    });

    clientWs.on('close', () => {
      this.cleanupSession(session);
      this.sessions.delete(clientWs);
      if (this.activeSessionsByCallId.get(callId) === session) {
        this.activeSessionsByCallId.delete(callId);
      }
    });

    clientWs.on('error', (err) => {
      console.warn('[LiveTranscriptionService] Client WebSocket error:', err.message);
      this.cleanupSession(session);
      this.sessions.delete(clientWs);
      if (this.activeSessionsByCallId.get(callId) === session) {
        this.activeSessionsByCallId.delete(callId);
      }
    });
  }

  private cleanupSession(session: ClientSession): void {
    if (session.geminiWs) {
      if (session.geminiWs.readyState === WebSocket.OPEN || session.geminiWs.readyState === WebSocket.CONNECTING) {
        try {
          session.geminiWs.close(1000, 'Session ended by client');
        } catch (_) {}
      }
      session.geminiWs = null;
    }
    session.pendingAudioChunks = [];
    session.isSetupComplete = false;
  }
}

export const liveTranscriptionService = new LiveTranscriptionService();
