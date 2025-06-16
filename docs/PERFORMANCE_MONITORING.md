# Performance Monitoring System

This document describes the comprehensive performance monitoring system implemented for the contributor.info application.

## Overview

The performance monitoring system provides real-time visibility into:
- **Database Performance**: Query execution times, connection pool usage, index effectiveness
- **GitHub API Performance**: Rate limit tracking, response times, error rates
- **Application Performance**: Real-time metrics and alerting
- **Storage Performance**: CDN performance and cache hit rates

## Components

### 1. Database Monitoring

#### Features
- **Query Performance Tracking**: Automatic detection of slow queries (>500ms)
- **Connection Pool Monitoring**: Real-time connection usage and health
- **Index Usage Analysis**: Track which indexes are being used effectively
- **Performance Snapshots**: Historical performance data collection
- **Automated Alerting**: Configurable performance thresholds

#### Files
- `supabase/migrations/20250616000002_enable_performance_monitoring.sql` - Database setup
- `scripts/monitor-database-performance.js` - CLI monitoring tool
- `src/lib/supabase-monitoring.ts` - Application-level database monitoring

#### Usage

```bash
# Run performance monitoring
npm run monitor-db

# Create performance snapshot
npm run monitor-db-snapshot

# Reset query statistics
npm run monitor-db-reset
```

#### Database Views Available

```sql
-- View slow queries
SELECT * FROM slow_queries;

-- Get query performance summary
SELECT * FROM query_performance_summary;

-- Check index usage
SELECT * FROM index_usage_stats;

-- Monitor table activity
SELECT * FROM table_activity_stats;

-- Check connection status
SELECT * FROM connection_stats;
```

#### Monitoring Functions

```sql
-- Get connection pool status
SELECT * FROM get_connection_pool_status();

-- Get database size information
SELECT * FROM get_database_size_stats();

-- Reset query statistics
SELECT reset_query_stats();
```

### 2. GitHub API Monitoring

#### Features
- **Rate Limit Tracking**: Monitor usage across all GitHub API endpoints
- **Response Time Monitoring**: Track API performance and slow requests
- **Error Rate Analysis**: Categorize and track API errors
- **Cache Performance**: Monitor cache hit rates for API responses
- **Proactive Alerting**: Warn before rate limits are exceeded

#### Files
- `src/lib/github-api-monitoring.ts` - GitHub API monitoring wrapper

#### Usage

```typescript
import { githubAPIMonitoring } from '@/lib/github-api-monitoring';

// Wrap GitHub API calls for monitoring
const monitoredFetch = githubAPIMonitoring.createMonitoredFetch();

// Get performance stats
const stats = githubAPIMonitoring.getPerformanceStats(60); // Last 60 minutes

// Get rate limit status
const rateLimits = githubAPIMonitoring.getRateLimitStatus();

// Generate performance report
const report = githubAPIMonitoring.generatePerformanceReport();
```

### 3. Application-Level Monitoring

#### Features
- **Structured Logging**: All database operations logged with performance context
- **Sentry Integration**: Automatic error reporting and performance tracking
- **Performance Metrics**: Real-time application performance data
- **Dashboard UI**: Visual performance monitoring interface

#### Files
- `src/components/performance-monitoring-dashboard.tsx` - Monitoring dashboard
- `src/lib/supabase-monitoring.ts` - Enhanced Supabase client with monitoring

#### Integration

```typescript
import { createMonitoredSupabaseClient } from '@/lib/supabase-monitoring';

// Create monitored client
const supabase = createMonitoredSupabaseClient(supabaseUrl, supabaseKey);

// All operations are automatically monitored
const { data, error } = await supabase.from('contributors').select('*');

// Get performance metrics
const metrics = supabase.getMetrics();
```

### 4. CDN Performance Monitoring

#### Features
- **Multi-region Testing**: Test CDN performance from multiple locations
- **Cache Analysis**: Monitor cache headers and effectiveness
- **Storage Usage**: Track storage consumption and optimization opportunities
- **Performance Recommendations**: Automated optimization suggestions

#### Files
- `scripts/monitor-cdn-performance.js` - CDN monitoring script (existing)

#### Usage

```bash
# Monitor CDN performance
npm run monitor-cdn
```

## Configuration

### Environment Variables

```bash
# Required for database monitoring
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_TOKEN=your-service-role-key

# Required for error tracking
VITE_SENTRY_DSN=your-sentry-dsn

# Optional for enhanced monitoring
VITE_POSTHOG_KEY=your-posthog-key
```

### Monitoring Thresholds

Default thresholds can be configured in:

