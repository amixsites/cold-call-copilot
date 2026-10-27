import http from 'http';
import WebSocket from 'ws';
import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.NODE_ENV = 'test';

const { app } = await import('../src/index.js');
const { liveTranscriptionService } = await import('../src/services/liveTranscriptionService.js');

async function runLiveWsTests() {
  console.log('=== Testing Gemini Live Streaming WebSocket Endpoint ===');
  
  const testServer = http.createServer(app);
  liveTranscriptionService.initialize(testServer);

  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = testServer.address() as any;
  const port = address.port;
  console.log(`Test server listening on port ${port}`);

  let testPassed = false;

  try {
    const wsUrl = `ws://127.0.0.1:${port}/api/calls/test-call-live-101/transcription/live`;
    console.log(`Connecting test client to: ${wsUrl}`);

    const clientWs = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout waiting for WebSocket events'));
      }, 15000);

      const receivedMessages: any[] = [];

      clientWs.on('open', () => {
        console.log('✓ Connected to test server WebSocket successfully!');
      });

      clientWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          console.log('Received WebSocket message:', msg);
          receivedMessages.push(msg);

          if (msg.type === 'status' && msg.status === 'listening') {
            console.log('✓ Gemini Live session reached LISTENING state!');
            
            // Send binary PCM chunk (16kHz 16-bit mono = 3200 bytes)
            const dummyPcm = Buffer.alloc(3200);
            clientWs.send(dummyPcm);
            console.log('✓ Successfully sent binary 16-bit PCM audio chunk to WebSocket!');

            setTimeout(() => {
              testPassed = true;
              clientWs.close();
              clearTimeout(timeout);
              resolve();
            }, 1000);
          }
        } catch (e: any) {
          console.error('Error parsing client message:', e);
        }
      });

      clientWs.on('error', (err) => {
        console.error('Client WS error:', err);
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log('=== Live Transcription WebSocket Test PASSED! ===');
  } finally {
    testServer.close();
  }
}

runLiveWsTests().catch((err) => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
