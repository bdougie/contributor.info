/**
 * Maintainer Classification Evaluator
 * Implements the core classification logic for evaluation
 */

import type { EvaluationInput, EvaluationResult, EvaluationConfig, GitHubEvent, ContributorMetrics } from '../types';

export class MaintainerClassifier {
  private config: EvaluationConfig;

  constructor(config: EvaluationConfig) {
    this.config = config;
  }

  async evaluateSample(
    input: EvaluationInput,
    sampleId: string,
    expected: 'owner' | 'maintainer' | 'contributor'
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      const prediction = this.classifyContributor(input);
      const confidence = this.calculateConfidence(input, prediction);
      const executionTime = Date.now() - startTime;

      return {
        sample_id: sampleId,
        prediction,
        confidence,
        expected,
        correct: prediction === expected,
        execution_time_ms: executionTime
      };
    } catch (error) {
      return {
        sample_id: sampleId,
        prediction: 'contributor', // Default fallback
        confidence: 0,
        expected,
        correct: false,
        execution_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private classifyContributor(input: EvaluationInput): 'owner' | 'maintainer' | 'contributor' {
    const features = this.extractFeatures(input);
    const score = this.calculateClassificationScore(features);

    // Apply confidence thresholds
    if (score >= this.config.confidence_thresholds.owner) {
      return 'owner';
    } else if (score >= this.config.confidence_thresholds.maintainer) {
      return 'maintainer';
    } else {
      return 'contributor';
    }
  }

  private extractFeatures(input: EvaluationInput) {
    const { events, metrics, repository_context } = input;

    // Temporal features
    const recentActivityWeight = this.calculateRecentActivityWeight(events);
    const consistencyScore = this.calculateActivityConsistency(events);
    
    // Repository context features
    const repoSizeWeight = this.getRepositorySizeWeight(repository_context?.size || 'small');
    const popularityFactor = Math.log(1 + (repository_context?.stars || 0)) / 10;

    // Event-based features
    const privilegedEventRatio = metrics.total_events > 0 
      ? metrics.privileged_events / metrics.total_events 
      : 0;

    const adminActionWeight = this.calculateAdminActionWeight(events);
    const releaseActivityWeight = metrics.release_events / Math.max(metrics.total_events, 1);

    return {
      privileged_event_ratio: privilegedEventRatio,
      admin_action_weight: adminActionWeight,
      release_activity_weight: releaseActivityWeight,
      recent_activity_weight: recentActivityWeight,
      consistency_score: consistencyScore,
      repo_size_weight: repoSizeWeight,
      popularity_factor: popularityFactor,
      detection_method_count: metrics.detection_methods.length,
      days_active_normalized: Math.min(metrics.days_active / 365, 1), // Normalize to 1 year
      merge_event_ratio: metrics.merge_events / Math.max(metrics.total_events, 1)
    };
  }

  private calculateClassificationScore(features: any): number {
    const weights = this.config.feature_weights || {
      merge_events: 0.25,
      push_events: 0.2,
      admin_actions: 0.3,
      temporal_activity: 0.25
    };

    // Weighted combination of features
    let score = 0;

    // Core maintainer indicators
    score += features.privileged_event_ratio * weights.merge_events;
    score += features.admin_action_weight * weights.admin_actions;
    score += features.release_activity_weight * weights.admin_actions;

    // Temporal consistency
    score += features.recent_activity_weight * weights.temporal_activity;
    score += features.consistency_score * weights.temporal_activity;

    // Repository context
    score += features.repo_size_weight * 0.1;
    score += features.popularity_factor * 0.05;

    // Detection method diversity
    score += (features.detection_method_count / 5) * 0.15; // Max 5 detection methods

    // Long-term engagement
    score += features.days_active_normalized * 0.1;

    // Merge activity (strong indicator)
    score += features.merge_event_ratio * weights.merge_events;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  private calculateRecentActivityWeight(events: GitHubEvent[]): number {
    if (events.length === 0) return 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentEvents = events.filter(event => 
      new Date(event.created_at) >= thirtyDaysAgo
    );

    return recentEvents.length / Math.max(events.length, 1);
  }

  private calculateActivityConsistency(events: GitHubEvent[]): number {
    if (events.length < 2) return 0;

    // Group events by week
    const weeklyActivity = new Map<string, number>();
    
    events.forEach(event => {
      const date = new Date(event.created_at);
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      weeklyActivity.set(weekKey, (weeklyActivity.get(weekKey) || 0) + 1);
    });

    const activityValues = Array.from(weeklyActivity.values());
    if (activityValues.length < 2) return 0;

    // Calculate coefficient of variation (inverse of consistency)
    const mean = activityValues.reduce((sum, val) => sum + val, 0) / activityValues.length;
    const variance = activityValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / activityValues.length;
    const stdDev = Math.sqrt(variance);
    
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    return Math.max(0, 1 - coefficientOfVariation); // Higher consistency = lower CV
  }

  private calculateAdminActionWeight(events: GitHubEvent[]): number {
    const adminEvents = events.filter(event => 
      ['ReleaseEvent', 'IssuesEvent'].includes(event.type) ||
      (event.type === 'PushEvent' && event.ref?.includes('main'))
    );

    return adminEvents.length / Math.max(events.length, 1);
  }

  private getRepositorySizeWeight(size: 'small' | 'medium' | 'large'): number {
    // Larger repositories have higher barriers to maintainer status
    switch (size) {
      case 'small': return 0.8;
      case 'medium': return 0.9;
      case 'large': return 1.0;
      default: return 0.8;
    }
  }

  private calculateConfidence(input: EvaluationInput, prediction: 'owner' | 'maintainer' | 'contributor'): number {
    const features = this.extractFeatures(input);
    const score = this.calculateClassificationScore(features);

    // Confidence based on how far the score is from decision boundaries
    const { owner: ownerThreshold, maintainer: maintainerThreshold } = this.config.confidence_thresholds;

    if (prediction === 'owner') {
      return Math.min(score / ownerThreshold, 1.0);
    } else if (prediction === 'maintainer') {
      const distanceFromMaintainer = Math.abs(score - maintainerThreshold);
      const distanceFromOwner = Math.abs(score - ownerThreshold);
      const minDistance = Math.min(distanceFromMaintainer, distanceFromOwner);
      return Math.min(0.5 + minDistance, 1.0);
    } else {
      // Contributor confidence inversely related to score
      return Math.min(1.0 - score, 1.0);
    }
  }

  updateConfig(newConfig: Partial<EvaluationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): EvaluationConfig {
    return { ...this.config };
  }
}