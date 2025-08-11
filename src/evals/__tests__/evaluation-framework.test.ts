/**
 * Evaluation Framework Test Suite
 * Comprehensive tests for the maintainer classification evaluation system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaintainerClassifier } from '../runners/maintainer-classifier';
import { EvaluationMetricsCalculator } from '../metrics/evaluation-metrics';
import type { EvaluationConfig, EvaluationInput, EvaluationResult } from '../types';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }))
  }))
}));

describe('MaintainerClassifier', () => {
  let classifier: MaintainerClassifier;
  let config: EvaluationConfig;

  beforeEach(() => {
    config = {
      name: 'test-config',
      description: 'Test configuration',
      dataset_path: 'test.jsonl',
      confidence_thresholds: {
        maintainer: 0.8
      },
      evaluation_criteria: {
        min_accuracy: 0.85,
        min_samples: 100,
        max_execution_time_ms: 1000
      },
      feature_weights: {
        merge_events: 0.25,
        push_events: 0.2,
        admin_actions: 0.3,
        temporal_activity: 0.25
      }
    };
    classifier = new MaintainerClassifier(config);
  });

  describe('Maintainer Classification', () => {
    it('should classify moderate-privilege contributor as maintainer', async () => {
      const input: EvaluationInput = {
        user_id: 'test-maintainer',
        repository: 'test/repo',
        events: [
          { type: 'PullRequestEvent', action: 'closed', merged: true, created_at: '2024-01-01T00:00:00Z' },
          { type: 'PushEvent', action: 'push', ref: 'refs/heads/main', created_at: '2024-01-02T00:00:00Z' },
          { type: 'IssuesEvent', action: 'closed', created_at: '2024-01-03T00:00:00Z' },
          { type: 'ReleaseEvent', action: 'published', created_at: '2024-01-04T00:00:00Z' }
        ],
        metrics: {
          privileged_events: 10,
          total_events: 15,
          days_active: 200,
          detection_methods: ['merge_event', 'push_to_protected', 'admin_action'],
          confidence_score: 0.82,
          merge_events: 6,
          push_to_protected: 2,
          admin_actions: 2,
          release_events: 0
        }
      };

      const result = await classifier.evaluateSample(input, 'test-2', 'maintainer');

      expect(result.prediction).toBe('maintainer');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.correct).toBe(true);
    });
  });

  describe('Contributor Classification', () => {
    it('should classify low-privilege contributor as contributor', async () => {
      const input: EvaluationInput = {
        user_id: 'test-contributor',
        repository: 'test/repo',
        events: [
          { type: 'PullRequestEvent', action: 'opened', created_at: '2024-01-01T00:00:00Z' },
          { type: 'IssueCommentEvent', action: 'created', created_at: '2024-01-02T00:00:00Z' }
        ],
        metrics: {
          privileged_events: 1,
          total_events: 10,
          days_active: 30,
          detection_methods: [],
          confidence_score: 0.3,
          merge_events: 0,
          push_to_protected: 0,
          admin_actions: 0,
          release_events: 0
        }
      };

      const result = await classifier.evaluateSample(input, 'test-3', 'contributor');

      expect(result.prediction).toBe('contributor');
      expect(result.correct).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty events gracefully', async () => {
      const input: EvaluationInput = {
        user_id: 'test-empty',
        repository: 'test/repo',
        events: [],
        metrics: {
          privileged_events: 0,
          total_events: 0,
          days_active: 0,
          detection_methods: [],
          confidence_score: 0,
          merge_events: 0,
          push_to_protected: 0,
          admin_actions: 0,
          release_events: 0
        }
      };

      const result = await classifier.evaluateSample(input, 'test-empty', 'contributor');

      expect(result.error).toBeUndefined();
      expect(result.prediction).toBe('contributor');
    });

    it('should handle malformed data', async () => {
      const input: EvaluationInput = {
        user_id: 'test-malformed',
        repository: 'test/repo',
        events: [
          // @ts-expect-error Testing malformed data
          { type: 'InvalidEvent', created_at: 'invalid-date' }
        ],
        metrics: {
          privileged_events: 0,
          total_events: 1,
          days_active: 0,
          detection_methods: [],
          confidence_score: 0,
          merge_events: 0,
          push_to_protected: 0,
          admin_actions: 0,
          release_events: 0
        }
      };

      const result = await classifier.evaluateSample(input, 'test-malformed', 'contributor');

      expect(result.error).toBeUndefined(); // Should handle gracefully
      expect(result.prediction).toBeDefined();
    });
  });
});

describe('EvaluationMetricsCalculator', () => {
  let calculator: EvaluationMetricsCalculator;

  beforeEach(() => {
    calculator = new EvaluationMetricsCalculator();
  });

  describe('Overall Accuracy', () => {
    it('should calculate correct overall accuracy', () => {
      const results: EvaluationResult[] = [
        { sample_id: '1', prediction: 'maintainer', expected: 'maintainer', confidence: 0.9, correct: true, execution_time_ms: 100 },
        { sample_id: '2', prediction: 'maintainer', expected: 'maintainer', confidence: 0.8, correct: true, execution_time_ms: 150 },
        { sample_id: '3', prediction: 'contributor', expected: 'maintainer', confidence: 0.3, correct: false, execution_time_ms: 80 },
        { sample_id: '4', prediction: 'contributor', expected: 'contributor', confidence: 0.7, correct: true, execution_time_ms: 120 }
      ];

      const metrics = calculator.calculateMetrics(results);

      expect(metrics.overall_accuracy).toBe(0.75); // 3 out of 4 correct
      expect(metrics.execution_stats.total_samples).toBe(4);
      expect(metrics.execution_stats.successful_predictions).toBe(4);
      expect(metrics.execution_stats.failed_predictions).toBe(0);
    });
  });

  describe('Per-Class Metrics', () => {
    it('should calculate precision, recall, and F1 scores correctly', () => {
      const results: EvaluationResult[] = [
        // Maintainer: 2 predicted, 1 correct (TP=1, FP=1, FN=1)
        { sample_id: '1', prediction: 'maintainer', expected: 'maintainer', confidence: 0.9, correct: true, execution_time_ms: 100 },
        { sample_id: '2', prediction: 'maintainer', expected: 'contributor', confidence: 0.85, correct: false, execution_time_ms: 110 },
        { sample_id: '3', prediction: 'contributor', expected: 'maintainer', confidence: 0.75, correct: false, execution_time_ms: 90 },
        
        // Contributor: 2 predicted, 2 correct (TP=2, FP=0, FN=0)
        { sample_id: '4', prediction: 'contributor', expected: 'contributor', confidence: 0.6, correct: true, execution_time_ms: 85 },
        { sample_id: '5', prediction: 'contributor', expected: 'contributor', confidence: 0.5, correct: true, execution_time_ms: 80 }
      ];

      const metrics = calculator.calculateMetrics(results);

      // Maintainer metrics: TP=1, FP=1, FN=1
      expect(metrics.per_class_metrics.maintainer.precision).toBe(0.5); // 1/(1+1)
      expect(metrics.per_class_metrics.maintainer.recall).toBe(0.5); // 1/(1+1)
      expect(metrics.per_class_metrics.maintainer.f1_score).toBe(0.5); // 2*(0.5*0.5)/(0.5+0.5)

      // Contributor metrics: TP=2, FP=1, FN=1
      expect(metrics.per_class_metrics.contributor.precision).toBeCloseTo(0.667, 2); // 2/(2+1)
      expect(metrics.per_class_metrics.contributor.recall).toBeCloseTo(0.667, 2); // 2/(2+1)
      expect(metrics.per_class_metrics.contributor.f1_score).toBeCloseTo(0.667, 2); // 2*(0.667*0.667)/(0.667+0.667)
    });
  });

  describe('Confusion Matrix', () => {
    it('should generate correct confusion matrix', () => {
      const results: EvaluationResult[] = [
        { sample_id: '1', prediction: 'maintainer', expected: 'maintainer', confidence: 0.9, correct: true, execution_time_ms: 100 },
        { sample_id: '2', prediction: 'maintainer', expected: 'contributor', confidence: 0.8, correct: false, execution_time_ms: 110 },
        { sample_id: '3', prediction: 'contributor', expected: 'maintainer', confidence: 0.85, correct: false, execution_time_ms: 90 },
        { sample_id: '4', prediction: 'contributor', expected: 'contributor', confidence: 0.7, correct: true, execution_time_ms: 80 }
      ];

      const metrics = calculator.calculateMetrics(results);
      const matrix = metrics.confusion_matrix;

      // Matrix should be 2x2 (maintainer, contributor)
      expect(matrix).toHaveLength(2);
      expect(matrix[0]).toHaveLength(2);

      // Row 0 (Maintainer actual): [1, 1] - 1 correctly predicted as maintainer, 1 incorrectly as contributor
      expect(matrix[0][0]).toBe(1); // maintainer->maintainer
      expect(matrix[0][1]).toBe(1); // maintainer->contributor

      // Row 1 (Contributor actual): [1, 1] - 1 incorrectly as maintainer, 1 correctly as contributor
      expect(matrix[1][0]).toBe(1); // contributor->maintainer
      expect(matrix[1][1]).toBe(1); // contributor->contributor

    });
  });

  describe('Confidence Calibration', () => {
    it('should calculate calibration metrics', () => {
      const results: EvaluationResult[] = [
        { sample_id: '1', prediction: 'maintainer', expected: 'maintainer', confidence: 0.9, correct: true, execution_time_ms: 100 },
        { sample_id: '2', prediction: 'maintainer', expected: 'maintainer', confidence: 0.8, correct: true, execution_time_ms: 110 },
        { sample_id: '3', prediction: 'maintainer', expected: 'contributor', confidence: 0.7, correct: false, execution_time_ms: 90 },
        { sample_id: '4', prediction: 'contributor', expected: 'contributor', confidence: 0.6, correct: true, execution_time_ms: 80 }
      ];

      const metrics = calculator.calculateMetrics(results);
      
      expect(metrics.confidence_calibration.expected_accuracy).toBeGreaterThan(0);
      expect(metrics.confidence_calibration.actual_accuracy).toBe(0.75); // 3/4 correct
      expect(metrics.confidence_calibration.calibration_error).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', () => {
      const results: EvaluationResult[] = [
        { sample_id: '1', prediction: 'maintainer', expected: 'maintainer', confidence: 0.9, correct: true, execution_time_ms: 100 },
        { sample_id: '2', prediction: 'maintainer', expected: 'maintainer', confidence: 0.8, correct: true, execution_time_ms: 110 },
        { sample_id: '3', prediction: 'contributor', expected: 'contributor', confidence: 0.7, correct: true, execution_time_ms: 90 }
      ];

      const metrics = calculator.calculateMetrics(results);
      const report = calculator.generateDetailedReport(metrics);

      expect(report).toContain('Maintainer Classification Evaluation Report');
      expect(report).toContain('Overall Performance');
      expect(report).toContain('Per-Class Performance');
      expect(report).toContain('Confidence Calibration');
      expect(report).toContain('Confusion Matrix');
      expect(report).toContain('Recommendations');
      expect(report).toContain('100.00%'); // Perfect accuracy
    });
  });
});

describe('Feature Extraction', () => {
  let classifier: MaintainerClassifier;
  
  beforeEach(() => {
    const config: EvaluationConfig = {
      name: 'test-config',
      description: 'Test configuration',
      dataset_path: 'test.jsonl',
      confidence_thresholds: { maintainer: 0.8 },
      evaluation_criteria: { min_accuracy: 0.85, min_samples: 100, max_execution_time_ms: 1000 }
    };
    classifier = new MaintainerClassifier(config);
  });

  it('should handle repository context correctly', async () => {
    const input: EvaluationInput = {
      user_id: 'test-user',
      repository: 'large-repo/project',
      events: [
        { type: 'PullRequestEvent', action: 'closed', merged: true, created_at: '2024-01-01T00:00:00Z' }
      ],
      metrics: {
        privileged_events: 5,
        total_events: 10,
        days_active: 100,
        detection_methods: ['merge_event'],
        confidence_score: 0.8,
        merge_events: 5,
        push_to_protected: 0,
        admin_actions: 0,
        release_events: 0
      },
      repository_context: {
        size: 'large',
        stars: 5000,
        contributors_count: 100,
        created_at: '2020-01-01T00:00:00Z'
      }
    };

    const result = await classifier.evaluateSample(input, 'test-repo-context', 'maintainer');
    
    expect(result.error).toBeUndefined();
    expect(result.prediction).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });
