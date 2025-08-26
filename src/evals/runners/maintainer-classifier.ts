/**
 * Maintainer Classification Evaluator
 * Implements the core classification logic for evaluation
 */

import type { EvaluationInput, EvaluationResult, EvaluationConfig } from '../types';

export class MaintainerClassifier {
  private config: EvaluationConfig;

  constructor(config: EvaluationConfig) {
    this.config = config;
  }

  async evaluateSample(
    input: EvaluationInput,
    sampleId: string,
    expected: 'maintainer' | 'contributor'
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
    } catch (_error) {
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

  private classifyContributor(input: EvaluationInput): 'maintainer' | 'contributor' {
    // Use the pre-calculated confidence score from input metrics
    const score = input.metrics.confidence_score;

    // Apply confidence threshold - only maintainer vs contributor
    if (score >= this.config.confidence_thresholds.maintainer) {
      return 'maintainer';
    } else {
      return 'contributor';
    }
  }


  private calculateConfidence(input: EvaluationInput, prediction: 'maintainer' | 'contributor'): number {
    // Use the pre-calculated confidence score from input metrics
    const score = input.metrics.confidence_score;

    // Confidence based on how far the score is from decision boundaries
    const { maintainer: maintainerThreshold } = this.config.confidence_thresholds;

    if (prediction === 'maintainer') {
      // For maintainer: confidence increases with score above threshold
      return Math.min(score / maintainerThreshold, 1.0);
    } else {
      // For contributor: confidence decreases as score approaches maintainer threshold
      const distanceFromThreshold = maintainerThreshold - score;
      return Math.min(0.5 + (distanceFromThreshold / maintainerThreshold), 1.0);
    }
  }

  updateConfig(newConfig: Partial<EvaluationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): EvaluationConfig {
    return { ...this.config };
  }
}