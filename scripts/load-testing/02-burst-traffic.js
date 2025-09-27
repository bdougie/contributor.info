/**
 * Burst Traffic Test
 *
 * Tests the system's ability to handle sudden bursts of traffic.
 * Sends 1000 requests in 10 seconds using 100 virtual users.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { ENV, ENDPOINTS, generateTestEvent, SCENARIOS } from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const requestsPerSecond = new Gauge('requests_per_second');

// Test configuration
export const options = {
  scenarios: {
    burst_traffic: SCENARIOS.burst_traffic,
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // Less than 5% error rate (higher tolerance for burst)
    http_req_duration: ['p(95)<3000'], // 95% of requests should be below 3s
    errors: ['rate<0.05'],
  },
};

// Test setup
export function setup() {
  console.log('Starting Burst Traffic Test');
  console.log('Configuration:');
  console.log(`- Target: ${ENDPOINTS.supabase.url}`);
  console.log(`- Total Requests: 1000`);
  console.log(`- Virtual Users: 100`);
  console.log(`- Max Duration: 10 seconds`);
  console.log('----------------------------------------');

  return {
    startTime: Date.now(),
    endpoint: ENDPOINTS.supabase,
    requestCount: 0,
  };
}

// Main test function
export default function (data) {
  const event = generateTestEvent('burst-traffic');

  // Add idempotency key
  const idempotencyKey = `burst-${__VU}-${__ITER}`;

  const params = {
    headers: {
      ...data.endpoint.headers,
      'X-Idempotency-Key': idempotencyKey,
    },
    timeout: '30s',
    tags: {
      scenario: 'burst_traffic',
    },
  };

  // Record start time for RPS calculation
  const startTime = Date.now();

  // Send request
  const response = http.post(data.endpoint.url, JSON.stringify(event), params);

  // Calculate requests per second
  const currentTime = Date.now();
  const elapsedSeconds = (currentTime - data.startTime) / 1000;
  if (elapsedSeconds > 0) {
    requestsPerSecond.add((__ITER + 1) / elapsedSeconds);
  }

  // Record metrics
  requestDuration.add(response.timings.duration);

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
    'response time < 3000ms': (r) => r.timings.duration < 3000,
    'no rate limiting': (r) => r.status !== 429,
  });

  // Track success/failure
  if (success) {
    successfulRequests.add(1);
    errorRate.add(false);
  } else {
    failedRequests.add(1);
    errorRate.add(true);

    // Log specific error types
    if (response.status === 429) {
      console.warn('Rate limiting detected!');
    } else if (response.status === 503) {
      console.warn('Service unavailable - possible overload');
    } else if (response.status !== 200) {
      console.error(`Request failed: Status ${response.status}`);
    }
  }

  // Minimal sleep to allow burst behavior
  sleep(0.01);
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const totalRequests = successfulRequests.values + failedRequests.values;
  const actualRPS = totalRequests / duration;

  console.log('----------------------------------------');
  console.log('Burst Traffic Test Complete');
  console.log(`Total Duration: ${duration.toFixed(2)}s`);
  console.log(`Actual Requests Per Second: ${actualRPS.toFixed(2)}`);
  console.log('----------------------------------------');

  // Generate summary report
  const summary = {
    test: 'Burst Traffic Test',
    duration: `${duration.toFixed(2)}s`,
    configuration: {
      totalRequests: 1000,
      virtualUsers: 100,
      maxDuration: '10s',
    },
    performance: {
      actualRPS: actualRPS.toFixed(2),
      expectedRPS: 100,
    },
    results: {
      totalRequests,
      successfulRequests: successfulRequests.values,
      failedRequests: failedRequests.values,
      successRate: ((successfulRequests.values / totalRequests) * 100).toFixed(2) + '%',
    },
  };

  console.log('Test Summary:');
  console.log(JSON.stringify(summary, null, 2));

  // Warnings
  if (failedRequests.values > totalRequests * 0.05) {
    console.warn('⚠️  High failure rate detected during burst traffic!');
  }
  if (actualRPS < 90) {
    console.warn("⚠️  System couldn't sustain expected request rate during burst!");
  }

  return summary;
}
