# Maintainer Classification Evaluation Framework

A comprehensive TypeScript-based evaluation system for testing and improving the accuracy of GitHub contributor role classification (owner/maintainer/contributor).

## Overview

This evaluation framework implements a robust testing system that:
- Extracts ground truth datasets from Supabase
- Runs classification evaluations with configurable parameters
- Calculates comprehensive metrics (accuracy, precision, recall, F1, calibration)
- Provides detailed reports and error analysis
- Supports benchmark comparisons across different configurations

## Quick Start

### Prerequisites

1. **Environment Variables**: Set up your `.env` file:
```bash
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_TOKEN=your-service-role-key
```

2. **Install Dependencies**:
```bash
npm install
```

### Running Evaluations

```bash
# Run standard evaluation
npm run eval:maintainer

# Run with conservative thresholds (higher precision)
npm run eval:conservative

# Run with aggressive thresholds (higher recall)
npm run eval:aggressive

# Run benchmark comparison across all configurations
npm run eval:benchmark
```

### Custom Evaluation

```bash
# Run with custom parameters
npm run eval:maintainer -- --samples 1500 --min-accuracy 0.9

# Export results to custom directory
npm run eval:maintainer -- --export ./my-results

# Get help
npm run eval:maintainer -- --help
```

## Architecture

### Core Components

#### 1. Data Extraction (`datasets/ground-truth-extractor.ts`)
- Extracts high-confidence contributor classifications from Supabase
- Balances dataset across role types (owner/maintainer/contributor)
- Generates JSONL format compatible with evaluation frameworks
- Validates data quality and prevents leakage

#### 2. Classification Logic (`runners/maintainer-classifier.ts`)
- Implements feature extraction from GitHub events
- Applies weighted scoring algorithm for role determination
- Calculates confidence scores with calibration
- Handles edge cases and malformed data gracefully

#### 3. Metrics Calculation (`metrics/evaluation-metrics.ts`)
- Computes comprehensive evaluation metrics
- Generates confusion matrices and calibration analysis
- Provides per-class performance breakdown
- Creates detailed reports with actionable recommendations

#### 4. Evaluation Runner (`runners/evaluation-runner.ts`)
- Orchestrates complete evaluation workflow
- Supports batch processing for large datasets
- Validates results against quality criteria
- Exports results in multiple formats

### Data Types

The framework uses strongly-typed TypeScript interfaces:

```typescript
interface EvaluationInput {
  user_id: string;
  repository: string;
  events: GitHubEvent[];
  metrics: ContributorMetrics;
  repository_context?: RepositoryContext;
}

interface EvaluationResult {
  sample_id: string;
  prediction: 'owner' | 'maintainer' | 'contributor';
  confidence: number;
  expected: 'owner' | 'maintainer' | 'contributor';
  correct: boolean;
  execution_time_ms: number;
  error?: string;
}
```

## Configuration

### Evaluation Configurations

Three pre-built configurations are available:

#### Standard (Balanced)
```typescript
{
  confidence_thresholds: { owner: 0.95, maintainer: 0.8 },
  evaluation_criteria: { min_accuracy: 0.85, min_samples: 1000 },
  feature_weights: {
    merge_events: 0.25,
    push_events: 0.2,
    admin_actions: 0.3,
    temporal_activity: 0.25
  }
}
```

#### Conservative (High Precision)
```typescript
{
  confidence_thresholds: { owner: 0.98, maintainer: 0.9 },
  evaluation_criteria: { min_accuracy: 0.8, min_samples: 1000 },
  feature_weights: {
    merge_events: 0.3,
    push_events: 0.15,
    admin_actions: 0.4,
    temporal_activity: 0.15
  }
}
```

#### Aggressive (High Recall)
```typescript
{
  confidence_thresholds: { owner: 0.9, maintainer: 0.7 },
  evaluation_criteria: { min_accuracy: 0.75, min_samples: 1000 },
  feature_weights: {
    merge_events: 0.2,
    push_events: 0.25,
    admin_actions: 0.25,
    temporal_activity: 0.3
  }
}
```

### Custom Configuration

Create custom configurations by extending the base `EvaluationConfig` interface:

```typescript
import { EvaluationRunner } from './src/evals';

const customConfig = {
  name: 'my-custom-eval',
  description: 'Custom evaluation with specific parameters',
  confidence_thresholds: { owner: 0.92, maintainer: 0.75 },
  evaluation_criteria: { min_accuracy: 0.88, min_samples: 800 },
  feature_weights: {
    merge_events: 0.4,
    push_events: 0.2,
    admin_actions: 0.3,
    temporal_activity: 0.1
  }
};

const runner = new EvaluationRunner(customConfig);
const results = await runner.runCompleteEvaluation();
```

## Feature Engineering

The classifier extracts multiple feature types:

### Event-Based Features
- **Privileged Event Ratio**: Proportion of high-privilege actions (merges, protected pushes)
- **Admin Action Weight**: Frequency of administrative actions (releases, issue management)
- **Merge Event Ratio**: Proportion of merged pull requests

### Temporal Features
- **Recent Activity Weight**: Activity in last 30 days vs. total activity
- **Consistency Score**: Regularity of contributions over time
- **Days Active Normalized**: Long-term engagement indicator

