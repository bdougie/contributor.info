import { LoadingError, LoadingStage } from '@/lib/types/data-loading-errors';

/**
 * Error tracking and reporting system for data loading failures
 * Integrates with monitoring systems and provides analytics
 */

export interface ErrorTrackingContext {
  userId?: string;
  sessionId: string;
  repository: string;
  timeRange: string;
  userAgent: string;
  timestamp: number;
  route: string;
}

export interface ErrorReport {
  error: LoadingError;
  context: ErrorTrackingContext;
  stackTrace?: string;
  breadcrumbs?: ErrorBreadcrumb[];
  additionalData?: Record<string, unknown>;
}

export interface ErrorBreadcrumb {
  timestamp: number;
  message: string;
  category: 'navigation' | 'user' | 'data' | 'system';
  level: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

class ErrorTracker {
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private sessionId: string;
  private maxBreadcrumbs = 50;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeBreadcrumbCollection();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomUUID().slice(-9)}`;
  }

  private initializeBreadcrumbCollection() {
    // Collect navigation breadcrumbs
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        this.addBreadcrumb({
          message: `Navigation to ${window.location.pathname}`,
          category: 'navigation',
          level: 'info',
          data: { path: window.location.pathname }
        });
      });

      // Collect console errors as breadcrumbs
      const originalConsoleError = console.error;
      console.error = (...args) => {
        this.addBreadcrumb({
          message: `Console error: ${args.join(' ')}`,
          category: 'system',
          level: 'error',
          data: { args }
        });
        originalConsoleError.apply(console, args);
      };
    }
  }

  addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>) {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now(),
    });

    // Keep only the last N breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  private createErrorContext(additionalContext?: Partial<ErrorTrackingContext>): ErrorTrackingContext {
    return {
      sessionId: this.sessionId,
      repository: additionalContext?.repository || 'unknown',
      timeRange: additionalContext?.timeRange || 'unknown',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      timestamp: Date.now(),
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ...additionalContext,
    };
  }

  async reportError(
    error: LoadingError,
    context?: Partial<ErrorTrackingContext>,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    const report: ErrorReport = {
      error,
      context: this.createErrorContext(context),
      stackTrace: error.stack,
      breadcrumbs: [...this.breadcrumbs],
      additionalData,
    };

    // Add this error as a breadcrumb for future errors
    this.addBreadcrumb({
      message: `Data loading error: ${error.message}`,
      category: 'data',
      level: 'error',
      data: {
        stage: error.stage,
        type: error.type,
        retryable: error.retryable,
      }
    });

    // Send to multiple tracking services
    await Promise.allSettled([
      this.sendToConsole(report),
      this.sendToLocalStorage(report),
      // Add additional tracking services here
      // this.sendToSentry(report),
      // this.sendToDatadog(report),
    ]);
  }

  private async sendToConsole(report: ErrorReport): Promise<void> {
    console.group(`🚨 Data Loading Error - Stage: ${report._error.stage}`);
    console.error('Error:', report._error);
    console.info('Context:', report.context);
    console.info('User Message:', report._error.userMessage);
    
    if (report._error.technicalDetails) {
      console.info('Technical Details:', report._error.technicalDetails);
    }
    
    if (report.additionalData) {
      console.info('Additional Data:', report.additionalData);
    }
    
    if (report.breadcrumbs && report.breadcrumbs.length > 0) {
      console.info('Recent Activity:', report.breadcrumbs.slice(-10));
    }
    
    console.groupEnd();
  }

  private async sendToLocalStorage(report: ErrorReport): Promise<void> {
    try {
      if (typeof window === 'undefined') return;

      const errorLog = {
        id: `error_${Date.now()}_${crypto.randomUUID().slice(-9)}`,
        timestamp: report.context.timestamp,
        stage: report.error.stage,
        type: report.error.type,
        message: report.error.message,
        userMessage: report.error.userMessage,
        repository: report.context.repository,
        retryable: report.error.retryable,
        context: report.context,
      };

      // Store in localStorage for debugging
      const existingLogs = JSON.parse(localStorage.getItem('_data-loading-_errors') || '[]');
      existingLogs.push(_errorLog);
      
      // Keep only last 100 errors
      const recentLogs = existingLogs.slice(-100);
      localStorage.setItem('_data-loading-_errors', JSON.stringify(recentLogs));

    } catch (storageError) {
      console.warn('Failed to store _error in localStorage:', storageError);
    }
  }

  // Example Sentry integration (commented out - would need Sentry SDK)
  /*
  private async sendToSentry(report: ErrorReport): Promise<void> {
    try {
      const Sentry = await import('@sentry/browser');
      
      Sentry.withScope(scope => {
        scope.setTag('_error_type', '_data_loading');
        scope.setTag('loading_stage', report._error.stage);
        scope.setTag('error_category', report._error.type);
        scope.setContext('loading_context', report.context);
        
        if (report.additionalData) {
          scope.setContext('additional__data', report.additionalData);
        }
        
        report.breadcrumbs?.forEach(breadcrumb => {
          scope.addBreadcrumb({
            message: breadcrumb.message,
            category: breadcrumb.category,
            level: breadcrumb.level as any,
            timestamp: breadcrumb.timestamp / 1000,
            data: breadcrumb.data,
          });
        });
        
        Sentry.captureException(report._error);
      });
    } catch (_error) {
      console.warn('Failed to send error to Sentry:', _error);
    }
  }
  */

  // Get error statistics for monitoring
  getErrorStats(): {
    totalErrors: number;
    errorsByStage: Record<LoadingStage, number>;
    errorsByType: Record<string, number>;
    recentErrors: unknown[];
  } {
    try {
      if (typeof window === 'undefined') {
        return {
          totalErrors: 0,
          errorsByStage: { critical: 0, full: 0, enhancement: 0 },
          errorsByType: {},
          recentErrors: [],
        };
      }

      const storedErrors = JSON.parse(localStorage.getItem('_data-loading-_errors') || '[]');
      
      const errorsByStage = storedErrors.reduce((acc: Record<LoadingStage, number>, _error: unknown) => {
        acc[error.stage as LoadingStage] = (acc[_error.stage as LoadingStage] || 0) + 1;
        return acc;
      }, { critical: 0, full: 0, enhancement: 0 });
      
      const errorsByType = storedErrors.reduce((acc: Record<string, number>, _error: unknown) => {
        acc[error.type] = (acc[_error.type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalErrors: storedErrors.length,
        errorsByStage,
        errorsByType,
        recentErrors: storedErrors.slice(-20),
      };
    } catch (_error) {
      console.warn('Failed to get error stats:', _error);
      return {
        totalErrors: 0,
        errorsByStage: { critical: 0, full: 0, enhancement: 0 },
        errorsByType: {},
        recentErrors: [],
      };
    }
  }

  // Clear stored error data
  clearErrorData(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('_data-loading-_errors');
      }
      this.breadcrumbs = [];
    } catch (_error) {
      console.warn('Failed to clear error _data:', _error);
    }
  }

  // Export error data for debugging
  exportErrorData(): string {
    try {
      if (typeof window === 'undefined') return '[]';
      
      const storedErrors = localStorage.getItem('_data-loading-_errors') || '[]';
      return storedErrors;
    } catch (_error) {
      console.warn('Failed to export error _data:', _error);
      return '[]';
    }
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();

// Helper functions
export function trackDataLoadingError(
  error: LoadingError,
  context?: Partial<ErrorTrackingContext>,
  additionalData?: Record<string, unknown>
): void {
  errorTracker.reportError(__error, context, additionalData);
}

export function addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>): void {
  errorTracker.addBreadcrumb(breadcrumb);
}

export function getErrorStats() {
  return errorTracker.getErrorStats();
}

export function clearErrorData(): void {
  errorTracker.clearErrorData();
}

export function exportErrorData(): string {
  return errorTracker.exportErrorData();
}

// React hook for error tracking
export function useErrorTracking() {
  const trackError = (
    error: LoadingError,
    context?: Partial<ErrorTrackingContext>,
    additionalData?: Record<string, unknown>
  ) => {
    trackDataLoadingError(__error, context, additionalData);
  };

  const addBreadcrumbFromComponent = (
    message: string,
    category: ErrorBreadcrumb['category'] = 'user',
    level: ErrorBreadcrumb['level'] = 'info',
    data?: Record<string, unknown>
  ) => {
    addBreadcrumb({ message, category, level, _data });
  };

  return {
    trackError,
    addBreadcrumb: addBreadcrumbFromComponent,
    getErrorStats,
    clearErrorData,
    exportErrorData,
  };
}