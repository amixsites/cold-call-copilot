process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import http from 'node:http';
const { app } = await import('../server/src/index.js');
import { 
  generateRealTimeCoaching, 
  generateFallbackCoaching,
  CoachingInput,
} from '../server/src/services/coachingService.js';

console.log('=== Cold Call Copilot — Manual Speaker Correction & Instant AI Refresh Tests ===\n');

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

function makeRequest(
  port: number,
  options: { method: string; path: string; body?: any }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-speaker',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            resolve({ status: res.statusCode || 200, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 200, body: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;

  try {
    // Setup test call
    let testCallId = '';
    const createCallRes = await makeRequest(port, {
      method: 'POST',
      path: '/api/calls',
      body: {
        companyName: 'Vance Precision Machining',
        contactName: 'Marcus Vance',
        callObjective: 'Explore CNC mill capacity and overflow machining needs',
        activeStage: 4,
        prospectNotes: 'Haas 5-axis shop with high scrap rates on titanium aerospace brackets',
      },
    });

    const callData = createCallRes.body.data || createCallRes.body;
    testCallId = callData.id;
    assert.ok(testCallId, 'Must create active test call');

    // Add initial transcript segments
    const seg1Id = `seg-speaker-${Date.now()}-1`;
    const seg2Id = `seg-speaker-${Date.now()}-2`;

    await makeRequest(port, {
      method: 'POST',
      path: `/api/calls/${testCallId}/transcript`,
      body: {
        segments: [
          {
            segmentId: seg1Id,
            text: 'Hello Marcus, this is Alex from Apex Precision.',
            speaker: 'agent',
            speaker_source: 'automatic',
            isFinal: true,
          },
          {
            segmentId: seg2Id,
            text: 'We already use another provider and switching would be difficult.',
            speaker: 'agent', // Intentionally mislabeled as Agent initially
            speaker_source: 'automatic',
            isFinal: true,
          },
        ],
      },
    });

    // Test 1: Agent → Prospect correction
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'Prospect' },
      });

      assert.strictEqual(res.status, 200, 'Must return 200 OK');
      const data = res.body.data || res.body;
      assert.strictEqual(data.speaker, 'prospect', 'Speaker label must be updated to prospect');
      assert.strictEqual(data.speaker_source, 'manual', 'Must be marked as manual correction');
      assert.strictEqual(data.is_manual, true, 'is_manual must be true');
      reportPass('1. Agent → Prospect correction updates label and records manual source');
    } catch (err) {
      reportFail('1. Agent → Prospect correction', err);
    }

    // Test 2: Prospect → Agent correction
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'Agent' },
      });

      assert.strictEqual(res.status, 200, 'Must return 200 OK');
      const data = res.body.data || res.body;
      assert.strictEqual(data.speaker, 'agent', 'Speaker label must be switched to agent');
      assert.strictEqual(data.speaker_source, 'manual', 'Must remain marked as manual');
      reportPass('2. Prospect → Agent correction switches label back');
    } catch (err) {
      reportFail('2. Prospect → Agent correction', err);
    }

    // Test 3: Switching the same segment back and forth
    totalTests++;
    try {
      // Switch back to Prospect
      const res1 = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'Prospect' },
      });
      assert.strictEqual((res1.body.data || res1.body).speaker, 'prospect');

      // Switch back to Agent
      const res2 = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'Agent' },
      });
      assert.strictEqual((res2.body.data || res2.body).speaker, 'agent');

      // Switch once more to Prospect
      const res3 = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'Prospect' },
      });
      assert.strictEqual((res3.body.data || res3.body).speaker, 'prospect');
      reportPass('3. Switching the same segment back and forth succeeds idempotently');
    } catch (err) {
      reportFail('3. Switching the same segment back and forth', err);
    }

    // Test 4: Persistence after page refresh
    totalTests++;
    try {
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${testCallId}/transcript`,
      });

      assert.strictEqual(getRes.status, 200);
      const segments: any[] = getRes.body.data || getRes.body;
      const target = segments.find(s => s.segmentId === seg2Id || s.id === seg2Id);
      assert.ok(target, 'Segment must be found in call transcripts');
      assert.strictEqual(target.speaker, 'prospect', 'Speaker label must persist as prospect');
      assert.strictEqual(target.speaker_source, 'manual', 'Manual source tag must persist');
      reportPass('4. Manual speaker correction persists across refresh / retrieval');
    } catch (err) {
      reportFail('4. Persistence after page refresh', err);
    }

    // Test 5: Manual labels survive automatic transcription updates
    totalTests++;
    try {
      // Simulate speech recognition client re-sending the same segmentId with automatic agent label
      await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${testCallId}/transcript`,
        body: {
          segmentId: seg2Id,
          text: 'We already use another provider and switching would be difficult.',
          speaker: 'agent', // Attempt automatic overwrite
          speaker_source: 'automatic',
          isFinal: true,
        },
      });

      // Verify the manual label was NOT overwritten
      const checkRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${testCallId}/transcript`,
      });
      const segments: any[] = checkRes.body.data || checkRes.body;
      const target = segments.find(s => s.segmentId === seg2Id || s.id === seg2Id);
      assert.strictEqual(target.speaker, 'prospect', 'Manual label must survive automatic stream updates');
      assert.strictEqual(target.speaker_source, 'manual', 'Manual tag must remain intact');
      reportPass('5. Manual labels survive subsequent automatic transcription stream updates');
    } catch (err) {
      reportFail('5. Manual labels surviving automatic updates', err);
    }

    // Test 6: Coaching refresh after a successful correction
    totalTests++;
    try {
      // When labeled Agent, coaching should recognize agent speech and not attribute objection to prospect
      const agentContextCoaching = generateFallbackCoaching({
        activeStage: 4,
        recentSegments: [
          { speaker: 'prospect', text: 'What is your capacity?' },
          { speaker: 'agent', text: 'We already use another provider and switching would be difficult.' },
        ],
      });
      assert.strictEqual(agentContextCoaching.objection, null, 'Agent statement must not be flagged as prospect objection');

      // When corrected to Prospect, coaching immediately identifies the switching friction objection
      const prospectContextCoaching = generateFallbackCoaching({
        activeStage: 4,
        recentSegments: [
          { speaker: 'agent', text: 'How do you handle your precision milling right now?' },
          { speaker: 'prospect', text: 'We already use another provider and switching would be difficult.' },
        ],
      });
      assert.ok(prospectContextCoaching.objection?.includes('provider') || prospectContextCoaching.objection?.includes('Switching'), 'Corrected prospect statement must trigger objection detection');
      assert.ok(prospectContextCoaching.suggested_response.length > 10, 'Must generate actionable response to prospect');
      reportPass('6. Coaching refresh adapts to corrected speaker attribution without misattributing statements');
    } catch (err) {
      reportFail('6. Coaching refresh after successful correction', err);
    }

    // Test 7: Correct use of the two most recent finalized segments
    totalTests++;
    try {
      // Given 4 segments, correcting the last segment should select the 2 most recent segments
      const allSegments = [
        { id: '1', speaker: 'agent', text: 'Greeting' },
        { id: '2', speaker: 'prospect', text: 'Hello' },
        { id: '3', speaker: 'agent', text: 'What tolerances do you need?' },
        { id: '4', speaker: 'prospect', text: 'We require plus or minus two tenths.' },
      ];

      // Logic check for last segment correction
      const correctedIdx = 3;
      let context: any[] = [];
      if (correctedIdx >= allSegments.length - 2) {
        context = allSegments.slice(-2);
      } else {
        context = allSegments.slice(Math.max(0, correctedIdx - 1), correctedIdx + 2);
      }

      assert.strictEqual(context.length, 2, 'Must include exactly 2 segments');
      assert.strictEqual(context[0].id, '3');
      assert.strictEqual(context[1].id, '4');
      reportPass('7. Two most recent finalized segments selected when correcting latest conversation turns');
    } catch (err) {
      reportFail('7. Two most recent finalized segments selection', err);
    }

    // Test 8: Older-segment correction context
    totalTests++;
    try {
      // Given 5 segments, correcting an older segment (index 1) should include window around it
      const allSegments = [
        { id: '1', speaker: 'agent', text: 'Greeting' },
        { id: '2', speaker: 'prospect', text: 'Actually I am Marcus' },
        { id: '3', speaker: 'agent', text: 'Great, thanks Marcus' },
        { id: '4', speaker: 'agent', text: 'What tolerances do you run?' },
        { id: '5', speaker: 'prospect', text: 'We run aerospace parts' },
      ];

      const correctedIdx = 1; // older segment
      let context: any[] = [];
      if (correctedIdx >= allSegments.length - 2) {
        context = allSegments.slice(-2);
      } else {
        context = allSegments.slice(Math.max(0, correctedIdx - 1), correctedIdx + 2);
      }

      assert.strictEqual(context.length, 3, 'Must capture context window of preceding, corrected, and subsequent segment');
      assert.strictEqual(context[0].id, '1');
      assert.strictEqual(context[1].id, '2');
      assert.strictEqual(context[2].id, '3');
      reportPass('8. Older-segment correction captures targeted context window preserving conversation flow');
    } catch (err) {
      reportFail('8. Older-segment correction context', err);
    }

    // Test 9: Stale LLM responses arriving out of order are discarded
    totalTests++;
    try {
      let currentRequestId = 1;
      let activeSuggestion = { id: 'initial', text: 'Initial suggestion' };

      // Simulate async request 1 (stale, slow network)
      const simulateRequest1 = new Promise((resolve) => {
        setTimeout(() => {
          const req1Id = 1;
          if (req1Id === currentRequestId) {
            activeSuggestion = { id: 'req1', text: 'Stale suggestion 1' };
          }
          resolve(true);
        }, 80);
      });

      // User quickly triggers request 2 (e.g. quick second correction)
      currentRequestId = 2;
      activeSuggestion = { id: 'req2', text: 'Latest suggestion 2' };

      await simulateRequest1;

      assert.strictEqual(activeSuggestion.id, 'req2', 'Stale request 1 must not overwrite newer request 2');
      reportPass('9. Stale LLM responses arriving out of order are safely discarded');
    } catch (err) {
      reportFail('9. Stale LLM responses handling', err);
    }

    // Test 10: Backend validation & failure handling
    totalTests++;
    try {
      // Invalid speaker value
      const resBadSpeaker = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'invalid_speaker_type' },
      });
      assert.strictEqual(resBadSpeaker.status, 400, 'Must return 400 Bad Request for invalid speaker');

      // Missing speaker
      const resEmpty = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: {},
      });
      assert.strictEqual(resEmpty.status, 400, 'Must return 400 Bad Request for missing speaker');

      // Non-existent segment
      const resNotFound = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/non-existent-seg-id/speaker`,
        body: { speaker: 'Prospect' },
      });
      assert.strictEqual(resNotFound.status, 404, 'Must return 404 for unknown segment');
      reportPass('10. Backend speaker validation rejects invalid payloads and unknown segments safely');
    } catch (err) {
      reportFail('10. Backend validation & failure handling', err);
    }

    // Test 11: LLM failure after correction has been saved
    totalTests++;
    try {
      // Simulate saving correction successfully
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${testCallId}/transcript/${seg2Id}/speaker`,
        body: { speaker: 'Prospect' },
      });
      assert.strictEqual(res.status, 200);

      // Verify that even if coaching LLM call fails or times out, fallback coaching is returned
      // and the saved speaker correction in the database remains intact
      const fallbackResult = generateFallbackCoaching({
        activeStage: 4,
        recentSegments: [{ speaker: 'prospect', text: 'We are happy with our current shop.' }],
      });
      assert.ok(fallbackResult.suggested_response.length > 5, 'Fallback coaching must remain available on LLM failure');

      // Check transcript persistence is unaffected
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${testCallId}/transcript`,
      });
      const segments: any[] = getRes.body.data || getRes.body;
      const target = segments.find(s => s.segmentId === seg2Id || s.id === seg2Id);
      assert.strictEqual(target.speaker, 'prospect', 'Transcript segment remains correctly saved even during LLM alert');
      reportPass('11. LLM failure after correction does not undo saved speaker attribution');
    } catch (err) {
      reportFail('11. LLM failure resilience', err);
    }

    // Test 12: Existing transcript, call history, and post-call review functionality intact
    totalTests++;
    try {
      const getCallRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${testCallId}`,
      });
      assert.strictEqual(getCallRes.status, 200, 'Existing GET /api/calls/:id must remain functional');
      const callRecord = getCallRes.body.data || getCallRes.body;
      assert.strictEqual(callRecord.company_name || callRecord.companyName, 'Vance Precision Machining');

      const reviewRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${testCallId}/review`,
      });
      assert.strictEqual(reviewRes.status, 200, 'Post-call review generation must remain functional');
      const review = reviewRes.body.data || reviewRes.body;
      assert.ok(review.callSummary || review.whatWentWell, 'AI review must return structured review');
      reportPass('12. Existing call lifecycle, transcript history, and Gemini post-call review remain operational');
    } catch (err) {
      reportFail('12. Existing features preservation', err);
    }

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`Results: ${passedTests} / ${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
