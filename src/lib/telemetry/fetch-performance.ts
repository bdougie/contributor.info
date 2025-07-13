import { RepositorySize } from '../validation/database-schemas';

interface FetchMetrics {
  repository: string;
  size: RepositorySize | null;
  strategy: 'cache' | 'live' | 'partial' | 'emergency';
  duration: number;
  recordCount: number;
  cacheHit: boolean;
  cacheAge?: number; // in hours
  backgroundTriggered: boolean;
  error?: string;
}

class FetchPerformanceTelemetry {
  private metrics: FetchMetrics[] = [];
  private startTimes: Map<string, number> = new Map();

  startFetch(repository: string): void {
    this.startTimes.set(repository, Date.now());
  }

  endFetch(metrics: Omit<FetchMetrics, 'duration'>): void {
    const startTime = this.startTimes.get(metrics.repository);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.startTimes.delete(metrics.repository);

    const fullMetrics: FetchMetrics = {
      ...metrics,
      duration
    };

    this.metrics.push(fullMetrics);
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Fetch Performance:', {
        repo: fullMetrics.repository,
        size: fullMetrics.size || 'unclassified',
        strategy: fullMetrics.strategy,
        duration: `${fullMetrics.duration}ms`,
        records: fullMetrics.recordCount,
        cache: fullMetrics.cacheHit ? `hit (${fullMetrics.cacheAge}h old)` : 'miss',
        background: fullMetrics.backgroundTriggered
      });
    }

    // Clean up old metrics (keep last 100)
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getAverageMetrics(size?: RepositorySize): {
    avgDuration: number;
    avgRecords: number;
    cacheHitRate: number;
    strategyBreakdown: Record<string, number>;
  } {
    const relevantMetrics = size 
      ? this.metrics.filter(m => m.size === size)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return {
        avgDuration: 0,
        avgRecords: 0,
        cacheHitRate: 0,
        strategyBreakdown: {}
      };
    }

    const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalRecords = relevantMetrics.reduce((sum, m) => sum + m.recordCount, 0);
    const cacheHits = relevantMetrics.filter(m => m.cacheHit).length;

    const strategyBreakdown = relevantMetrics.reduce((acc, m) => {
      acc[m.strategy] = (acc[m.strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      avgDuration: Math.round(totalDuration / relevantMetrics.length),
      avgRecords: Math.round(totalRecords / relevantMetrics.length),
      cacheHitRate: Math.round((cacheHits / relevantMetrics.length) * 100),
      strategyBreakdown
    };
  }

  getRepositoryMetrics(repository: string): FetchMetrics[] {
    return this.metrics.filter(m => m.repository === repository);
  }

  clearMetrics(): void {
    this.metrics = [];
    this.startTimes.clear();
  }
}

// Singleton instance
export const fetchTelemetry = new FetchPerformanceTelemetry();

// Helper functions for easy tracking
export function trackFetchStart(repository: string): void {
  fetchTelemetry.startFetch(repository);
}

export function trackFetchEnd(
  repository: string,
  size: RepositorySize | null,
  strategy: 'cache' | 'live' | 'partial' | 'emergency',
  recordCount: number,
  cacheHit: boolean,
  backgroundTriggered: boolean,
  cacheAge?: number,
  error?: string
): void {
  fetchTelemetry.endFetch({
    repository,
    size,
    strategy,
    recordCount,
    cacheHit,
    cacheAge,
    backgroundTriggered,
    error
  });
}

// Export for debugging/monitoring
export function getFetchPerformanceReport(): {
  overall: ReturnType<typeof fetchTelemetry.getAverageMetrics>;
  bySize: Record<RepositorySize, ReturnType<typeof fetchTelemetry.getAverageMetrics>>;
} {
  const sizes: RepositorySize[] = ['small', 'medium', 'large', 'xl'];
  
  return {
    overall: fetchTelemetry.getAverageMetrics(),
    bySize: sizes.reduce((acc, size) => {
      acc[size] = fetchTelemetry.getAverageMetrics(size);
      return acc;
    }, {} as Record<RepositorySize, ReturnType<typeof fetchTelemetry.getAverageMetrics>>)
  };
}