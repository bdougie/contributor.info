/**
 * Circuit Breaker Test
 *
 * Tests the circuit breaker behavior under failure conditions.
 * Simulates failures and validates proper failover behavior.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { ENV, ENDPOINTS, generateTestEvent } from './config.js';

// Custom metrics for circuit breaker monitoring
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const circuitBreakerOpens = new Counter('circuit_breaker_opens');
const circuitBreakerCloses = new Counter('circuit_breaker_closes');
const failoverAttempts = new Counter('failover_attempts');
const failoverSuccesses = new Counter('failover_successes');
const primaryEndpointFailures = new Counter('primary_endpoint_failures');

// Circuit breaker state tracking
let circuitState = 'closed';
let consecutiveFailures = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT = 60000; // 60 seconds

// Test configuration
export const options = {
  scenarios: {
    circuit_breaker_test: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    circuit_breaker_opens: ['count<10'], // Circuit shouldn't open too frequently
    failover_successes: ['rate>0.8'], // 80% of failovers should succeed
  },
};

// Test setup
export function setup() {
  console.log('Starting Circuit Breaker Test');
  console.log('Configuration:');
  console.log(`- Primary: ${ENDPOINTS.supabase.url}`);
  console.log(`- Fallback: ${ENDPOINTS.netlify.url}`);
  console.log(`- Failure Threshold: ${FAILURE_THRESHOLD} consecutive failures`);
  console.log(`- Reset Timeout: ${RESET_TIMEOUT}ms`);
  console.log(`- Test Duration: 3 minutes`);
  console.log('----------------------------------------');

  return {
    startTime: Date.now(),
    primaryEndpoint: ENDPOINTS.supabase,
    fallbackEndpoint: ENDPOINTS.netlify,
    circuitBreakerEvents: [],
  };
}

// Simulate circuit breaker logic
function shouldUsePrimaryEndpoint() {
  if (circuitState === 'open') {
    // Check if enough time has passed to try half-open
    if (Date.now() - lastFailureTime >= RESET_TIMEOUT) {
      circuitState = 'half-open';
      circuitBreakerCloses.add(1);
      console.log('Circuit breaker moving to half-open state');
      return true; // Try primary
    }
    return false; // Use fallback
  }
  return true; // Use primary for closed or half-open state
}

function recordPrimarySuccess() {
  if (circuitState === 'half-open') {
    circuitState = 'closed';
    console.log('Circuit breaker closed after successful request');
  }
  consecutiveFailures = 0;
}

function recordPrimaryFailure(data) {
  consecutiveFailures++;
  lastFailureTime = Date.now();
  primaryEndpointFailures.add(1);

  if (consecutiveFailures >= FAILURE_THRESHOLD && circuitState !== 'open') {
    circuitState = 'open';
    circuitBreakerOpens.add(1);
    console.warn(`Circuit breaker OPENED after ${consecutiveFailures} failures`);

    // Record event
    data.circuitBreakerEvents.push({
      timestamp: new Date().toISOString(),
      event: 'opened',
      failures: consecutiveFailures,
    });
  }
}

// Main test function
export default function (data) {
  const event = generateTestEvent('circuit-breaker');
  const idempotencyKey = `circuit-${__VU}-${__ITER}`;

  // Determine which endpoint to use
  const usePrimary = shouldUsePrimaryEndpoint();
  const endpoint = usePrimary ? data.primaryEndpoint : data.fallbackEndpoint;

  // Simulate intermittent failures (20% failure rate on primary)
  const shouldSimulateFailure = usePrimary && Math.random() < 0.2 && __ITER % 10 === 0;

  const params = {
    headers: {
      ...endpoint.headers,
      'X-Idempotency-Key': idempotencyKey,
      'X-Test-Scenario': 'circuit-breaker',
      // Simulate failure with special header
      ...(shouldSimulateFailure ? { 'X-Simulate-Failure': 'true' } : {}),
    },
    timeout: '10s',
    tags: {
      scenario: 'circuit_breaker',
      endpoint: usePrimary ? 'primary' : 'fallback',
      circuit_state: circuitState,
    },
  };

  // Track failover attempt
  if (!usePrimary) {
    failoverAttempts.add(1);
  }

  // Send request
  const response = shouldSimulateFailure
    ? { status: 503, timings: { duration: 100 }, body: '{"error": "Simulated failure"}' }
    : http.post(endpoint.url, JSON.stringify(event), params);

  // Record metrics
  requestDuration.add(response.timings.duration);

  // Validate response
  const success = check(response, {
    'request succeeded': (r) => r.status === 200,
    'has valid response': (r) => {
      if (r.status !== 200) return false;
      try {
        const body = JSON.parse(r.body);
        return body.eventId !== undefined || body.success === true;
      } catch {
        return false;
      }
    },
  });

  // Update circuit breaker state based on primary endpoint results
  if (usePrimary) {
    if (success) {
      recordPrimarySuccess();
      successfulRequests.add(1);
      errorRate.add(false);
    } else {
      recordPrimaryFailure(data);
      failedRequests.add(1);
      errorRate.add(true);
    }
  } else {
    // Fallback endpoint result
    if (success) {
      failoverSuccesses.add(1);
      successfulRequests.add(1);
      errorRate.add(false);
    } else {
      failedRequests.add(1);
      errorRate.add(true);
      console.error('Failover to fallback endpoint also failed!');
    }
  }

  // Log circuit breaker state changes
  if (__ITER % 100 === 0) {
    console.log(
      `[Iteration ${__ITER}] Circuit State: ${circuitState}, Consecutive Failures: ${consecutiveFailures}`
    );
  }

  // Vary sleep based on circuit state
  const sleepTime = circuitState === 'open' ? 0.5 : 0.2;
  sleep(sleepTime);
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const totalRequests = successfulRequests.values + failedRequests.values;

  console.log('----------------------------------------');
  console.log('Circuit Breaker Test Complete');
  console.log(`Total Duration: ${duration.toFixed(2)}s`);
  console.log(`Circuit Breaker Opens: ${circuitBreakerOpens.values}`);
  console.log(`Circuit Breaker Closes: ${circuitBreakerCloses.values}`);
  console.log('----------------------------------------');

  // Generate summary report
  const summary = {
    test: 'Circuit Breaker Test',
    duration: `${duration.toFixed(2)}s`,
    circuitBreakerBehavior: {
      opens: circuitBreakerOpens.values,
      closes: circuitBreakerCloses.values,
      failureThreshold: FAILURE_THRESHOLD,
      resetTimeout: `${RESET_TIMEOUT}ms`,
      events: data.circuitBreakerEvents,
    },
    endpoints: {
      primaryFailures: primaryEndpointFailures.values,
      failoverAttempts: failoverAttempts.values,
      failoverSuccesses: failoverSuccesses.values,
      failoverSuccessRate:
        failoverAttempts.values > 0
          ? ((failoverSuccesses.values / failoverAttempts.values) * 100).toFixed(2) + '%'
          : 'N/A',
    },
    results: {
      totalRequests,
      successfulRequests: successfulRequests.values,
      failedRequests: failedRequests.values,
      overallSuccessRate: ((successfulRequests.values / totalRequests) * 100).toFixed(2) + '%',
    },
  };

  console.log('Test Summary:');
  console.log(JSON.stringify(summary, null, 2));

  // Analysis
  if (circuitBreakerOpens.values === 0) {
    console.warn('⚠️  Circuit breaker never opened - may need to adjust test parameters');
  }
  if (failoverSuccesses.values < failoverAttempts.values * 0.8) {
    console.error('❌ Failover success rate below 80% threshold!');
  }
  if (circuitBreakerOpens.values > 10) {
    console.warn('⚠️  Circuit breaker opened too frequently - possible instability');
  }

  return summary;
}
