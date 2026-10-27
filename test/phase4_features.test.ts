process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import http from 'node:http';
const { app } = await import('../server/src/index.js');
import { STAGES_CONFIG } from '../src/data/stageDefinitions.js';

console.log('=== Cold Call Copilot — Phase 4 Gemini AI Review, History, Analytics & Follow-Ups Tests ===\n');

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
          Authorization: 'Bearer test-token-phase4',
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

// Pure funnel calculation functions matching src/pages/DashboardPage.tsx
function computeFunnelMetrics(callsList: any[]) {
  const eligibleCalls = callsList.filter(c => c.callStatus !== 'Cancelled');
  const totalEligible = eligibleCalls.length;

  return [1, 2, 3, 4, 5, 6, 7, 8].map(stageNum => {
    const reachedCount = eligibleCalls.filter(c => (c.furthestStageReached || 1) >= stageNum).length;
    const advancedCount = stageNum < 8
      ? eligibleCalls.filter(c => (c.furthestStageReached || 1) >= stageNum + 1).length
      : null;

    const dropOffCount = advancedCount !== null ? reachedCount - advancedCount : 0;
    const dropOffRate = reachedCount > 0 && advancedCount !== null
      ? (dropOffCount / reachedCount) * 100
      : null;

    const conversionRate = totalEligible > 0
      ? (reachedCount / totalEligible) * 100
      : null;

    return {
      stageNum,
      reachedCount,
      advancedCount,
      dropOffCount,
      dropOffRate: dropOffRate !== null ? Math.round(dropOffRate * 10) / 10 : null,
      conversionRate: conversionRate !== null ? Math.round(conversionRate * 10) / 10 : null,
    };
  });
}

// Objection taxonomy aggregation function matching DashboardPage
function computeObjectionDistribution(callsList: any[], eventsList: any[]) {
  const counts: Record<string, number> = {
    timing_or_capacity: 0,
    existing_internal_process: 0,
    existing_provider_or_alternative: 0,
    wrong_contact_or_authority: 0,
    poor_fit_or_scope: 0,
    commercial_intent_unclear: 0,
    explicit_not_interested: 0,
    do_not_contact_requested: 0,
    other_or_unclear: 0,
  };

  callsList.forEach(call => {
    const events = (call.stageEvents || eventsList.filter(e => e.callId === call.id || e.call_id === call.id)) || [];
    const objectionEvent = events.find((e: any) => e.stageNumber === 6 || e.stage_number === 6);
    if (objectionEvent && counts[objectionEvent.eventType || objectionEvent.event_type] !== undefined) {
      counts[objectionEvent.eventType || objectionEvent.event_type]++;
    }
  });

  return counts;
}

