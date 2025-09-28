# Idempotency Load Testing Suite

## Overview

This comprehensive load testing suite validates the idempotency mechanism in our Supabase Edge Functions, ensuring duplicate requests are properly handled under various traffic conditions.

## Key Features

- **k6 Load Testing**: Professional-grade performance testing
- **Multiple Scenarios**: Sustained load, burst traffic, concurrent requests
- **Custom Metrics**: Duplicate detection rate, cache hit rate, race condition tracking
- **HTML Reports**: Visual dashboards with performance metrics
- **Quick Tests**: Node.js script for rapid validation

## Test Scenarios

### 1. Sustained Load Test
- **Rate**: 100 requests/second for 2 minutes
- **Purpose**: Validate consistent performance under normal load
- **Key Metrics**: Response time p95, duplicate detection rate

### 2. Burst Traffic Test
- **Pattern**: 1000 requests in 10 seconds
- **Purpose**: Test race condition handling
- **Key Metrics**: Race condition errors, cache performance

### 3. Concurrent Connections Test
- **Configuration**: 20 VUs × 5 iterations with same key
- **Purpose**: Validate mutex/locking mechanisms
- **Key Metrics**: Unique event IDs, processing conflicts

## Performance Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **Success Rate** | > 99% | Overall request success |
| **p95 Response Time** | < 2s | 95th percentile latency |
| **Duplicate Detection** | > 80% | Correctly identified duplicates |
| **Cache Hit Rate** | > 70% | Cached response usage |
| **Race Conditions** | < 10 | Concurrent processing errors |

## Setup

### Prerequisites

1. **Install k6**:
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   choco install k6
   ```

2. **Set Environment Variables**:
   ```bash
   # Copy example file
   cp .env.example .env

   # Edit with your values
   export VITE_SUPABASE_URL=https://your-project.supabase.co
   export VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Running Tests

### Quick Test (Node.js)
```bash
# Run basic idempotency validation
node scripts/testing-tools/test-idempotency.js
```

### Full Test Suite
```bash
# Run all scenarios with HTML reports
./scripts/load-testing/run-idempotency-tests.sh all

# Run specific scenario
./scripts/load-testing/run-idempotency-tests.sh sustained
./scripts/load-testing/run-idempotency-tests.sh burst
./scripts/load-testing/run-idempotency-tests.sh concurrent
```

### Individual k6 Tests
```bash
# Run with custom parameters
k6 run scripts/load-testing/idempotency-load-test.js

# With specific scenario
k6 run -e SCENARIO=burst_duplicates scripts/load-testing/idempotency-load-test.js

# With custom VUs and duration
k6 run --vus 100 --duration 5m scripts/load-testing/idempotency-load-test.js
```

## Test Results

Results are saved in `scripts/load-testing/results/idempotency/` with:
- JSON metrics data
- Log files
- HTML reports
- Performance summaries

## Interpreting Results

### Success Criteria ✅

- **Error rate < 1%**: System stability under load
- **p95 < 2 seconds**: Acceptable user experience
- **Duplicate detection > 80%**: Idempotency working correctly
- **Cache hit > 70%**: Efficient duplicate handling
- **Race conditions < 10**: Proper concurrency control

### Warning Signs ⚠️

- **High race condition count**: Need better locking mechanism
- **Low cache hit rate**: Cache TTL might be too short
- **Increasing response times**: Database bottleneck
- **Duplicate detection < 50%**: Critical idempotency failure

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run Idempotency Tests
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  run: |
    ./scripts/load-testing/run-idempotency-tests.sh all

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: idempotency-test-results
    path: scripts/load-testing/results/
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Duplicate Request Rate**: Track percentage of duplicate detections
2. **Cache Performance**: Monitor hit/miss ratio
3. **Race Conditions**: Alert on concurrent processing conflicts
4. **Response Time**: Track p50, p95, p99 percentiles
5. **Error Rate**: Alert if > 1%

### Recommended Dashboards

- Grafana dashboard with k6 metrics
- Supabase dashboard for database performance
- Custom alerts for threshold violations

## Troubleshooting

### Common Issues

1. **"k6 not installed"**
   - Follow installation instructions above
   - Verify with: `k6 version`

2. **"Environment variables not set"**
   - Check .env file exists
   - Source environment: `source .env`
   - Verify: `echo $VITE_SUPABASE_URL`

3. **"High race condition errors"**
   - Check database connection pooling
   - Review Edge Function concurrency settings
   - Consider implementing distributed locking

4. **"Low cache hit rate"**
   - Increase cache TTL in Edge Function
   - Review cache key generation logic
   - Monitor cache eviction patterns

## Performance Optimization

### Database Optimizations

```sql
-- Ensure proper indexing
CREATE INDEX idx_idempotency_keys_lookup
ON idempotency_keys(key, status, expires_at);

-- Periodic cleanup of expired keys
DELETE FROM idempotency_keys
WHERE expires_at < NOW() - INTERVAL '7 days';
```

### Edge Function Optimizations

- Implement connection pooling
- Add request queuing for high traffic
- Consider Redis for faster cache layer
- Implement circuit breaker pattern

## Related Documentation

- [Idempotency Implementation](../../docs/infrastructure/idempotency-implementation.md)
- [Load Testing Guide](../../docs/testing/load-testing-guide.md)
- [Edge Function Best Practices](../../docs/edge-functions/best-practices.md)

## Next Steps

1. **Baseline Performance**: Establish current metrics
2. **Regular Testing**: Schedule weekly test runs
3. **Capacity Planning**: Use results for scaling decisions
4. **Continuous Improvement**: Iterate based on findings

## Contact

For questions or issues:
- GitHub Issues: [Report Issue](https://github.com/bdougie/contributor.info/issues)
- Documentation: [Full Docs](../../docs/)