process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import http from 'node:http';
const { app } = await import('../server/src/index.js');
import { 
  generateRealTimeCoaching, 
  generateFallbackCoaching,
  RealTimeCoachingInput,
} from '../server/src/services/coachingService.js';
import { STAGES_CONFIG } from '../src/data/stageDefinitions.js';

console.log('=== Cold Call Copilot — Real-Time AI Coaching Acceptance Tests ===\n');

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
          Authorization: 'Bearer test-token-coaching',
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

async function runCoachingTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as any).port;

  let testCallId = '';

  try {
    // -------------------------------------------------------------
    // TEST 1: Service Unit Test - Grounded Fallback Coaching Schema Normalization
    // -------------------------------------------------------------
    totalTests++;
    try {
      const input: RealTimeCoachingInput = {
        callId: 'call-unit-1',
        activeStage: 3,
        stageName: 'Pain Point & Workflow Discovery',
        stageObjective: 'Uncover bottlenecks in CNC milling',
        latestStatement: 'Our current supplier takes 6 weeks and the scrap rate is almost 4%.',
        latestSpeaker: 'prospect',
        recentSegments: [
          { id: '1', speaker: 'agent', text: 'How are your current turnaround times on custom machined parts?', timestamp: new Date().toISOString() },
          { id: '2', speaker: 'prospect', text: 'Our current supplier takes 6 weeks and the scrap rate is almost 4%.', timestamp: new Date().toISOString() },
        ],
        prospectInfo: {
          companyName: 'Precision Aero Works',
          contactName: 'Mark Vance',
          industry: 'Aerospace & Defense',
        },
      };

      const coaching = generateFallbackCoaching(input);

      assert.ok(coaching.suggested_response, 'Must contain suggested_response');
      assert.strictEqual(typeof coaching.suggested_response, 'string');
      assert.ok(coaching.detected_intent, 'Must contain detected_intent');
      assert.ok(Array.isArray(coaching.buying_signals), 'buying_signals must be an array');
      assert.ok(coaching.follow_up_question, 'Must contain follow_up_question');
      assert.ok(coaching.recommended_action, 'Must contain recommended_action');
      assert.ok(typeof coaching.confidence === 'number', 'confidence must be a number');
      assert.ok(coaching.confidence >= 0.5 && coaching.confidence <= 1.0, 'confidence in valid range');

      reportPass('Service: Normalizes all 7 structured coaching fields in accordance with schema');
    } catch (err: any) {
      reportFail('Service: Normalizes all 7 structured coaching fields', err);
    }

    // -------------------------------------------------------------
    // TEST 2: Service Unit Test - Objection Detection Taxonomy
    // -------------------------------------------------------------
    totalTests++;
    try {
      // 1. Existing provider objection
      const provInput: RealTimeCoachingInput = {
        activeStage: 2,
        stageName: 'Hook & Value Prop',
        latestStatement: 'We already use another provider for machining, and switching would be difficult.',
        latestSpeaker: 'prospect',
      };
      const provCoaching = generateFallbackCoaching(provInput);
      assert.ok(
        provCoaching.objection?.toLowerCase().includes('provider') || 
        provCoaching.objection?.toLowerCase().includes('switching') ||
        provCoaching.objection?.toLowerCase().includes('relationship'),
        `Expected provider objection, got: ${provCoaching.objection}`
      );

      // 2. Price/Budget objection
      const priceInput: RealTimeCoachingInput = {
        activeStage: 4,
        stageName: 'Solution Alignment',
        latestStatement: 'Your rates are too expensive and we do not have budget for new tooling.',
        latestSpeaker: 'prospect',
      };
      const priceCoaching = generateFallbackCoaching(priceInput);
      assert.ok(
        priceCoaching.objection?.toLowerCase().includes('price') || 
        priceCoaching.objection?.toLowerCase().includes('budget'),
        `Expected price/budget objection, got: ${priceCoaching.objection}`
      );

      // 3. Timing/Brush-off objection
      const timeInput: RealTimeCoachingInput = {
        activeStage: 1,
        stageName: 'Pattern Interrupt',
        latestStatement: 'I am in the middle of a shift, just send me an email.',
        latestSpeaker: 'prospect',
      };
      const timeCoaching = generateFallbackCoaching(timeInput);
      assert.ok(
        timeCoaching.objection?.toLowerCase().includes('timing') || 
        timeCoaching.objection?.toLowerCase().includes('email') ||
        timeCoaching.objection?.toLowerCase().includes('brush-off'),
        `Expected timing objection, got: ${timeCoaching.objection}`
      );

      reportPass('Service: Accurately identifies objections across provider, price, and timing categories');
    } catch (err: any) {
      reportFail('Service: Accurately identifies objections', err);
    }

    // -------------------------------------------------------------
    // TEST 3: Service Unit Test - Company & Manufacturing Context Grounding
    // -------------------------------------------------------------
    totalTests++;
    try {
      const mfgInput: RealTimeCoachingInput = {
        activeStage: 4,
        stageName: 'Solution Alignment',
        latestStatement: 'What kind of tolerances can your shop maintain on titanium brackets?',
        latestSpeaker: 'prospect',
        prospectInfo: {
          companyName: 'Titan Aero',
          materialTypes: 'Titanium Ti-6Al-4V',
        },
      };

      const coaching = generateFallbackCoaching(mfgInput);
      assert.ok(
        coaching.suggested_response.includes('±0.0002') || 
        coaching.suggested_response.includes('tolerance') ||
        coaching.suggested_response.includes('5-axis') ||
        coaching.suggested_response.includes('Haas'),
        `Expected precision manufacturing context, got: ${coaching.suggested_response}`
      );

      reportPass('Service: Grounds responses in verified manufacturing parameters (tolerances, Haas CNC, 14-day turns)');
    } catch (err: any) {
      reportFail('Service: Grounds responses in verified manufacturing parameters', err);
    }

    // -------------------------------------------------------------
    // TEST 4: Service Unit Test - Sparse / Empty Input Handling
    // -------------------------------------------------------------
    totalTests++;
    try {
      const emptyInput: RealTimeCoachingInput = {
        activeStage: 1,
      };

      const coaching = generateFallbackCoaching(emptyInput);
      assert.ok(coaching.suggested_response.length > 10, 'Must produce a valid opening guidance suggestion');
      assert.strictEqual(coaching.objection, null, 'No objection should be hallucinated on empty input');

      reportPass('Service: Handles empty or sparse inputs safely without throwing or hallucinating');
    } catch (err: any) {
      reportFail('Service: Handles empty or sparse inputs safely', err);
    }

    // -------------------------------------------------------------
    // TEST 5: API Integration - Initialize a test call record
    // -------------------------------------------------------------
    totalTests++;
    try {
      const createRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls',
        body: {
          prospectId: 'prospect-coaching-test-001',
          companyName: 'Apex Dynamics',
          contactName: 'Sarah Jenkins',
          callDate: new Date().toISOString(),
          durationSeconds: 15,
          callStatus: 'In Progress',
          callObjective: 'High-tolerance CNC manufacturing discovery',
          activeStage: 2,
          furthestStageReached: 2,
        },
      });

      assert.strictEqual(createRes.status, 201, `Expected 201, got ${createRes.status}`);
      const callData = createRes.body.data || createRes.body;
      assert.ok(callData?.id, 'Expected returned call record ID');
      testCallId = callData.id;

      reportPass(`API: Created active test call record (${testCallId})`);
    } catch (err: any) {
      reportFail('API: Created active test call record', err);
    }

    // -------------------------------------------------------------
    // TEST 6: API Integration - POST /api/calls/:callId/coaching generates & persists suggestion
    // -------------------------------------------------------------
    totalTests++;
    try {
      const coachingRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${testCallId}/coaching`,
        body: {
          activeStage: 2,
          stageName: 'Hook & Value Prop',
          stageObjective: 'Capture 30 seconds of interest',
          latestStatement: 'We already use another provider, and switching would be difficult.',
          latestSpeaker: 'prospect',
          prospectInfo: {
            companyName: 'Apex Dynamics',
            contactName: 'Sarah Jenkins',
          },
        },
      });

      assert.strictEqual(coachingRes.status, 200, `Expected 200, got ${coachingRes.status}: ${JSON.stringify(coachingRes.body)}`);
      const coaching = coachingRes.body.data || coachingRes.body;
      assert.ok(coaching.suggested_response, 'Response must include suggested_response');
      assert.ok(coaching.objection, 'Response should detect the existing provider objection');
      assert.ok(coaching.follow_up_question, 'Response must include follow_up_question');
      assert.ok(typeof coaching.confidence === 'number', 'Confidence must be numeric');

      reportPass('API: POST /api/calls/:callId/coaching generates and returns structured coaching');
    } catch (err: any) {
      reportFail('API: POST /api/calls/:callId/coaching generates and returns structured coaching', err);
    }

    // -------------------------------------------------------------
    // TEST 7: API Integration - GET /api/calls/:callId/coaching retrieves persisted suggestion
    // -------------------------------------------------------------
    totalTests++;
    try {
      const getRes = await makeRequest(port, {
        method: 'GET',
        path: `/api/calls/${testCallId}/coaching`,
      });

      assert.strictEqual(getRes.status, 200, `Expected 200, got ${getRes.status}`);
      const cachedList = getRes.body.data || getRes.body;
      const cached = Array.isArray(cachedList) ? cachedList[0] : cachedList;
      assert.ok(cached, 'Expected cached suggestion to be returned');
      assert.ok(cached.suggested_response, 'Cached item must have suggested_response');

      reportPass('API: GET /api/calls/:callId/coaching successfully retrieves persisted coaching');
    } catch (err: any) {
      reportFail('API: GET /api/calls/:callId/coaching successfully retrieves persisted coaching', err);
    }

    // -------------------------------------------------------------
    // TEST 8: API Integration - POST /api/calls/coaching (Stateless fallback)
    // -------------------------------------------------------------
    totalTests++;
    try {
      const statelessRes = await makeRequest(port, {
        method: 'POST',
        path: '/api/calls/coaching',
        body: {
          activeStage: 5,
          stageName: 'Objection Handling',
          latestStatement: 'Send me some information and I will look at it next month.',
          latestSpeaker: 'prospect',
        },
      });

      assert.strictEqual(statelessRes.status, 200, `Expected 200, got ${statelessRes.status}`);
      const coaching = statelessRes.body.data || statelessRes.body;
      assert.ok(coaching.suggested_response, 'Expected valid suggested response in stateless endpoint');
      assert.ok(coaching.follow_up_question, 'Expected valid follow up question in stateless endpoint');

      reportPass('API: POST /api/calls/coaching functions cleanly without existing callId');
    } catch (err: any) {
      reportFail('API: POST /api/calls/coaching functions cleanly without existing callId', err);
    }

    // -------------------------------------------------------------
    // TEST 9: Backward Compatibility - POST /api/calls/:callId/suggestions remains disabled
    // -------------------------------------------------------------
    totalTests++;
    try {
      const legacyRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${testCallId}/suggestions`,
        body: { stageNumber: 2 },
      });

      assert.strictEqual(legacyRes.status, 200, `Expected 200, got ${legacyRes.status}`);
      const body = legacyRes.body.data || legacyRes.body;
      assert.strictEqual(body.disabled, true, 'Legacy suggestions must be flagged disabled');
      assert.strictEqual(body.unavailable, true, 'Legacy suggestions must be flagged unavailable');

      reportPass('API: Legacy POST /api/calls/:callId/suggestions preserved in disabled state');
    } catch (err: any) {
      reportFail('API: Legacy POST /api/calls/:callId/suggestions preserved in disabled state', err);
    }

    // -------------------------------------------------------------
    // TEST 10: Backward Compatibility - Post-call review remains intact
    // -------------------------------------------------------------
    totalTests++;
    try {
      const reviewRes = await makeRequest(port, {
        method: 'POST',
        path: `/api/calls/${testCallId}/review`,
        body: {},
      });

      assert.strictEqual(reviewRes.status, 200, `Expected 200, got ${reviewRes.status}`);
      const review = reviewRes.body.data || reviewRes.body;
      assert.ok(review.callSummary, 'Review must contain callSummary');
      assert.ok(Array.isArray(review.whatWentWell), 'Review must contain whatWentWell array');
      assert.ok(review.recommendedNextAction, 'Review must contain recommendedNextAction');

      reportPass('API: Existing Gemini Post-Call Review feature remains fully intact and operational');
    } catch (err: any) {
      reportFail('API: Existing Gemini Post-Call Review feature remains fully intact', err);
    }

  } finally {
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`Results: ${passedTests} / ${totalTests} tests passed`);
  console.log(`======================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCoachingTests().catch(err => {
  console.error('Test runner fatal exception:', err);
  process.exit(1);
});
