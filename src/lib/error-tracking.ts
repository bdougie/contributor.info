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
  additionalData?: Record<string, any>;
}

export interface ErrorBreadcrumb {
  timestamp: number;
  message: string;
  category: 'navigation' | 'user' | 'data' | 'system';
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
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
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    additionalData?: Record<string, any>
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
    console.group(`🚨 Data Loading Error - Stage: ${report.error.stage}`);
    console.error('Error:', report.error);
    console.info('Context:', report.context);
    console.info('User Message:', report.error.userMessage);
    
    if (report.error.technicalDetails) {
      console.info('Technical Details:', report.error.technicalDetails);
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
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      const existingLogs = JSON.parse(localStorage.getItem('data-loading-errors') || '[]');
      existingLogs.push(errorLog);
      
      // Keep only last 100 errors
      const recentLogs = existingLogs.slice(-100);
      localStorage.setItem('data-loading-errors', JSON.stringify(recentLogs));

    } catch (storageError) {
      console.warn('Failed to store error in localStorage:', storageError);
    }
  }

  // Example Sentry integration (commented out - would need Sentry SDK)
  /*
  private async sendToSentry(report: ErrorReport): Promise<void> {
    try {
      const Sentry = await import('@sentry/browser');
      
      Sentry.withScope(scope => {
        scope.setTag('error_type', 'data_loading');
        scope.setTag('loading_stage', report.error.stage);
        scope.setTag('error_category', report.error.type);
        scope.setContext('loading_context', report.context);
        
        if (report.additionalData) {
          scope.setContext('additional_data', report.additionalData);
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
        
        Sentry.captureException(report.error);
      });
    } catch (error) {
      console.warn('Failed to send error to Sentry:', error);
    }
  }
  */

  // Get error statistics for monitoring
  getErrorStats(): {
    totalErrors: number;
    errorsByStage: Record<LoadingStage, number>;
    errorsByType: Record<string, number>;
    recentErrors: any[];
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

      const storedErrors = JSON.parse(localStorage.getItem('data-loading-errors') || '[]');
      
      const errorsByStage = storedErrors.reduce((acc: Record<LoadingStage, number>, error: any) => {
        acc[error.stage as LoadingStage] = (acc[error.stage as LoadingStage] || 0) + 1;
        return acc;
      }, { critical: 0, full: 0, enhancement: 0 });
      
      const errorsByType = storedErrors.reduce((acc: Record<string, number>, error: any) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalErrors: storedErrors.length,
        errorsByStage,
        errorsByType,
        recentErrors: storedErrors.slice(-20),
      };
    } catch (error) {
      console.warn('Failed to get error stats:', error);
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
        localStorage.removeItem('data-loading-errors');
      }
      this.breadcrumbs = [];
    } catch (error) {
      console.warn('Failed to clear error data:', error);
    }
  }

  // Export error data for debugging
  exportErrorData(): string {
    try {
      if (typeof window === 'undefined') return '[]';
      
      const storedErrors = localStorage.getItem('data-loading-errors') || '[]';
      return storedErrors;
    } catch (error) {
      console.warn('Failed to export error data:', error);
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
  additionalData?: Record<string, any>
): void {
  errorTracker.reportError(error, context, additionalData);
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
    additionalData?: Record<string, any>
  ) => {
    trackDataLoadingError(error, context, additionalData);
  };

  const addBreadcrumbFromComponent = (
    message: string,
    category: ErrorBreadcrumb['category'] = 'user',
    level: ErrorBreadcrumb['level'] = 'info',
    data?: Record<string, any>
  ) => {
    addBreadcrumb({ message, category, level, data });
  };

  return {
    trackError,
    addBreadcrumb: addBreadcrumbFromComponent,
    getErrorStats,
    clearErrorData,
    exportErrorData,
  };
}