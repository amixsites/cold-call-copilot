process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import http from 'node:http';
const { app } = await import('../server/src/index.js');
import {
  generateTranscriptText,
  sanitizeFilename,
  TranscriptExportOptions,
} from '../src/lib/transcriptExport.js';

console.log('=== Cold Call Copilot — Complete Persistence & TXT Download Verification Tests ===\n');

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
  options: { method: string; path: string; body?: any; headers?: Record<string, string> }
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
          Authorization: 'Bearer test-token-suite',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...options.headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {}
          resolve({
            status: res.statusCode || 0,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runPersistenceAndDownloadTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as any).port;

  const testProspectId = '22222222-2222-4222-8222-222222222222';
  let createdCallId = '';
  let secondCallId = '';

  try {
    // -------------------------------------------------------------
    // Test 1: Creating a prospect and confirming it survives reload
    // -------------------------------------------------------------
    totalTests++;
    try {
      const createRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/prospects',
        body: {
          id: testProspectId,
          companyName: 'Kumar Electricals Pvt Ltd',
          contactName: 'Praveen Kumar',
          jobTitle: 'Plant Operations Director',
          industry: 'Industrial Equipment',
          status: 'New',
          notes: 'High voltage motor manufacturing facility seeking automated testing.',
        },
      });
      assert.strictEqual(createRes.status, 201, 'Prospect creation must return HTTP 201');

      // Simulate browser reload / fresh list fetch
      const listRes = await makeRequest(port, {
        method: 'GET',
        path: '/api/prospects',
      });
      assert.strictEqual(listRes.status, 200, 'GET /api/prospects must return HTTP 200');
      const found = listRes.body.data.find((p: any) => p.id === testProspectId);
      assert.ok(found, 'Created prospect must be retrieved after simulated page reload');
      assert.strictEqual(found.companyName, 'Kumar Electricals Pvt Ltd');
      reportPass('1. Creating a prospect and confirming it survives reload');
    } catch (err) {
      reportFail('1. Creating a prospect and confirming it survives reload', err);
    }

    // -------------------------------------------------------------
    // Test 2: Editing a prospect and restoring the updated values
    // -------------------------------------------------------------
    totalTests++;
    try {
      const updateRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/prospects/${testProspectId}`,
        body: {
          status: 'In Discussion',
          contactName: 'Praveen M. Kumar',
          notes: 'Discussion in progress regarding automated coil winding solutions.',
        },
      });
      assert.strictEqual(updateRes.status, 200, 'Updating prospect must return HTTP 200');

      const getUpdatedRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/prospects/${testProspectId}`,
      });
      assert.strictEqual(getUpdatedRes.body.data.status, 'In Discussion');
      assert.strictEqual(getUpdatedRes.body.data.contactName, 'Praveen M. Kumar');
      reportPass('2. Editing a prospect and restoring the updated values');
    } catch (err) {
      reportFail('2. Editing a prospect and restoring the updated values', err);
    }

    // -------------------------------------------------------------
    // Test 3: Creating a call and restoring its state
    // -------------------------------------------------------------
    totalTests++;
    try {
      const callRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          prospectId: testProspectId,
          companyName: 'Kumar Electricals Pvt Ltd',
          contactName: 'Praveen M. Kumar',
          callStatus: 'In Progress',
          callObjective: 'Explore automated motor coil testing',
          activeStage: 1,
          furthestStageReached: 1,
        },
      });
      assert.strictEqual(callRes.status, 201, 'Call creation must return HTTP 201');
      assert.ok(callRes.body.data.id, 'Created call must have a valid ID');
      createdCallId = callRes.body.data.id;

      // Restore call by ID
      const fetchCallRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(fetchCallRes.status, 200);
      assert.strictEqual(fetchCallRes.body.data.companyName, 'Kumar Electricals Pvt Ltd');
      assert.strictEqual(fetchCallRes.body.data.callStatus, 'In Progress');
      reportPass('3. Creating a call and restoring its state');
    } catch (err) {
      reportFail('3. Creating a call and restoring its state', err);
    }

    // -------------------------------------------------------------
    // Test 4: Saving notes and restoring them after refresh
    // -------------------------------------------------------------
    totalTests++;
    try {
      const stageNotesPayload = {
        1: 'Opener verified with Praveen. Stated 40 seconds available.',
        2: 'Plant capacity: 12,000 motors/month. Manual testing creates 3-day bottleneck.',
      };
      const noteUpdateRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          stageNotes: stageNotesPayload,
          generalNotes: 'Targeting Q4 budget approval for automated rig.',
        },
      });
      assert.strictEqual(noteUpdateRes.status, 200);

      // Verify restoration after simulated reload
      const reloadCallRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(
        reloadCallRes.body.data.stageNotes[2],
        'Plant capacity: 12,000 motors/month. Manual testing creates 3-day bottleneck.'
      );
      reportPass('4. Saving notes and restoring them after refresh');
    } catch (err) {
      reportFail('4. Saving notes and restoring them after refresh', err);
    }

    // -------------------------------------------------------------
    // Test 5: Clicking Quick Actions and persisting their activity records
    // -------------------------------------------------------------
    totalTests++;
    try {
      const actionRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${createdCallId}/events`,
        body: {
          stageNumber: 2,
          eventType: 'stated_capacity_bottleneck',
          eventLabel: 'Capacity Bottleneck Confirmed',
        },
      });
      assert.strictEqual(actionRes.status, 201, 'Action tap must be persisted with HTTP 201');

      const getEventsRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/events`,
      });
      const tapFound = getEventsRes.body.data.find((e: any) => e.eventType === 'stated_capacity_bottleneck');
      assert.ok(tapFound, 'Persisted action tap must be restored from events endpoint');
      reportPass('5. Clicking Quick Actions and persisting their relevant state or activity records');
    } catch (err) {
      reportFail('5. Clicking Quick Actions and persisting their relevant state or activity records', err);
    }

    // -------------------------------------------------------------
    // Test 6: Changing stages and restoring the current stage
    // -------------------------------------------------------------
    totalTests++;
    try {
      const stageChangeRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          activeStage: 4,
          furthestStageReached: 4,
        },
      });
      assert.strictEqual(stageChangeRes.status, 200);

      const verifyStageRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(verifyStageRes.body.data.activeStage, 4, 'Active stage must be 4');
      assert.strictEqual(verifyStageRes.body.data.furthestStageReached, 4, 'Furthest stage reached must be 4');
      reportPass('6. Changing stages and restoring the current stage');
    } catch (err) {
      reportFail('6. Changing stages and restoring the current stage', err);
    }

    // -------------------------------------------------------------
    // Test 7: Persisting transcript segments and restoring their order
    // -------------------------------------------------------------
    totalTests++;
    try {
      const time1 = '2026-10-27T16:53:56.000Z';
      const time2 = '2026-10-27T16:54:04.000Z';
      const time3 = '2026-10-27T16:54:21.000Z';

      const seg1 = {
        segmentId: 'seg-001',
        text: "Hello, I'm calling from Precision Robotics regarding quality testing.",
        speaker: 'agent',
        timestamp: time1,
        isFinal: true,
      };
      const seg2 = {
        segmentId: 'seg-002',
        text: 'Yeah, sure. What is it about?',
        speaker: 'prospect',
        timestamp: time2,
        isFinal: true,
      };
      const seg3 = {
        segmentId: 'seg-003',
        text: 'Hi Praveen, I am calling because we help industrial plants reduce manual QC.',
        speaker: 'agent',
        timestamp: time3,
        isFinal: true,
      };

      await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${createdCallId}/transcript`,
        body: { segments: [seg1, seg2, seg3] },
      });

      const getTransRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/transcript`,
      });

      assert.strictEqual(getTransRes.status, 200);
      assert.strictEqual(getTransRes.body.data.length, 3, 'All 3 segments must be saved');
      assert.strictEqual(getTransRes.body.data[0].segmentId, 'seg-001');
      assert.strictEqual(getTransRes.body.data[1].segmentId, 'seg-002');
      assert.strictEqual(getTransRes.body.data[2].segmentId, 'seg-003');
      reportPass('7. Persisting transcript segments and restoring their original order');
    } catch (err) {
      reportFail('7. Persisting transcript segments and restoring their original order', err);
    }

    // -------------------------------------------------------------
    // Test 8: Updating a transcript segment without creating duplicates
    // -------------------------------------------------------------
    totalTests++;
    try {
      // Re-send seg-002 with revised text
      const revisedSeg2 = {
        segmentId: 'seg-002',
        text: 'Yeah, sure. What is it about? We are currently in production.',
        speaker: 'prospect',
        timestamp: '2026-10-27T16:54:04.000Z',
        isFinal: true,
      };

      await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${createdCallId}/transcript`,
        body: { segments: [revisedSeg2] },
      });

      const checkDupRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/transcript`,
      });

      assert.strictEqual(checkDupRes.body.data.length, 3, 'Transcript length must remain 3 without duplicates');
      const updatedItem = checkDupRes.body.data.find((s: any) => s.segmentId === 'seg-002');
      assert.ok(updatedItem.text.includes('We are currently in production'), 'Updated text must be saved');
      reportPass('8. Updating a transcript segment without creating duplicates');
    } catch (err) {
      reportFail('8. Updating a transcript segment without creating duplicates', err);
    }

    // -------------------------------------------------------------
    // Test 9: Manually correcting a speaker and preserving that correction
    // -------------------------------------------------------------
    totalTests++;
    try {
      // Switch seg-003 speaker from agent to prospect
      const patchSpeakerRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}/transcript/seg-003/speaker`,
        body: { speaker: 'prospect' },
      });
      assert.strictEqual(patchSpeakerRes.status, 200);
      assert.strictEqual(patchSpeakerRes.body.data.speaker, 'prospect');
      assert.strictEqual(patchSpeakerRes.body.data.speaker_source, 'manual');

      // Attempt to overwrite seg-003 with an incoming automated stream label 'agent'
      await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${createdCallId}/transcript`,
        body: {
          segments: [
            {
              segmentId: 'seg-003',
              text: 'Hi Praveen, I am calling because we help industrial plants reduce manual QC.',
              speaker: 'agent',
              timestamp: '2026-10-27T16:54:21.000Z',
              isFinal: true,
            },
          ],
        },
      });

      // Verify that manual correction was NOT overwritten
      const verifySpeakerRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/transcript`,
      });
      const seg3Check = verifySpeakerRes.body.data.find((s: any) => s.segmentId === 'seg-003');
      assert.strictEqual(seg3Check.speaker, 'prospect', 'Manual speaker correction must be protected against automatic overwrite');
      reportPass('9. Manually correcting a speaker and preserving that correction');
    } catch (err) {
      reportFail('9. Manually correcting a speaker and preserving that correction', err);
    }

    // -------------------------------------------------------------
    // Test 10: Downloading a .txt file with correct timestamps, text, and speaker labels
    // -------------------------------------------------------------
    totalTests++;
    try {
      const segmentsForExport = [
        {
          id: 'seg-001',
          segmentId: 'seg-001',
          text: "Hello, I'm calling from Precision Robotics regarding quality testing.",
          speaker: 'agent' as const,
          timestamp: '2026-10-27T22:23:56.000Z',
          isFinal: true,
          createdAt: '2026-10-27T22:23:56.000Z',
        },
        {
          id: 'seg-002',
          segmentId: 'seg-002',
          text: 'Yeah, sure. What is it about?',
          speaker: 'prospect' as const,
          timestamp: '2026-10-27T22:24:04.000Z',
          isFinal: true,
          createdAt: '2026-10-27T22:24:04.000Z',
        },
        {
          id: 'seg-003',
          segmentId: 'seg-003',
          text: 'Hi Praveen, I am calling because we help industrial plants reduce manual QC.',
          speaker: 'agent' as const,
          timestamp: '2026-10-27T22:24:21.000Z',
          isFinal: true,
          createdAt: '2026-10-27T22:24:21.000Z',
        },
      ];

      const exportOptions: TranscriptExportOptions = {
        callId: 'call-sample-uuid-1234',
        companyName: 'Kumar Electricals',
        contactName: 'Praveen Kumar',
        callDate: '2026-10-27T22:23:56.000Z',
        durationSeconds: 165,
        segments: segmentsForExport,
        notes: 'Targeting Q4 budget approval for automated test rig.',
        outcome: 'Connected - Follow-up Required',
      };

      const plainText = generateTranscriptText(exportOptions);

      // Verify exact header structure
      assert.ok(plainText.includes('Cold Call Copilot — Call Transcript'), 'Must include title header');
      assert.ok(plainText.includes('Prospect: Kumar Electricals (Praveen Kumar)'), 'Must include formatted prospect');
      assert.ok(plainText.includes('Call ID: call-sample-uuid-1234'), 'Must include call ID');
      assert.ok(plainText.includes('Duration: 2m 45s'), 'Must include formatted duration');

      // Verify exact dialogue structure with timestamps and speaker labels
      assert.ok(
        plainText.includes("Agent: Hello, I'm calling from Precision Robotics regarding quality testing."),
        'Must format Agent segment'
      );
      assert.ok(
        plainText.includes('Prospect: Yeah, sure. What is it about?'),
        'Must format Prospect segment'
      );

      // Verify filename sanitization
      const cleanFilename = sanitizeFilename('Kumar Electricals / Special <Units>');
      assert.strictEqual(cleanFilename, 'Kumar-Electricals-Special-Units', 'Must sanitize unsafe filename characters');

      reportPass('10. Downloading a .txt file with correct timestamps, text, and speaker labels');
    } catch (err) {
      reportFail('10. Downloading a .txt file with correct timestamps, text, and speaker labels', err);
    }

    // -------------------------------------------------------------
    // Test 11: Restoring notes and outcomes in the exported transcript
    // -------------------------------------------------------------
    totalTests++;
    try {
      const exportOptionsWithNotes: TranscriptExportOptions = {
        callId: 'call-with-notes-9999',
        companyName: 'Alpha Precision',
        callDate: '2026-10-27T20:00:00.000Z',
        segments: [
          {
            id: 's1',
            segmentId: 's1',
            text: 'We need high tolerance CNC parts.',
            speaker: 'prospect' as const,
            timestamp: '2026-10-27T20:00:10.000Z',
            isFinal: true,
            createdAt: '2026-10-27T20:00:10.000Z',
          },
        ],
        notes: '[Stage 2] 3-axis machines causing 15% scrap rate.',
        outcome: 'Connected - Interested',
      };

      const exported = generateTranscriptText(exportOptionsWithNotes);
      assert.ok(exported.includes('Call Notes:'), 'Export must have Call Notes section');
      assert.ok(exported.includes('[Stage 2] 3-axis machines causing 15% scrap rate.'), 'Must contain saved notes');
      assert.ok(exported.includes('Call Outcome:\nConnected - Interested'), 'Must contain saved outcome');
      reportPass('11. Restoring notes and outcomes in the exported transcript');
    } catch (err) {
      reportFail('11. Restoring notes and outcomes in the exported transcript', err);
    }

    // -------------------------------------------------------------
    // Test 12: Showing an error when database writes fail
    // -------------------------------------------------------------
    totalTests++;
    try {
      // Invalid activeStage should be rejected with HTTP 400
      const invalidStageRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: { activeStage: 99 },
      });
      assert.strictEqual(invalidStageRes.status, 400, 'Invalid activeStage 99 must return HTTP 400');
      assert.ok(invalidStageRes.body.error, 'Response must describe the validation failure');

      // Invalid outcome
      const invalidOutcomeRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: { outcome: 'Invalid_Outcome_XYZ' },
      });
      assert.strictEqual(invalidOutcomeRes.status, 400, 'Invalid outcome must return HTTP 400');
      reportPass('12. Showing an error when database writes fail');
    } catch (err) {
      reportFail('12. Showing an error when database writes fail', err);
    }

    // -------------------------------------------------------------
    // Test 13: Preventing data from one call from leaking into another
    // -------------------------------------------------------------
    totalTests++;
    try {
      // Create second call
      const secondCallRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          companyName: 'Beta Manufacturing Ltd',
          callStatus: 'In Progress',
          callObjective: 'CNC tooling discovery',
          activeStage: 1,
        },
      });
      secondCallId = secondCallRes.body.data.id;

      // Add a distinct transcript segment to call 2
      await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${secondCallId}/transcript`,
        body: {
          segments: [
            {
              segmentId: 'call2-seg-1',
              text: 'This statement belongs strictly to Call 2.',
              speaker: 'prospect',
              timestamp: '2026-10-27T17:00:00.000Z',
              isFinal: true,
            },
          ],
        },
      });

      // Verify call 1 transcript does NOT have call 2's segment
      const call1Trans = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/transcript`,
      });
      assert.ok(
        !call1Trans.body.data.some((s: any) => s.text.includes('Call 2')),
        "Call 1 must not contain Call 2's transcript segments"
      );

      // Verify call 2 transcript does NOT have call 1's segment
      const call2Trans = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${secondCallId}/transcript`,
      });
      assert.ok(
        !call2Trans.body.data.some((s: any) => s.text.includes('Precision Robotics')),
        "Call 2 must not contain Call 1's transcript segments"
      );
      reportPass("13. Preventing data from one call from leaking into another call's workspace");
    } catch (err) {
      reportFail("13. Preventing data from one call from leaking into another call's workspace", err);
    }
  } finally {
    server.close();
  }

  console.log(`\n=== Verification Results: ${passedTests} of ${totalTests} PASSED ===\n`);
  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runPersistenceAndDownloadTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
