/**
 * Evaluation Metrics Calculator
 * Implements comprehensive metrics for maintainer classification evaluation
 */

import type { EvaluationResult, EvaluationMetrics } from '../types';

export class EvaluationMetricsCalculator {
  private readonly roleLabels: ('maintainer' | 'contributor')[] = ['maintainer', 'contributor'];

  calculateMetrics(results: EvaluationResult[]): EvaluationMetrics {
    const validResults = results.filter(r => !r.error);
    
    return {
      overall_accuracy: this.calculateOverallAccuracy(validResults),
      per_class_metrics: this.calculatePerClassMetrics(validResults),
      confusion_matrix: this.calculateConfusionMatrix(validResults),
      confidence_calibration: this.calculateConfidenceCalibration(validResults),
      execution_stats: this.calculateExecutionStats(results)
    };
  }

  private calculateOverallAccuracy(results: EvaluationResult[]): number {
    if (results.length === 0) return 0;
    
    const correct = results.filter(r => r.correct).length;
    return correct / results.length;
  }

  private calculatePerClassMetrics(results: EvaluationResult[]) {
    const metrics: EvaluationMetrics['per_class_metrics'] = {
      maintainer: { precision: 0, recall: 0, f1_score: 0, support: 0 },
      contributor: { precision: 0, recall: 0, f1_score: 0, support: 0 }
    };

    this.roleLabels.forEach(role => {
      const truePositives = results.filter(r => r.prediction === role && r.expected === role).length;
      const falsePositives = results.filter(r => r.prediction === role && r.expected !== role).length;
      const falseNegatives = results.filter(r => r.prediction !== role && r.expected === role).length;
      const support = results.filter(r => r.expected === role).length;


      const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
      const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
      const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      metrics[role] = {
        precision,
        recall,
        f1_score: f1Score,
        support
      };
    });

    return metrics;
  }

  private calculateConfusionMatrix(results: EvaluationResult[]): number[][] {
    const matrix: number[][] = Array(2).fill(null).map(() => Array(2).fill(0));
    const labelToIndex = { maintainer: 0, contributor: 1 };

    results.forEach(result => {
      const actualIndex = labelToIndex[result.expected];
      const predictedIndex = labelToIndex[result.prediction];
      matrix[actualIndex][predictedIndex]++;
    });

    return matrix;
  }

  private calculateConfidenceCalibration(results: EvaluationResult[]) {
    // Group results by confidence bins
    const bins = this.createConfidenceBins(results);
    let totalExpectedAccuracy = 0;
    let totalActualAccuracy = 0;
    let totalWeight = 0;

    bins.forEach(bin => {
      if (bin.results.length > 0) {
        const binAccuracy = bin.results.filter(r => r.correct).length / bin.results.length;
        const weight = bin.results.length;
        
        totalExpectedAccuracy += bin.avgConfidence * weight;
        totalActualAccuracy += binAccuracy * weight;
        totalWeight += weight;
      }
    });

    const expectedAccuracy = totalWeight > 0 ? totalExpectedAccuracy / totalWeight : 0;
    const actualAccuracy = totalWeight > 0 ? totalActualAccuracy / totalWeight : 0;

    return {
      expected_accuracy: expectedAccuracy,
      actual_accuracy: actualAccuracy,
      calibration_error: Math.abs(expectedAccuracy - actualAccuracy)
    };
  }

