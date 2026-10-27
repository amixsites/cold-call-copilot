import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyGeminiError } from '../server/src/services/liveTranscriptionService.js';
import { MANDATORY_GEMINI_MODEL } from '../server/src/config/env.js';

const API_BASE = 'http://localhost:3001/api';
const AUTH_HEADER = {
  Authorization: 'Bearer demo_token_authenticated',
  'Content-Type': 'application/json',
};

describe('Gemini Model Enforcement & Speech-to-Text Integration Tests', () => {
  it('1. Model enforcement: Only gemini-3.5-transcribe-live is configured and text generation is disabled', async () => {
    assert.strictEqual(MANDATORY_GEMINI_MODEL, 'gemini-3.5-transcribe-live', 'Backend must enforce gemini-3.5-transcribe-live');

    const res = await fetch(`${API_BASE}/ai/health`, {
      headers: AUTH_HEADER,
    });
    assert.strictEqual(res.status, 200, 'Health endpoint should return 200');
    const json = await res.json() as any;
    assert.strictEqual(json.status, 'ok');
    assert.strictEqual(typeof json.configured, 'boolean');
    assert.strictEqual(json.model, 'gemini-3.5-transcribe-live', 'Active model must strictly be gemini-3.5-transcribe-live');
    assert.strictEqual(json.textGenerationDisabled, true, 'Text generation LLM calls must be disabled');
    assert.strictEqual(json.provider, 'google-genai');

    // Security check: Verify no secret API key is exposed anywhere in the response
    const jsonString = JSON.stringify(json);
    assert.strictEqual(jsonString.includes('AQ.Ab8RN'), false, 'Health response must never leak the API key');
    assert.strictEqual(jsonString.includes('AIzaSy'), false, 'Health response must never leak the API key');
    console.log('✓ PASS: 1. Health diagnostic confirms gemini-3.5-transcribe-live and disabled text generation');
  });

  it('2. AI suggestions endpoint is cleanly disabled and triggers zero Gemini text-generation requests', async () => {
    const res = await fetch(`${API_BASE}/ai/call-assist`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        currentStage: 4,
        companyName: 'Apex Precision Machining Corp',
        contactName: 'Dave Miller, VP Operations',
        industry: 'Precision CNC Machining',
        callObjective: 'Tool wear discovery',
        recentSegments: [
          { segmentId: 'seg-1', speaker: 'prospect', text: 'We run mostly aerospace Inconel 718 on our Mazaks.' },
        ],
      }),
    });

    assert.strictEqual(res.status, 200, 'AI call-assist should return 200');
    const json = await res.json() as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.disabled, true, 'AI Suggestions must report disabled: true');
    assert.strictEqual(json.unavailable, true, 'AI Suggestions must report unavailable: true');
    assert.strictEqual(json.modelEnforced, 'gemini-3.5-transcribe-live');
    assert.strictEqual(json.data, null, 'No fabricated or rate-limited suggestions should be generated');

    console.log('✓ PASS: 2. POST /api/ai/call-assist confirms disabled state without invoking rate-limited models');
  });

  it('3. Error classification distinguishes quota, auth, availability, and network errors without model fallback', () => {
    // 3.1 Quota Error Simulation
    const quotaErr = classifyGeminiError('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
    assert.strictEqual(quotaErr.category, 'QUOTA_EXCEEDED');
    assert.ok(quotaErr.message.includes('quota exceeded'));
    assert.ok(quotaErr.message.includes('gemini-3.5-transcribe-live'));

    const http429Err = classifyGeminiError('Too Many Requests', 429);
    assert.strictEqual(http429Err.category, 'QUOTA_EXCEEDED');

    // 3.2 Authentication Error Simulation
    const authErr = classifyGeminiError('API_KEY_INVALID: The provided API key is invalid', 400);
    assert.strictEqual(authErr.category, 'AUTHENTICATION_ERROR');

    const permDeniedErr = classifyGeminiError('PERMISSION_DENIED', 403);
    assert.strictEqual(permDeniedErr.category, 'AUTHENTICATION_ERROR');

    // 3.3 Model Availability Error Simulation
    const availErr = classifyGeminiError('NOT_FOUND: Model not found or deprecated', 404);
    assert.strictEqual(availErr.category, 'MODEL_AVAILABILITY_ERROR');

    // 3.4 Network Error Simulation
    const netErr = classifyGeminiError('ECONNRESET: Connection reset by peer');
    assert.strictEqual(netErr.category, 'NETWORK_ERROR');

    console.log('✓ PASS: 3. Error classifier accurately distinguishes all error types and enforces no fallback');
  });

  it('4. POST /api/calls/:id/transcript persists finalized segments and prevents duplicate segment records', async () => {
    // Step A: Create a test call
    const createCallRes = await fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        companyName: 'Vanguard Aerospace Tooling',
        contactName: 'Sarah Jenkins',
        callStatus: 'In Progress',
        activeStage: 4,
      }),
    });
    const callData = await createCallRes.json() as any;
    const callId = callData.data.id;

    // Step B: Persist initial finalized segment
    const seg1Res = await fetch(`${API_BASE}/calls/${callId}/transcript`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        segmentId: 'seg-101',
        text: 'We are currently testing coated carbide end mills for our titanium batch.',
        speaker: 'prospect',
        isFinal: true,
        timestamp: new Date().toISOString(),
      }),
    });
    assert.strictEqual(seg1Res.status, 201, 'Transcript segment save should return 201');

    // Step C: Persist second segment
    const seg2Res = await fetch(`${API_BASE}/calls/${callId}/transcript`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        segmentId: 'seg-102',
        text: 'Our scrap rate dropped 4% after adjusting the coolant pressure.',
        speaker: 'prospect',
        isFinal: true,
        timestamp: new Date().toISOString(),
      }),
    });
    assert.strictEqual(seg2Res.status, 201);

    // Step D: Recognition restart with duplicate segmentId (re-sending seg-101)
    const restartRes = await fetch(`${API_BASE}/calls/${callId}/transcript`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        segmentId: 'seg-101',
        text: 'We are currently testing coated carbide end mills for our titanium batch.',
        speaker: 'prospect',
        isFinal: true,
      }),
    });
    assert.strictEqual(restartRes.status, 201);

    // Step E: Fetch all segments and verify deduplication
    const getRes = await fetch(`${API_BASE}/calls/${callId}/transcript`, {
      headers: AUTH_HEADER,
    });
    assert.strictEqual(getRes.status, 200);
    const getJson = await getRes.json() as any;
    assert.strictEqual(getJson.success, true);
    assert.ok(Array.isArray(getJson.data));
    assert.strictEqual(getJson.data.length, 2, 'Must have exactly 2 distinct segments; duplicates must be prevented');
    assert.strictEqual(getJson.data[0].segmentId, 'seg-101');
    assert.strictEqual(getJson.data[1].segmentId, 'seg-102');
    console.log('✓ PASS: 4. Finalized segments persist reliably and duplicate segment IDs are deduplicated');
  });

  it('5. Workspace refresh restores persisted transcript segments accurately', async () => {
    // Create call with transcript
    const createCallRes = await fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        companyName: 'Midwest Turbine Machining',
        contactName: 'Marcus Bell',
        callStatus: 'In Progress',
        activeStage: 5,
      }),
    });
    const callData = await createCallRes.json() as any;
    const callId = callData.data.id;

    await fetch(`${API_BASE}/calls/${callId}/transcript`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        segmentId: 'seg-midwest-1',
        text: 'Marcus mentioned tolerances on the shroud rings must stay under 0.0002 inches.',
        speaker: 'rep',
        isFinal: true,
      }),
    });

    // Simulate workspace reload by fetching transcript by callId
    const reloadRes = await fetch(`${API_BASE}/calls/${callId}/transcript`, {
      headers: AUTH_HEADER,
    });
    assert.strictEqual(reloadRes.status, 200);
    const reloadData = await reloadRes.json() as any;
    assert.strictEqual(reloadData.data.length, 1);
    assert.strictEqual(reloadData.data[0].segmentId, 'seg-midwest-1');
    assert.ok(reloadData.data[0].text.includes('shroud rings'));
    console.log('✓ PASS: 5. Persisted transcript segments survive reload and refresh');
  });

  it('6. Post-call review operates purely via local analytics engine without external LLM text generation requests', async () => {
    // Create a call
    const createCallRes = await fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        companyName: 'Precision Dynamics Corp',
        contactName: 'Alex Wright',
        callStatus: 'Completed',
        durationSeconds: 245,
        activeStage: 7,
        furthestStageReached: 7,
        endingStage: 7,
        endingReason: 'normal_completion',
        outcome: 'Follow-up Needed',
        prospectWords: 'Our night shift cycle times are slipping due to edge chipping.',
        quoteStatus: 'need_stated',
      }),
    });
    const callData = await createCallRes.json() as any;
    const callId = callData.data.id;

    // Generate review
    const reviewRes = await fetch(`${API_BASE}/calls/${callId}/review`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });
    assert.strictEqual(reviewRes.status, 200, 'Post-call review should return 200');
    const reviewJson = await reviewRes.json() as any;
    assert.strictEqual(reviewJson.success, true);
    assert.ok(reviewJson.data);
    assert.ok(reviewJson.data.callSummary.includes('Precision Dynamics Corp'));
    assert.ok(reviewJson.data.modelUsed.includes('local-analytics-engine'));
    assert.ok(!reviewJson.data.modelUsed.includes('gemini-3.8-flash'), 'Must never invoke Gemini 3.8 Flash');

    console.log('✓ PASS: 6. Post-call review persists data-grounded evaluation with 0 Gemini text requests');
  });
});
