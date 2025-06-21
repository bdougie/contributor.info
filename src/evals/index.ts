/**
 * Main Evaluation Entry Point
 * Provides CLI interface and default configurations for maintainer classification evaluation
 */

import { EvaluationRunner } from './runners/evaluation-runner';
import type { EvaluationConfig } from './types';

// Default evaluation configurations
export const DEFAULT_CONFIGS: Record<string, EvaluationConfig> = {
  standard: {
    name: 'standard-maintainer-classification',
    description: 'Standard maintainer classification evaluation with balanced thresholds',
    dataset_path: 'evals/datasets/maintainer_ground_truth.jsonl',
    confidence_thresholds: {
      maintainer: 0.8
    },
    evaluation_criteria: {
      min_accuracy: 0.85,
      min_samples: 1000,
      max_execution_time_ms: 1000
    },
    feature_weights: {
      merge_events: 0.25,
      push_events: 0.2,
      admin_actions: 0.3,
      temporal_activity: 0.25
    }
  },
  
  conservative: {
    name: 'conservative-maintainer-classification',
    description: 'Conservative classification with higher thresholds for precision',
    dataset_path: 'evals/datasets/maintainer_ground_truth.jsonl',
    confidence_thresholds: {
      maintainer: 0.9
    },
    evaluation_criteria: {
      min_accuracy: 0.8,
      min_samples: 1000,
      max_execution_time_ms: 1000
    },
    feature_weights: {
      merge_events: 0.3,
      push_events: 0.15,
      admin_actions: 0.4,
      temporal_activity: 0.15
    }
  },
  
  aggressive: {
    name: 'aggressive-maintainer-classification',
    description: 'Aggressive classification with lower thresholds for recall',
    dataset_path: 'evals/datasets/maintainer_ground_truth.jsonl',
    confidence_thresholds: {
      maintainer: 0.7
    },
    evaluation_criteria: {
      min_accuracy: 0.75,
      min_samples: 1000,
      max_execution_time_ms: 1000
    },
    feature_weights: {
      merge_events: 0.2,
      push_events: 0.25,
      admin_actions: 0.25,
      temporal_activity: 0.3
    }
  }
};

export async function runEvaluation(configName: keyof typeof DEFAULT_CONFIGS = 'standard') {
  const config = DEFAULT_CONFIGS[configName];
  if (!config) {
    throw new Error(`Unknown configuration: ${configName}`);
  }

  const runner = new EvaluationRunner(config);
  
  try {
    const results = await runner.runCompleteEvaluation();
    
    // Export results
    await runner.exportResults(
      results.results,
      results.metrics,
      `./eval-outputs/${configName}`
    );
    
    return results;
  } catch (error) {
    console.error(`Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

export async function runBenchmark() {
  const configs = Object.values(DEFAULT_CONFIGS);
  const runner = new EvaluationRunner(configs[0]); // Use first config as base
  
  return runner.runBenchmarkComparison(configs);
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const configName = (args[1] as keyof typeof DEFAULT_CONFIGS) || 'standard';

  console.log('🚀 Maintainer Classification Evaluation Suite');
  console.log('=' .repeat(50));

  try {
    switch (command) {
      case 'run':
        console.log(`Running evaluation with config: ${configName}`);
        await runEvaluation(configName);
        break;
        
      case 'benchmark':
        console.log('Running benchmark across all configurations');
        await runBenchmark();
        break;
        
      case 'list':
        console.log('Available configurations:');
        Object.entries(DEFAULT_CONFIGS).forEach(([name, config]) => {
          console.log(`  ${name}: ${config.description}`);
        });
        break;
        
      default:
        console.log('Usage:');
        console.log('  npm run eval              # Run standard evaluation');
        console.log('  npm run eval run conservative  # Run with conservative config');
        console.log('  npm run eval benchmark    # Run benchmark comparison');
        console.log('  npm run eval list         # List available configurations');
        break;
    }
  } catch (error) {
    console.error('❌ Evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Export everything for programmatic use
export * from './types';
export { EvaluationRunner } from './runners/evaluation-runner';
export { MaintainerClassifier } from './runners/maintainer-classifier';
export { GroundTruthExtractor } from './datasets/ground-truth-extractor';
export { EvaluationMetricsCalculator } from './metrics/evaluation-metrics';

// Run CLI if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  main().catch(console.error);
}