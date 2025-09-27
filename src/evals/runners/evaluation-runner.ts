/**
 * Evaluation Runner
 * Orchestrates the complete evaluation process
 */

import { GroundTruthExtractor } from '../datasets/ground-truth-extractor';
import { MaintainerClassifier } from './maintainer-classifier';
import { EvaluationMetricsCalculator } from '../metrics/evaluation-metrics';
import type {
  EvaluationSample,
  EvaluationResult,
  EvaluationConfig,
  EvaluationMetrics,
  DatasetStats,
} from '../types';

export class EvaluationRunner {
  private extractor: GroundTruthExtractor;
  private classifier: MaintainerClassifier;
  private metricsCalculator: EvaluationMetricsCalculator;
  private config: EvaluationConfig;

  constructor(config: EvaluationConfig) {
    this.config = config;
    this.extractor = new GroundTruthExtractor();
    this.classifier = new MaintainerClassifier(config);
    this.metricsCalculator = new EvaluationMetricsCalculator();
  }

  async runCompleteEvaluation(): Promise<{
    metrics: EvaluationMetrics;
    results: EvaluationResult[];
    datasetStats: DatasetStats;
    report: string;
  }> {
    console.log('Starting evaluation: %s', this.config.name);
    console.log('Description: %s', this.config.description);

    // Step 1: Extract ground truth dataset
    console.log('\n1. Extracting ground truth dataset...');
    const samples = await this.extractor.extractGroundTruthDataset();

    if (samples.length < this.config.evaluation_criteria.min_samples) {
      throw new Error(
        `Insufficient samples: ${samples.length} < ${this.config.evaluation_criteria.min_samples}`
      );
    }

    // Step 2: Generate dataset statistics
    console.log('\n2. Analyzing dataset statistics...');
    const datasetStats = await this.extractor.generateDatasetStats(samples);
    this.logDatasetStats(datasetStats);

    // Step 3: Run evaluation on all samples
    console.log('\n3. Running classification evaluation...');
    const results = await this.evaluateAllSamples(samples);

    // Step 4: Calculate comprehensive metrics
    console.log('\n4. Calculating evaluation metrics...');
    const metrics = this.metricsCalculator.calculateMetrics(results);

    // Step 5: Generate detailed report
    console.log('\n5. Generating evaluation report...');
    const report = this.metricsCalculator.generateDetailedReport(metrics);

    // Step 6: Validate results against criteria
    this.validateResults(metrics);

    console.log('\n✅ Evaluation completed successfully!');

    return {
      metrics,
      results,
      datasetStats,
      report,
    };
  }

  async evaluateAllSamples(samples: EvaluationSample[]): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    const batchSize = 50; // Process in batches to avoid memory issues

    for (let i = 0; i < samples.length; i += batchSize) {
      const batch = samples.slice(i, i + batchSize);
      console.log(
        'Processing batch %s/%s',
        Math.floor(i / batchSize) + 1,
        Math.ceil(samples.length / batchSize)
      );

      const batchResults = await Promise.all(
        batch.map(async (sample, index) => {
          const sampleId = `sample_${i + index}`;
          return this.classifier.evaluateSample(sample.input, sampleId, sample.ideal);
        })
      );

      results.push(...batchResults);

      // Progress indicator
      const progress = (((i + batch.length) / samples.length) * 100).toFixed(1);
      console.log('Progress: %s% (%s/%s)', progress, i + batch.length, samples.length);
    }

    return results;
  }

  private logDatasetStats(stats: DatasetStats): void {
    console.log('📊 Dataset Statistics:');
    console.log('  Total samples: %s', stats.total_samples);
    console.log('  Class distribution:');
    console.log(
      '    - Maintainer: %s (%s%)',
      stats.class_distribution.maintainer,
      ((stats.class_distribution.maintainer / stats.total_samples) * 100).toFixed(1)
    );
    console.log(
      '    - Contributor: %s (%s%)',
      stats.class_distribution.contributor,
      ((stats.class_distribution.contributor / stats.total_samples) * 100).toFixed(1)
    );
    console.log('  Quality metrics:');
    console.log('    - Verified samples: %s', stats.quality_metrics.verified_samples);
    console.log('    - High confidence: %s', stats.quality_metrics.high_confidence_samples);
    console.log('    - Edge cases: %s', stats.quality_metrics.edge_cases);
  }

  private validateResults(metrics: EvaluationMetrics): void {
    const criteria = this.config.evaluation_criteria;
    const issues: string[] = [];

    // Check minimum accuracy
    if (metrics.overall_accuracy < criteria.min_accuracy) {
      issues.push(
        `Accuracy ${(metrics.overall_accuracy * 100).toFixed(2)}% below minimum ${criteria.min_accuracy * 100}%`
      );
    }

    // Check execution time
    if (metrics.execution_stats.average_execution_time_ms > criteria.max_execution_time_ms) {
      issues.push(
        `Average execution time ${metrics.execution_stats.average_execution_time_ms}ms exceeds maximum ${criteria.max_execution_time_ms}ms`
      );
    }

    // Check for significant class imbalances in results
    const failureRate =
      metrics.execution_stats.failed_predictions / metrics.execution_stats.total_samples;
    if (failureRate > 0.05) {
      // More than 5% failures
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
    }

    if (issues.length > 0) {
      console.warn('\n⚠️  Evaluation issues detected:');
      issues.forEach((issue) => console.warn('  - %s', issue));
    } else {
      console.log('\n✅ All evaluation criteria passed!');
    }
  }

  async exportResults(
    results: EvaluationResult[],
    metrics: EvaluationMetrics,
    outputDir: string
  ): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Export results as JSON
    const resultsPath = path.join(outputDir, `eval-results-${timestamp}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    // Export metrics as JSON
    const metricsPath = path.join(outputDir, `eval-metrics-${timestamp}.json`);
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

    // Export detailed report as markdown
    const reportPath = path.join(outputDir, `eval-report-${timestamp}.md`);
    const report = this.metricsCalculator.generateDetailedReport(metrics);
    fs.writeFileSync(reportPath, report);

    console.log('\n📁 Results exported to:');
    console.log('  - Results: %s', resultsPath);
    console.log('  - Metrics: %s', metricsPath);
    console.log('  - Report: %s', reportPath);
  }

  async runBenchmarkComparison(
    configs: EvaluationConfig[]
  ): Promise<{ config: EvaluationConfig; metrics: EvaluationMetrics }[]> {
    console.log('\n🏃 Running benchmark comparison with %s configurations...', configs.length);

    const results = [];

    for (const config of configs) {
      console.log('\nEvaluating configuration: %s', config.name);
      this.config = config;
      this.classifier = new MaintainerClassifier(config);

      try {
        const evaluation = await this.runCompleteEvaluation();
        results.push({ config, metrics: evaluation.metrics });

        console.log(
          '✅ %s: %s% accuracy',
          config.name,
          (evaluation.metrics.overall_accuracy * 100).toFixed(2)
        );
      } catch (error) {
        console.error(
          '❌ %s failed: %s',
          config.name,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Sort by accuracy
    results.sort((a, b) => b.metrics.overall_accuracy - a.metrics.overall_accuracy);

    console.log('\n🏆 Benchmark Results (by accuracy):');
    results.forEach((result, index) => {
      console.log(
        '%s. %s: %s%',
        index + 1,
        result.config.name,
        (result.metrics.overall_accuracy * 100).toFixed(2)
      );
    });

    return results;
  }

  updateConfig(newConfig: Partial<EvaluationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.classifier.updateConfig(this.config);
  }
}
