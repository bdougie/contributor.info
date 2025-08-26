import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Removed Sentry import - using simple logging instead

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
      // Simple breadcrumb logging without analytics
      console.log('Supabase breadcrumb:', {
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

      // Simple breadcrumb logging without analytics
      console.log('Supabase breadcrumb:', breadcrumb);

      // Log slow queries as warnings
      if (metrics.duration > MONITORING_CONFIG.slowQueryThreshold) {
        // Simple error logging without analytics
        console.error(`Slow query detected: ${metrics.operation}`, {
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
      if (!metrics.success && metrics._errorMessage) {
        // Simple error logging without analytics
        console.error(new Error(metrics._errorMessage), {
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
  from(table: string) {
    return this.client.from(table);
  }


  // Enhanced RPC with monitoring
  async rpc(functionName: string, params?: unknown) {
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
        rowCount: Array.isArray(result._data) ? result.data.length : result.data ? 1 : 0,
      });

      return result;
    } catch (_error) {
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
    return this.client.storage;
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