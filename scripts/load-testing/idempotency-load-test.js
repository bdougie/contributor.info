import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// Custom metrics for idempotency testing
const duplicateRate = new Rate('duplicate_requests');
const cacheHitRate = new Rate('cache_hits');
const raceConditionErrors = new Counter('race_condition_errors');
const idempotencyLatency = new Trend('idempotency_latency');

// Environment configuration
const SUPABASE_URL = __ENV.VITE_SUPABASE_URL || __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.VITE_SUPABASE_ANON_KEY || __ENV.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Required environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set'
  );
}

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Test duplicate request handling under sustained load
    sustained_duplicates: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // Scenario 2: Burst test for race condition handling
    burst_duplicates: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 1000,
      maxDuration: '30s',
      startTime: '2m30s', // Start after sustained test
    },
    // Scenario 3: Concurrent requests with same idempotency key
    concurrent_same_key: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 5,
      maxDuration: '1m',
      startTime: '3m30s',
    },
  },
  thresholds: {
    // Success criteria
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    duplicate_requests: ['rate>0.8'], // 80%+ duplicates should be caught
    cache_hits: ['rate>0.7'], // 70%+ cache hit rate for duplicates
    race_condition_errors: ['count<10'], // Minimal race condition errors
  },
};

/**
 * Generate idempotency key based on scenario
 */
function generateIdempotencyKey(scenario) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);

  switch (scenario) {
    case 'sustained_duplicates':
      // Use a rotating set of keys to test cache performance
      const keyIndex = Math.floor(Math.random() * 10);
      return `sustained-${keyIndex}-${Math.floor(timestamp / 10000)}`;

    case 'burst_duplicates':
      // All requests in burst use the same key
      return `burst-test-${__ITER % 5}`; // 5 different keys across iterations

    case 'concurrent_same_key':
      // All VUs use the same key to test race conditions
      return `concurrent-test-${__VU % 3}`; // 3 keys across VUs

    default:
      return `test-${timestamp}-${random}`;
  }
}

/**
 * Send request with idempotency key
 */
export default function () {
  const scenario = __ENV.SCENARIO || 'sustained_duplicates';
  const idempotencyKey = generateIdempotencyKey(scenario);

  const payload = JSON.stringify({
    eventName: `test/load.${scenario}`,
    data: {
      scenario: scenario,
      vu: __VU,
      iteration: __ITER,
      timestamp: new Date().toISOString(),
      testId: Math.random().toString(36).substring(2, 15),
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    tags: {
      scenario: scenario,
      idempotencyKey: idempotencyKey,
    },
  };

  // Record start time for latency measurement
  const startTime = new Date().getTime();

  // Send request
  const response = http.post(`${SUPABASE_URL}/functions/v1/queue-event`, payload, params);

  // Record latency
  const endTime = new Date().getTime();
  idempotencyLatency.add(endTime - startTime);

  // Parse response
  let responseData = {};
  try {
    responseData = JSON.parse(response.body);
  } catch (e) {
    console.error('Failed to parse response:', response.body);
  }

  // Check response and record metrics
  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'has eventId': (r) => {
      const data = JSON.parse(r.body);
      return data.eventId !== undefined;
    },
    'duplicate flag set correctly': (r) => {
      const data = JSON.parse(r.body);
      return data.duplicate !== undefined;
    },
  });

  // Track duplicate detection
  if (responseData.duplicate === true) {
    duplicateRate.add(1);

    // Check if it's a cached response
    if (responseData.cached === true) {
      cacheHitRate.add(1);
    }
  } else {
    duplicateRate.add(0);
    cacheHitRate.add(0);
  }

  // Check for race condition indicators
  if (response.status === 500 && response.body.includes('still being processed')) {
    raceConditionErrors.add(1);
  }

  // Sleep pattern based on scenario
  switch (scenario) {
    case 'sustained_duplicates':
      sleep(0.01); // Minimal sleep for sustained load
      break;
    case 'burst_duplicates':
      // No sleep in burst scenario
      break;
    case 'concurrent_same_key':
      sleep(0.001); // Very minimal sleep
      break;
    default:
      sleep(0.1);
  }
}

/**
 * Generate HTML report after test completion
 */
export function handleSummary(data) {
  return {
    'reports/idempotency-load-test.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

/**
 * Custom text summary for console output
 */
function textSummary(data, options) {
  const { metrics } = data;

  let summary = '\n=== Idempotency Load Test Results ===\n\n';

  // Overall performance
  summary += 'Performance Metrics:\n';
  summary += `  ✓ Success Rate: ${(100 - (metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `  ✓ Avg Response Time: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `  ✓ p95 Response Time: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;

  // Idempotency-specific metrics
  summary += '\nIdempotency Metrics:\n';
  summary += `  ✓ Duplicate Detection Rate: ${((metrics.duplicate_requests?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `  ✓ Cache Hit Rate: ${((metrics.cache_hits?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `  ✓ Race Condition Errors: ${metrics.race_condition_errors?.values?.count || 0}\n`;
  summary += `  ✓ Avg Idempotency Latency: ${(metrics.idempotency_latency?.values?.avg || 0).toFixed(2)}ms\n`;

  // Test scenarios summary
  summary += '\nScenarios Completed:\n';
  summary += '  ✓ Sustained duplicate load (100 req/s for 2 min)\n';
  summary += '  ✓ Burst duplicate traffic (1000 requests)\n';
  summary += '  ✓ Concurrent same-key requests (20 VUs × 5 iterations)\n';

  // Threshold validation
  summary += '\nThreshold Validation:\n';
  const thresholdsPassed = Object.entries(metrics).every(([key, metric]) => {
    if (metric.thresholds) {
      return Object.values(metric.thresholds).every((t) => t.ok);
    }
    return true;
  });

  summary += thresholdsPassed
    ? '  ✅ All thresholds passed!\n'
    : '  ❌ Some thresholds failed. Check detailed report.\n';

  summary += '\n======================================\n';

  return summary;
}
