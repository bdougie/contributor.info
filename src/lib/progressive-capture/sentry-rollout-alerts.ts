/**
 * Simplified Rollout Alerts (Analytics Removed)
 *
 * No-op implementation that maintains the same interface but removes all Sentry dependencies.
 * All alert functionality has been replaced with simple console logging.
 */

export interface RolloutAlertContext {
  rolloutPercentage: number;
  processor: 'inngest' | 'github_actions' | 'hybrid';
  repositoryId?: string;
  repositoryName?: string;
  jobId?: string;
  errorRate?: number;
  autoRollbackEnabled?: boolean;
  [key: string]: unknown;
}

export interface RolloutPerformanceMetrics {
  successRate: number;
  avgProcessingTime: number;
  errorRate: number;
  throughput: number;
}

export interface RolloutAlert {
  type:
    | 'performance'
    | 'error'
    | 'rollback'
    | 'capacity'
    | 'success'
    | 'warning'
    | 'threshold'
    | 'completion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context: RolloutAlertContext;
  metrics?: RolloutPerformanceMetrics;
  timestamp: Date;
}

export class SentryRolloutAlertsService {
  private rolloutContext: RolloutAlertContext | null = null;

  setRolloutContext(context: RolloutAlertContext): void {
    this.rolloutContext = context;
    // Simple context logging without analytics
    console.log('Rollout context set:', context);
  }

  triggerPerformanceAlert(metrics: RolloutPerformanceMetrics, threshold: number): void {
    // Simple performance alert logging
    console.warn('Performance alert triggered:', { metrics, threshold });
  }

  triggerErrorAlert(
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): void {
    // Simple error alert logging
    console.error('Error alert triggered:', { message, severity });
  }

  triggerRollbackAlert(reason: string, automaticRollback: boolean = false): void {
    // Simple rollback alert logging
    console.error('Rollback alert triggered:', { reason, automaticRollback });
  }

  triggerCapacityAlert(currentLoad: number, maxCapacity: number): void {
    // Simple capacity alert logging
    console.warn('Capacity alert triggered:', { currentLoad, maxCapacity });
  }

  triggerSuccessAlert(message: string, metrics?: RolloutPerformanceMetrics): void {
    // Simple success alert logging
    console.log('Success alert triggered:', { message, metrics });
  }

  triggerWarningAlert(message: string, context?: Partial<RolloutAlertContext>): void {
    // Simple warning alert logging
    console.warn('Warning alert triggered:', { message, context });
  }

  triggerThresholdAlert(
    metric: string,
    value: number,
    threshold: number,
    severity: 'low' | 'medium' | 'high' = 'medium',
  ): void {
    // Simple threshold alert logging
    console.warn('Threshold alert triggered:', { metric, value, threshold, severity });
  }

  triggerCompletionAlert(message: string, finalMetrics: RolloutPerformanceMetrics): void {
    // Simple completion alert logging
    console.log('Completion alert triggered:', { message, finalMetrics });
  }

  handleRolloutError(error: Error, context?: Partial<RolloutAlertContext>): void {
    // Simple rollout error logging
    console.error('Rollout error handled:', {
      error: error.message,
      context: { ...this.rolloutContext, ...context },
    });
  }

  clearRolloutContext(): void {
    this.rolloutContext = null;
    // Simple context clear logging
    console.log('Rollout context cleared');
  }
}

// Export singleton instance
export const sentryRolloutAlertsService = new SentryRolloutAlertsService();