```typescript
// Database monitoring thresholds
const MONITORING_CONFIG = {
  slowQueryThreshold: 500, // milliseconds
  connectionUtilizationWarning: 70, // percentage
  connectionUtilizationCritical: 80, // percentage
  cacheHitRatioWarning: 90, // percentage
};

// GitHub API monitoring thresholds
const API_MONITORING_CONFIG = {
  slowRequestThreshold: 2000, // milliseconds
  rateLimitWarningThreshold: 0.8, // 80% of rate limit
};
```

## Alerting

### Types of Alerts

1. **Database Performance Alerts**
   - Slow queries detected (>500ms)
   - High connection pool utilization (>80%)
   - Low cache hit ratio (<90%)
   - Connection leaks detected

2. **API Performance Alerts**
   - GitHub rate limit approaching (>80% used)
   - Slow API responses (>2 seconds)
   - High error rates (>5%)
   - Cache performance degradation

3. **Application Alerts**
   - Memory usage alerts
   - Error rate spikes
   - Performance degradation

### Alert Destinations

- **Sentry**: All performance alerts and errors
- **Console Logs**: Development environment alerts
- **Database**: Performance alert history stored in `query_performance_alerts` table

## Monitoring Dashboard

Access the monitoring dashboard at `/performance-monitoring` (component available).

### Dashboard Features

- **Real-time Metrics**: Live performance data
- **Historical Trends**: Performance over time
- **Alert Management**: View and manage active alerts
- **Quick Actions**: Performance snapshots and diagnostics

## Troubleshooting

### Common Issues

1. **pg_stat_statements not enabled**
   ```sql
   -- Check if extension is available
   SELECT * FROM pg_available_extensions WHERE name = 'pg_stat_statements';
   
   -- Enable extension (requires superuser)
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   ```

2. **Monitoring views not accessible**
   ```bash
   # Apply the monitoring migration
   npx supabase db reset
   # Or run migration manually in Supabase dashboard
   ```

3. **High memory usage from monitoring**
   ```typescript
   // Adjust monitoring configuration
   const MONITORING_CONFIG = {
     sampleRate: 0.1, // Sample 10% of operations
     enableQueryLogging: false, // Disable detailed logging
   };
   ```

### Performance Impact

The monitoring system is designed to have minimal performance impact:
- **Database monitoring**: <1% query overhead
- **API monitoring**: <50ms additional latency per request
- **Application monitoring**: <5MB memory usage

### Debugging Commands

```bash
# Check database performance
npm run monitor-db

# Test CDN performance
npm run monitor-cdn

# Create performance snapshot
npm run monitor-db-snapshot

# View recent performance alerts
psql -c "SELECT * FROM query_performance_alerts WHERE created_at > NOW() - INTERVAL '1 hour';"
```

## Best Practices

### Development

1. **Regular Monitoring**: Check performance metrics during development
2. **Threshold Tuning**: Adjust alerting thresholds based on application behavior
3. **Performance Testing**: Use monitoring during load testing
4. **Alert Response**: Establish procedures for responding to performance alerts

### Production

1. **Automated Monitoring**: Set up automated performance checks
2. **Alert Escalation**: Configure appropriate alert escalation procedures
3. **Performance Budgets**: Establish performance budgets and track against them
4. **Regular Reviews**: Schedule regular performance reviews using historical data

## Extending the Monitoring System

### Adding New Metrics

1. **Database Metrics**: Add new views to the monitoring migration
2. **Application Metrics**: Extend the monitoring clients with new tracking
3. **Custom Alerts**: Add new alert types to the alerts table

### Integration with External Services

The monitoring system can be extended to integrate with:
- **Grafana**: For advanced dashboards
- **PagerDuty**: For alert escalation
- **Datadog**: For comprehensive APM
- **New Relic**: For application performance monitoring

## Migration Guide

### Enabling Performance Monitoring

1. **Run the migration**:
   ```bash
   npx supabase db reset
   # Or copy migration content to Supabase dashboard SQL editor
   ```

2. **Update application code**:
   ```typescript
   // Replace existing Supabase client usage
   import { createMonitoredSupabaseClient } from '@/lib/supabase-monitoring';
   ```

3. **Configure monitoring scripts**:
   ```bash
   # Add to package.json scripts (already done)
   npm run monitor-db
   ```

4. **Set up alerting**:
   - Configure Sentry DSN
   - Set up alert thresholds
   - Test alert delivery

### Rollback Procedure

If you need to disable monitoring:

1. **Remove monitoring views**:
   ```sql
   DROP VIEW IF EXISTS slow_queries;
   DROP VIEW IF EXISTS query_performance_summary;
   -- ... other views
   ```

2. **Revert to original Supabase client**:
   ```typescript
   import { supabase } from '@/lib/supabase';
   ```

## Support

For questions or issues with the performance monitoring system:

1. Check this documentation
2. Review the code comments in monitoring files
3. Check Sentry for any monitoring-related errors
4. Review the performance monitoring dashboard for system health