### Repository Context Features
- **Repository Size Weight**: Adjustment based on repository size/popularity
- **Popularity Factor**: Logarithmic scaling of star count
- **Detection Method Count**: Diversity of role detection signals

## Metrics & Reporting

### Core Metrics

1. **Overall Accuracy**: Percentage of correct classifications
2. **Per-Class Metrics**: Precision, recall, and F1-score for each role type
3. **Confusion Matrix**: Detailed breakdown of classification errors
4. **Confidence Calibration**: How well confidence scores match actual accuracy

### Example Report Output

```
# Maintainer Classification Evaluation Report

## Overall Performance
- **Accuracy**: 87.42%
- **Total Samples**: 1,247
- **Successful Predictions**: 1,247
- **Failed Predictions**: 0

## Per-Class Performance

### Owner Classification
- **Precision**: 92.15%
- **Recall**: 89.31%
- **F1-Score**: 90.71%
- **Support**: 415 samples

### Maintainer Classification
- **Precision**: 84.67%
- **Recall**: 86.42%
- **F1-Score**: 85.54%
- **Support**: 398 samples

### Contributor Classification
- **Precision**: 89.23%
- **Recall**: 88.76%
- **F1-Score**: 88.99%
- **Support**: 434 samples
```

## Testing

The framework includes comprehensive unit tests:

```bash
# Run all tests
npm test

# Run evaluation-specific tests
npm test src/evals

# Run tests with coverage
npm run test:coverage
```

Test coverage includes:
- Classification accuracy for different role types
- Feature extraction edge cases
- Metrics calculation validation
- Error handling and recovery
- Configuration validation

## Integration

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: Maintainer Classification Evaluation
on:
  pull_request:
    paths: ['src/lib/contributors/**']
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Run Evaluation
        run: npm run eval:maintainer
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_TOKEN: ${{ secrets.SUPABASE_TOKEN }}
      - name: Check Results
        run: |
          if [ $? -eq 0 ]; then
            echo "✅ Evaluation passed quality criteria"
          else
            echo "❌ Evaluation failed - accuracy below threshold"
            exit 1
          fi
```

### Programmatic Usage

```typescript
import { 
  EvaluationRunner, 
  MaintainerClassifier, 
  DEFAULT_CONFIGS 
} from './src/evals';

// Run single evaluation
const runner = new EvaluationRunner(DEFAULT_CONFIGS.standard);
const results = await runner.runCompleteEvaluation();

// Run benchmark comparison
const benchmarkResults = await runner.runBenchmarkComparison([
  DEFAULT_CONFIGS.standard,
  DEFAULT_CONFIGS.conservative,
  DEFAULT_CONFIGS.aggressive
]);

// Custom classification
const classifier = new MaintainerClassifier(customConfig);
const result = await classifier.evaluateSample(input, 'sample-1', 'maintainer');
```

## Performance Considerations

### Dataset Size
- Target: 1,000+ samples minimum for reliable metrics
- Balanced: Equal representation across role types
- Quality: High-confidence ground truth (>0.9 confidence score)

### Execution Time
- Target: <1000ms per sample classification
- Batch processing: 50 samples per batch to manage memory
- Parallel processing: Multiple configurations can run concurrently

### Memory Usage
- Large datasets processed in batches
- Results streamed to prevent memory exhaustion
- Configurable batch sizes for different environments

## Troubleshooting

### Common Issues

1. **"Insufficient samples" Error**
   ```bash
   # Reduce minimum sample requirement
   npm run eval:maintainer -- --samples 500
   ```

2. **"Missing environment variables" Error**
   ```bash
   # Check .env file configuration
   cat .env | grep SUPABASE
   ```

3. **"Database connection failed" Error**
   ```bash
   # Test Supabase connection
   node -e "console.log(process.env.VITE_SUPABASE_URL)"
   ```

4. **Low Accuracy Results**
   - Review feature weights in configuration
   - Check confidence threshold settings
   - Analyze error patterns in detailed report
   - Validate ground truth data quality

### Debug Mode

Enable verbose logging:

```bash
DEBUG=eval:* npm run eval:maintainer
```

## Future Enhancements

### Planned Features
- **Real-time evaluation**: Stream processing for live accuracy monitoring
- **A/B testing framework**: Compare multiple algorithm versions
- **Cross-repository validation**: Test generalization across different repo types
- **Active learning**: Human-in-the-loop validation for edge cases

### Extension Points
- **Custom feature extractors**: Add domain-specific features
- **Alternative classifiers**: Integrate ML models beyond rule-based classification
- **Multi-platform support**: Extend to GitLab, Bitbucket, other platforms
- **Advanced metrics**: ROC curves, SHAP analysis, bias detection

## Contributing

1. **Add new features**: Extend the `EvaluationConfig` interface
2. **Add new metrics**: Implement in `EvaluationMetricsCalculator`
3. **Add new classifiers**: Extend the `MaintainerClassifier` base class
4. **Add tests**: Comprehensive test coverage required for all changes

## Support

For issues and questions:
- 📧 Create an issue in the repository
- 📝 Check the troubleshooting section above
- 🔍 Review the test suite for usage examples