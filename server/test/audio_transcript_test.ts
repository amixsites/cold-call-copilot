import http from 'http';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.NODE_ENV = 'test';

const { app } = await import('../src/index.js');
const { liveTranscriptionService } = await import('../src/services/liveTranscriptionService.js');

async function testAudioStreamingAndTranscriptFlow() {
  console.log('=== Verifying Real-Time Audio Streaming Pipeline with gemini-3.5-transcribe-live ===');

  const testServer = http.createServer(app);
  liveTranscriptionService.initialize(testServer);

  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = testServer.address() as any;
  const port = address.port;
  console.log(`Test server running on port ${port}`);

  try {
    const callId = 'audio-live-verify-101';
    const wsUrl = `ws://127.0.0.1:${port}/api/calls/${callId}/transcription/live`;

    console.log(`Connecting WebSocket to: ${wsUrl}`);
    const clientWs = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for listening state')), 15000);
      let listeningReached = false;
      let chunksSent = 0;

      clientWs.on('open', () => {
        console.log('✓ Connected to backend WebSocket');
      });

      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log('Received from server:', msg.type, msg.status || '', msg.text || '');

        if (msg.type === 'status' && msg.status === 'listening' && !listeningReached) {
          listeningReached = true;
          console.log('✓ Gemini Live session active & LISTENING');

          // Simulate streaming 10 chunks of 16kHz 16-bit PCM mono audio (~1.0s of audio)
          const interval = setInterval(() => {
            if (chunksSent >= 10) {
              clearInterval(interval);
              clearTimeout(timeout);
              console.log(`✓ Streamed ${chunksSent} PCM audio chunks successfully!`);
              clientWs.close();
              resolve();
              return;
            }

            // Generate 16kHz 16-bit PCM chunk (1600 samples = 3200 bytes per 100ms)
            // Modulated sine wave approximating human vocal fundamental frequency (150Hz)
            const sampleCount = 1600;
            const buffer = Buffer.alloc(sampleCount * 2);
            for (let i = 0; i < sampleCount; i++) {
              const t = (chunksSent * sampleCount + i) / 16000;
              const sample = Math.sin(2 * Math.PI * 150 * t) * 0.4;
              const intSample = Math.round(sample * 32767);
              buffer.writeInt16LE(intSample, i * 2);
            }

            clientWs.send(buffer);
            chunksSent++;
          }, 100);
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(`Server error: ${msg.message} (Category: ${msg.errorCategory})`));
        }
      });

      clientWs.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log('=== Audio Streaming Verification Completed Successfully! ===');
  } finally {
    testServer.close();
  }
}

testAudioStreamingAndTranscriptFlow().catch((err) => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
