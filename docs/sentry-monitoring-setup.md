# Sentry Monitoring Setup

## Overview

This document describes the comprehensive Sentry monitoring setup implemented for the Contributor Info application, specifically focused on tracking database caching, progressive data capture, and error recovery systems.

## Architecture

### Core Integration Points

1. **Enhanced Application Monitoring** - React error boundaries with user feedback
2. **Database Operation Tracking** - Performance and cache effectiveness monitoring
3. **Progressive Capture Monitoring** - Queue processing and data quality tracking
4. **User Context Tracking** - Route-based context and feature usage
5. **Custom Error Categorization** - Automatic classification of error types

## Configuration

### 1. Environment Setup

```bash
# Primary Sentry DSN (Production)
VITE_SENTRY_DSN=https://c3990775f22023f5aedf00dffefa0b8d@o4509499199258624.ingest.us.sentry.io/4509499205877760

# Development Sentry DSN
VITE_SENTRY_DSN=https://d1ea36f47149a2736ca112883e6ee2fe@o4509499199258624.ingest.us.sentry.io/4509499206336512
```

### 2. Initialization (`/src/main.tsx`)

**Performance-Optimized Loading**:
- Dynamic imports to avoid blocking initial bundle
- Deferred initialization (8 seconds delay or after page load)
- Uses `requestIdleCallback` when available
- Conditional DSN-based activation

```typescript
// Optimized Sentry initialization
const initializeSentry = async () => {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  
  const Sentry = await import('@sentry/react');
  
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    
    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Deferred by 3 seconds for performance
        maskAllText: false,
        blockAllMedia: false,
      }, { defer: 3000 })
    ],
    
    // Sample rates
    tracesSampleRate: import.meta.env.PROD ? 0.01 : 1.0,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 0.1,
  });
};
```

## Custom Monitoring Components

### 1. Database Operation Tracking (`/src/lib/sentry/data-tracking.ts`)

**Purpose**: Monitor database performance, cache effectiveness, and fallback usage

```typescript
export function trackDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  context: DatabaseOperationContext
): Promise<T> {
  return Sentry.startSpan({
    name: `db.${context.operation}.${context.table}`,
    op: 'db.query',
    attributes: {
      'db.operation': context.operation,
      'db.table': context.table,
      'repository.name': context.repository,
      'fallback.used': context.fallbackUsed,
      'cache.hit': context.cacheHit,
      'rate_limit.hit': context.rateLimited,
      'db.record_count': context.recordCount
    }
  }, async (span) => {
    // Comprehensive performance and error tracking
  });
}
```

**Tracked Metrics**:
- Query performance (duration, slow query detection >2s)
- Cache hit/miss ratios
- Fallback usage patterns
- Rate limiting incidents
- Error categorization (rate_limit, network, schema, unknown)

### 2. Cache Operation Monitoring

**Purpose**: Track cache performance across multiple tiers (database, API, memory, storage)

```typescript
export function trackCacheOperation<T>(
  operationName: string,
  operation: () => Promise<T> | T,
  context: CacheOperationContext
): Promise<T> {
  return Sentry.startSpan({
    name: `cache.${context.operation}.${context.cacheType}`,
    op: 'cache',
    attributes: {
      'cache.operation': context.operation,
      'cache.type': context.cacheType,
      'cache.hit': context.hit,
      'cache.size': context.size,
      'cache.ttl': context.ttl
    }
  });
}
```

### 3. Rate Limiting Detection

**Purpose**: Automatic detection and reporting of GitHub API rate limiting

```typescript
export function trackRateLimit(
  apiType: 'github' | 'supabase',
  endpoint: string,
  remainingQuota?: number,
  resetTime?: Date
) {
  Sentry.withScope((scope) => {
    scope.setTag('component', 'api');
    scope.setTag('api_type', apiType);
    scope.setTag('rate_limited', true);
    scope.setContext('rate_limit', {
      endpoint,
      remainingQuota,
      resetTime: resetTime?.toISOString()
    });
    scope.setLevel('warning');
    
    Sentry.captureMessage(`Rate limit exceeded for ${apiType} API`, 'warning');
  });
}
```

### 4. Progressive Capture Monitoring

**Purpose**: Track data synchronization and queue processing effectiveness