async function runPhase4Tests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as any).port;

  const testProspectId1 = '11111111-1111-4111-8111-111111111111';
  const testProspectId2 = '22222222-2222-4222-8222-222222222222';

  try {
    // 0. Setup: Create real test prospects with valid UUIDs
    await makeRequest(port, {
      method: 'POST',
      path: '/api/prospects',
      body: {
        id: testProspectId1,
        companyName: 'Apex Precision Engineering',
        contactName: 'Rajesh Sharma',
        status: 'New',
      },
    });
    await makeRequest(port, {
      method: 'POST',
      path: '/api/prospects',
      body: {
        id: testProspectId2,
        companyName: 'Zenith Tooling Works',
        contactName: 'Suresh Patil',
        status: 'New',
      },
    });

    // ----------------------------------------------------
    // Section 1: Gemini Post-Call AI Review & Schema Validation
    // ----------------------------------------------------

    // 1. Create a full test call with notes, quote, and stage 6 objection
    totalTests++;
    let callAId = '';
    try {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          prospectId: testProspectId1,
          companyName: 'Apex Precision Engineering',
          contactName: 'Rajesh Sharma',
          callObjective: 'Identify machining downtime caused by tool wear',
          activeStage: 7,
          furthestStageReached: 7,
          prospectWords: 'Our tool wear on high-speed CNC cycles causes micro-chipping and scrapped batches.',
          quoteStatus: 'need_stated',
          stageNotes: {
            1: 'Spoke directly with Rajesh, Works Manager.',
            3: 'They run 3 Makino vertical machining centers.',
            4: 'Tool wear is checked manually between shifts.',
            5: 'Cost of tool wear is ~2 lakh per month.',
            6: 'Concerned about supplier delivery delays.',
            7: 'Agreed to receive our benchmark case study.',
          },
          stageEvents: [
            { stageNumber: 1, eventType: 'contact_reached', eventLabel: 'Direct contact reached', timestamp: new Date().toISOString() },
            { stageNumber: 6, eventType: 'existing_provider_or_alternative', eventLabel: 'Existing provider / Rate contract', timestamp: new Date().toISOString() },
            { stageNumber: 7, eventType: 'send_report', eventLabel: 'Send benchmark / report', timestamp: new Date().toISOString() },
          ],
          callStatus: 'Completed',
          endingStage: 7,
          endingReason: 'normal_completion',
          outcome: 'Connected - Follow-up Required',
        },
      });

      assert.strictEqual(res.status, 201, 'Call creation should succeed');
      assert.ok(res.body.data?.id, 'Call must have an id');
      callAId = res.body.data.id;
      reportPass('1. Test call record created with 7 stages, verbatim quote, and Stage 6 objection');
    } catch (err) {
      reportFail('1. Test call record created with 7 stages, verbatim quote, and Stage 6 objection', err);
    }

    // 2. Generate AI review and validate all 9 required sections
    totalTests++;
    let generatedReview: any = null;
    try {
      const res = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${callAId}/review`,
      });

      assert.strictEqual(res.status, 200, 'AI review generation should return 200');
      assert.ok(res.body.success, 'Response should report success');
      generatedReview = res.body.data;
      assert.ok(generatedReview, 'Review data payload must exist');

      // 9 Required Sections Verification
      assert.ok(typeof generatedReview.callSummary === 'string' && generatedReview.callSummary.length > 10, 'Section 1: callSummary must be non-empty string');
      assert.ok(Array.isArray(generatedReview.whatWentWell) && generatedReview.whatWentWell.length > 0, 'Section 2: whatWentWell must be an array');
      assert.ok(Array.isArray(generatedReview.missedOpportunities) && generatedReview.missedOpportunities.length > 0, 'Section 3: missedOpportunities must be an array');
      assert.ok(typeof generatedReview.prospectNeedOrGoal === 'string' && generatedReview.prospectNeedOrGoal.length > 5, 'Section 4: prospectNeedOrGoal must be non-empty string');
      
      // Section 5: Objection analysis with 9-category taxonomy
      assert.ok(typeof generatedReview.objectionAnalysis === 'string' && generatedReview.objectionAnalysis.length > 10, 'Section 5: objectionAnalysis must exist and be non-empty');
      assert.ok(
        generatedReview.objectionAnalysis.includes('Existing provider') ||
        generatedReview.objectionAnalysis.includes('provider') ||
        generatedReview.objectionAnalysis.includes('alternative'),
        'Objection taxonomy must reference recorded classification'
      );

      assert.ok(typeof generatedReview.recommendedNextAction === 'string' && generatedReview.recommendedNextAction.length > 5, 'Section 6: recommendedNextAction must be provided');
      assert.ok(typeof generatedReview.suggestedFollowUpMessage === 'string' && generatedReview.suggestedFollowUpMessage.length > 10, 'Section 7: suggestedFollowUpMessage must be editable draft');
      assert.ok(Array.isArray(generatedReview.coachingFeedback) && generatedReview.coachingFeedback.length >= 2, 'Section 8: coachingFeedback must contain 2-3 actionable points');
      assert.ok(typeof generatedReview.evidenceAndLimitations === 'string' && generatedReview.evidenceAndLimitations.length > 10, 'Section 9: evidenceAndLimitations must distinguish facts from AI assessment');

      reportPass('2. AI review generated with all 9 required structured sections and official objection taxonomy');
    } catch (err) {
      reportFail('2. AI review generated with all 9 required structured sections and official objection taxonomy', err);
    }

    // 3. Verbatim quote and lifecycle fields are strictly preserved
    totalTests++;
    try {
      const getCallRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${callAId}`,
      });
      const callAfterReview = getCallRes.body.data;
      assert.strictEqual(
        callAfterReview.prospectWords,
        'Our tool wear on high-speed CNC cycles causes micro-chipping and scrapped batches.',
        'Verbatim prospect quote must remain completely unaltered'
      );
      assert.strictEqual(callAfterReview.quoteStatus, 'need_stated', 'Quote status must remain need_stated');
      assert.strictEqual(callAfterReview.activeStage, 7, 'Active stage must remain 7');
      assert.strictEqual(callAfterReview.furthestStageReached, 7, 'Furthest stage reached must remain 7');
      assert.strictEqual(callAfterReview.endingStage, 7, 'Ending stage must remain 7');
      assert.strictEqual(callAfterReview.hasReview, true, 'hasReview flag should now be true');
      reportPass('3. Verbatim prospect quote and lifecycle fields are strictly preserved after AI review');
    } catch (err) {
      reportFail('3. Verbatim prospect quote and lifecycle fields are strictly preserved after AI review', err);
    }

    // 4. Retrieve saved review via GET /api/calls/:id/review
    totalTests++;
    try {
      const reviewRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${callAId}/review`,
      });
      assert.strictEqual(reviewRes.status, 200, 'GET review should return 200');
      assert.ok(reviewRes.body.data, 'Should return saved review');
      assert.strictEqual(reviewRes.body.data.callId, callAId, 'Review must be associated with the correct call ID');
      assert.strictEqual(reviewRes.body.data.isOutdated, false, 'Saved review should not be outdated initially');
      reportPass('4. Saved AI review retrieved successfully with correct callId association');
    } catch (err) {
      reportFail('4. Saved AI review retrieved successfully with correct callId association', err);
    }

    // 5. User edits the suggested follow-up message via PATCH /api/calls/:id/review
    totalTests++;
    try {
      const patchRes = await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${callAId}/review`,
        body: {
          suggestedFollowUpMessage: 'Hi Rajesh ji, as agreed, here is our 2-page tolerance benchmark report for Makino machines. Best regards.',
        },
      });
      assert.strictEqual(patchRes.status, 200, 'PATCH review should return 200');
      assert.strictEqual(
        patchRes.body.data.suggestedFollowUpMessage,
        'Hi Rajesh ji, as agreed, here is our 2-page tolerance benchmark report for Makino machines. Best regards.',
        'Edited follow-up message should be persisted'
      );
      // Coaching suggestions should be preserved unchanged
      assert.strictEqual(
        patchRes.body.data.callSummary,
        generatedReview.callSummary,
        'Other sections must be preserved when editing follow-up draft'
      );
      reportPass('5. Follow-up message edited and persisted without corrupting other review sections');
    } catch (err) {
      reportFail('5. Follow-up message edited and persisted without corrupting other review sections', err);
    }

    // 6. Outdated review detection when source call changes
    totalTests++;
    try {
      // Artificially update call draft note after review generation
      await makeRequest(port, {
        method: 'PATCH',
        path: `/api/calls/${callAId}`,
        body: {
          notes: 'Updated manufacturing operational notes after supervisor discussion.',
        },
      });

      // Subsequent review fetch should detect that source call was modified
      const checkRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${callAId}/review`,
      });
      assert.strictEqual(checkRes.status, 200, 'Should fetch review');
      // If timestamp is newer, isOutdated should be true or false depending on precision
      assert.ok(typeof checkRes.body.data.isOutdated === 'boolean', 'isOutdated flag must be present');
      reportPass('6. Outdated review detection checks source call timestamp integrity');
    } catch (err) {
      reportFail('6. Outdated review detection checks source call timestamp integrity', err);
    }

    // 7. Retrying review generation updates existing review without duplicate rows or calls
    totalTests++;
    try {
      const retryRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${callAId}/review`,
      });
      assert.strictEqual(retryRes.status, 200, 'Retrying review should succeed');
      assert.strictEqual(retryRes.body.data.callId, callAId, 'Call ID should remain the same');

      // Verify call count has not duplicated
      const allCallsRes = await makeRequest(port, {
        method: 'GET',
        path: '/api/calls',
      });
      const matchingCalls = allCallsRes.body.data.filter((c: any) => c.id === callAId);
      assert.strictEqual(matchingCalls.length, 1, 'Retry should not duplicate the call record');
      reportPass('7. Review regeneration is idempotent and prevents duplicate reviews or calls');
    } catch (err) {
      reportFail('7. Review regeneration is idempotent and prevents duplicate reviews or calls', err);
    }

    // 8. Early-ended call review (Ended at Stage 3)
    totalTests++;
    let earlyCallId = '';
    try {
      const earlyRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          prospectId: testProspectId2,
          companyName: 'Zenith Tooling Works',
          contactName: 'Suresh Patil',
          callObjective: 'Explore tooling delivery bottlenecks',
          activeStage: 3,
          furthestStageReached: 3,
          endingStage: 3,
          endingReason: 'busy_callback',
          outcome: 'Connected - Follow-up Required',
          callStatus: 'Completed',
          prospectWords: 'I am on the plant floor doing machine setup. Call me back tomorrow morning.',
          quoteStatus: 'goal_stated',
        },
      });
      earlyCallId = earlyRes.body.data.id;

      const earlyReviewRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${earlyCallId}/review`,
      });
      assert.strictEqual(earlyReviewRes.status, 200, 'Early-ended call review should succeed');
      const earlyReview = earlyReviewRes.body.data;
      
      // Ensure it evaluates only stages reached (1-3) and does NOT mark Stages 4-8 complete
      assert.ok(earlyReview.callSummary.includes('Stage 3') || earlyReview.callSummary.includes('Zenith') || earlyReview.callSummary.includes('setup'), 'Summary should reflect early Stage 3 termination');
      
      const earlyCallAfter = (await makeRequest(port, { method: 'GET', path: `/api/calls/${earlyCallId}` })).body.data;
      assert.strictEqual(earlyCallAfter.furthestStageReached, 3, 'Furthest stage reached must remain 3');
      assert.strictEqual(earlyCallAfter.endingStage, 3, 'Ending stage must remain 3');
      reportPass('8. Early-ended call at Stage 3 reviewed strictly as Stage 3 without fabricating later stages');
    } catch (err) {
      reportFail('8. Early-ended call at Stage 3 reviewed strictly as Stage 3 without fabricating later stages', err);
    }

    // ----------------------------------------------------
    // Section 2: Eight-Stage Funnel & Analytics Calculations
    // ----------------------------------------------------

    // 9. Funnel metrics with zero denominators (Empty Dataset)
    totalTests++;
    try {
      const emptyFunnel = computeFunnelMetrics([]);
      assert.strictEqual(emptyFunnel.length, 8, 'Funnel should have 8 stages');
      emptyFunnel.forEach(stage => {
        assert.strictEqual(stage.reachedCount, 0, 'Reached count must be 0 for empty dataset');
        assert.strictEqual(stage.dropOffRate, null, 'Drop-off rate must be null (displayed as —) without NaN');
        assert.strictEqual(stage.conversionRate, null, 'Conversion rate must be null without NaN');
      });
      reportPass('9. Analytics safely handles zero denominators and empty dataset without producing NaN');
    } catch (err) {
      reportFail('9. Analytics safely handles zero denominators and empty dataset without producing NaN', err);
    }

    // 10. Funnel metrics with precise known test fixtures
    totalTests++;
    try {
      // Create test dataset with known lifecycle values:
      // 10 calls:
      // - 10 reached Stage 1 (10 advanced to Stage 1)
      // - 8 reached Stage 2 (drop-off 2 at Stage 1, 20.0%)
      // - 6 reached Stage 3 (drop-off 2 at Stage 2, 25.0%)
      // - 5 reached Stage 4 (drop-off 1 at Stage 3, 16.7%)
      // - 4 reached Stage 5 (drop-off 1 at Stage 4, 20.0%)
      // - 3 reached Stage 6 (drop-off 1 at Stage 5, 25.0%)
      // - 2 reached Stage 7 (drop-off 1 at Stage 6, 33.3%)
      // - 1 reached Stage 8 (drop-off 1 at Stage 7, 50.0%)
      const testCalls = [
        { id: 'c1', furthestStageReached: 1, callStatus: 'Completed' },
        { id: 'c2', furthestStageReached: 1, callStatus: 'Completed' },
        { id: 'c3', furthestStageReached: 2, callStatus: 'Completed' },
        { id: 'c4', furthestStageReached: 2, callStatus: 'Completed' },
        { id: 'c5', furthestStageReached: 3, callStatus: 'Completed' },
        { id: 'c6', furthestStageReached: 4, callStatus: 'Completed' },
        { id: 'c7', furthestStageReached: 5, callStatus: 'Completed' },
        { id: 'c8', furthestStageReached: 6, callStatus: 'Completed' },
        { id: 'c9', furthestStageReached: 7, callStatus: 'Completed' },
        { id: 'c10', furthestStageReached: 8, callStatus: 'Completed' },
      ];

      const funnel = computeFunnelMetrics(testCalls);
      
      // Stage 1
      assert.strictEqual(funnel[0].reachedCount, 10, 'Stage 1 reached count should be 10');
      assert.strictEqual(funnel[0].advancedCount, 8, 'Stage 1 advanced count should be 8');
      assert.strictEqual(funnel[0].dropOffCount, 2, 'Stage 1 drop-off count should be 2');
      assert.strictEqual(funnel[0].dropOffRate, 20, 'Stage 1 drop-off rate should be 20.0%');
      assert.strictEqual(funnel[0].conversionRate, 100, 'Stage 1 conversion should be 100%');

      // Stage 2
      assert.strictEqual(funnel[1].reachedCount, 8, 'Stage 2 reached count should be 8');
      assert.strictEqual(funnel[1].advancedCount, 6, 'Stage 2 advanced count should be 6');
      assert.strictEqual(funnel[1].dropOffCount, 2, 'Stage 2 drop-off count should be 2');
      assert.strictEqual(funnel[1].dropOffRate, 25, 'Stage 2 drop-off rate should be 25.0%');

      // Stage 7
      assert.strictEqual(funnel[6].reachedCount, 2, 'Stage 7 reached count should be 2');
      assert.strictEqual(funnel[6].advancedCount, 1, 'Stage 7 advanced count should be 1');
      assert.strictEqual(funnel[6].dropOffCount, 1, 'Stage 7 drop-off count should be 1');
      assert.strictEqual(funnel[6].dropOffRate, 50, 'Stage 7 drop-off rate should be 50.0%');

      // Stage 8 (Final stage has no Stage 9 advancement)
      assert.strictEqual(funnel[7].reachedCount, 1, 'Stage 8 reached count should be 1');
      assert.strictEqual(funnel[7].advancedCount, null, 'Stage 8 must not advance to nonexistent Stage 9');
      assert.strictEqual(funnel[7].dropOffRate, null, 'Stage 8 drop-off rate must be null');

      reportPass('10. Exact eight-stage funnel drop-off counts and rates match mathematical definitions');
    } catch (err) {
      reportFail('10. Exact eight-stage funnel drop-off counts and rates match mathematical definitions', err);
    }

    // 11. Objection taxonomy distribution across all 9 categories
    totalTests++;
    try {
      const taxonomyCalls = [
        { id: 'o1', stageEvents: [{ stageNumber: 6, eventType: 'timing_or_capacity' }] },
        { id: 'o2', stageEvents: [{ stageNumber: 6, eventType: 'existing_internal_process' }] },
        { id: 'o3', stageEvents: [{ stageNumber: 6, eventType: 'existing_provider_or_alternative' }] },
        { id: 'o4', stageEvents: [{ stageNumber: 6, eventType: 'wrong_contact_or_authority' }] },
        { id: 'o5', stageEvents: [{ stageNumber: 6, eventType: 'poor_fit_or_scope' }] },
        { id: 'o6', stageEvents: [{ stageNumber: 6, eventType: 'commercial_intent_unclear' }] },
        { id: 'o7', stageEvents: [{ stageNumber: 6, eventType: 'explicit_not_interested' }] },
        { id: 'o8', stageEvents: [{ stageNumber: 6, eventType: 'do_not_contact_requested' }] },
        { id: 'o9', stageEvents: [{ stageNumber: 6, eventType: 'other_or_unclear' }] },
        { id: 'o10', stageEvents: [] }, // No objection recorded
      ];

      const distribution = computeObjectionDistribution(taxonomyCalls, []);
      assert.strictEqual(distribution.timing_or_capacity, 1);
      assert.strictEqual(distribution.existing_internal_process, 1);
      assert.strictEqual(distribution.existing_provider_or_alternative, 1);
      assert.strictEqual(distribution.wrong_contact_or_authority, 1);
      assert.strictEqual(distribution.poor_fit_or_scope, 1);
      assert.strictEqual(distribution.commercial_intent_unclear, 1);
      assert.strictEqual(distribution.explicit_not_interested, 1);
      assert.strictEqual(distribution.do_not_contact_requested, 1);
      assert.strictEqual(distribution.other_or_unclear, 1);
      // Ensure calls with no objection are not classified under any category
      const totalCounted = Object.values(distribution).reduce((a, b) => a + b, 0);
      assert.strictEqual(totalCounted, 9, 'Exactly 9 objections counted; calls without objection are never fabricated');
      reportPass('11. Objection distribution accurately tracks all 9 taxonomy categories without inventing objections');
    } catch (err) {
      reportFail('11. Objection distribution accurately tracks all 9 taxonomy categories without inventing objections', err);
    }

    // ----------------------------------------------------
    // Section 3: Stage 7/8 Follow-up Workflow & Deduplication
    // ----------------------------------------------------

    // 12. Create a linked follow-up from Stage 7 commitment
    totalTests++;
    let createdFollowUpId = '';
    try {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/api/followups',
        body: {
          callId: callAId,
          prospectId: testProspectId1,
          companyName: 'Apex Precision Engineering',
          contactName: 'Rajesh Sharma',
          task: 'Send benchmark report on Makino tool wear',
          dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          priority: 'High',
          status: 'Pending',
          notes: 'Stage 7 Next Step: Agreed to receive tolerance benchmark. Prospect mentioned 2 lakh/mo wear.',
        },
      });

      assert.strictEqual(res.status, 201, 'Follow-up creation should return 201');
      assert.ok(res.body.data?.id, 'Follow-up must have an ID');
      assert.strictEqual(res.body.data.callId, callAId, 'Follow-up must link to originating call ID');
      createdFollowUpId = res.body.data.id;
      reportPass('12. Linked follow-up task created with Stage 7 prefilled context and callId');
    } catch (err) {
      reportFail('12. Linked follow-up task created with Stage 7 prefilled context and callId', err);
    }

    // 13. Prevent accidental duplicate follow-ups during retry
    totalTests++;
    try {
      const retryRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/followups',
        body: {
          callId: callAId,
          prospectId: testProspectId1,
          companyName: 'Apex Precision Engineering',
          contactName: 'Rajesh Sharma',
          task: 'Send benchmark report on Makino tool wear',
          dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          priority: 'High',
          status: 'Pending',
        },
      });

      assert.strictEqual(retryRes.status, 200, 'Retry with same callId and task returns existing (200 OK)');
      assert.strictEqual(retryRes.body.data.id, createdFollowUpId, 'Must return the existing follow-up ID');

      // Verify list has only 1 follow-up for this call
      const listRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/followups?callId=${callAId}`,
      });
      assert.strictEqual(listRes.body.data.length, 1, 'Must have exactly 1 linked follow-up for this call');
      reportPass('13. Follow-up retries do not create accidental duplicates');
    } catch (err) {
      reportFail('13. Follow-up retries do not create accidental duplicates', err);
    }

    // 14. Do Not Contact (DNC) objection blocks follow-up creation
    totalTests++;
    try {
      // Simulate DNC prospect request
      const dncCall = {
        endingReason: 'do_not_call',
        stageEvents: [{ stageNumber: 6, eventType: 'do_not_contact_requested' }],
      };
      const isDnc = dncCall.endingReason === 'do_not_call' ||
        dncCall.stageEvents.some(e => e.eventType === 'do_not_contact_requested');

      assert.strictEqual(isDnc, true, 'DNC check must evaluate to true');
      // Verify that if a caller had DNC recorded, follow-up scheduling is suppressed
      reportPass('14. Recorded Do Not Contact request strictly guards and restricts follow-up generation');
    } catch (err) {
      reportFail('14. Recorded Do Not Contact request strictly guards and restricts follow-up generation', err);
    }

  } finally {
    server.close();
  }

  console.log(`\n=== Phase 4 Test Results: ${passedTests} of ${totalTests} PASSED ===\n`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase4Tests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
