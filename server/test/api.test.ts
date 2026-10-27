process.env.NODE_ENV = 'test';
import http from 'http';
const { app } = await import('../src/index.js');

async function makeRequest(options: http.RequestOptions, bodyData?: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Cold Call Copilot API Security & Integration Tests ---');
  let failures = 0;

  // Launch test server on ephemeral port for self-contained testing
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = testServer.address() as any;
  const port = address.port;

  // Test 1: GET /api/health
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/health',
      method: 'GET',
    });

    if (res.statusCode === 200 && res.body?.status === 'ok') {
      console.log('✓ PASS: GET /api/health returns 200 OK');
    } else {
      console.error('✗ FAIL: GET /api/health', res);
      failures++;
    }

    // Verify security headers
    if (res.headers['x-content-type-options'] === 'nosniff' && res.headers['x-frame-options'] === 'DENY') {
      console.log('✓ PASS: Security headers (nosniff, DENY) present');
    } else {
      console.error('✗ FAIL: Security headers missing', res.headers);
      failures++;
    }
  } catch (err) {
    console.error('✗ FAIL: Health check exception', err);
    failures++;
  }

  // Test 2: Unauthenticated GET /api/prospects -> 401
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/prospects',
      method: 'GET',
    });

    if (res.statusCode === 401 && res.body?.success === false) {
      console.log('✓ PASS: Unauthenticated GET /api/prospects blocked with 401');
    } else {
      console.error('✗ FAIL: Unauthenticated GET /api/prospects allowed or unexpected status', res);
      failures++;
    }
  } catch (err) {
    console.error('✗ FAIL: Prospects auth test error', err);
    failures++;
  }

  // Test 3: Unauthenticated GET /api/calls -> 401
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/calls',
      method: 'GET',
    });

    if (res.statusCode === 401 && res.body?.success === false) {
      console.log('✓ PASS: Unauthenticated GET /api/calls blocked with 401');
    } else {
      console.error('✗ FAIL: Unauthenticated GET /api/calls allowed', res);
      failures++;
    }
  } catch (err) {
    console.error('✗ FAIL: Calls auth test error', err);
    failures++;
  }

  // Test 4: Unauthenticated GET /api/followups -> 401
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/followups',
      method: 'GET',
    });

    if (res.statusCode === 401 && res.body?.success === false) {
      console.log('✓ PASS: Unauthenticated GET /api/followups blocked with 401');
    } else {
      console.error('✗ FAIL: Unauthenticated GET /api/followups allowed', res);
      failures++;
    }
  } catch (err) {
    console.error('✗ FAIL: Followups auth test error', err);
    failures++;
  }

  // Test 5: Invalid Bearer Token -> 401
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/prospects',
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_fake_token_random_xyz',
      },
    });

    if (res.statusCode === 401 && res.body?.success === false) {
      console.log('✓ PASS: Invalid bearer token blocked with 401');
    } else {
      console.error('✗ FAIL: Invalid bearer token not rejected properly', res);
      failures++;
    }
  } catch (err) {
    console.error('✗ FAIL: Invalid token test error', err);
    failures++;
  }

  // Test 6: Unknown Endpoint -> 404
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/nonexistent-route-testing-404',
      method: 'GET',
    });

    if (res.statusCode === 404 && res.body?.success === false) {
      console.log('✓ PASS: Unknown route returns 404 with structured JSON');
    } else {
      console.error('✗ FAIL: 404 handler', res);
      failures++;
    }
  } catch (err) {
    console.error('✗ FAIL: 404 test error', err);
    failures++;
  }

  testServer.close();
  console.log(`--- API Tests Completed: ${failures === 0 ? 'ALL 6 PASSED' : failures + ' FAILED'} ---`);
  process.exit(failures > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
