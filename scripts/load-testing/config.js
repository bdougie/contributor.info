/**
 * Load Testing Configuration
 *
 * Central configuration for all load test scenarios
 */

// Environment configuration
export const ENV = {
  // Supabase Edge Function configuration
  SUPABASE_URL: __ENV.SUPABASE_URL || __ENV.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: __ENV.SUPABASE_ANON_KEY || __ENV.VITE_SUPABASE_ANON_KEY || '',

  // Netlify Function configuration (fallback)
  NETLIFY_URL: __ENV.NETLIFY_URL || 'http://localhost:8888',

  // Test configuration
  USE_PRODUCTION: __ENV.USE_PRODUCTION === 'true',
  ENABLE_CIRCUIT_BREAKER_TEST: __ENV.ENABLE_CIRCUIT_BREAKER_TEST === 'true',
  VERBOSE: __ENV.VERBOSE === 'true',
};

// Validate required environment variables
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error('❌ Required environment variables not set!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.error(
    'Example: k6 run -e VITE_SUPABASE_URL=your-url -e VITE_SUPABASE_ANON_KEY=your-key test.js'
  );
}

// Endpoint configurations
export const ENDPOINTS = {
  supabase: {
    name: 'Supabase Edge Function',
    url: `${ENV.SUPABASE_URL}/functions/v1/queue-event`,
    headers: {
      'Content-Type': 'application/json',
      apikey: ENV.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
    },
    timeout: '150s', // Edge Function timeout
  },
  netlify: {
    name: 'Netlify Function',
    url: `${ENV.NETLIFY_URL}/api/queue-event`,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s', // Netlify Function timeout
  },
};

// Test event generators
export function generateTestEvent(scenario = 'load-test') {
  return {
    eventName: `test/${scenario}.k6`,
    data: {
      timestamp: new Date().toISOString(),
      scenario,
      testId: Math.random().toString(36).substring(7),
      source: 'k6-load-test',
      metadata: {
        iteration: __ITER || 0,
        vu: __VU || 0,
      },
    },
  };
}

// Large payload generator for stress testing
export function generateLargePayload(sizeKB = 100) {
  const chunk = 'x'.repeat(1024); // 1KB chunk
  const largeData = Array(sizeKB).fill(chunk).join('');

  return {
    eventName: 'test/large-payload.k6',
    data: {
      timestamp: new Date().toISOString(),
      largeData,
      sizeKB,
      metadata: {
        iteration: __ITER || 0,
        vu: __VU || 0,
      },
    },
  };
}

// Performance thresholds
export const THRESHOLDS = {
  // Response time thresholds
  http_req_duration: [
    { threshold: 'p(50)<1000', abortOnFail: false }, // 50% of requests should be below 1s
    { threshold: 'p(95)<2000', abortOnFail: false }, // 95% of requests should be below 2s
    { threshold: 'p(99)<5000', abortOnFail: true }, // 99% of requests should be below 5s
  ],

  // Error rate thresholds
  http_req_failed: [
    { threshold: 'rate<0.1', abortOnFail: true }, // Error rate should be below 10%
  ],

  // Custom metrics thresholds
  circuit_breaker_opens: [
    { threshold: 'count<5', abortOnFail: false }, // Circuit breaker shouldn't open more than 5 times
  ],

  duplicate_requests: [
    { threshold: 'rate<0.01', abortOnFail: false }, // Duplicate detection rate should be low
  ],
};

// Test scenarios configuration
export const SCENARIOS = {
  // Sustained load test
  sustained_load: {
    executor: 'constant-arrival-rate',
    rate: 100, // 100 requests per second
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 50,
    maxVUs: 200,
  },

  // Burst traffic test
  burst_traffic: {
    executor: 'shared-iterations',
    vus: 100,
    iterations: 1000,
    maxDuration: '10s',
  },

  // Concurrent connections test
  concurrent_connections: {
    executor: 'constant-vus',
    vus: 50,
    duration: '2m',
  },

  // Ramp up/down test
  ramp_test: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 200,
    stages: [
      { duration: '1m', target: 50 }, // Ramp up to 50 req/s
      { duration: '2m', target: 100 }, // Ramp up to 100 req/s
      { duration: '2m', target: 100 }, // Stay at 100 req/s
      { duration: '1m', target: 200 }, // Ramp up to 200 req/s
      { duration: '2m', target: 200 }, // Stay at 200 req/s
      { duration: '2m', target: 0 }, // Ramp down to 0
    ],
  },

  // Stress test with increasing load
  stress_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 }, // Below normal load
      { duration: '5m', target: 100 }, // Normal load
      { duration: '2m', target: 200 }, // Around breaking point
      { duration: '5m', target: 200 }, // At breaking point
      { duration: '2m', target: 300 }, // Beyond breaking point
      { duration: '5m', target: 300 }, // Beyond breaking point
      { duration: '10m', target: 0 }, // Recovery
    ],
  },

  // Spike test
  spike_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 }, // Warm up
      { duration: '1m', target: 100 }, // Stay at 100
      { duration: '10s', target: 1000 }, // Spike to 1000
      { duration: '3m', target: 1000 }, // Stay at 1000
      { duration: '10s', target: 100 }, // Scale down
      { duration: '3m', target: 100 }, // Recovery
      { duration: '10s', target: 0 }, // Ramp down
    ],
  },

  // Circuit breaker test
  circuit_breaker_test: {
    executor: 'constant-arrival-rate',
    rate: 200, // High rate to trigger circuit breaker
    timeUnit: '1s',
    duration: '3m',
    preAllocatedVUs: 100,
    maxVUs: 300,
  },
};

// Helper function to select endpoint
export function selectEndpoint(useSupabase = true) {
  return useSupabase ? ENDPOINTS.supabase : ENDPOINTS.netlify;
}

// Helper function to log metrics
export function logMetrics(response, scenario) {
  if (ENV.VERBOSE) {
    console.log(
      `[${scenario}] Status: ${response.status}, Duration: ${response.timings.duration}ms`
    );
  }
}
