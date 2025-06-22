/**
 * TypeScript types for OpenAI Evals integration
 * Maintainer Classification Evaluation Framework
 */

export interface GitHubEvent {
  type: 'PullRequestEvent' | 'PushEvent' | 'ReleaseEvent' | 'IssuesEvent' | 'IssueCommentEvent';
  action: string;
  merged?: boolean;
  ref?: string;
  forced?: boolean;
  created_at: string;
}

export interface ContributorMetrics {
  privileged_events: number;
  total_events: number;
  days_active: number;
  detection_methods: string[];
  confidence_score: number;
  merge_events: number;
  push_to_protected: number;
  admin_actions: number;
  release_events: number;
}

export interface EvaluationInput {
  user_id: string;
  repository: string;
  events: GitHubEvent[];
  metrics: ContributorMetrics;
  repository_context?: {
    size: 'small' | 'medium' | 'large';
    stars: number;
    contributors_count: number;
    created_at: string;
  };
}

export interface EvaluationSample {
  input: EvaluationInput;
  ideal: 'maintainer' | 'contributor';
  metadata?: {
    verified_by: string;
    verification_date: string;
    confidence_level: 'high' | 'medium' | 'low';
    edge_case?: boolean;
  };
}

export interface EvaluationResult {
  sample_id: string;
  prediction: 'maintainer' | 'contributor';
  confidence: number;
  expected: 'maintainer' | 'contributor';
  correct: boolean;
  execution_time_ms: number;
  error?: string;
}

export interface EvaluationMetrics {
  overall_accuracy: number;
  per_class_metrics: {
    [key in 'maintainer' | 'contributor']: {
      precision: number;
      recall: number;
      f1_score: number;
      support: number;
    };
  };
  confusion_matrix: number[][];
  confidence_calibration: {
    expected_accuracy: number;
    actual_accuracy: number;
    calibration_error: number;
  };
  execution_stats: {
    total_samples: number;
    successful_predictions: number;
    failed_predictions: number;
    average_execution_time_ms: number;
  };
}

export interface EvaluationConfig {
  name: string;
  description: string;
  dataset_path: string;
  confidence_thresholds: {
    maintainer: number;
  };
  evaluation_criteria: {
    min_accuracy: number;
    min_samples: number;
    max_execution_time_ms: number;
  };
  feature_weights?: {
    merge_events: number;
    push_events: number;
    admin_actions: number;
    temporal_activity: number;
  };
}

export interface DatasetStats {
  total_samples: number;
  class_distribution: {
    maintainer: number;
    contributor: number;
  };
  repository_distribution: {
    [repo: string]: number;
  };
  temporal_distribution: {
    [month: string]: number;
  };
  quality_metrics: {
    verified_samples: number;
    high_confidence_samples: number;
    edge_cases: number;
  };
}

export interface GroundTruthValidation {
  sample_id: string;
  original_label: 'maintainer' | 'contributor';
  reviewer_labels: ('maintainer' | 'contributor')[];
  consensus_label: 'maintainer' | 'contributor';
  agreement_score: number;
  requires_review: boolean;
  notes?: string;
}