import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';

// Performance monitoring configuration
const MONITORING_CONFIG = {
  slowQueryThreshold: 500, // milliseconds
  enableQueryLogging: true,
  enablePerformanceTracking: true,
  sampleRate: 1.0, // Sample 100% of queries for monitoring
};

// Query categories for better monitoring
const QUERY_CATEGORIES = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  RPC: 'rpc',
  STORAGE: 'storage',
  AUTH: 'auth',
} as const;

type QueryCategory = typeof QUERY_CATEGORIES[keyof typeof QUERY_CATEGORIES];

interface QueryMetrics {
  operation: string;
  table?: string;
  category: QueryCategory;
  duration: number;
  success: boolean;
  errorMessage?: string;
  rowCount?: number;
  querySize?: number;
}

interface ConnectionMetrics {
  activeConnections: number;
  timestamp: Date;
}

class SupabaseMonitoring {
  private client: SupabaseClient;
  private queryMetrics: QueryMetrics[] = [];
  private connectionMetrics: ConnectionMetrics[] = [];
  private performanceObserver?: PerformanceObserver;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.initializePerformanceMonitoring();
  }

  private initializePerformanceMonitoring() {
    if (!MONITORING_CONFIG.enablePerformanceTracking) return;

    // Initialize performance observer for detailed metrics
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name.includes('supabase')) {
            this.logPerformanceEntry(entry);
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  private logPerformanceEntry(entry: PerformanceEntry) {
    if (entry.duration > MONITORING_CONFIG.slowQueryThreshold) {
      Sentry.addBreadcrumb({
        message: 'Slow Supabase operation detected',
        category: 'performance',
        level: 'warning',
        data: {
          operation: entry.name,
          duration: entry.duration,
          type: entry.entryType,
        },
      });
    }
  }

  private categorizeQuery(operation: string, table?: string): QueryCategory {
    const op = operation.toLowerCase();
    if (op.includes('select') || op.includes('from')) return QUERY_CATEGORIES.READ;
    if (op.includes('insert') || op.includes('update') || op.includes('upsert')) return QUERY_CATEGORIES.WRITE;
    if (op.includes('delete')) return QUERY_CATEGORIES.DELETE;
    if (op.includes('rpc')) return QUERY_CATEGORIES.RPC;
    if (op.includes('storage')) return QUERY_CATEGORIES.STORAGE;
    if (op.includes('auth')) return QUERY_CATEGORIES.AUTH;
    return QUERY_CATEGORIES.READ; // default
  }

  private async logQueryMetrics(metrics: QueryMetrics) {
    this.queryMetrics.push(metrics);

    // Log to Sentry for monitoring
    if (MONITORING_CONFIG.enableQueryLogging) {
      const breadcrumb = {
        message: `Supabase ${metrics.category} operation`,
        category: 'database',
        level: metrics.success ? 'info' : 'error',
        data: {
          operation: metrics.operation,
          table: metrics.table,
          duration: metrics.duration,
          success: metrics.success,
          rowCount: metrics.rowCount,
        },
      } as const;

      Sentry.addBreadcrumb(breadcrumb);

      // Log slow queries as warnings
      if (metrics.duration > MONITORING_CONFIG.slowQueryThreshold) {
        Sentry.captureMessage(`Slow query detected: ${metrics.operation}`, {
          level: 'warning',
          tags: {
            component: 'database',
            operation: metrics.category,
            table: metrics.table || 'unknown',
          },
          extra: {
            duration: metrics.duration,
            query: metrics.operation,
            rowCount: metrics.rowCount,
          },
        });
      }

      // Log errors
      if (!metrics.success && metrics.errorMessage) {
        Sentry.captureException(new Error(metrics.errorMessage), {
          tags: {
            component: 'database',
            operation: metrics.category,
            table: metrics.table || 'unknown',
          },
          extra: {
            duration: metrics.duration,
            query: metrics.operation,
          },
        });
      }
    }

    // Keep only recent metrics in memory (last 100 operations)
    if (this.queryMetrics.length > 100) {
      this.queryMetrics = this.queryMetrics.slice(-100);
    }
  }

  // Enhanced query methods with monitoring
  async from(table: string) {
    const startTime = performance.now();
    
    try {
      const queryBuilder = this.client.from(table);
      
      // Wrap the query builder methods to add monitoring
      const originalSelect = queryBuilder.select.bind(queryBuilder);
      const originalInsert = queryBuilder.insert.bind(queryBuilder);
      const originalUpdate = queryBuilder.update.bind(queryBuilder);
      const originalDelete = queryBuilder.delete.bind(queryBuilder);
      const originalUpsert = queryBuilder.upsert.bind(queryBuilder);

      queryBuilder.select = (...args) => {
        const query = originalSelect(...args);
        this.wrapQueryExecution(query, 'select', table, startTime);
        return query;
      };

      queryBuilder.insert = (...args) => {
        const query = originalInsert(...args);
        this.wrapQueryExecution(query, 'insert', table, startTime);
        return query;
      };

      queryBuilder.update = (...args) => {
        const query = originalUpdate(...args);
        this.wrapQueryExecution(query, 'update', table, startTime);
        return query;
      };

      queryBuilder.delete = (...args) => {
        const query = originalDelete(...args);
        this.wrapQueryExecution(query, 'delete', table, startTime);
        return query;
      };

      queryBuilder.upsert = (...args) => {
        const query = originalUpsert(...args);
        this.wrapQueryExecution(query, 'upsert', table, startTime);
        return query;
      };

      return queryBuilder;
    } catch (error) {
      const duration = performance.now() - startTime;
      await this.logQueryMetrics({
        operation: `from(${table})`,
        table,
        category: QUERY_CATEGORIES.READ,
        duration,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async wrapQueryExecution(query: any, operation: string, table: string, startTime: number) {
    const originalThen = query.then?.bind(query);
    if (originalThen) {
      query.then = async (onResolve: any, onReject: any) => {
        try {
          const result = await originalThen(onResolve, onReject);
          const duration = performance.now() - startTime;
          
          await this.logQueryMetrics({
            operation: `${operation} from ${table}`,
            table,
            category: this.categorizeQuery(operation, table),
            duration,
            success: !result.error,
            errorMessage: result.error?.message,
            rowCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
          });

          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          await this.logQueryMetrics({
            operation: `${operation} from ${table}`,
            table,
            category: this.categorizeQuery(operation, table),
            duration,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      };
    }
  }

  // Enhanced RPC with monitoring
  async rpc(functionName: string, params?: any) {
    const startTime = performance.now();
    
    try {
      const result = await this.client.rpc(functionName, params);
      const duration = performance.now() - startTime;
      
      await this.logQueryMetrics({
        operation: `rpc: ${functionName}`,
        category: QUERY_CATEGORIES.RPC,
        duration,
        success: !result.error,
        errorMessage: result.error?.message,
        rowCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      await this.logQueryMetrics({
        operation: `rpc: ${functionName}`,
        category: QUERY_CATEGORIES.RPC,
        duration,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Enhanced storage operations with monitoring
  get storage() {
    const originalStorage = this.client.storage;
    
    return {
      ...originalStorage,
      from: (bucketName: string) => {
        const bucket = originalStorage.from(bucketName);
        
        // Wrap storage operations
        const originalUpload = bucket.upload.bind(bucket);
        const originalDownload = bucket.download.bind(bucket);
        const originalList = bucket.list.bind(bucket);
        const originalRemove = bucket.remove.bind(bucket);

        bucket.upload = async (...args) => {
          const startTime = performance.now();
          try {
            const result = await originalUpload(...args);
            const duration = performance.now() - startTime;
            
            await this.logQueryMetrics({
              operation: `storage.upload to ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: !result.error,
              errorMessage: result.error?.message,
            });

            return result;
          } catch (error) {
            const duration = performance.now() - startTime;
            await this.logQueryMetrics({
              operation: `storage.upload to ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        };

        bucket.download = async (...args) => {
          const startTime = performance.now();
          try {
            const result = await originalDownload(...args);
            const duration = performance.now() - startTime;
            
            await this.logQueryMetrics({
              operation: `storage.download from ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: !result.error,
              errorMessage: result.error?.message,
            });

            return result;
          } catch (error) {
            const duration = performance.now() - startTime;
            await this.logQueryMetrics({
              operation: `storage.download from ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        };

        bucket.list = async (...args) => {
          const startTime = performance.now();
          try {
            const result = await originalList(...args);
            const duration = performance.now() - startTime;
            
            await this.logQueryMetrics({
              operation: `storage.list from ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: !result.error,
              errorMessage: result.error?.message,
              rowCount: Array.isArray(result.data) ? result.data.length : 0,
            });

            return result;
          } catch (error) {
            const duration = performance.now() - startTime;
            await this.logQueryMetrics({
              operation: `storage.list from ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        };

        bucket.remove = async (...args) => {
          const startTime = performance.now();
          try {
            const result = await originalRemove(...args);
            const duration = performance.now() - startTime;
            
            await this.logQueryMetrics({
              operation: `storage.remove from ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: !result.error,
              errorMessage: result.error?.message,
            });

            return result;
          } catch (error) {
            const duration = performance.now() - startTime;
            await this.logQueryMetrics({
              operation: `storage.remove from ${bucketName}`,
              category: QUERY_CATEGORIES.STORAGE,
              duration,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        };

        return bucket;
      },
    };
  }

  // Get performance metrics
  getMetrics() {
    const now = Date.now();
    const recentMetrics = this.queryMetrics.filter(
      m => now - new Date(m.duration).getTime() < 300000 // Last 5 minutes
    );

    return {
      totalQueries: this.queryMetrics.length,
      recentQueries: recentMetrics.length,
      slowQueries: recentMetrics.filter(m => m.duration > MONITORING_CONFIG.slowQueryThreshold).length,
      errorRate: recentMetrics.length > 0 
        ? recentMetrics.filter(m => !m.success).length / recentMetrics.length 
        : 0,
      averageQueryTime: recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
        : 0,
      queryBreakdown: recentMetrics.reduce((breakdown, m) => {
        breakdown[m.category] = (breakdown[m.category] || 0) + 1;
        return breakdown;
      }, {} as Record<QueryCategory, number>),
    };
  }

  // Cleanup
  destroy() {
    this.performanceObserver?.disconnect();
    this.queryMetrics = [];
    this.connectionMetrics = [];
  }

  // Expose original client for compatibility
  get auth() {
    return this.client.auth;
  }

  get channel() {
    return this.client.channel;
  }

  get functions() {
    return this.client.functions;
  }

  get realtime() {
    return this.client.realtime;
  }
}

// Helper function to create monitored Supabase client
export function createMonitoredSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'implicit'
    }
  });

  return new SupabaseMonitoring(client);
}

export type { QueryMetrics, ConnectionMetrics, QueryCategory };
export { MONITORING_CONFIG, QUERY_CATEGORIES };