  private createConfidenceBins(results: EvaluationResult[]) {
    const numBins = 10;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      min: i / numBins,
      max: (i + 1) / numBins,
      results: [] as EvaluationResult[],
      avgConfidence: 0
    }));

    results.forEach(result => {
      const binIndex = Math.min(Math.floor(result.confidence * numBins), numBins - 1);
      bins[binIndex].results.push(result);
    });

    // Calculate average confidence for each bin
    bins.forEach(bin => {
      if (bin.results.length > 0) {
        bin.avgConfidence = bin.results.reduce((sum, r) => sum + r.confidence, 0) / bin.results.length;
      }
    });

    return bins;
  }

  private calculateExecutionStats(results: EvaluationResult[]) {
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    
    const avgExecutionTime = successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.execution_time_ms, 0) / successful.length 
      : 0;

    return {
      total_samples: results.length,
      successful_predictions: successful.length,
      failed_predictions: failed.length,
      average_execution_time_ms: avgExecutionTime
    };
  }

  generateDetailedReport(metrics: EvaluationMetrics): string {
    const report = `
# Maintainer Classification Evaluation Report

## Overall Performance
- **Accuracy**: ${(metrics.overall_accuracy * 100).toFixed(2)}%
- **Total Samples**: ${metrics.execution_stats.total_samples}
- **Successful Predictions**: ${metrics.execution_stats.successful_predictions}
- **Failed Predictions**: ${metrics.execution_stats.failed_predictions}

## Per-Class Performance

### Maintainer Classification
- **Precision**: ${(metrics.per_class_metrics.maintainer.precision * 100).toFixed(2)}%
- **Recall**: ${(metrics.per_class_metrics.maintainer.recall * 100).toFixed(2)}%
- **F1-Score**: ${(metrics.per_class_metrics.maintainer.f1_score * 100).toFixed(2)}%
- **Support**: ${metrics.per_class_metrics.maintainer.support} samples

### Contributor Classification
- **Precision**: ${(metrics.per_class_metrics.contributor.precision * 100).toFixed(2)}%
- **Recall**: ${(metrics.per_class_metrics.contributor.recall * 100).toFixed(2)}%
- **F1-Score**: ${(metrics.per_class_metrics.contributor.f1_score * 100).toFixed(2)}%
- **Support**: ${metrics.per_class_metrics.contributor.support} samples

## Confidence Calibration
- **Expected Accuracy**: ${(metrics.confidence_calibration.expected_accuracy * 100).toFixed(2)}%
- **Actual Accuracy**: ${(metrics.confidence_calibration.actual_accuracy * 100).toFixed(2)}%
- **Calibration Error**: ${(metrics.confidence_calibration.calibration_error * 100).toFixed(2)}%

## Confusion Matrix
\`\`\`
              Predicted
Actual      Main  Contrib
Maintainer  ${metrics.confusion_matrix[0][0].toString().padStart(4)}  ${metrics.confusion_matrix[0][1].toString().padStart(7)}
Contributor ${metrics.confusion_matrix[1][0].toString().padStart(4)}  ${metrics.confusion_matrix[1][1].toString().padStart(7)}
\`\`\`

## Performance Statistics
- **Average Execution Time**: ${metrics.execution_stats.average_execution_time_ms.toFixed(2)}ms per sample
- **Success Rate**: ${((metrics.execution_stats.successful_predictions / metrics.execution_stats.total_samples) * 100).toFixed(2)}%

## Recommendations
${this.generateRecommendations(metrics)}
    `.trim();

    return report;
  }

  private generateRecommendations(metrics: EvaluationMetrics): string {
    const recommendations: string[] = [];

    // Overall accuracy recommendations
    if (metrics.overall_accuracy < 0.85) {
      recommendations.push('- Overall accuracy is below 85% target. Consider adjusting confidence thresholds or improving feature engineering.');
    }

    // Per-class recommendations
    Object.entries(metrics.per_class_metrics).forEach(([role, roleMetrics]) => {
      if (roleMetrics.precision < 0.8) {
        recommendations.push(`- ${role} precision is low (${(roleMetrics.precision * 100).toFixed(1)}%). Review false positive cases.`);
      }
      if (roleMetrics.recall < 0.8) {
        recommendations.push(`- ${role} recall is low (${(roleMetrics.recall * 100).toFixed(1)}%). Review false negative cases.`);
      }
    });

    // Calibration recommendations
    if (metrics.confidence_calibration.calibration_error > 0.1) {
      recommendations.push('- High calibration error detected. Consider recalibrating confidence scores.');
    }

    // Performance recommendations
    if (metrics.execution_stats.average_execution_time_ms > 1000) {
      recommendations.push('- High execution time detected. Consider optimizing the classification algorithm.');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '- No specific recommendations. Performance meets targets.';
  }
}