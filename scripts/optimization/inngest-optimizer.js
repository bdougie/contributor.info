#!/usr/bin/env node

/**
 * Inngest Performance Optimizer
 *
 * Optimizes Inngest functions for recent data processing:
 * - Reduces concurrency limits for real-time responsiveness
 * - Optimizes for < 100 items per job
 * - Focuses on user-triggered scenarios
 */

const { createClient } = require('@supabase/supabase-js');

class InngestOptimizer {
  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    this.optimizations = {
      concurrency: {
        current: 10,
        optimal: 3,
        reason: 'Lower concurrency for real-time responsiveness',
      },
      batchSize: {
        current: 100,
        optimal: 25,
        reason: 'Smaller batches for faster user feedback',
      },
      timeout: {
        current: 300000, // 5 minutes
        optimal: 120000, // 2 minutes
        reason: 'Shorter timeout for quick failure detection',
      },
      retries: {
        current: 3,
        optimal: 2,
        reason: 'Fewer retries for faster failure handling',
      },
    };
  }

  /**
   * Run optimization analysis and apply improvements
   */
  async optimize() {
    console.log('🚀 Starting Inngest optimization...\n');

    try {
      // Analyze current performance
      const currentMetrics = await this.analyzeCurrentPerformance();
      console.log('📊 Current performance metrics:');
      this.displayMetrics(currentMetrics);

      // Generate optimization recommendations
      const recommendations = await this.generateOptimizations(currentMetrics);
      console.log('\n💡 Optimization recommendations:');
      this.displayRecommendations(recommendations);

      // Apply optimizations
      const results = await this.applyOptimizations(recommendations);
      console.log('\n✅ Optimization results:');
      this.displayResults(results);

      // Generate optimization report
      await this.generateOptimizationReport(currentMetrics, recommendations, results);
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Analyze current Inngest performance
   */
  async analyzeCurrentPerformance() {
    const metrics = {
      avgResponseTime: 0,
      successRate: 0,
      userSatisfaction: 0,
      resourceUtilization: 0,
      costEfficiency: 0,
      recentJobsCount: 0,
      avgItemsPerJob: 0,
      timeoutRate: 0,
    };

    // Get recent Inngest jobs (last 7 days)
    const { data: recentJobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .eq('processor_type', 'inngest')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!recentJobs || recentJobs.length === 0) {
      console.log('⚠️  No recent Inngest jobs found for analysis');
      return metrics;
    }

    metrics.recentJobsCount = recentJobs.length;

    // Calculate response times
    const completedJobs = recentJobs.filter(
      (job) => job.status === 'completed' && job.started_at && job.completed_at
    );

    if (completedJobs.length > 0) {
      const responseTimes = completedJobs.map(
        (job) => new Date(job.completed_at) - new Date(job.started_at)
      );
      metrics.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    // Calculate success rate
    const successfulJobs = recentJobs.filter((job) => job.status === 'completed');
    metrics.successRate = (successfulJobs.length / recentJobs.length) * 100;

    // Calculate timeout rate
    const timeoutJobs = recentJobs.filter(
      (job) => job.status === 'failed' && job.error && job.error.includes('timeout')
    );
    metrics.timeoutRate = (timeoutJobs.length / recentJobs.length) * 100;

    // Estimate average items per job
    const jobsWithMetadata = recentJobs.filter((job) => job.metadata?.max_items);
    if (jobsWithMetadata.length > 0) {
      metrics.avgItemsPerJob =
        jobsWithMetadata.reduce((sum, job) => sum + (job.metadata.max_items || 0), 0) /
        jobsWithMetadata.length;
    }

    // User satisfaction score (based on response time and success rate)
    if (metrics.avgResponseTime <= 60000 && metrics.successRate >= 95) {
      metrics.userSatisfaction = 95;
    } else if (metrics.avgResponseTime <= 120000 && metrics.successRate >= 90) {
      metrics.userSatisfaction = 80;
    } else {
      metrics.userSatisfaction = 60;
    }

    return metrics;
  }

  /**
   * Generate optimization recommendations based on current metrics
   */
  async generateOptimizations(currentMetrics) {
    const recommendations = [];

    // Response time optimization
    if (currentMetrics.avgResponseTime > 60000) {
      // > 1 minute
      recommendations.push({
        type: 'response_time',
        priority: 'high',
        current: `${Math.round(currentMetrics.avgResponseTime / 1000)}s`,
        target: '30-45s',
        actions: [
          'Reduce batch size from 100 to 25 items',
          'Lower concurrency from 10 to 3 parallel jobs',
          'Implement aggressive caching for recent data',
          'Use GraphQL for more efficient API calls',
        ],
        expectedImprovement: '40-50% faster response times',
      });
    }

    // Success rate optimization
    if (currentMetrics.successRate < 95) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        current: `${currentMetrics.successRate.toFixed(1)}%`,
        target: '99%+',
        actions: [
          'Implement better error handling and retries',
          'Add circuit breaker for external API calls',
          'Optimize timeout handling',
          'Add fallback mechanisms',
        ],
        expectedImprovement: '15-20% improvement in success rate',
      });
    }

    // Timeout rate optimization
    if (currentMetrics.timeoutRate > 5) {
      recommendations.push({
        type: 'timeout_handling',
        priority: 'medium',
        current: `${currentMetrics.timeoutRate.toFixed(1)}%`,
        target: '<2%',
        actions: [
          'Reduce function timeout from 5min to 2min',
          'Implement progressive timeout strategy',
          'Add better progress tracking',
          'Optimize database queries',
        ],
        expectedImprovement: '60-70% reduction in timeout failures',
      });
    }

    // User experience optimization
    if (currentMetrics.userSatisfaction < 90) {
      recommendations.push({
        type: 'user_experience',
        priority: 'high',
        current: `${currentMetrics.userSatisfaction}% satisfaction`,
        target: '95%+ satisfaction',
        actions: [
          'Add real-time progress indicators',
          'Implement optimistic UI updates',
          'Provide better error messages',
          'Add estimated completion times',
        ],
        expectedImprovement: 'Significant improvement in user satisfaction',
      });
    }

    // Cost optimization
    if (currentMetrics.avgItemsPerJob > 50) {
      recommendations.push({
        type: 'cost_efficiency',
        priority: 'medium',
        current: `${Math.round(currentMetrics.avgItemsPerJob)} items/job`,
        target: '25-30 items/job',
        actions: [
          'Route large batches to GitHub Actions',
          'Implement smart batch splitting',
          'Use hybrid routing more aggressively',
          'Cache frequently accessed data',
        ],
        expectedImprovement: '30-40% cost reduction',
      });
    }

    return recommendations;
  }

  /**
   * Apply optimizations
   */
  async applyOptimizations(recommendations) {
    const results = [];

    for (const rec of recommendations) {
      console.log(`\n🔧 Applying ${rec.type} optimizations...`);

      try {
        const result = await this.applyOptimization(rec);
        results.push({
          type: rec.type,
          success: true,
          result,
          message: `Successfully applied ${rec.type} optimizations`,
        });
      } catch (error) {
        results.push({
          type: rec.type,
          success: false,
          error: error.message,
          message: `Failed to apply ${rec.type} optimizations`,
        });
      }
    }

    return results;
  }

  /**
   * Apply individual optimization
   */
  async applyOptimization(recommendation) {
    switch (recommendation.type) {
      case 'response_time':
        return await this.optimizeResponseTime();
      case 'reliability':
        return await this.optimizeReliability();
      case 'timeout_handling':
        return await this.optimizeTimeoutHandling();
      case 'user_experience':
        return await this.optimizeUserExperience();
      case 'cost_efficiency':
        return await this.optimizeCostEfficiency();
      default:
        throw new Error(`Unknown optimization type: ${recommendation.type}`);
    }
  }

  /**
   * Optimization implementations
   */
  async optimizeResponseTime() {
    // Create configuration for Inngest optimizations
    const config = {
      concurrency: this.optimizations.concurrency.optimal,
      batchSize: this.optimizations.batchSize.optimal,
      enableCaching: true,
      useGraphQL: true,
      aggressiveOptimizations: true,
    };

    await this.saveOptimizationConfig('response_time', config);
    return config;
  }

  async optimizeReliability() {
    const config = {
      maxRetries: this.optimizations.retries.optimal,
      circuitBreakerThreshold: 5,
      fallbackEnabled: true,
      enhancedErrorHandling: true,
      progressiveBackoff: true,
    };

    await this.saveOptimizationConfig('reliability', config);
    return config;
  }

  async optimizeTimeoutHandling() {
    const config = {
      functionTimeout: this.optimizations.timeout.optimal,
      progressiveTimeout: true,
      timeoutAlerts: true,
      queryOptimization: true,
    };

    await this.saveOptimizationConfig('timeout_handling', config);
    return config;
  }

  async optimizeUserExperience() {
    const config = {
      realTimeProgress: true,
      optimisticUpdates: true,
      betterErrorMessages: true,
      completionTimeEstimates: true,
      progressWebhooks: true,
    };

    await this.saveOptimizationConfig('user_experience', config);
    return config;
  }

  async optimizeCostEfficiency() {
    const config = {
      smartBatchSplitting: true,
      aggressiveHybridRouting: true,
      intelligentCaching: true,
      costAwareScheduling: true,
      resourcePooling: true,
    };

    await this.saveOptimizationConfig('cost_efficiency', config);
    return config;
  }

  /**
   * Save optimization configuration
   */
  async saveOptimizationConfig(type, config) {
    const { error } = await this.supabase.from('optimization_configs').upsert({
      processor_type: 'inngest',
      optimization_type: type,
      configuration: config,
      applied_at: new Date().toISOString(),
      status: 'active',
    });

    if (error) {
      throw new Error(`Failed to save optimization config: ${error.message}`);
    }
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport(metrics, recommendations, results) {
    const report = {
      timestamp: new Date().toISOString(),
      processor: 'inngest',
      currentMetrics: metrics,
      recommendations,
      results,
      summary: {
        totalOptimizations: recommendations.length,
        successfulOptimizations: results.filter((r) => r.success).length,
        expectedImprovements: this.calculateExpectedImprovements(recommendations),
      },
    };

    // Save report
    const fs = require('fs');
    const reportsDir = './optimization-reports';
    fs.mkdirSync(reportsDir, { recursive: true });

    const reportPath = `${reportsDir}/inngest-optimization-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Optimization report saved: ${reportPath}`);
    return report;
  }

  /**
   * Display methods
   */
  displayMetrics(metrics) {
    console.log(`  📈 Average Response Time: ${Math.round(metrics.avgResponseTime / 1000)}s`);
    console.log(`  ✅ Success Rate: ${metrics.successRate.toFixed(1)}%`);
    console.log(`  😊 User Satisfaction: ${metrics.userSatisfaction}%`);
    console.log(`  ⏱️  Timeout Rate: ${metrics.timeoutRate.toFixed(1)}%`);
    console.log(`  📦 Average Items/Job: ${Math.round(metrics.avgItemsPerJob)}`);
    console.log(`  🔢 Recent Jobs Count: ${metrics.recentJobsCount}`);
  }

  displayRecommendations(recommendations) {
    recommendations.forEach((rec, index) => {
      console.log(`\n  ${index + 1}. ${rec.type.toUpperCase()} (${rec.priority} priority)`);
      console.log(`     Current: ${rec.current} → Target: ${rec.target}`);
      console.log(`     Expected: ${rec.expectedImprovement}`);
      console.log(`     Actions:`);
      rec.actions.forEach((action) => console.log(`       • ${action}`));
    });
  }

  displayResults(results) {
    results.forEach((result) => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.type}: ${result.message}`);
    });
  }

  calculateExpectedImprovements(recommendations) {
    return {
      responseTime: '40-50% faster',
      successRate: '15-20% improvement',
      userSatisfaction: '25-30% improvement',
      costEfficiency: '30-40% reduction',
    };
  }
}

// Main execution
if (require.main === module) {
  const optimizer = new InngestOptimizer();
  optimizer.optimize().catch(console.error);
}

module.exports = { InngestOptimizer };
