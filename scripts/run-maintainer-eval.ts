#!/usr/bin/env tsx
/**
 * Maintainer Classification Evaluation Script
 * Standalone script to run evaluations with custom configurations
 */

import dotenv from 'dotenv';
import { runEvaluation, runBenchmark, DEFAULT_CONFIGS } from '../src/evals';

// Load environment variables
dotenv.config();

interface CLIOptions {
  config?: keyof typeof DEFAULT_CONFIGS;
  benchmark?: boolean;
  help?: boolean;
  export?: string;
  samples?: number;
  minAccuracy?: number;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--config':
      case '-c':
        options.config = args[++i] as keyof typeof DEFAULT_CONFIGS;
        break;
      case '--benchmark':
      case '-b':
        options.benchmark = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--export':
      case '-e':
        options.export = args[++i];
        break;
      case '--samples':
      case '-s':
        options.samples = parseInt(args[++i]);
        break;
      case '--min-accuracy':
      case '-a':
        options.minAccuracy = parseFloat(args[++i]);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
🔍 Maintainer Classification Evaluation Tool

Usage: npm run eval:maintainer [options]

Options:
  -c, --config <name>        Use specific configuration (standard|conservative|aggressive)
  -b, --benchmark           Run benchmark across all configurations
  -e, --export <dir>        Export results to custom directory
  -s, --samples <num>       Minimum number of samples required
  -a, --min-accuracy <num>  Minimum accuracy threshold (0.0-1.0)
  -h, --help               Show this help message

Examples:
  npm run eval:maintainer                    # Run with standard config
  npm run eval:maintainer -c conservative   # Run with conservative config
  npm run eval:maintainer -b                # Run benchmark comparison
  npm run eval:maintainer -c standard -e ./custom-results

Available Configurations:
${Object.entries(DEFAULT_CONFIGS).map(([name, config]) => 
  `  ${name.padEnd(12)} - ${config.description}`
).join('\n')}
  `);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  console.log('🚀 Starting Maintainer Classification Evaluation');
  console.log('=' .repeat(60));

  // Validate environment
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_TOKEN) {
    console.error('❌ Missing required environment variables:');
    console.error('   VITE_SUPABASE_URL and SUPABASE_TOKEN must be set');
    process.exit(1);
  }

  try {
    if (options.benchmark) {
      console.log('🏁 Running benchmark comparison...\n');
      const results = await runBenchmark();
      
      console.log('\n📊 Benchmark Summary:');
      console.log('=' .repeat(50));
      results.forEach((result, index) => {
        const accuracy = (result.metrics.overall_accuracy * 100).toFixed(2);
        const precision = Object.values(result.metrics.per_class_metrics)
          .reduce((sum, metric) => sum + metric.precision, 0) / 3;
        const recall = Object.values(result.metrics.per_class_metrics)
          .reduce((sum, metric) => sum + metric.recall, 0) / 3;
        
        console.log(`${index + 1}. ${result.config.name}`);
        console.log(`   Accuracy: ${accuracy}%`);
        console.log(`   Avg Precision: ${(precision * 100).toFixed(2)}%`);
        console.log(`   Avg Recall: ${(recall * 100).toFixed(2)}%`);
        console.log(`   Execution Time: ${result.metrics.execution_stats.average_execution_time_ms.toFixed(2)}ms`);
        console.log('');
      });
      
    } else {
      const configName = options.config || 'standard';
      console.log(`🔧 Using configuration: ${configName}`);
      
      if (!DEFAULT_CONFIGS[configName]) {
        console.error(`❌ Unknown configuration: ${configName}`);
        console.error('Available configurations:', Object.keys(DEFAULT_CONFIGS).join(', '));
        process.exit(1);
      }

      // Customize config if options provided
      const config = { ...DEFAULT_CONFIGS[configName] };
      if (options.samples) {
        config.evaluation_criteria.min_samples = options.samples;
      }
      if (options.minAccuracy) {
        config.evaluation_criteria.min_accuracy = options.minAccuracy;
      }

      console.log(`📝 Configuration details:`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Owner threshold: ${config.confidence_thresholds.owner}`);
      console.log(`   Maintainer threshold: ${config.confidence_thresholds.maintainer}`);
      console.log(`   Min accuracy: ${(config.evaluation_criteria.min_accuracy * 100)}%`);
      console.log(`   Min samples: ${config.evaluation_criteria.min_samples}`);
      console.log('');

      const results = await runEvaluation(configName);
      
      console.log('\n🎯 Evaluation Results:');
      console.log('=' .repeat(40));
      console.log(`Overall Accuracy: ${(results.metrics.overall_accuracy * 100).toFixed(2)}%`);
      console.log(`Total Samples: ${results.metrics.execution_stats.total_samples}`);
      console.log(`Successful Predictions: ${results.metrics.execution_stats.successful_predictions}`);
      console.log(`Average Execution Time: ${results.metrics.execution_stats.average_execution_time_ms.toFixed(2)}ms`);
      
      console.log('\n📈 Per-Class Performance:');
      Object.entries(results.metrics.per_class_metrics).forEach(([role, metrics]) => {
        console.log(`${role.charAt(0).toUpperCase() + role.slice(1)}:`);
        console.log(`  Precision: ${(metrics.precision * 100).toFixed(2)}%`);
        console.log(`  Recall: ${(metrics.recall * 100).toFixed(2)}%`);
        console.log(`  F1-Score: ${(metrics.f1_score * 100).toFixed(2)}%`);
        console.log(`  Support: ${metrics.support} samples`);
      });

      console.log('\n🎯 Confidence Calibration:');
      console.log(`Expected Accuracy: ${(results.metrics.confidence_calibration.expected_accuracy * 100).toFixed(2)}%`);
      console.log(`Actual Accuracy: ${(results.metrics.confidence_calibration.actual_accuracy * 100).toFixed(2)}%`);
      console.log(`Calibration Error: ${(results.metrics.confidence_calibration.calibration_error * 100).toFixed(2)}%`);

      // Quality check
      const passedCriteria = results.metrics.overall_accuracy >= config.evaluation_criteria.min_accuracy;
      console.log(`\n${passedCriteria ? '✅' : '❌'} Quality Check: ${passedCriteria ? 'PASSED' : 'FAILED'}`);
      
      if (!passedCriteria) {
        console.log(`   Required accuracy: ${(config.evaluation_criteria.min_accuracy * 100)}%`);
        console.log(`   Achieved accuracy: ${(results.metrics.overall_accuracy * 100).toFixed(2)}%`);
      }
    }

    console.log('\n🎉 Evaluation completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Evaluation failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}