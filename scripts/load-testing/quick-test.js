#!/usr/bin/env node

/**
 * Quick Load Test Script
 *
 * A simple Node.js script for basic load testing without k6
 * Useful for quick validation and simple scenarios
 */

import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY not set!');
  console.error('Please set VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

// Test scenarios
const scenarios = {
  quick: {
    name: 'Quick Test',
    requests: 10,
    concurrent: 2,
    delay: 100,
  },
  sustained: {
    name: 'Sustained Load',
    requests: 100,
    concurrent: 10,
    delay: 100,
  },
  burst: {
    name: 'Burst Traffic',
    requests: 50,
    concurrent: 50,
    delay: 0,
  },
  stress: {
    name: 'Stress Test',
    requests: 500,
    concurrent: 25,
    delay: 50,
  },
};

// Metrics tracking
class Metrics {
  constructor() {
    this.requests = 0;
    this.successful = 0;
    this.failed = 0;
    this.durations = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  recordSuccess(duration) {
    this.requests++;
    this.successful++;
    this.durations.push(duration);
  }

  recordFailure(error) {
    this.requests++;
    this.failed++;
    this.errors.push(error);
  }

  getStats() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const sortedDurations = [...this.durations].sort((a, b) => a - b);

    return {
      total: this.requests,
      successful: this.successful,
      failed: this.failed,
      successRate: ((this.successful / this.requests) * 100).toFixed(2) + '%',
      totalTime: totalTime.toFixed(2) + 's',
      requestsPerSecond: (this.requests / totalTime).toFixed(2),
      avgDuration:
        this.durations.length > 0
          ? (this.durations.reduce((a, b) => a + b, 0) / this.durations.length).toFixed(2) + 'ms'
          : 'N/A',
      p50: sortedDurations[Math.floor(sortedDurations.length * 0.5)] + 'ms',
      p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)] + 'ms',
      p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)] + 'ms',
      errors: this.errors.slice(0, 5),
    };
  }
}

// Send a single request
function sendRequest(metrics, requestId) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(`${SUPABASE_URL}/functions/v1/queue-event`);

    const data = JSON.stringify({
      eventName: 'test/quick-load.test',
      data: {
        timestamp: new Date().toISOString(),
        requestId,
        source: 'quick-test',
      },
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'X-Idempotency-Key': `quick-test-${requestId}`,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;

        if (res.statusCode === 200) {
          metrics.recordSuccess(duration);
          process.stdout.write('.');
        } else {
          metrics.recordFailure({
            status: res.statusCode,
            message: responseData.substring(0, 100),
          });
          process.stdout.write('x');
        }

        resolve();
      });
    });

    req.on('error', (error) => {
      metrics.recordFailure({
        message: error.message,
      });
      process.stdout.write('!');
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      metrics.recordFailure({
        message: 'Request timeout',
      });
      process.stdout.write('T');
      resolve();
    });

    req.setTimeout(30000); // 30 second timeout
    req.write(data);
    req.end();
  });
}

// Run concurrent requests
async function runConcurrentBatch(metrics, batchSize, startId) {
  const promises = [];

  for (let i = 0; i < batchSize; i++) {
    promises.push(sendRequest(metrics, startId + i));
  }

  await Promise.all(promises);
}

// Main test runner
async function runTest(scenario) {
  console.log(`\n🚀 Running ${scenario.name} Test`);
  console.log(`   Requests: ${scenario.requests}`);
  console.log(`   Concurrent: ${scenario.concurrent}`);
  console.log(`   Delay: ${scenario.delay}ms\n`);
  console.log('Progress: ');

  const metrics = new Metrics();
  let requestId = 0;

  // Process requests in batches
  while (requestId < scenario.requests) {
    const batchSize = Math.min(scenario.concurrent, scenario.requests - requestId);
    await runConcurrentBatch(metrics, batchSize, requestId);
    requestId += batchSize;

    // Add delay between batches
    if (scenario.delay > 0 && requestId < scenario.requests) {
      await new Promise((resolve) => setTimeout(resolve, scenario.delay));
    }
  }

  console.log('\n');
  return metrics;
}

// Display results
function displayResults(metrics, scenarioName) {
  const stats = metrics.getStats();

  console.log('\n📊 Test Results');
  console.log('═'.repeat(50));
  console.log(`Test: ${scenarioName}`);
  console.log(`Duration: ${stats.totalTime}`);
  console.log(`Requests: ${stats.total}`);
  console.log(`Successful: ${stats.successful} (${stats.successRate})`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Req/sec: ${stats.requestsPerSecond}`);
  console.log('\nResponse Times:');
  console.log(`  Average: ${stats.avgDuration}`);
  console.log(`  p50: ${stats.p50}`);
  console.log(`  p95: ${stats.p95}`);
  console.log(`  p99: ${stats.p99}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors (first 5):');
    stats.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.message || `Status ${error.status}`}`);
    });
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  if (stats.failed === 0) {
    console.log('✅ All requests succeeded!');
  } else if (stats.failed < stats.total * 0.05) {
    console.log('⚠️  Some requests failed but within acceptable range (< 5%)');
  } else {
    console.log('❌ High failure rate detected!');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const scenarioName = args[0] || 'quick';

  if (scenarioName === 'help' || scenarioName === '--help') {
    console.log('Usage: node quick-test.js [scenario]');
    console.log('\nAvailable scenarios:');
    Object.entries(scenarios).forEach(([key, value]) => {
      console.log(
        `  ${key.padEnd(12)} - ${value.name} (${value.requests} requests, ${value.concurrent} concurrent)`
      );
    });
    console.log('\nExample:');
    console.log('  node quick-test.js sustained');
    process.exit(0);
  }

  const scenario = scenarios[scenarioName];

  if (!scenario) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', Object.keys(scenarios).join(', '));
    process.exit(1);
  }

  console.log('🔧 Quick Load Testing Tool');
  console.log('═'.repeat(50));
  console.log(`Target: ${SUPABASE_URL}`);

  try {
    const metrics = await runTest(scenario);
    displayResults(metrics, scenario.name);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { sendRequest, runTest, Metrics };
