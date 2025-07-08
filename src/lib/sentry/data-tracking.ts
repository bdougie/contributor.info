import * as Sentry from '@sentry/react';

/**
 * Enhanced Sentry tracking for database and caching operations
 * Provides structured error tracking and performance monitoring
 */

export interface DatabaseOperationContext {
  operation: 'fetch' | 'insert' | 'update' | 'delete' | 'query';
  table?: string;
  repository?: string;
  fallbackUsed?: boolean;
  cacheHit?: boolean;
  rateLimited?: boolean;
  recordCount?: number;
  duration?: number;
}

export interface CacheOperationContext {
  operation: 'get' | 'set' | 'delete' | 'clear';
  cacheType: 'database' | 'api' | 'memory' | 'storage';
  key?: string;
  hit?: boolean;
  size?: number;
  ttl?: number;
}

/**
 * Track database operations with comprehensive context
 */
export function trackDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  context: DatabaseOperationContext
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `db.${context.operation}.${context.table || 'unknown'}`,
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
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'db.duration_ms': duration,
          'db.success': true
        });

        // Track slow queries
        if (duration > 2000) {
          Sentry.addBreadcrumb({
            category: 'database',
            message: `Slow database query detected: ${operationName}`,
            level: 'warning',
            data: {
              operation: context.operation,
              duration,
              table: context.table
            }
          });
        }

        // Track fallback usage
        if (context.fallbackUsed) {
          Sentry.addBreadcrumb({
            category: 'database',
            message: `Database fallback used for ${operationName}`,
            level: 'info',
            data: context
          });
        }

        return result;
      } catch (error) {
        span.setAttributes({
          'db.success': false,
          'error.type': error instanceof Error ? error.constructor.name : 'Unknown'
        });

        // Enhanced error context for database operations
        Sentry.withScope((scope) => {
          scope.setTag('component', 'database');
          scope.setTag('operation', context.operation);
          scope.setContext('database_operation', {
            operationName,
            ...context,
            duration: Date.now() - startTime
          });

          // Categorize database errors
          if (error instanceof Error) {
            if (error.message.includes('rate limit') || error.message.includes('403')) {
              scope.setTag('error.category', 'rate_limit');
              scope.setLevel('warning');
            } else if (error.message.includes('network') || error.message.includes('timeout')) {
              scope.setTag('error.category', 'network');
              scope.setLevel('error');
            } else if (error.message.includes('column') || error.message.includes('constraint')) {
              scope.setTag('error.category', 'schema');
              scope.setLevel('error');
            } else {
              scope.setTag('error.category', 'unknown');
              scope.setLevel('error');
            }
          }

          Sentry.captureException(error);
        });

        throw error;
      }
    }
  );
}

/**
 * Track cache operations with performance metrics
 */
export function trackCacheOperation<T>(
  operationName: string,
  operation: () => Promise<T> | T,
  context: CacheOperationContext
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `cache.${context.operation}.${context.cacheType}`,
      op: 'cache',
      attributes: {
        'cache.operation': context.operation,
        'cache.type': context.cacheType,
        'cache.key': context.key,
        'cache.hit': context.hit,
        'cache.size': context.size,
        'cache.ttl': context.ttl
      }
    },
    async (span) => {
      try {
        const result = await operation();
        
        span.setAttributes({
          'cache.success': true
        });

        // Track cache performance
        if (context.hit !== undefined) {
          Sentry.addBreadcrumb({
            category: 'cache',
            message: `Cache ${context.hit ? 'hit' : 'miss'}: ${operationName}`,
            level: 'info',
            data: context
          });
        }

        return result;
      } catch (error) {
        span.setAttributes({
          'cache.success': false,
          'error.type': error instanceof Error ? error.constructor.name : 'Unknown'
        });

        Sentry.withScope((scope) => {
          scope.setTag('component', 'cache');
          scope.setTag('cache_type', context.cacheType);
          scope.setContext('cache_operation', {
            operationName,
            ...context
          });

          // Cache errors are usually non-critical
          scope.setLevel('warning');
          Sentry.captureException(error);
        });

        throw error;
      }
    }
  );
}

/**
 * Track API rate limiting events
 */
export function trackRateLimit(
  apiType: 'github' | 'supabase',
  endpoint: string,
  remainingQuota?: number,
  resetTime?: Date
) {
  Sentry.addBreadcrumb({
    category: 'rate_limit',
    message: `Rate limit hit: ${apiType} ${endpoint}`,
    level: 'warning',
    data: {
      api_type: apiType,
      endpoint,
      remaining_quota: remainingQuota,
      reset_time: resetTime?.toISOString()
    }
  });

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

/**
 * Track data synchronization operations
 */
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
  Sentry.addBreadcrumb({
    category: 'data_sync',
    message: `Data sync completed: ${syncType} for ${repository}`,
    level: 'info',
    data: {
      sync_type: syncType,
      repository,
      ...stats
    }
  });

  // Track sync performance issues
  if (stats.failed > stats.processed * 0.1) { // More than 10% failure rate
    Sentry.withScope((scope) => {
      scope.setTag('component', 'data_sync');
      scope.setTag('sync_type', syncType);
      scope.setContext('sync_stats', { repository, ...stats });
      scope.setLevel('warning');
      
      Sentry.captureMessage(
        `High failure rate in data sync: ${stats.failed}/${stats.processed} failed`,
        'warning'
      );
    });
  }
}

/**
 * Enhanced user context for better error tracking
 */
export function setUserContext(user: {
  id?: string;
  email?: string;
  username?: string;
  plan?: string;
  features?: string[];
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    plan: user.plan
  });

  Sentry.setContext('user_features', {
    enabled_features: user.features || [],
    feature_count: user.features?.length || 0
  });
}

/**
 * Set application context for debugging
 */
export function setApplicationContext(context: {
  route?: string;
  repository?: string;
  timeRange?: string;
  dataSource?: 'database' | 'api' | 'cache';
  experimentalFeatures?: string[];
}) {
  Sentry.setContext('application', context);
  
  if (context.repository) {
    Sentry.setTag('repository', context.repository);
  }
  
  if (context.dataSource) {
    Sentry.setTag('data_source', context.dataSource);
  }
}