#!/usr/bin/env node

/**
 * End-to-end test script for manual backfill endpoints
 *
 * Usage:
 *   node scripts/test-backfill-endpoints.js [base-url]
 *
 * Examples:
 *   node scripts/test-backfill-endpoints.js                    # Test locally (http://localhost:8888)
 *   node scripts/test-backfill-endpoints.js https://contributor.info  # Test production
 */

const BASE_URL = process.argv[2] || 'http://localhost:8888';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  log(`\n📍 Testing: ${name}`, 'cyan');
  log(`   ${method} ${url}`, 'blue');

  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const responseBody = await response.text();

    let parsedBody;
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = responseBody;
    }

    // Log response
    if (response.status === 503) {
      log(`   ⚠️  Status: ${response.status} - Service Unavailable`, 'yellow');
      log(`   This is expected if GH_DATPIPE_KEY is not configured`, 'yellow');
    } else if (response.status === 404) {
      log(`   ❌ Status: ${response.status} - Not Found`, 'red');
      log(`   This indicates the function is not loading properly!`, 'red');
    } else if (response.status >= 400) {
      log(`   ⚠️  Status: ${response.status}`, 'yellow');
    } else {
      log(`   ✅ Status: ${response.status}`, 'green');
    }

    log(`   Response: ${JSON.stringify(parsedBody, null, 2)}`);

    return {
      name,
      status: response.status,
      success: response.status !== 404, // 404 is the critical error we're fixing
      body: parsedBody,
    };
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return {
      name,
      status: 0,
      success: false,
      error: error.message,
    };
  }
}

async function runTests() {
  log('🧪 Manual Backfill Endpoints Test Suite', 'cyan');
  log('=========================================', 'cyan');
  log(`Testing against: ${BASE_URL}\n`, 'blue');

  const results = [];

  // Test 1: Trigger endpoint (should work or return 503, not 404)
  results.push(
    await testEndpoint('Trigger Backfill', 'POST', '/api/backfill/trigger', {
      repository: 'test/repo',
      days: 30,
    })
  );

  // Test 2: Status endpoint
  results.push(await testEndpoint('Get Job Status', 'GET', '/api/backfill/status/test-job-id'));

  // Test 3: Cancel endpoint
  results.push(await testEndpoint('Cancel Job', 'POST', '/api/backfill/cancel/test-job-id'));

  // Test 4: Events endpoint
  results.push(await testEndpoint('List Events', 'GET', '/api/backfill/events'));

  // Test 5: Invalid method (should return 405, not 404)
  results.push(await testEndpoint('Invalid Method Test', 'GET', '/api/backfill/trigger'));

  // Test 6: Invalid JSON (should return 400, not 404)
  const invalidJsonTest = await (async () => {
    const url = `${BASE_URL}/api/backfill/trigger`;
    log(`\n📍 Testing: Invalid JSON`, 'cyan');
    log(`   POST ${url}`, 'blue');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      const body = await response.json().catch(() => ({}));

      if (response.status === 400) {
        log(`   ✅ Status: ${response.status} - Correctly handled invalid JSON`, 'green');
      } else if (response.status === 404) {
        log(`   ❌ Status: ${response.status} - Function not loading!`, 'red');
      } else {
        log(`   ⚠️  Status: ${response.status}`, 'yellow');
      }

      return {
        name: 'Invalid JSON Test',
        status: response.status,
        success: response.status !== 404,
        body,
      };
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
      return {
        name: 'Invalid JSON Test',
        status: 0,
        success: false,
        error: error.message,
      };
    }
  })();
  results.push(invalidJsonTest);

  // Summary
  log('\n📊 Test Summary', 'cyan');
  log('================', 'cyan');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const critical404s = results.filter((r) => r.status === 404).length;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${icon} ${result.name}: ${result.status || 'Failed'}`, color);
  });

  log('');
  log(`Total: ${results.length} tests`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  if (critical404s > 0) {
    log(`\n⚠️  CRITICAL: ${critical404s} endpoints returned 404!`, 'red');
    log('This indicates the lazy initialization fix is not working.', 'red');
    log('The functions are failing to load due to missing environment variables.', 'red');
  } else if (results.some((r) => r.status === 503)) {
    log('\n📝 Note: Some endpoints returned 503 (Service Unavailable)', 'yellow');
    log('This is expected behavior when GH_DATPIPE_KEY is not configured.', 'yellow');
    log('To enable the service, set the required environment variables.', 'yellow');
  }

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
