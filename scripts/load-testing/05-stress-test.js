/**
 * Stress Test
 *
 * Gradually increases load to find the system's breaking point.
 * Ramps up from 0 to 300 VUs over time to identify performance degradation.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { ENV, ENDPOINTS, generateTestEvent, generateLargePayload, SCENARIOS } from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const timeouts = new Counter('timeouts');
const connectionErrors = new Counter('connection_errors');
const serverErrors = new Counter('server_errors_5xx');
const currentLoad = new Gauge('current_load_vus');

// Performance degradation tracking
let performanceBaseline = null;
let degradationPoints = [];

// Test configuration
export const options = {
  scenarios: {
    stress_test: SCENARIOS.stress_test,
  },
  thresholds: {
    http_req_failed: ['rate<0.5'], // Allow up to 50% failure at peak
    http_req_duration: ['p(50)<5000'], // Median should stay below 5s
  },
};

// Test setup
export function setup() {
  console.log('Starting Stress Test');
  console.log('Configuration:');
  console.log(`- Target: ${ENDPOINTS.supabase.url}`);
  console.log(`- Max VUs: 300`);
  console.log(`- Duration: ~30 minutes`);
  console.log('- Stages:');
  console.log('  1. Warm-up: 0 → 100 VUs (2m)');
  console.log('  2. Normal: 100 VUs (5m)');
  console.log('  3. Breaking: 100 → 300 VUs (7m)');
  console.log('  4. Recovery: 300 → 0 VUs (10m)');
  console.log('----------------------------------------');

  return {
    startTime: Date.now(),
    endpoint: ENDPOINTS.supabase,
    performanceHistory: [],
    breakingPoint: null,
  };
}

// Main test function
export default function (data) {
  currentLoad.add(__VU);

  // Use larger payloads as stress increases
  const uselargePayload = __VU > 150;
  const event = uselargePayload
    ? generateLargePayload(50) // 50KB payload
    : generateTestEvent('stress-test');

  const idempotencyKey = `stress-${__VU}-${__ITER}`;

  const params = {
    headers: {
      ...data.endpoint.headers,
      'X-Idempotency-Key': idempotencyKey,
      'X-Load-Level': String(__VU),
    },
    timeout: '30s',
    tags: {
      scenario: 'stress_test',
      load_level: __VU <= 100 ? 'normal' : __VU <= 200 ? 'high' : 'extreme',
    },
  };

  // Send request
  const startTime = Date.now();
  const response = http.post(data.endpoint.url, JSON.stringify(event), params);
  const endTime = Date.now();

  // Record metrics
  requestDuration.add(response.timings.duration);

  // Track performance baseline (first 100 requests)
  if (!performanceBaseline && __ITER < 100 && response.status === 200) {
    if (!data.performanceHistory.baseline) {
      data.performanceHistory.baseline = [];
    }
    data.performanceHistory.baseline.push(response.timings.duration);

    if (data.performanceHistory.baseline.length === 100) {
      const avgBaseline = data.performanceHistory.baseline.reduce((a, b) => a + b, 0) / 100;
      performanceBaseline = avgBaseline;
      console.log(`Performance Baseline Established: ${avgBaseline.toFixed(2)}ms`);
    }
  }

  // Detect performance degradation
  if (performanceBaseline && response.timings.duration > performanceBaseline * 2) {
    degradationPoints.push({
      vus: __VU,
      duration: response.timings.duration,
      ratio: response.timings.duration / performanceBaseline,
    });
  }

  // Comprehensive response validation
  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'no timeout': (r) => r.status !== 0 && r.timings.duration < 30000,
    'no server error': (r) => r.status < 500,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'response time < 10s': (r) => r.timings.duration < 10000,
  });

  // Categorize failures
  if (response.status === 200) {
    successfulRequests.add(1);
    errorRate.add(false);
  } else {
    failedRequests.add(1);
    errorRate.add(true);

    // Track failure types
    if (response.status === 0 || response.error_code === 1050) {
      timeouts.add(1);
      console.error(`Timeout at ${__VU} VUs`);
    } else if (response.status >= 500) {
      serverErrors.add(1);
      console.error(`Server error (${response.status}) at ${__VU} VUs`);

      // Mark breaking point
      if (!data.breakingPoint && serverErrors.values > 10) {
        data.breakingPoint = {
          vus: __VU,
          timestamp: new Date().toISOString(),
          errorRate: failedRequests.values / (successfulRequests.values + failedRequests.values),
        };
        console.warn(`🔴 BREAKING POINT DETECTED at ${__VU} VUs`);
      }
    } else if (response.error_code) {
      connectionErrors.add(1);
    }
  }

  // Log status at regular intervals
  if (__ITER % 100 === 0) {
    const totalReqs = successfulRequests.values + failedRequests.values;
    const currentErrorRate = failedRequests.values / totalReqs;
    console.log(
      `[VUs: ${__VU}] Requests: ${totalReqs}, Error Rate: ${(currentErrorRate * 100).toFixed(2)}%`
    );
  }

  // Adaptive sleep based on load level
  const sleepTime = __VU > 200 ? 0.1 : __VU > 100 ? 0.3 : 0.5;
  sleep(sleepTime);
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const totalRequests = successfulRequests.values + failedRequests.values;

  console.log('----------------------------------------');
  console.log('Stress Test Complete');
  console.log(`Total Duration: ${(duration / 60).toFixed(2)} minutes`);
  console.log('----------------------------------------');

  // Calculate statistics
  const errorRate = failedRequests.values / totalRequests;
  const avgDegradation =
    degradationPoints.length > 0
      ? degradationPoints.reduce((a, b) => a + b.ratio, 0) / degradationPoints.length
      : 1;

  // Generate summary report
  const summary = {
    test: 'Stress Test',
    duration: `${(duration / 60).toFixed(2)} minutes`,
    performance: {
      baseline: performanceBaseline ? `${performanceBaseline.toFixed(2)}ms` : 'Not established',
      avgDegradation: `${avgDegradation.toFixed(2)}x`,
      degradationPoints: degradationPoints.slice(0, 5), // First 5 degradation points
    },
    breakingPoint: data.breakingPoint || {
      vus: 'Not reached',
      note: 'System handled maximum load',
    },
    failures: {
      total: failedRequests.values,
      timeouts: timeouts.values,
      serverErrors: serverErrors.values,
      connectionErrors: connectionErrors.values,
    },
    results: {
      totalRequests,
      successfulRequests: successfulRequests.values,
      failedRequests: failedRequests.values,
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
    },
  };

  console.log('Test Summary:');
  console.log(JSON.stringify(summary, null, 2));

  // Analysis and recommendations
  console.log('\n📊 Analysis:');

  if (data.breakingPoint) {
    console.log(`❌ System breaking point: ${data.breakingPoint.vus} VUs`);
    console.log('   Recommendation: Optimize for handling > 200 concurrent users');
  } else {
    console.log('✅ System handled maximum test load without breaking');
  }

  if (avgDegradation > 3) {
    console.log(
      `⚠️  Significant performance degradation (${avgDegradation.toFixed(2)}x) under load`
    );
    console.log('   Recommendation: Implement caching or optimize database queries');
  }

  if (timeouts.values > totalRequests * 0.05) {
    console.log('⚠️  High timeout rate detected');
    console.log('   Recommendation: Increase timeout limits or optimize slow endpoints');
  }

  return summary;
}
