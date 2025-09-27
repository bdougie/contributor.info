import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// Custom metrics for concurrency testing
const concurrentRequests = new Gauge('concurrent_requests');
const queuedRequests = new Counter('queued_requests');
const throttledRequests = new Counter('throttled_requests');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const requestLatency = new Trend('request_latency');
const queueWaitTime = new Trend('queue_wait_time');
const successRate = new Rate('success_rate');

// Environment configuration
const SUPABASE_URL = __ENV.VITE_SUPABASE_URL || __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.VITE_SUPABASE_ANON_KEY || __ENV.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Required environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set'
  );
}

// Test configuration for different concurrency scenarios
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up to find concurrency limit
    find_concurrency_limit: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 }, // Warm up to 10 VUs
        { duration: '1m', target: 30 }, // Ramp to 30 VUs (near expected limit)
        { duration: '1m', target: 50 }, // Push to 50 VUs (expected to hit limits)
        { duration: '1m', target: 75 }, // Stress test at 75 VUs
        { duration: '30s', target: 0 }, // Ramp down
      ],
    },

    // Scenario 2: Sustained load at concurrency limit
    sustained_at_limit: {
      executor: 'constant-vus',
      vus: 40, // Based on research, Pro tier limit is ~40
      duration: '3m',
      startTime: '4m', // Start after finding limit
    },

    // Scenario 3: Burst beyond capacity
    burst_overload: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 1000,
      maxDuration: '1m',
      startTime: '7m30s',
    },

    // Scenario 4: Priority queue testing
    priority_queue_test: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 10,
      maxDuration: '2m',
      startTime: '9m',
    },
  },

  thresholds: {
    // Performance thresholds
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    success_rate: ['rate>0.9'], // Success rate above 90%

    // Concurrency thresholds
    concurrent_requests: ['max<100'], // Max concurrent under 100
    throttled_requests: ['count<100'], // Less than 100 throttled requests
    circuit_breaker_trips: ['count<5'], // Circuit breaker trips less than 5 times

    // Queue metrics
    queue_wait_time: ['p(95)<10000'], // 95% queue wait under 10s
  },
};

/**
 * Generate test payload based on scenario
 */
function generatePayload(scenario) {
  const eventTypes = [
    'push',
    'pull_request.opened',
    'pull_request.closed',
    'issue.created',
    'issue.comment',
    'workflow.completed',
  ];

  const priority =
    scenario === 'priority_queue_test'
      ? ['high', 'medium', 'low'][Math.floor(Math.random() * 3)]
      : 'medium';

  return {
    eventName: `github.${eventTypes[Math.floor(Math.random() * eventTypes.length)]}`,
    data: {
      repository: `test-repo-${__VU}`,
      action: 'test',
      timestamp: new Date().toISOString(),
      payload_size: Math.floor(Math.random() * 1000) + 100,
      vu_id: __VU,
      iteration: __ITER,
      scenario: scenario,
      priority: priority,
    },
  };
}

/**
 * Main test function
 */
export default function () {
  const scenario = __ENV.SCENARIO || 'find_concurrency_limit';
  const payload = JSON.stringify(generatePayload(scenario));

  // Track concurrent requests
  concurrentRequests.add(1);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Priority':
        scenario === 'priority_queue_test' ? ['high', 'medium', 'low'][__VU % 3] : 'medium',
      'X-Test-Scenario': scenario,
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    tags: {
      scenario: scenario,
    },
    timeout: '30s',
  };

  // Record request start time
  const startTime = new Date().getTime();

  // Send request
  const response = http.post(`${SUPABASE_URL}/functions/v1/queue-event`, payload, params);

  // Record latency
  const endTime = new Date().getTime();
  const latency = endTime - startTime;
  requestLatency.add(latency);

  // Release concurrent request counter
  concurrentRequests.add(-1);

  // Parse response
  let responseData = {};
  try {
    if (response.body) {
      responseData = JSON.parse(response.body);
    }
  } catch (e) {
    console.error('Failed to parse response:', response.body);
  }

  // Check response and record metrics
  const checks = check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'no circuit breaker trip': (r) => !r.body.includes('Circuit breaker'),
    'no concurrency limit': (r) => !r.body.includes('Concurrency limit'),
    'request processed': (r) => {
      if (!r.body) return false;
      const data = JSON.parse(r.body);
      return data.success === true || data.eventId !== undefined;
    },
  });

  // Track success rate
  successRate.add(response.status >= 200 && response.status < 300 ? 1 : 0);

  // Track throttling and queuing
  if (response.status === 429 || response.body.includes('throttled')) {
    throttledRequests.add(1);
    console.log(`Request throttled at VU ${__VU}`);
  }

  if (responseData.queued === true || response.body.includes('queued')) {
    queuedRequests.add(1);
    if (responseData.estimatedWaitTime) {
      queueWaitTime.add(responseData.estimatedWaitTime);
    }
  }

  if (response.body.includes('Circuit breaker')) {
    circuitBreakerTrips.add(1);
    console.log(`Circuit breaker tripped at VU ${__VU}`);
  }

  // Log errors for debugging
  if (response.status >= 400) {
    console.log(
      `Error at VU ${__VU}: Status ${response.status}, Body: ${response.body.substring(0, 200)}`
    );
  }

  // Sleep pattern based on scenario
  switch (scenario) {
    case 'find_concurrency_limit':
      sleep(Math.random() * 2); // Random 0-2s sleep
      break;
    case 'sustained_at_limit':
      sleep(1); // Consistent 1s sleep
      break;
    case 'burst_overload':
      // No sleep for burst
      break;
    case 'priority_queue_test':
      sleep(0.5 + Math.random()); // 0.5-1.5s sleep
      break;
    default:
      sleep(1);
  }
}

