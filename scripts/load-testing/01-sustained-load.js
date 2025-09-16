/**
 * Sustained Load Test
 *
 * Tests the system's ability to handle a constant load of 100 requests per second
 * for 5 minutes. This simulates normal production traffic.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { ENV, ENDPOINTS, generateTestEvent, SCENARIOS, logMetrics } from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test configuration
export const options = {
  scenarios: {
    sustained_load: SCENARIOS.sustained_load,
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% error rate
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    errors: ['rate<0.01'],
  },
};

// Test setup
export function setup() {
  console.log('Starting Sustained Load Test');
  console.log('Configuration:');
  console.log(`- Target: ${ENDPOINTS.supabase.url}`);
  console.log(`- Rate: 100 requests/second`);
  console.log(`- Duration: 5 minutes`);
  console.log(`- Max VUs: ${SCENARIOS.sustained_load.maxVUs}`);
  console.log('----------------------------------------');

  return {
    startTime: Date.now(),
    endpoint: ENDPOINTS.supabase,
  };
}

// Main test function
export default function (data) {
  const event = generateTestEvent('sustained-load');

  // Add idempotency key for deduplication testing
  const idempotencyKey = `sustained-${__VU}-${__ITER}`;

  const params = {
    headers: {
      ...data.endpoint.headers,
      'X-Idempotency-Key': idempotencyKey,
    },
    timeout: '30s',
    tags: {
      scenario: 'sustained_load',
    },
  };

  // Send request
  const response = http.post(data.endpoint.url, JSON.stringify(event), params);

  // Record metrics
  requestDuration.add(response.timings.duration);
  logMetrics(response, 'sustained_load');

  // Validate response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has eventId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.eventId !== undefined || body.success === true;
      } catch {
        return false;
      }
    },
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  // Track success/failure
  if (success) {
    successfulRequests.add(1);
    errorRate.add(false);
  } else {
    failedRequests.add(1);
    errorRate.add(true);

    // Log error details for debugging
    if (response.status !== 200) {
      console.error(`Request failed: Status ${response.status}, Body: ${response.body}`);
    }
  }

  // Small sleep to prevent overwhelming the system
  sleep(0.1);
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('----------------------------------------');
  console.log('Sustained Load Test Complete');
  console.log(`Total Duration: ${duration}s`);
  console.log('----------------------------------------');

  // Generate summary report
  const summary = {
    test: 'Sustained Load Test',
    duration: `${duration}s`,
    configuration: {
      rate: '100 req/s',
      duration: '5 minutes',
    },
    results: {
      totalRequests: successfulRequests.values + failedRequests.values,
      successfulRequests: successfulRequests.values,
      failedRequests: failedRequests.values,
    },
  };

  console.log('Test Summary:');
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}
