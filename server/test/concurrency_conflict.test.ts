import http from 'http';
import WebSocket from 'ws';
import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.NODE_ENV = 'test';

const { app } = await import('../src/index.js');
const { liveTranscriptionService } = await import('../src/services/liveTranscriptionService.js');

async function testConcurrencyHandling() {
  console.log('=== Testing Session Concurrency & Collision Protection ===');

  const testServer = http.createServer(app);
  liveTranscriptionService.initialize(testServer);

  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = testServer.address() as any;
  const port = address.port;
  console.log(`Test server running on port ${port}`);

  try {
    const callId = 'test-concurrent-call-999';
    const wsUrl = `ws://127.0.0.1:${port}/api/calls/${callId}/transcription/live`;

    // 1. Establish first connection
    console.log('[Test] Establishing Connection 1...');
    const ws1 = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection 1 timeout')), 10000);
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status' && msg.status === 'listening') {
          console.log('✓ Connection 1 active and LISTENING');
          clearTimeout(timer);
          resolve();
        }
      });
      ws1.on('error', reject);
    });

    // 2. Immediately establish second connection for the SAME callId without manually closing Connection 1
    console.log('[Test] Establishing Connection 2 for SAME callId (simulating rapid reconnect / re-click)...');
    const ws2 = new WebSocket(wsUrl);

    let ws1Closed = false;
    ws1.on('close', (code, reason) => {
      console.log(`✓ Connection 1 received clean close event: code=${code}, reason="${reason}"`);
      ws1Closed = true;
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection 2 timeout')), 10000);
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status' && msg.status === 'listening') {
          console.log('✓ Connection 2 successfully established and LISTENING without 409 Conflict!');
          clearTimeout(timer);
          resolve();
        } else if (msg.type === 'error') {
          clearTimeout(timer);
          reject(new Error(`Connection 2 error: ${msg.message} (Category: ${msg.errorCategory})`));
        }
      });
      ws2.on('error', reject);
    });

    assert.strictEqual(ws1Closed, true, 'Previous connection must have been cleanly closed');

    // 3. Clean up Connection 2
    ws2.close();
    console.log('=== Concurrency & 409 Conflict Protection Test PASSED! ===');
  } finally {
    testServer.close();
  }
}

testConcurrencyHandling().catch((err) => {
  console.error('Concurrency Test FAILED:', err);
  process.exit(1);
});