/**
 * Setup function - runs once per VU before iterations
 */
export function setup() {
  console.log('Starting concurrency load test');
  console.log('Target URL:', SUPABASE_URL);

  // Test connectivity
  const testResponse = http.get(`${SUPABASE_URL}/functions/v1/health`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (testResponse.status !== 200 && testResponse.status !== 404) {
    throw new Error(`Failed to connect to Edge Functions: ${testResponse.status}`);
  }

  return {
    startTime: new Date().toISOString(),
    targetUrl: SUPABASE_URL,
  };
}

/**
 * Teardown function - runs once after all iterations
 */
export function teardown(data) {
  console.log('Test completed:', data.startTime, '->', new Date().toISOString());
}

/**
 * Generate HTML report and summary
 */
export function handleSummary(data) {
  const customSummary = generateCustomSummary(data);

  return {
    'reports/concurrency-load-test.html': htmlReport(data),
    'reports/concurrency-summary.json': JSON.stringify(data, null, 2),
    stdout: customSummary,
  };
}

/**
 * Generate custom text summary
 */
function generateCustomSummary(data) {
  const { metrics } = data;

  let summary = '\n' + '='.repeat(60) + '\n';
  summary += '🎯 Concurrency Load Test Results\n';
  summary += '='.repeat(60) + '\n\n';

  // Overall performance
  summary += '📊 Performance Metrics:\n';
  summary += `  • Success Rate: ${((metrics.success_rate?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `  • Avg Response Time: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(
    2
  )}ms\n`;
  summary += `  • p95 Response Time: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(
    2
  )}ms\n`;

  // Concurrency metrics
  summary += '\n🔄 Concurrency Metrics:\n';
  summary += `  • Peak Concurrent Requests: ${metrics.concurrent_requests?.values?.max || 0}\n`;
  summary += `  • Throttled Requests: ${metrics.throttled_requests?.values?.count || 0}\n`;
  summary += `  • Queued Requests: ${metrics.queued_requests?.values?.count || 0}\n`;
  summary += `  • Circuit Breaker Trips: ${metrics.circuit_breaker_trips?.values?.count || 0}\n`;

  // Queue metrics
  if (metrics.queue_wait_time?.values?.avg) {
    summary += '\n📋 Queue Performance:\n';
    summary += `  • Avg Queue Wait: ${metrics.queue_wait_time.values.avg.toFixed(2)}ms\n`;
    summary += `  • p95 Queue Wait: ${(metrics.queue_wait_time.values['p(95)'] || 0).toFixed(
      2
    )}ms\n`;
  }

  // Scenarios completed
  summary += '\n✅ Scenarios Completed:\n';
  summary += '  1. Concurrency limit discovery (ramping to 75 VUs)\n';
  summary += '  2. Sustained load at limit (40 VUs for 3 min)\n';
  summary += '  3. Burst overload test (100 VUs burst)\n';
  summary += '  4. Priority queue validation\n';

  // Findings
  summary += '\n🔍 Key Findings:\n';

  const maxConcurrent = metrics.concurrent_requests?.values?.max || 0;
  if (maxConcurrent < 40) {
    summary += `  ⚠️  Concurrency limit appears to be ${maxConcurrent} (below expected 40)\n`;
  } else {
    summary += `  ✅ Handled ${maxConcurrent} concurrent requests successfully\n`;
  }

  if (metrics.circuit_breaker_trips?.values?.count > 0) {
    summary += '  ⚠️  Circuit breaker activated during testing\n';
  }

  if (metrics.throttled_requests?.values?.count > 50) {
    summary += '  ⚠️  Significant throttling detected - consider scaling strategy\n';
  }

  // Recommendations
  summary += '\n💡 Recommendations:\n';
  if (maxConcurrent < 30) {
    summary += '  • Consider migrating high-volume endpoints to Cloudflare Workers\n';
  }
  if (metrics.queue_wait_time?.values?.['p(95)'] > 5000) {
    summary += '  • Implement priority-based queue processing\n';
  }
  if (metrics.circuit_breaker_trips?.values?.count > 0) {
    summary += '  • Review circuit breaker thresholds and fallback mechanisms\n';
  }
  summary += '  • Monitor Edge Function metrics continuously in production\n';

  summary += '\n' + '='.repeat(60) + '\n';

  return summary;
}
