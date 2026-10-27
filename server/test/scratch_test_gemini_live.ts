import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GEMINI_API_KEY;

async function testAudioStreaming() {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('Connected! Sending setup for gemini-3.5-transcribe-live...');
    const setupMsg = {
      setup: {
        model: 'models/gemini-3.5-transcribe-live',
        generationConfig: {
          responseModalities: ["TEXT"]
        },
        inputAudioTranscription: {
          languageCodes: ["en-US"]
        }
      }
    };
    ws.send(JSON.stringify(setupMsg));
  });

  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    console.log('Received frame:', JSON.stringify(parsed, null, 2).substring(0, 500));

    if (parsed.setupComplete) {
      console.log('Setup complete! Sending 1 second of dummy PCM audio...');
      // 16000 samples/sec, 16-bit = 32000 bytes/sec
      // Send 5 chunks of 3200 bytes (100ms each)
      for (let i = 0; i < 5; i++) {
        const pcmBuffer = Buffer.alloc(3200); // 100ms of silence/dummy audio
        const audioMsg = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: pcmBuffer.toString('base64')
              }
            ]
          }
        };
        ws.send(JSON.stringify(audioMsg));
      }
      console.log('Sent 5 audio chunks (500ms total)');
      setTimeout(() => {
        console.log('Closing test socket cleanly...');
        ws.close(1000, 'Test finished');
      }, 3000);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: code ${code}, reason: ${reason?.toString()}`);
    process.exit(0);
  });
}

testAudioStreaming().catch(console.error);
