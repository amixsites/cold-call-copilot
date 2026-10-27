import assert from 'node:assert';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = { OPEN: 1, CONNECTING: 0, CLOSING: 2, CLOSED: 3 };
}

import { GeminiLiveAudioClient } from '../src/lib/geminiLiveAudio.js';
import { LiveTranscriptSegment } from '../src/types/index.js';

console.log('=== Speaker Label Alternation & Pause Detection Heuristic Tests ===\n');

let passedTests = 0;
let totalTests = 0;

function reportPass(name: string) {
  passedTests++;
  console.log(`✓ PASS: ${name}`);
}

function reportFail(name: string, err: any) {
  console.error(`✗ FAIL: ${name}`);
  console.error(`   ${err.message || err}`);
}

async function runTests() {
  // Test 1: First finalized transcript segment must be labeled Agent by default
  totalTests++;
  try {
    const emittedSegments: LiveTranscriptSegment[] = [];
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: (seg) => emittedSegments.push(seg),
      onStatusChange: () => {},
      onError: () => {},
    });

    // Emulate server message handler
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-test-1',
      text: 'Hello, is this Marcus Vance at Apex?',
    });

    assert.strictEqual(emittedSegments.length, 1);
    assert.strictEqual(emittedSegments[0].speaker, 'agent', 'Initial finalized segment must default to Agent');
    assert.strictEqual(emittedSegments[0].text, 'Hello, is this Marcus Vance at Apex?');
    reportPass('1. Initial finalized segment defaults to Agent');
  } catch (err) {
    reportFail('1. Initial finalized segment defaults to Agent', err);
  }

  // Test 2: If no qualifying pause occurs, subsequent segment retains Agent
  totalTests++;
  try {
    const emittedSegments: LiveTranscriptSegment[] = [];
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: (seg) => emittedSegments.push(seg),
      onStatusChange: () => {},
      onError: () => {},
      pauseThresholdSeconds: 1.5,
    });

    // 1st segment: Agent
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-1',
      text: 'Hello, is this Marcus?',
    });

    // 2nd segment arrives without any qualifying pause
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-2',
      text: 'I am following up regarding your machine shop inquiries.',
    });

    assert.strictEqual(emittedSegments.length, 2);
    assert.strictEqual(emittedSegments[0].speaker, 'agent');
    assert.strictEqual(emittedSegments[1].speaker, 'agent', 'Without qualifying pause, speaker remains Agent');
    reportPass('2. Consecutive speech without qualifying pause retains same speaker');
  } catch (err) {
    reportFail('2. Consecutive speech without qualifying pause retains same speaker', err);
  }

  // Test 3: Audio pause >= threshold marks speaker change pending and switches to Prospect
  totalTests++;
  try {
    const emittedSegments: LiveTranscriptSegment[] = [];
    let pendingReported = false;

    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: (seg) => emittedSegments.push(seg),
      onStatusChange: () => {},
      onError: () => {},
      onSpeakerChangePending: (pending) => { pendingReported = pending; },
      pauseThresholdSeconds: 1.5,
    });

    // Set dummy running and mock ws to allow processAudioFrame
    (client as any).isRunning = true;
    (client as any).ws = { readyState: 1, send: () => {} }; // 1 = OPEN

    // 1st segment (Agent speaks)
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-1',
      text: 'Hello, is this Marcus?',
    });
    assert.strictEqual(emittedSegments[0].speaker, 'agent');

    // Simulate speech audio frame (RMS > 0.012)
    // 1600 samples at amplitude 0.1 -> RMS 0.1
    const speechSamples = new Float32Array(1600).fill(0.1);
    (client as any).processAudioFrame(speechSamples);
    assert.strictEqual((client as any).speechDetectedInCurrentTurn, true, 'Speech detected in turn');

    // Simulate silence audio frames (RMS 0.00)
    // Each 1600 samples frame at 16000Hz = 0.1 seconds
    const silenceSamples = new Float32Array(1600).fill(0.0);

    // Feed 10 frames = 1.0s of silence (less than 1.5s threshold)
    for (let i = 0; i < 10; i++) {
      (client as any).processAudioFrame(silenceSamples);
    }
    assert.strictEqual(client.isSpeakerSwitchPending(), false, 'Pause < 1.5s must NOT trigger speaker switch');

    // Feed 6 more frames = 0.6s of silence (total 1.6s > 1.5s threshold)
    for (let i = 0; i < 6; i++) {
      (client as any).processAudioFrame(silenceSamples);
    }
    assert.strictEqual(client.isSpeakerSwitchPending(), true, 'Pause >= 1.5s MUST set speaker switch pending');
    assert.strictEqual(pendingReported, true, 'onSpeakerChangePending callback fired with true');

    // Prospect speaks and final segment arrives
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-2',
      text: 'Yes, this is Marcus. What can I do for you?',
    });

    assert.strictEqual(emittedSegments.length, 2);
    assert.strictEqual(emittedSegments[1].speaker, 'prospect', 'Subsequent segment after qualifying pause is labeled Prospect');
    assert.strictEqual(client.isSpeakerSwitchPending(), false, 'Pending switch is cleared once consumed');
    reportPass('3. Audio pause >= 1.5s triggers alternation from Agent to Prospect');
  } catch (err) {
    reportFail('3. Audio pause >= 1.5s triggers alternation from Agent to Prospect', err);
  }

  // Test 4: Prolonged silence does NOT repeatedly toggle speaker switches
  totalTests++;
  try {
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: () => {},
      onStatusChange: () => {},
      onError: () => {},
      pauseThresholdSeconds: 1.5,
    });
    (client as any).isRunning = true;
    (client as any).ws = { readyState: 1, send: () => {} };

    // Mark speech occurred
    const speechSamples = new Float32Array(1600).fill(0.15);
    (client as any).processAudioFrame(speechSamples);

    // Stream 60 frames = 6.0 seconds of continuous silence
    const silenceSamples = new Float32Array(1600).fill(0.0);
    for (let i = 0; i < 60; i++) {
      (client as any).processAudioFrame(silenceSamples);
    }

    // Switch pending should be true, but currentSpeaker should NOT have flipped 4 times
    assert.strictEqual(client.isSpeakerSwitchPending(), true, 'Switch pending exactly once');
    assert.strictEqual((client as any).currentSpeaker, 'agent', 'Current speaker remains Agent until segment consumed');
    reportPass('4. Repeated/prolonged silence interval avoids repeated triggers');
  } catch (err) {
    reportFail('4. Repeated/prolonged silence interval avoids repeated triggers', err);
  }

  // Test 5: Full 3-turn alternation (Agent -> Prospect -> Agent)
  totalTests++;
  try {
    const emittedSegments: LiveTranscriptSegment[] = [];
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: (seg) => emittedSegments.push(seg),
      onStatusChange: () => {},
      onError: () => {},
      pauseThresholdSeconds: 1.5,
    });
    (client as any).isRunning = true;
    (client as any).ws = { readyState: 1, send: () => {} };

    const speech = new Float32Array(1600).fill(0.12);
    const silence = new Float32Array(1600).fill(0.0);

    // Turn 1: Agent speaks
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-1',
      text: 'Hello, is this Marcus?',
    });

    // Agent finishes, 1.6s pause occurs
    (client as any).processAudioFrame(speech);
    for (let i = 0; i < 16; i++) (client as any).processAudioFrame(silence);

    // Turn 2: Prospect speaks
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-2',
      text: 'Yes, speaking.',
    });

    // Prospect finishes, 1.8s pause occurs
    (client as any).processAudioFrame(speech);
    for (let i = 0; i < 18; i++) (client as any).processAudioFrame(silence);

    // Turn 3: Agent speaks again
    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-3',
      text: 'Great, I am calling from Apex Solutions.',
    });

    assert.strictEqual(emittedSegments.length, 3);
    assert.strictEqual(emittedSegments[0].speaker, 'agent', 'Turn 1 is Agent');
    assert.strictEqual(emittedSegments[1].speaker, 'prospect', 'Turn 2 is Prospect');
    assert.strictEqual(emittedSegments[2].speaker, 'agent', 'Turn 3 is Agent');

    // Verify previously finalized segments were not mutated
    assert.strictEqual(emittedSegments[0].speaker, 'agent');
    assert.strictEqual(emittedSegments[1].speaker, 'prospect');
    reportPass('5. Full multi-turn conversation alternates Agent -> Prospect -> Agent without relabeling earlier segments');
  } catch (err) {
    reportFail('5. Full multi-turn conversation alternates Agent -> Prospect -> Agent', err);
  }

  // Test 6: Configurable pause threshold (1 to 5 seconds)
  totalTests++;
  try {
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: () => {},
      onStatusChange: () => {},
      onError: () => {},
      pauseThresholdSeconds: 2.0,
    });
    assert.strictEqual(client.getPauseThreshold(), 2.0);

    client.setPauseThreshold(3.5);
    assert.strictEqual(client.getPauseThreshold(), 3.5);

    // Clamping checks
    client.setPauseThreshold(0.2); // below min
    assert.strictEqual(client.getPauseThreshold(), 1.0, 'Clamps below 1.0s to 1.0s');

    client.setPauseThreshold(9.9); // above max
    assert.strictEqual(client.getPauseThreshold(), 5.0, 'Clamps above 5.0s to 5.0s');

    reportPass('6. Configurable pause threshold (1-5s, default 1.5s, bounds enforced)');
  } catch (err) {
    reportFail('6. Configurable pause threshold', err);
  }

  // Test 7: Empty transcription does not create a segment
  totalTests++;
  try {
    const emittedSegments: LiveTranscriptSegment[] = [];
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: (seg) => emittedSegments.push(seg),
      onStatusChange: () => {},
      onError: () => {},
    });

    (client as any).handleServerMessage({
      type: 'final',
      segmentId: 'seg-empty',
      text: '   ',
    });

    assert.strictEqual(emittedSegments.length, 0, 'Empty or whitespace-only transcript must not emit segment');
    reportPass('7. Empty or whitespace-only transcription does not create a segment');
  } catch (err) {
    reportFail('7. Empty or whitespace-only transcription does not create a segment', err);
  }

  // Test 8: Cleanup on stop/destroy resets heuristic state
  totalTests++;
  try {
    const client = new GeminiLiveAudioClient({
      onInterimText: () => {},
      onFinalSegment: () => {},
      onStatusChange: () => {},
      onError: () => {},
    });
    (client as any).speakerSwitchPending = true;
    (client as any).speechDetectedInCurrentTurn = true;
    (client as any).consecutiveSilenceAudioSeconds = 4.0;
    (client as any).hasEmittedFirstSegment = true;
    (client as any).currentSpeaker = 'prospect';

    client.stop();

    assert.strictEqual(client.isSpeakerSwitchPending(), false, 'switchPending reset to false');
    assert.strictEqual((client as any).speechDetectedInCurrentTurn, false, 'speechDetected reset');
    assert.strictEqual((client as any).consecutiveSilenceAudioSeconds, 0, 'silence duration reset');
    assert.strictEqual((client as any).hasEmittedFirstSegment, false, 'first segment flag reset');
    assert.strictEqual(client.getCurrentSpeaker(), 'agent', 'speaker reset to agent');
    reportPass('8. Stopping / cleaning up resets audio pause detector and speaker heuristic');
  } catch (err) {
    reportFail('8. Stopping / cleaning up resets audio pause detector', err);
  }

  console.log(`\n=== Heuristic Test Results: ${passedTests} of ${totalTests} PASSED ===\n`);
  assert.strictEqual(passedTests, totalTests, 'All speaker heuristic tests must pass');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
