process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import http from 'node:http';
const { app } = await import('../server/src/index.js');
import { STAGES_CONFIG } from '../src/data/stageDefinitions.js';

console.log('=== Cold Call Copilot — Phase 3 Database Persistence & Workflow Tests ===\n');

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

// HTTP Helper using native http module with bearer authorization
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
          Authorization: 'Bearer test-token-phase3',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
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

async function runPhase3Tests() {
  // Launch ephemeral server on port 0
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as any).port;

  let createdCallId = '';
  const testProspectId = '11111111-1111-4111-8111-111111111111';

  try {
    // 0. Setup: Create a real test prospect with valid UUID
    await makeRequest(port, {
      method: 'POST',
      path: '/api/prospects',
      body: {
        id: testProspectId,
        companyName: 'Apex Precision Engineering',
        contactName: 'Rajesh Sharma',
        status: 'New',
      },
    });

    // 1. A new call is created successfully
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          prospectId: testProspectId,
          contactName: 'Rajesh Sharma',
          companyName: 'Apex Precision Engineering',
          callObjective: 'Identify machining downtime',
        },
      });
      assert.strictEqual(res.status, 201, 'Should return status 201 Created');
      assert.ok(res.body.success, 'Response success should be true');
      const call = res.body.data;
      assert.ok(call, 'Response should contain data payload');
      assert.strictEqual(call.activeStage, 1, 'Initial activeStage must be 1');
      assert.strictEqual(call.furthestStageReached, 1, 'Initial furthestStageReached must be 1');
      assert.strictEqual(call.status, 'In Progress', 'Initial status should be In Progress');
      createdCallId = call.id;
      reportPass('1. A new call is created successfully');
    } catch (err: any) {
      reportFail('1. A new call is created successfully', err);
    }

    // 2. The call receives a real database ID
    totalTests++;
    try {
      assert.ok(createdCallId, 'Call ID must exist');
      assert.strictEqual(typeof createdCallId, 'string', 'Call ID must be string');
      // ID should be a UUID or valid call key format
      const isUuidOrCallId = /^[0-9a-fA-F-]{36}$/.test(createdCallId) || /^call_/.test(createdCallId);
      assert.ok(isUuidOrCallId, `Call ID (${createdCallId}) must be valid UUID or format`);
      reportPass('2. The call receives a real database ID');
    } catch (err: any) {
      reportFail('2. The call receives a real database ID', err);
    }

    // 3. The call can be retrieved after creation
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(res.status, 200, 'Should return 200 OK');
      assert.strictEqual(res.body.data.id, createdCallId, 'Retrieved call ID must match');
      assert.strictEqual(res.body.data.prospectId, testProspectId, 'Prospect ID must match');
      reportPass('3. The call can be retrieved after creation');
    } catch (err: any) {
      reportFail('3. The call can be retrieved after creation', err);
    }

    // 4. Updating the active stage saves the correct value
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          activeStage: 2,
          furthestStageReached: 2,
        },
      });
      assert.strictEqual(res.status, 200, 'Should return 200 OK');
      assert.strictEqual(res.body.data.activeStage, 2, 'activeStage should be 2');
      assert.strictEqual(res.body.data.furthestStageReached, 2, 'furthestStageReached should be 2');
      reportPass('4. Updating the active stage saves the correct value');
    } catch (err: any) {
      reportFail('4. Updating the active stage saves the correct value', err);
    }

    // 5. The furthest stage reached is maintained correctly
    totalTests++;
    try {
      // Advance to stage 5
      await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          activeStage: 5,
          furthestStageReached: 5,
        },
      });

      // Now navigate backward to stage 3. furthestStageReached should stay 5!
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          activeStage: 3,
          furthestStageReached: 5, // Preserved
        },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.activeStage, 3, 'activeStage should be 3');
      assert.strictEqual(res.body.data.furthestStageReached, 5, 'furthestStageReached must remain 5');
      reportPass('5. The furthest stage reached is maintained correctly');
    } catch (err: any) {
      reportFail('5. The furthest stage reached is maintained correctly', err);
    }

    // 6. Quote text is saved and restored
    totalTests++;
    try {
      const quoteText = 'Our main bottleneck is CNC spindle runout on the night shift; parts get scrapped before inspection.';
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          prospectWords: quoteText,
        },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.prospectWords, quoteText, 'Prospect words should be saved verbatim');

      // Verify retrieval
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(getRes.body.data.prospectWords, quoteText, 'Prospect words must be restored on GET');
      reportPass('6. Quote text is saved and restored');
    } catch (err: any) {
      reportFail('6. Quote text is saved and restored', err);
    }

    // 7. Quote status is saved and restored
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          quoteStatus: 'need_stated',
        },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.quoteStatus, 'need_stated', 'Quote status should be need_stated');

      // Verify invalid quote status is rejected
      const invalidRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          quoteStatus: 'non_existent_status',
        },
      });
      assert.strictEqual(invalidRes.status, 400, 'Invalid quote status must return 400 Bad Request');
      reportPass('7. Quote status is saved and restored');
    } catch (err: any) {
      reportFail('7. Quote status is saved and restored', err);
    }

    // 8. Stage notes are saved and restored
    totalTests++;
    try {
      const notesDict = {
        1: 'Gatekeeper transferred to Sanjay Mehta directly.',
        2: 'Clarified focus on CNC tooling scrap rates in Plant 2.',
        5: 'Stated runout causes 3 hours downtime per weekly batch.',
      };
      const res = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          stageNotes: notesDict,
        },
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body.data.stageNotes, notesDict, 'Stage notes dictionary must be preserved');

      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.deepStrictEqual(getRes.body.data.stageNotes, notesDict, 'Stage notes dictionary must be restored on GET');
      reportPass('8. Stage notes are saved and restored');
    } catch (err: any) {
      reportFail('8. Stage notes are saved and restored', err);
    }

    // 9. An action tap is persisted
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${createdCallId}/events`,
        body: {
          stageNumber: 2,
          eventType: 'purpose_understood',
          eventData: { label: 'Purpose understood' },
        },
      });
      assert.strictEqual(res.status, 201, 'Should return 201 Created');
      assert.ok(res.body.data, 'Should return event in data payload');
      assert.strictEqual(res.body.data.stageNumber, 2, 'Stage number should be 2');
      assert.strictEqual(res.body.data.eventType, 'purpose_understood', 'Event type should be purpose_understood');
      reportPass('9. An action tap is persisted');
    } catch (err: any) {
      reportFail('9. An action tap is persisted', err);
    }

    // 10. Saved action taps are restored when the call is reopened
    totalTests++;
    try {
      const res = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/events`,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data), 'Events should be an array in data');
      const found = res.body.data.find((e: any) => e.eventType === 'purpose_understood' && e.stageNumber === 2);
      assert.ok(found, 'Recorded stage event must be returned in events list');
      reportPass('10. Saved action taps are restored when the call is reopened');
    } catch (err: any) {
      reportFail('10. Saved action taps are restored when the call is reopened', err);
    }

    // 11. Retrying an event write does not create accidental duplicates
    totalTests++;
    try {
      // Re-posting the exact same event
      const res = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${createdCallId}/events`,
        body: {
          stageNumber: 2,
          eventType: 'purpose_understood',
        },
      });
      // Should succeed gracefully (200 or 201) and deduplicate
      assert.ok([200, 201].includes(res.status), 'Retry should be handled cleanly');
      
      const listRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/events`,
      });
      const matching = listRes.body.data.filter(
        (e: any) => e.stageNumber === 2 && e.eventType === 'purpose_understood'
      );
      assert.strictEqual(matching.length, 1, 'Should NOT create duplicate event records for the same key');
      reportPass('11. Retrying an event write does not create accidental duplicates');
    } catch (err: any) {
      reportFail('11. Retrying an event write does not create accidental duplicates', err);
    }

    // 12. Deselecting an action behaves consistently with the chosen persistence model
    totalTests++;
    try {
      const delRes = await makeRequest(port, {
        method: 'DELETE',
        path: `/api/calls/${createdCallId}/events?stageNumber=2&eventType=purpose_understood`,
      });
      assert.strictEqual(delRes.status, 200, 'DELETE should return 200 OK');

      const listRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}/events`,
      });
      const found = listRes.body.data.find(
        (e: any) => e.stageNumber === 2 && e.eventType === 'purpose_understood'
      );
      assert.strictEqual(found, undefined, 'Event should be removed after deletion');
      reportPass('12. Deselecting an action behaves consistently with the chosen persistence model');
    } catch (err: any) {
      reportFail('12. Deselecting an action behaves consistently with the chosen persistence model', err);
    }

    // 13. A call ending at Stage 2 saves ending_stage = 2
    totalTests++;
    let earlyCallId = '';
    try {
      // Create a fresh call to test early termination at Stage 2
      const newCall = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          prospectId: testProspectId,
          contactName: 'Anil Kulkarni',
          companyName: 'Kulkarni Toolcraft',
        },
      });
      earlyCallId = newCall.body.data.id;

      // Move to Stage 2
      await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${earlyCallId}`,
        body: {
          activeStage: 2,
          furthestStageReached: 2,
        },
      });

      // End the call at Stage 2 with ending reason
      const endRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${earlyCallId}`,
        body: {
          activeStage: 2,
          endingStage: 2,
          endingReason: 'not_interested',
          outcome: 'Lost',
          status: 'Completed',
        },
      });
      assert.strictEqual(endRes.status, 200);
      assert.strictEqual(endRes.body.data.endingStage, 2, 'endingStage must be 2');
      assert.strictEqual(endRes.body.data.status, 'Completed', 'status should be Completed');
      reportPass('13. A call ending at Stage 2 saves ending_stage = 2');
    } catch (err: any) {
      reportFail('13. A call ending at Stage 2 saves ending_stage = 2', err);
    }

    // 14. Early termination does not automatically advance the furthest stage to Stage 8
    totalTests++;
    try {
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${earlyCallId}`,
      });
      assert.strictEqual(getRes.body.data.endingStage, 2, 'endingStage should remain 2');
      assert.strictEqual(getRes.body.data.furthestStageReached, 2, 'furthestStageReached must NEVER be auto-advanced to 8');
      assert.notStrictEqual(getRes.body.data.furthestStageReached, 8, 'Furthest stage must NOT be 8');
      reportPass('14. Early termination does not automatically advance the furthest stage to Stage 8');
    } catch (err: any) {
      reportFail('14. Early termination does not automatically advance the furthest stage to Stage 8', err);
    }

    // 15. Ending reason and outcome remain distinct
    totalTests++;
    try {
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${earlyCallId}`,
      });
      assert.strictEqual(getRes.body.data.endingReason, 'not_interested', 'Ending reason should be not_interested');
      assert.strictEqual(getRes.body.data.outcome, 'Lost', 'Outcome should be Lost');
      assert.notStrictEqual(getRes.body.data.endingReason, getRes.body.data.outcome, 'endingReason and outcome must be distinct fields');
      reportPass('15. Ending reason and outcome remain distinct');
    } catch (err: any) {
      reportFail('15. Ending reason and outcome remain distinct', err);
    }

    // 16. A failed End Call request does not discard the current draft
    totalTests++;
    try {
      // Try sending invalid ending reason
      const failRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${earlyCallId}`,
        body: {
          endingReason: 'completely_invalid_reason_string',
        },
      });
      assert.strictEqual(failRes.status, 400, 'Server should reject invalid ending reason with 400');

      // Verify the previous state is completely preserved
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${earlyCallId}`,
      });
      assert.strictEqual(getRes.body.data.endingReason, 'not_interested', 'Original ending reason preserved');
      reportPass('16. A failed End Call request does not discard the current draft');
    } catch (err: any) {
      reportFail('16. A failed End Call request does not discard the current draft', err);
    }

    // 17. Retrying a failed ending operation does not create a duplicate call
    totalTests++;
    try {
      // Retry with valid payload on the existing call ID
      const retryRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${earlyCallId}`,
        body: {
          endingReason: 'busy_callback',
          outcome: 'Connected - Follow-up Needed',
        },
      });
      assert.strictEqual(retryRes.status, 200, 'Retry should succeed with 200');
      assert.strictEqual(retryRes.body.data.id, earlyCallId, 'Must update the exact same call ID');
      assert.strictEqual(retryRes.body.data.endingReason, 'busy_callback');
      reportPass('17. Retrying a failed ending operation does not create a duplicate call');
    } catch (err: any) {
      reportFail('17. Retrying a failed ending operation does not create a duplicate call', err);
    }

    // 18. An existing call can be reopened after refresh
    totalTests++;
    try {
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.data.id, createdCallId);
      assert.strictEqual(getRes.body.data.activeStage, 3);
      assert.strictEqual(getRes.body.data.furthestStageReached, 5);
      assert.ok(getRes.body.data.prospectWords.includes('CNC spindle runout'));
      assert.strictEqual(getRes.body.data.quoteStatus, 'need_stated');
      assert.ok(getRes.body.data.stageNotes[1]);
      reportPass('18. An existing call can be reopened after refresh');
    } catch (err: any) {
      reportFail('18. An existing call can be reopened after refresh', err);
    }

    // 19. A failed save displays an error instead of false success
    totalTests++;
    try {
      const badStageRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          activeStage: 9, // Invalid stage (> 8)
        },
      });
      assert.strictEqual(badStageRes.status, 400, 'activeStage > 8 should return 400 Bad Request');
      assert.strictEqual(badStageRes.body.success, false, 'Should return success: false');
      reportPass('19. A failed save displays an error instead of false success');
    } catch (err: any) {
      reportFail('19. A failed save displays an error instead of false success', err);
    }

    // 20. Navigation between stages preserves all previously entered data
    totalTests++;
    try {
      // Step to Stage 4
      await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${createdCallId}`,
        body: {
          activeStage: 4,
          furthestStageReached: 5,
        },
      });

      // Verify Stage 1 and 2 notes and quotes remain untouched
      const res = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${createdCallId}`,
      });
      assert.strictEqual(res.body.data.activeStage, 4);
      assert.strictEqual(res.body.data.furthestStageReached, 5);
      assert.ok(res.body.data.prospectWords.includes('CNC spindle runout'));
      assert.strictEqual(res.body.data.stageNotes[1], 'Gatekeeper transferred to Sanjay Mehta directly.');
      assert.strictEqual(res.body.data.stageNotes[2], 'Clarified focus on CNC tooling scrap rates in Plant 2.');
      reportPass('20. Navigation between stages preserves all previously entered data');
    } catch (err: any) {
      reportFail('20. Navigation between stages preserves all previously entered data', err);
    }

    // 21. Existing prospects and follow-ups still work
    totalTests++;
    try {
      const prospectsRes = await makeRequest(port, {
        method: 'GET',
        path: '/api/prospects',
      });
      assert.strictEqual(prospectsRes.status, 200, 'GET /api/prospects should return 200');
      assert.ok(Array.isArray(prospectsRes.body.data), 'prospects should be an array');
      assert.ok(prospectsRes.body.data.length > 0, 'prospects list should not be empty');

      const followupsRes = await makeRequest(port, {
        method: 'GET',
        path: '/api/followups',
      });
      assert.strictEqual(followupsRes.status, 200, 'GET /api/followups should return 200');
      assert.ok(Array.isArray(followupsRes.body.data), 'followUps should be an array');
      reportPass('21. Existing prospects and follow-ups still work');
    } catch (err: any) {
      reportFail('21. Existing prospects and follow-ups still work', err);
    }

    // 22. Existing Phase 2 stage navigation and objection taxonomy continue to hold
    totalTests++;
    try {
      assert.strictEqual(STAGES_CONFIG.length, 8, 'Must have exactly 8 stages');
      const stage6 = STAGES_CONFIG.find(s => s.stageNumber === 6);
      assert.ok(stage6, 'Stage 6 (Objection) must exist');
      assert.strictEqual(stage6.actionTaps.length, 9, 'Stage 6 must implement the 9-category objection taxonomy');
      const expectedCategories = [
        'timing_or_capacity',
        'existing_internal_process',
        'existing_provider_or_alternative',
        'wrong_contact_or_authority',
        'poor_fit_or_scope',
        'commercial_intent_unclear',
        'explicit_not_interested',
        'do_not_contact_requested',
        'other_or_unclear',
      ];
      expectedCategories.forEach((cat) => {
        assert.ok(stage6.actionTaps.some(tap => tap.id === cat), `Stage 6 must include objection category: ${cat}`);
      });
      reportPass('22. Existing Phase 2 stage navigation and objection taxonomy tests continue to pass');
    } catch (err: any) {
      reportFail('22. Existing Phase 2 stage navigation and objection taxonomy tests continue to pass', err);
    }

  } finally {
    server.close();
  }

  console.log(`\n=== Phase 3 Test Results: ${passedTests} of ${totalTests} PASSED ===\n`);
  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