```typescript
export function trackDataSync(
  syncType: 'full' | 'incremental' | 'progressive',
  repository: string,
  stats: {
    processed: number;
    inserted: number;
    updated: number;
    failed: number;
    duration: number;
  }
) {
  // Automatic alerting for high failure rates (>10%)
  if (stats.failed > stats.processed * 0.1) {
    Sentry.captureMessage(
      `High failure rate in data sync: ${stats.failed}/${stats.processed} failed`,
      'warning'
    );
  }
}
```

## React Error Boundaries

### 1. Enhanced Error Boundary (`/src/components/error-boundary.tsx`)

**Features**:
- Automatic Sentry error capture with context
- User feedback collection via Sentry's report dialog
- Retry functionality without page reload
- Contextual error messages per app section

```typescript
export class ErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: any) {
    Sentry.withScope((scope) => {
      scope.setTag('component', 'ErrorBoundary');
      scope.setContext('errorBoundary', {
        componentStack: errorInfo.componentStack,
        context: this.props.context || 'unknown'
      });
      
      // Enable user feedback
      scope.setContext('userFeedback', {
        canCollectFeedback: true,
        errorId: Sentry.captureException(error)
      });
    });
  }
}
```

### 2. Application Coverage

**Error Boundaries Deployed**:
- Application root boundary (`App.tsx`)
- Repository view sections (8 specific boundaries):
  - Repository Data Provider
  - Repository Chart Display
  - Repository Health Analysis
  - Contributions Chart
  - Metrics and Trends
  - Contributor of the Month
  - Distribution Analysis
  - Repository Insights

### 3. HOC Wrapper

```typescript
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) => {
  return Sentry.withErrorBoundary(Component, {
    fallback: ({ error, resetError }) => (
      // Custom fallback UI with retry functionality
    ),
    beforeCapture: (scope) => {
      scope.setTag('component', context || 'unknown');
      scope.setLevel('error');
    }
  });
};
```

## Application Context Tracking

### 1. Route-Based Context (`/src/lib/sentry/app-context.ts`)

**Automatic Context Setting**:
```typescript
export function useSentryRouteTracking() {
  const location = useLocation();

  useEffect(() => {
    // Extract repository from URL
    const pathParts = location.pathname.split('/');
    let repository: string | undefined;
    
    if (pathParts[1] === 'repo' && pathParts[2] && pathParts[3]) {
      repository = `${pathParts[2]}/${pathParts[3]}`;
    }

    setApplicationContext({
      route: location.pathname,
      repository,
      timeRange: searchParams.get('timeRange') || '30',
      dataSource: 'database' // Default to database-first approach
    });
  }, [location]);
}
```

### 2. User Authentication Context

```typescript
export function setSentryUserContext(user: {
  id?: string;
  email?: string;
  username?: string;
  plan?: string;
}) {
  setUserContext({
    ...user,
    features: [
      'database_fallback',
      'progressive_capture',
      'smart_notifications',
      'analytics_tracking'
    ]
  });
}
```

### 3. Feature Usage Tracking

```typescript
export function trackFeatureUsage(feature: string, metadata?: Record<string, any>) {
  setApplicationContext({
    experimentalFeatures: [feature]
  });
  
  if (metadata) {
    Sentry.setContext('feature_metadata', metadata);
  }
}
```

## Instrumented Functions

### 1. Core Data Fetching

**Database Operations** (`/src/lib/supabase-pr-data.ts`):
```typescript
export async function fetchPRDataWithFallback(owner: string, repo: string) {
  return trackDatabaseOperation(
    'fetchPRDataWithFallback',
    async () => {
      // Database query logic with fallback cascade
    },
    {
      operation: 'fetch',
      table: 'pull_requests',
      repository: `${owner}/${repo}`,
      fallbackUsed,
      cacheHit
    }
  );
}
```

**GitHub API Calls** (`/src/lib/github.ts`):
- Automatic rate limiting detection
- Authentication context tracking
- Success metrics collection
- Error categorization for different failure modes

**Cache Operations** (`/src/hooks/use-cached-repo-data.ts`):
- Cache hit/miss ratio tracking
- Performance metrics for cache vs API
- Application context setting for debugging

### 2. Progressive Capture System

**Queue Management** - Track job processing effectiveness
**Background Processing** - Monitor data capture success rates
**UI Notifications** - Track user engagement with progressive features

## Error Categorization

### Automatic Classification

