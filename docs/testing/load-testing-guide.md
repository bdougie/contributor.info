# Load Testing Guide for Supabase Edge Functions

## Overview

This guide documents the comprehensive load testing suite for validating the performance and reliability of Supabase Edge Function endpoints. The tests ensure the system can handle production traffic volumes and maintain stability under various load conditions.

## Prerequisites

### 1. Install k6

k6 is our load testing framework of choice. Install it using:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Environment Variables

Set the following environment variables:

```bash
export VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Or source from your `.env` file:

```bash
source .env
```

## Test Scenarios

### 1. Sustained Load Test (`01-sustained-load.js`)

**Purpose**: Validates system stability under normal production load

- **Rate**: 100 requests/second
- **Duration**: 5 minutes
- **Success Criteria**:
  - Error rate < 1%
  - p95 response time < 2 seconds

**Run individually**:
```bash
k6 run scripts/load-testing/01-sustained-load.js
```

### 2. Burst Traffic Test (`02-burst-traffic.js`)

**Purpose**: Tests system behavior during traffic spikes

- **Load**: 1000 requests in 10 seconds
- **Virtual Users**: 100 concurrent
- **Success Criteria**:
  - Error rate < 5%
  - p95 response time < 3 seconds
  - No rate limiting (429 responses)

**Run individually**:
```bash
k6 run scripts/load-testing/02-burst-traffic.js
```

### 3. Concurrent Connections Test (`03-concurrent-connections.js`)

**Purpose**: Validates connection pooling and concurrent request handling

- **Concurrent Users**: 50 constant
- **Duration**: 2 minutes
- **Success Criteria**:
  - Error rate < 1%
  - No connection timeouts
  - Stable response times

**Run individually**:
```bash
k6 run scripts/load-testing/03-concurrent-connections.js
```

### 4. Circuit Breaker Test (`04-circuit-breaker.js`)

**Purpose**: Validates failover mechanism and circuit breaker behavior

- **Simulated Failures**: 20% failure rate
- **Duration**: 3 minutes
- **Success Criteria**:
  - Circuit breaker opens after 3 failures
  - Successful failover to backup endpoint
  - 80% failover success rate

**Run individually**:
```bash
k6 run scripts/load-testing/04-circuit-breaker.js
```

### 5. Stress Test (`05-stress-test.js`)

**Purpose**: Identifies system breaking point and performance limits

- **Load Pattern**: Gradual increase from 0 to 300 VUs
- **Duration**: ~30 minutes
- **Stages**:
  1. Warm-up: 0 → 100 VUs (2m)
  2. Normal: 100 VUs (5m)
  3. Breaking: 100 → 300 VUs (7m)
  4. Recovery: 300 → 0 VUs (10m)

**Run individually**:
```bash
k6 run scripts/load-testing/05-stress-test.js
```

## Running All Tests

Use the provided test runner script:

```bash
cd scripts/load-testing
./run-tests.sh
```

The script will:
1. Check dependencies
2. Run all tests sequentially
3. Generate JSON results
4. Create an HTML report
5. Open the report in your browser

### Customizing Test Execution

Skip specific tests using environment variables:

```bash
# Skip stress test (takes 30 minutes)
RUN_STRESS=false ./run-tests.sh

# Run only specific tests
RUN_BURST=false RUN_CIRCUIT=false ./run-tests.sh
```

## Understanding Results

### Key Metrics

1. **Response Time Percentiles**
   - `p50`: Median response time
   - `p95`: 95% of requests are faster than this
   - `p99`: 99% of requests are faster than this

2. **Error Rates**
   - `http_req_failed`: Overall failure rate
   - `errors`: Custom error tracking

3. **Throughput**
   - `http_reqs`: Total requests made
   - `http_req_rate`: Requests per second

4. **Circuit Breaker Metrics**
   - `circuit_breaker_opens`: Times circuit opened
   - `failover_attempts`: Fallback attempts
   - `failover_successes`: Successful fallbacks

### Success Criteria

| Test | Max Error Rate | p95 Response Time | p99 Response Time |
|------|---------------|-------------------|-------------------|
| Sustained Load | < 1% | < 2s | < 5s |
| Burst Traffic | < 5% | < 3s | < 5s |
| Concurrent | < 1% | < 2s | < 5s |
| Circuit Breaker | < 10% | N/A | N/A |
| Stress Test | < 50% at peak | < 5s (median) | N/A |

## Interpreting Results

### Green Flags ✅

- Consistent response times under load
- Low error rates (< 1%)
- Successful circuit breaker operation
- Quick recovery after load reduction
- Linear performance degradation

### Red Flags 🚨

- Sudden spike in response times
- Error rate > 10% under normal load
- Connection timeouts
- Memory leaks (increasing response times over time)
- Circuit breaker failing to open

## Troubleshooting

### Common Issues

1. **"k6 is not installed"**
   - Install k6 following the prerequisites

2. **"SUPABASE_ANON_KEY not set"**
   - Export the environment variable or source your `.env` file

3. **High error rates**
   - Check Supabase dashboard for function logs
   - Verify Edge Function is deployed
   - Check for rate limiting

4. **Connection timeouts**
   - Verify network connectivity
   - Check Supabase service status
   - Review Edge Function timeout settings

### Performance Optimization Tips

1. **Reduce Cold Starts**
   - Keep functions warm with periodic health checks
   - Minimize function size and dependencies

2. **Optimize Database Queries**
   - Add appropriate indexes
   - Use connection pooling
   - Implement query result caching

3. **Implement Caching**
   - Cache frequently accessed data
   - Use CDN for static assets
   - Implement Redis for session data

4. **Scale Infrastructure**
   - Upgrade Supabase plan for higher limits
   - Implement horizontal scaling
   - Use load balancers

## Continuous Integration

Add load testing to your CI pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run Sustained Load Test
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          k6 run scripts/load-testing/01-sustained-load.js

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: scripts/load-testing/results/
```

## Monitoring During Tests

While tests are running, monitor:

1. **Supabase Dashboard**
   - Function invocations
   - Error rates
   - Response times

2. **Application Logs**
   - Circuit breaker state changes
   - Failover attempts
   - Error details

3. **k6 Real-time Metrics**
   - Watch console output for live metrics
   - Monitor VU (Virtual User) count
   - Track request rate

## Best Practices

1. **Test in Staging First**
   - Never run stress tests against production
   - Use a dedicated test environment

2. **Gradual Load Increase**
   - Start with low load tests
   - Gradually increase to stress tests

3. **Monitor Impact**
   - Watch for cascading failures
   - Monitor dependent services
   - Check database load

4. **Document Findings**
   - Record breaking points
   - Note performance bottlenecks
   - Track improvements over time

5. **Regular Testing**
   - Run tests after major changes
   - Schedule periodic performance audits
   - Compare results over time

## Related Documentation

- [Queue Event Migration](../infrastructure/queue-event-migration.md)
- [Idempotency Implementation](../infrastructure/idempotency-implementation.md)
- [Edge Function Monitoring](#485)
- [Concurrency Limits](#489)