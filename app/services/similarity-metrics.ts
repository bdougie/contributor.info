/**
 * SimilarityMetricsService - Track similarity prediction accuracy
 *
 * Uses PostHog to track:
 * - Which predicted issues were actually linked in PRs
 * - Precision/recall for similarity predictions
 * - Model performance over time
 * - User feedback on suggestions
 */

import type { SimilarIssue } from './similarity';

export interface SimilarityPrediction {
  prId: string | number;
  prNumber: number;
  repositoryId: string | number;
  predictedIssues: SimilarIssue[];
  predictedAt: string;
  confidence: number;
}

export interface SimilarityAccuracy {
  prId: string | number;
  predictions: SimilarIssue[];
  actualLinkedIssues: Array<{
    id: string | number;
    number: number;
  }>;
  precision: number;
  recall: number;
  accuracy: number;
}

/**
 * Lightweight PostHog client for server-side tracking
 */
class PostHogClient {
  private apiKey: string | undefined;
  private host: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.POSTHOG_API_KEY;
    this.host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
    this.enabled = !!this.apiKey;
  }

  async capture(
    distinctId: string,
    event: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled || !this.apiKey) return;

    try {
      const response = await fetch(`${this.host}/capture/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          distinct_id: distinctId,
          event,
          properties: {
            ...properties,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        console.error('PostHog capture failed:', response.status);
      }
    } catch (error) {
      console.error('Error capturing PostHog event:', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * SimilarityMetricsService - ML accuracy tracking
 */
export class SimilarityMetricsService {
  private static instance: SimilarityMetricsService;
  private posthog: PostHogClient;

  // Track predictions for later evaluation
  private predictions = new Map<string, SimilarityPrediction>();

  private constructor() {
    this.posthog = new PostHogClient();
  }

  static getInstance(): SimilarityMetricsService {
    if (!SimilarityMetricsService.instance) {
      SimilarityMetricsService.instance = new SimilarityMetricsService();
    }
    return SimilarityMetricsService.instance;
  }

  /**
   * Track similarity predictions when PR is opened
   */
  async trackPrediction(prediction: SimilarityPrediction): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    // Store prediction for later evaluation
    this.predictions.set(prediction.prId.toString(), prediction);

    const distinctId = `pr-${prediction.prId}`;

    await this.posthog.capture(distinctId, 'similarity_prediction', {
      // PR context
      pr_id: prediction.prId,
      pr_number: prediction.prNumber,
      repository_id: prediction.repositoryId,

      // Predictions
      predicted_count: prediction.predictedIssues.length,
      predicted_issues: prediction.predictedIssues.map((issue) => ({
        issue_id: issue.issue.id,
        issue_number: issue.issue.number,
        similarity_score: issue.similarityScore,
        relationship: issue.relationship,
      })),

      // Confidence metrics
      avg_similarity_score:
        prediction.predictedIssues.reduce((sum, issue) => sum + issue.similarityScore, 0) /
        prediction.predictedIssues.length,
      max_similarity_score: Math.max(
        ...prediction.predictedIssues.map((issue) => issue.similarityScore)
      ),
      min_similarity_score: Math.min(
        ...prediction.predictedIssues.map((issue) => issue.similarityScore)
      ),

      // Metadata
      predicted_at: prediction.predictedAt,
      confidence: prediction.confidence,

      // Feature flag
      feature: 'similarity-prediction',
    });
  }

  /**
   * Track accuracy when PR is merged/closed
   */
  async trackAccuracy(accuracy: SimilarityAccuracy): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `pr-${accuracy.prId}`;

    // Calculate true/false positives
    const predictedIssueNumbers = new Set(accuracy.predictions.map((p) => p.issue.number));
    const actualIssueNumbers = new Set(accuracy.actualLinkedIssues.map((i) => i.number));

    const truePositives = accuracy.predictions.filter((p) =>
      actualIssueNumbers.has(p.issue.number)
    ).length;
    const falsePositives = accuracy.predictions.filter(
      (p) => !actualIssueNumbers.has(p.issue.number)
    ).length;
    const falseNegatives = accuracy.actualLinkedIssues.filter(
      (i) => !predictedIssueNumbers.has(i.number)
    ).length;

    await this.posthog.capture(distinctId, 'similarity_accuracy', {
      // PR context
      pr_id: accuracy.prId,

      // Accuracy metrics
      precision: accuracy.precision,
      recall: accuracy.recall,
      accuracy: accuracy.accuracy,
      f1_score: this.calculateF1Score(accuracy.precision, accuracy.recall),

      // Confusion matrix
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives,

      // Predictions vs actual
      predicted_count: accuracy.predictions.length,
      actual_count: accuracy.actualLinkedIssues.length,
      correctly_predicted: truePositives,

      // Feature flag
      feature: 'similarity-accuracy',
    });

    // Remove prediction from memory after evaluation
    this.predictions.delete(accuracy.prId.toString());
  }

  /**
   * Track user feedback on similarity suggestions
   */
  async trackUserFeedback(
    prId: string | number,
    issueId: string | number,
    feedback: 'helpful' | 'not_helpful' | 'incorrect',
    userComment?: string
  ): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `pr-${prId}`;

    await this.posthog.capture(distinctId, 'similarity_feedback', {
      pr_id: prId,
      issue_id: issueId,
      feedback,
      user_comment: userComment,
      feature: 'similarity-feedback',
    });
  }

  /**
   * Track real-time similarity updates
   */
  async trackSimilarityUpdate(
    prId: string | number,
    repositoryId: string | number,
    trigger: 'issue_opened' | 'issue_edited' | 'pr_edited',
    previousCount: number,
    newCount: number,
    updateTimeMs: number
  ): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `pr-${prId}`;

    await this.posthog.capture(distinctId, 'similarity_updated', {
      pr_id: prId,
      repository_id: repositoryId,
      trigger,
      previous_count: previousCount,
      new_count: newCount,
      change: newCount - previousCount,
      update_time_ms: updateTimeMs,
      feature: 'similarity-updates',
    });
  }

  /**
   * Calculate F1 score from precision and recall
   */
  private calculateF1Score(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  /**
   * Calculate accuracy metrics from predictions and actual links
   */
  calculateAccuracyMetrics(
    predictions: SimilarIssue[],
    actualLinks: Array<{ id: string | number; number: number }>
  ): Omit<SimilarityAccuracy, 'prId'> {
    const predictedIssueNumbers = new Set(predictions.map((p) => p.issue.number));
    const actualIssueNumbers = new Set(actualLinks.map((i) => i.number));

    // Calculate confusion matrix
    const truePositives = predictions.filter((p) => actualIssueNumbers.has(p.issue.number)).length;
    const falsePositives = predictions.filter(
      (p) => !actualIssueNumbers.has(p.issue.number)
    ).length;
    const falseNegatives = actualLinks.filter((i) => !predictedIssueNumbers.has(i.number)).length;

    // Calculate metrics
    const precision =
      truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall =
      truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const accuracy =
      truePositives + falsePositives + falseNegatives > 0
        ? truePositives / (truePositives + falsePositives + falseNegatives)
        : 0;

    return {
      predictions,
      actualLinkedIssues: actualLinks,
      precision,
      recall,
      accuracy,
    };
  }

  /**
   * Check if tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.posthog.isEnabled();
  }
}

// Export singleton instance
export const similarityMetricsService = SimilarityMetricsService.getInstance();