**Rate Limiting Errors**:
```typescript
if (error.message.includes('rate limit') || error.message.includes('403')) {
  scope.setTag('error.category', 'rate_limit');
  scope.setLevel('warning');
}
```

**Network Errors**:
```typescript
if (error.message.includes('network') || error.message.includes('timeout')) {
  scope.setTag('error.category', 'network');
  scope.setLevel('error');
}
```

**Database Schema Errors**:
```typescript
if (error.message.includes('column') || error.message.includes('constraint')) {
  scope.setTag('error.category', 'schema');
  scope.setLevel('error');
}
```

## Performance Monitoring

### 1. Database Query Performance

**Tracked Metrics**:
- Query execution time
- Slow query detection (>2s automatic alerting)
- Cache effectiveness ratios
- Fallback usage patterns

### 2. Progressive Capture Effectiveness

**Monitored Operations**:
- Job queue processing times
- Success/failure rates by job type
- User-triggered capture completion rates
- Background processing efficiency

### 3. User Experience Metrics

**Tracked Events**:
- Progressive capture button usage
- Error boundary activations
- User feedback submissions
- Feature adoption rates

## Alerting and Dashboards

### 1. Critical Alerts

**Rate Limiting**:
- GitHub API quota exceeded
- Unusual fallback patterns
- Progressive capture queue backlogs

**Data Quality**:
- High cache miss rates
- Database query failures
- Progressive capture job failures

**User Experience**:
- Error boundary activations
- Failed progressive capture attempts
- User feedback indicating issues

### 2. Performance Dashboards

**Database Operations**:
- Query performance trends
- Cache hit/miss ratios
- Fallback usage patterns
- Error categorization breakdown

**Progressive Capture**:
- Job queue health
- Processing success rates
- User engagement metrics
- Data quality improvements

### 3. User Behavior Analytics

**Feature Usage**:
- Progressive capture adoption
- Error recovery patterns
- Route-based performance
- Authentication context correlation

## Debugging and Troubleshooting

### 1. Error Investigation Workflow

1. **Automatic Categorization** - Errors tagged by type and component
2. **Rich Context** - Repository, route, user state included
3. **Performance Data** - Query times and cache effectiveness
4. **User Journey** - Breadcrumbs showing path to error
5. **Reproduction Info** - Environment and feature flags

### 2. Performance Analysis

1. **Database vs API Usage** - Track fallback patterns
2. **Cache Effectiveness** - Monitor hit/miss ratios
3. **Progressive Capture Impact** - Measure data quality improvements
4. **User Experience Metrics** - Error rates and recovery success

### 3. Proactive Monitoring

1. **Trend Analysis** - Detect degrading performance
2. **Capacity Planning** - Monitor queue backlogs
3. **User Feedback** - Track satisfaction and pain points
4. **Feature Impact** - Measure success of new capabilities

## Integration with Existing Analytics

### Coordination with PostHog

**Sentry Focus**: Error tracking, performance monitoring, debugging
**PostHog Focus**: User behavior, feature adoption, business metrics

**Shared Context**:
- User authentication state
- Repository and route information
- Feature flags and experimental features
- Performance timing data

## Maintenance and Updates

### 1. Regular Reviews

**Weekly**:
- Error trend analysis
- Performance regression detection
- User feedback review

**Monthly**:
- Context accuracy validation
- Alert threshold optimization
- Dashboard effectiveness review

### 2. Continuous Improvement

**Error Pattern Analysis**:
- Identify recurring issues
- Optimize error boundaries placement
- Improve automatic recovery

**Performance Optimization**:
- Database query optimization
- Cache strategy refinement
- Progressive capture efficiency

**User Experience Enhancement**:
- Error message clarity
- Recovery flow improvement
- Feature discoverability

## Conclusion

The Sentry monitoring setup provides comprehensive visibility into the application's health, with particular focus on the database caching and progressive data capture systems. This enables:

1. **Proactive Issue Detection** - Identify problems before users report them
2. **Rapid Debugging** - Rich context for quick problem resolution
3. **Performance Optimization** - Data-driven improvements to system efficiency
4. **User Experience Monitoring** - Track and improve error recovery flows
5. **Capacity Planning** - Monitor system load and scaling needs

The integration transforms error handling from reactive firefighting to proactive system optimization, ensuring reliable operation during high-traffic periods and API rate limiting scenarios.