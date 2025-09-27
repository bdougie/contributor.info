/**
 * Concurrent Connections Test
 *
 * Tests the system's ability to handle multiple simultaneous connections.
 * Maintains 50 concurrent virtual users for 2 minutes.
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
const concurrentRequests = new Gauge('concurrent_requests');
const activeConnections = new Gauge('active_connections');

// Test configuration
export const options = {
  scenarios: {
    concurrent_connections: SCENARIOS.concurrent_connections,
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% error rate
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_waiting: ['p(95)<1500'], // 95% of wait time should be below 1.5s
  },
};

// Track active connections
let connectionCount = 0;

// Test setup
export function setup() {
  console.log('Starting Concurrent Connections Test');
  console.log('Configuration:');
  console.log(`- Target: ${ENDPOINTS.supabase.url}`);
  console.log(`- Concurrent Users: 50`);
  console.log(`- Duration: 2 minutes`);
  console.log('----------------------------------------');

  return {
    startTime: Date.now(),
    endpoint: ENDPOINTS.supabase,
    maxConcurrency: 0,
  };
}

// Main test function
export default function (data) {
  // Track concurrent connections
  connectionCount++;
  activeConnections.add(connectionCount);
  concurrentRequests.add(__VU);

  // Update max concurrency
  if (connectionCount > data.maxConcurrency) {
    data.maxConcurrency = connectionCount;
  }

  try {
    const event = generateTestEvent('concurrent-connections');

    // Add idempotency key
    const idempotencyKey = `concurrent-${__VU}-${__ITER}`;

    const params = {
      headers: {
        ...data.endpoint.headers,
        'X-Idempotency-Key': idempotencyKey,
        'X-Virtual-User': String(__VU),
      },
      timeout: '30s',
      tags: {
        scenario: 'concurrent_connections',
        vu: __VU,
      },
    };

    // Send request
    const response = http.post(data.endpoint.url, JSON.stringify(event), params);

    // Record metrics
    requestDuration.add(response.timings.duration);

    // Check for connection pooling issues
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
      'no connection errors': (r) => r.status !== 0 && r.status !== 503,
      'no timeout': (r) => r.timings.duration < 30000,
      'connection established': (r) => r.timings.connecting < 1000,
    });

    // Track success/failure
    if (success) {
      successfulRequests.add(1);
      errorRate.add(false);
    } else {
      failedRequests.add(1);
      errorRate.add(true);

      // Log connection-specific errors
      if (response.status === 0) {
        console.error(`Connection failed for VU ${__VU}`);
      } else if (response.status === 503) {
        console.warn(`Service overloaded - VU ${__VU}`);
      } else if (response.timings.connecting > 1000) {
        console.warn(
          `Slow connection establishment - VU ${__VU}: ${response.timings.connecting}ms`
        );
      }
    }

    // Vary sleep to simulate real user behavior
    const sleepTime = 0.5 + Math.random() * 1.5; // 0.5-2 seconds
    sleep(sleepTime);
  } finally {
    // Decrement connection count
    connectionCount--;
    activeConnections.add(connectionCount);
  }
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const totalRequests = successfulRequests.values + failedRequests.values;
  const avgRequestsPerVU = totalRequests / 50;

  console.log('----------------------------------------');
  console.log('Concurrent Connections Test Complete');
  console.log(`Total Duration: ${duration.toFixed(2)}s`);
  console.log(`Peak Concurrent Connections: ${data.maxConcurrency}`);
  console.log('----------------------------------------');

  // Generate summary report
  const summary = {
    test: 'Concurrent Connections Test',
    duration: `${duration.toFixed(2)}s`,
    configuration: {
      concurrentUsers: 50,
      testDuration: '2 minutes',
    },
    performance: {
      peakConcurrency: data.maxConcurrency,
      avgRequestsPerUser: avgRequestsPerVU.toFixed(2),
      totalRequests,
    },
    results: {
      successfulRequests: successfulRequests.values,
      failedRequests: failedRequests.values,
      successRate: ((successfulRequests.values / totalRequests) * 100).toFixed(2) + '%',
    },
  };

  console.log('Test Summary:');
  console.log(JSON.stringify(summary, null, 2));

  // Analysis
  if (data.maxConcurrency < 45) {
    console.warn("⚠️  System couldn't maintain expected concurrent connections!");
  }
  if (failedRequests.values > 0) {
    console.warn(`⚠️  ${failedRequests.values} requests failed under concurrent load!`);
  }

  return summary;
}
