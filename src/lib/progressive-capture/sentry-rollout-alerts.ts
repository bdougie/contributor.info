/**
 * Sentry Rollout Alerts
 * 
 * Enhanced Sentry integration specifically for rollout monitoring and alerting.
 * Extends the existing Sentry setup with rollout-specific context and alerts.
 */

import * as Sentry from '@sentry/react';

export interface RolloutAlertContext {
  rolloutPercentage: number;
  processor: 'inngest' | 'github_actions' | 'hybrid';
  repositoryId?: string;
  repositoryName?: string;
  jobId?: string;
  errorRate?: number;
  autoRollbackEnabled?: boolean;
}

export interface RolloutMetrics {
  totalJobs: number;
  successRate: number;
  errorRate: number;
  avgProcessingTime: number;
  costSavings: number;
  healthScore: number;
}

export interface EmergencyRollbackContext {
  previousPercentage: number;
  newPercentage: number;
  reason: string;
  triggeredBy: 'manual' | 'auto_health_check' | 'error_threshold';
  healthStatus: 'warning' | 'critical';
  errorDetails?: string[];
}

/**
 * Rollout-specific Sentry alert manager
 */
export class SentryRolloutAlerts {
  private static instance: SentryRolloutAlerts;
  private rolloutContext: RolloutAlertContext | null = null;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): SentryRolloutAlerts {
    if (!SentryRolloutAlerts.instance) {
      SentryRolloutAlerts.instance = new SentryRolloutAlerts();
    }
    return SentryRolloutAlerts.instance;
  }

  /**
   * Set rollout context for all subsequent alerts
   */
  setRolloutContext(context: Partial<RolloutAlertContext>): void {
    this.rolloutContext = { ...this.rolloutContext, ...context };
    
    // Update Sentry user context with rollout info
    Sentry.setContext('rollout', this.rolloutContext);
    
    // Set tags for filtering
    if (context.rolloutPercentage !== undefined) {
      Sentry.setTag('rollout.percentage', context.rolloutPercentage);
    }
    if (context.processor) {
      Sentry.setTag('rollout.processor', context.processor);
    }
    if (context.autoRollbackEnabled !== undefined) {
      Sentry.setTag('rollout.auto_rollback', context.autoRollbackEnabled);
    }
  }

  /**
   * Alert for rollout health degradation
   */
  alertHealthDegradation(
    healthScore: number,
    metrics: Partial<RolloutMetrics>,
    issues: string[]
  ): void {
    const level = healthScore < 50 ? 'error' : healthScore < 70 ? 'warning' : 'info';
    
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'health_degradation');
      scope.setTag('rollout.health_score', healthScore);
      scope.setLevel(level);
      
      scope.setContext('health_metrics', {
        healthScore,
        errorRate: metrics.errorRate,
        successRate: metrics.successRate,
        totalJobs: metrics.totalJobs,
        issues: issues.slice(0, 10) // Limit to first 10 issues
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `Rollout health degraded to ${healthScore}/100. Issues: ${issues.slice(0, 3).join(', ')}`;
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Alert for high error rates
   */
  alertHighErrorRate(
    errorRate: number,
    threshold: number,
    processor: 'inngest' | 'github_actions' | 'combined',
    recentErrors: Array<{ message: string; timestamp: string }>
  ): void {
    const level = errorRate > threshold * 2 ? 'error' : 'warning';
    
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'high_error_rate');
      scope.setTag('rollout.processor', processor);
      scope.setTag('rollout.error_rate', errorRate);
      scope.setLevel(level);
      
      scope.setContext('error_analysis', {
        errorRate,
        threshold,
        processor,
        recentErrorCount: recentErrors.length,
        recentErrors: recentErrors.slice(0, 5).map(e => ({
          message: e.message,
          timestamp: e.timestamp
        }))
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `High error rate detected: ${errorRate.toFixed(2)}% (threshold: ${threshold}%) on ${processor}`;
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Alert for emergency rollback
   */
  alertEmergencyRollback(context: EmergencyRollbackContext): void {
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'emergency_rollback');
      scope.setTag('rollout.trigger', context.triggeredBy);
      scope.setTag('rollout.health_status', context.healthStatus);
      scope.setLevel('error');
      
      scope.setContext('emergency_rollback', {
        previousPercentage: context.previousPercentage,
        newPercentage: context.newPercentage,
        reason: context.reason,
        triggeredBy: context.triggeredBy,
        healthStatus: context.healthStatus,
        errorCount: context.errorDetails?.length || 0
      });
      
      if (context.errorDetails && context.errorDetails.length > 0) {
        scope.setContext('rollback_errors', {
          errors: context.errorDetails.slice(0, 10) // Limit error details
        });
      }
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `🚨 EMERGENCY ROLLBACK: ${context.reason} (${context.previousPercentage}% → ${context.newPercentage}%)`;
      Sentry.captureMessage(message, 'error');
    });
  }

  /**
   * Alert for rollout configuration changes
   */
  alertRolloutChange(
    previousPercentage: number,
    newPercentage: number,
    triggeredBy: string,
    reason?: string
  ): void {
    const level = newPercentage === 0 ? 'warning' : 'info';
    
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'rollout_change');
      scope.setTag('rollout.trigger', triggeredBy);
      scope.setLevel(level);
      
      scope.setContext('rollout_change', {
        previousPercentage,
        newPercentage,
        triggeredBy,
        reason: reason || 'No reason provided',
        changeType: newPercentage > previousPercentage ? 'increase' : 
                    newPercentage < previousPercentage ? 'decrease' : 'no_change'
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const changeDirection = newPercentage > previousPercentage ? '📈' : newPercentage < previousPercentage ? '📉' : '➡️';
      const message = `${changeDirection} Rollout changed: ${previousPercentage}% → ${newPercentage}% by ${triggeredBy}`;
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Alert for processor-specific issues
   */
  alertProcessorIssue(
    processor: 'inngest' | 'github_actions',
    issueType: 'stuck_jobs' | 'high_latency' | 'connection_failure' | 'rate_limit',
    details: Record<string, any>
  ): void {
    const level = issueType === 'connection_failure' ? 'error' : 'warning';
    
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'processor_issue');
      scope.setTag('rollout.processor', processor);
      scope.setTag('processor.issue_type', issueType);
      scope.setLevel(level);
      
      scope.setContext('processor_issue', {
        processor,
        issueType,
        ...details
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `${processor} processor issue: ${issueType}`;
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Alert for repository categorization issues
   */
  alertRepositoryIssue(
    repositoryId: string,
    repositoryName: string,
    issueType: 'categorization_failed' | 'eligibility_error' | 'processing_stuck',
    errorMessage?: string
  ): void {
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'repository_issue');
      scope.setTag('repository.id', repositoryId);
      scope.setTag('repository.name', repositoryName);
      scope.setTag('repository.issue_type', issueType);
      scope.setLevel('warning');
      
      scope.setContext('repository_issue', {
        repositoryId,
        repositoryName,
        issueType,
        errorMessage: errorMessage || 'No error message provided'
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `Repository issue in ${repositoryName}: ${issueType}`;
      Sentry.captureMessage(message, 'warning');
    });
  }

  /**
   * Alert for cost anomalies
   */
  alertCostAnomaly(
    currentCost: number,
    expectedCost: number,
    anomalyType: 'spike' | 'unexpected_increase' | 'savings_degraded',
    processor?: 'inngest' | 'github_actions'
  ): void {
    const percentageChange = ((currentCost - expectedCost) / expectedCost) * 100;
    const level = Math.abs(percentageChange) > 50 ? 'error' : 'warning';
    
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'cost_anomaly');
      scope.setTag('cost.anomaly_type', anomalyType);
      scope.setTag('cost.percentage_change', Math.round(percentageChange));
      if (processor) {
        scope.setTag('rollout.processor', processor);
      }
      scope.setLevel(level);
      
      scope.setContext('cost_anomaly', {
        currentCost,
        expectedCost,
        percentageChange,
        anomalyType,
        processor
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `Cost anomaly detected: ${anomalyType} - ${percentageChange.toFixed(1)}% change (${processor || 'combined'})`;
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Alert for performance degradation
   */
  alertPerformanceDegradation(
    metric: 'processing_time' | 'throughput' | 'success_rate',
    currentValue: number,
    baselineValue: number,
    processor?: 'inngest' | 'github_actions'
  ): void {
    const degradationPercent = ((currentValue - baselineValue) / baselineValue) * 100;
    const level = Math.abs(degradationPercent) > 30 ? 'warning' : 'info';
    
    Sentry.withScope(scope => {
      scope.setTag('alert.type', 'performance_degradation');
      scope.setTag('performance.metric', metric);
      scope.setTag('performance.degradation_percent', Math.round(degradationPercent));
      if (processor) {
        scope.setTag('rollout.processor', processor);
      }
      scope.setLevel(level);
      
      scope.setContext('performance_degradation', {
        metric,
        currentValue,
        baselineValue,
        degradationPercent,
        processor
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      const message = `Performance degradation in ${metric}: ${degradationPercent.toFixed(1)}% change${processor ? ` (${processor})` : ''}`;
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Track rollout job execution
   */
  trackJobExecution(
    jobId: string,
    processor: 'inngest' | 'github_actions',
    status: 'started' | 'completed' | 'failed',
    processingTime?: number,
    error?: Error
  ): void {
    Sentry.withScope(scope => {
      scope.setTag('rollout.job_tracking', true);
      scope.setTag('rollout.processor', processor);
      scope.setTag('job.status', status);
      scope.setTag('job.id', jobId);
      
      scope.setContext('job_execution', {
        jobId,
        processor,
        status,
        processingTime,
        timestamp: new Date().toISOString()
      });
      
      if (this.rolloutContext) {
        scope.setContext('rollout_context', this.rolloutContext);
      }
      
      if (status === 'failed' && error) {
        scope.setLevel('error');
        Sentry.captureException(error);
      } else if (status === 'completed' && processingTime) {
        // Only track slow jobs as breadcrumbs
        if (processingTime > 60000) { // > 1 minute
          Sentry.addBreadcrumb({
            message: `Slow job completion: ${jobId}`,
            category: 'rollout.performance',
            level: 'warning',
            data: { jobId, processor, processingTime }
          });
        }
      }
    });
  }

  /**
   * Clear rollout context
   */
  clearRolloutContext(): void {
    this.rolloutContext = null;
    Sentry.setContext('rollout', null);
  }

  /**
   * Get current rollout context
   */
  getRolloutContext(): RolloutAlertContext | null {
    return this.rolloutContext;
  }
}

// Export singleton instance
export const sentryRolloutAlerts = SentryRolloutAlerts.getInstance();

// Convenience functions for common alerts
export const rolloutAlerts = {
  healthDegradation: (healthScore: number, metrics: Partial<RolloutMetrics>, issues: string[]) =>
    sentryRolloutAlerts.alertHealthDegradation(healthScore, metrics, issues),
    
  highErrorRate: (errorRate: number, threshold: number, processor: 'inngest' | 'github_actions' | 'combined', recentErrors: Array<{ message: string; timestamp: string }>) =>
    sentryRolloutAlerts.alertHighErrorRate(errorRate, threshold, processor, recentErrors),
    
  emergencyRollback: (context: EmergencyRollbackContext) =>
    sentryRolloutAlerts.alertEmergencyRollback(context),
    
  rolloutChange: (previousPercentage: number, newPercentage: number, triggeredBy: string, reason?: string) =>
    sentryRolloutAlerts.alertRolloutChange(previousPercentage, newPercentage, triggeredBy, reason),
    
  processorIssue: (processor: 'inngest' | 'github_actions', issueType: 'stuck_jobs' | 'high_latency' | 'connection_failure' | 'rate_limit', details: Record<string, any>) =>
    sentryRolloutAlerts.alertProcessorIssue(processor, issueType, details),
    
  repositoryIssue: (repositoryId: string, repositoryName: string, issueType: 'categorization_failed' | 'eligibility_error' | 'processing_stuck', errorMessage?: string) =>
    sentryRolloutAlerts.alertRepositoryIssue(repositoryId, repositoryName, issueType, errorMessage),
    
  costAnomaly: (currentCost: number, expectedCost: number, anomalyType: 'spike' | 'unexpected_increase' | 'savings_degraded', processor?: 'inngest' | 'github_actions') =>
    sentryRolloutAlerts.alertCostAnomaly(currentCost, expectedCost, anomalyType, processor),
    
  performanceDegradation: (metric: 'processing_time' | 'throughput' | 'success_rate', currentValue: number, baselineValue: number, processor?: 'inngest' | 'github_actions') =>
    sentryRolloutAlerts.alertPerformanceDegradation(metric, currentValue, baselineValue, processor),
    
  trackJob: (jobId: string, processor: 'inngest' | 'github_actions', status: 'started' | 'completed' | 'failed', processingTime?: number, error?: Error) =>
    sentryRolloutAlerts.trackJobExecution(jobId, processor, status, processingTime, error),
    
  setContext: (context: Partial<RolloutAlertContext>) =>
    sentryRolloutAlerts.setRolloutContext(context),
    
  clearContext: () =>
    sentryRolloutAlerts.clearRolloutContext()
};