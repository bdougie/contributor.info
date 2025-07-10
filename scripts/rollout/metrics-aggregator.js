/**
 * Rollout Metrics Aggregator
 * 
 * Collects and aggregates performance metrics from the hybrid progressive
 * capture rollout across both Inngest and GitHub Actions processors.
 */

import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

dotenv.config();

class RolloutMetricsAggregator {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Initialize Sentry for metrics tracking
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.ENVIRONMENT || 'production',
        serverName: 'rollout-metrics-aggregator'
      });
    }
    
    this.timeWindowHours = parseInt(process.env.TIME_WINDOW_HOURS || '24');
    this.includePerformance = process.env.INCLUDE_PERFORMANCE !== 'false';
    
    console.log(`📊 Rollout Metrics Aggregator initialized`);
    console.log(`Time window: ${this.timeWindowHours} hours`);
    console.log(`Include performance: ${this.includePerformance}`);
  }

  async aggregateMetrics() {
    try {
      console.log(`🔍 Aggregating rollout metrics for last ${this.timeWindowHours} hours...`);
      
      const timeWindow = {
        start: new Date(Date.now() - this.timeWindowHours * 60 * 60 * 1000),
        end: new Date()
      };
      
      // Get current rollout configuration
      const rolloutConfig = await this.getRolloutConfiguration();
      if (!rolloutConfig) {
        throw new Error('No active rollout configuration found');
      }

      // Collect all metrics
      const metrics = {
        timeWindow,
        rolloutConfig: this.sanitizeRolloutConfig(rolloutConfig),
        jobMetrics: await this.aggregateJobMetrics(timeWindow),
        processorMetrics: await this.aggregateProcessorMetrics(timeWindow),
        repositoryMetrics: await this.aggregateRepositoryMetrics(timeWindow),
        errorAnalysis: await this.aggregateErrorAnalysis(timeWindow),
        performanceMetrics: this.includePerformance ? await this.aggregatePerformanceMetrics(timeWindow) : null,
        costAnalysis: await this.aggregateCostAnalysis(timeWindow),
        trends: await this.calculateTrends(timeWindow)
      };
      
      // Calculate derived metrics
      metrics.summary = this.calculateSummaryMetrics(metrics);
      
      // Save aggregated metrics
      await this.saveMetrics(metrics);
      
      // Send metrics to Sentry for alerting
      await this.sendMetricsToSentry(metrics);
      
      console.log(`✅ Metrics aggregation completed`);
      return metrics;
      
    } catch (error) {
      console.error('❌ Metrics aggregation failed:', error.message);
      
      Sentry.captureException(error, {
        tags: {
          component: 'rollout_metrics_aggregator',
          time_window_hours: this.timeWindowHours
        }
      });
      
      throw error;
    }
  }

  async getRolloutConfiguration() {
    const { data, error } = await this.supabase
      .from('rollout_configuration')
      .select('*')
      .eq('feature_name', 'hybrid_progressive_capture')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get rollout configuration: ${error.message}`);
    }

    return data;
  }

  sanitizeRolloutConfig(config) {
    return {
      id: config.id,
      rollout_percentage: config.rollout_percentage,
      rollout_strategy: config.rollout_strategy,
      max_error_rate: config.max_error_rate,
      auto_rollback_enabled: config.auto_rollback_enabled,
      emergency_stop: config.emergency_stop,
      target_repositories_count: config.target_repositories?.length || 0,
      excluded_repositories_count: config.excluded_repositories?.length || 0
    };
  }

  async aggregateJobMetrics(timeWindow) {
    const { data: jobs, error } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch job metrics: ${error.message}`);
    }

    const metrics = {
      total: jobs?.length || 0,
      byStatus: {},
      byProcessor: {},
      byJobType: {},
      avgProcessingTime: 0,
      processingTimes: []
    };

    for (const job of jobs || []) {
      // Count by status
      metrics.byStatus[job.status] = (metrics.byStatus[job.status] || 0) + 1;
      
      // Count by processor
      metrics.byProcessor[job.processor_type] = (metrics.byProcessor[job.processor_type] || 0) + 1;
      
      // Count by job type
      metrics.byJobType[job.job_type] = (metrics.byJobType[job.job_type] || 0) + 1;
      
      // Calculate processing time
      if (job.started_at && job.completed_at) {
        const processingTime = new Date(job.completed_at) - new Date(job.started_at);
        metrics.processingTimes.push(processingTime);
      }
    }

    // Calculate average processing time
    if (metrics.processingTimes.length > 0) {
      metrics.avgProcessingTime = metrics.processingTimes.reduce((sum, time) => sum + time, 0) / metrics.processingTimes.length;
      metrics.medianProcessingTime = this.calculateMedian(metrics.processingTimes);
      metrics.p95ProcessingTime = this.calculatePercentile(metrics.processingTimes, 95);
    }

    // Calculate success rate
    const completed = metrics.byStatus.completed || 0;
    const failed = metrics.byStatus.failed || 0;
    metrics.successRate = completed + failed > 0 ? (completed / (completed + failed)) * 100 : 0;
    metrics.errorRate = completed + failed > 0 ? (failed / (completed + failed)) * 100 : 0;

    return metrics;
  }

  async aggregateProcessorMetrics(timeWindow) {
    const { data: metrics, error } = await this.supabase
      .from('rollout_metrics')
      .select('*')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString());

    if (error) {
      throw new Error(`Failed to fetch processor metrics: ${error.message}`);
    }

    const aggregated = {
      inngest: this.createProcessorMetricsTemplate(),
      github_actions: this.createProcessorMetricsTemplate(),
      combined: this.createProcessorMetricsTemplate()
    };

    for (const metric of metrics || []) {
      const processor = aggregated[metric.processor_type];
      
      if (processor) {
        processor.totalJobs += metric.total_jobs;
        processor.successCount += metric.success_count;
        processor.errorCount += metric.error_count;
        processor.totalProcessingTime += metric.average_processing_time * metric.total_jobs;
        
        if (metric.average_processing_time > 0) {
          processor.processingTimes.push(metric.average_processing_time);
        }
      }
      
      // Add to combined metrics
      aggregated.combined.totalJobs += metric.total_jobs;
      aggregated.combined.successCount += metric.success_count;
      aggregated.combined.errorCount += metric.error_count;
      aggregated.combined.totalProcessingTime += metric.average_processing_time * metric.total_jobs;
    }

    // Calculate derived metrics for each processor
    Object.values(aggregated).forEach(processor => {
      this.calculateProcessorDerivedMetrics(processor);
    });

    return aggregated;
  }

  createProcessorMetricsTemplate() {
    return {
      totalJobs: 0,
      successCount: 0,
      errorCount: 0,
      totalProcessingTime: 0,
      processingTimes: [],
      successRate: 0,
      errorRate: 0,
      avgProcessingTime: 0
    };
  }

  calculateProcessorDerivedMetrics(processor) {
    if (processor.totalJobs > 0) {
      processor.successRate = (processor.successCount / processor.totalJobs) * 100;
      processor.errorRate = (processor.errorCount / processor.totalJobs) * 100;
      processor.avgProcessingTime = processor.totalProcessingTime / processor.totalJobs;
    }
  }

  async aggregateRepositoryMetrics(timeWindow) {
    // Get repository categories and their rollout participation
    const { data: categories, error: catError } = await this.supabase
      .from('repository_categories')
      .select('*');

    if (catError) {
      throw new Error(`Failed to fetch repository categories: ${catError.message}`);
    }

    // Get job distribution by repository
    const { data: jobsByRepo, error: jobError } = await this.supabase
      .from('progressive_capture_jobs')
      .select('repository_id, processor_type, status')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString());

    if (jobError) {
      throw new Error(`Failed to fetch jobs by repository: ${jobError.message}`);
    }

    const metrics = {
      totalRepositories: categories?.length || 0,
      categorizedRepositories: 0,
      categoryDistribution: {},
      activeRepositories: new Set(),
      repositoryJobDistribution: {},
      testRepositories: 0
    };

    // Analyze repository categories
    for (const repo of categories || []) {
      metrics.categorizedRepositories++;
      metrics.categoryDistribution[repo.category] = (metrics.categoryDistribution[repo.category] || 0) + 1;
      
      if (repo.is_test_repository) {
        metrics.testRepositories++;
      }
    }

    // Analyze job distribution
    for (const job of jobsByRepo || []) {
      metrics.activeRepositories.add(job.repository_id);
      
      if (!metrics.repositoryJobDistribution[job.repository_id]) {
        metrics.repositoryJobDistribution[job.repository_id] = {
          inngest: 0,
          github_actions: 0,
          total: 0
        };
      }
      
      metrics.repositoryJobDistribution[job.repository_id][job.processor_type]++;
      metrics.repositoryJobDistribution[job.repository_id].total++;
    }

    metrics.activeRepositoriesCount = metrics.activeRepositories.size;
    metrics.repositoryParticipationRate = metrics.totalRepositories > 0 
      ? (metrics.activeRepositoriesCount / metrics.totalRepositories) * 100 
      : 0;

    return metrics;
  }

  async aggregateErrorAnalysis(timeWindow) {
    // Get recent errors from jobs
    const { data: failedJobs, error: jobError } = await this.supabase
      .from('progressive_capture_jobs')
      .select('processor_type, error, metadata, created_at')
      .eq('status', 'failed')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString());

    if (jobError) {
      throw new Error(`Failed to fetch failed jobs: ${jobError.message}`);
    }

    // Get error metrics
    const { data: errorMetrics, error: metricError } = await this.supabase
      .from('rollout_metrics')
      .select('processor_type, last_error_message, error_count, last_error_at')
      .gt('error_count', 0)
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString());

    if (metricError) {
      throw new Error(`Failed to fetch error metrics: ${metricError.message}`);
    }

    const analysis = {
      totalErrors: failedJobs?.length || 0,
      errorsByProcessor: {},
      errorPatterns: {},
      recentErrors: [],
      errorTrends: []
    };

    // Analyze failed jobs
    for (const job of failedJobs || []) {
      analysis.errorsByProcessor[job.processor_type] = (analysis.errorsByProcessor[job.processor_type] || 0) + 1;
      
      if (job.error) {
        // Categorize error patterns
        const errorCategory = this.categorizeError(job.error);
        analysis.errorPatterns[errorCategory] = (analysis.errorPatterns[errorCategory] || 0) + 1;
        
        analysis.recentErrors.push({
          processor: job.processor_type,
          error: job.error,
          category: errorCategory,
          timestamp: job.created_at
        });
      }
    }

    // Analyze error metrics
    for (const metric of errorMetrics || []) {
      if (metric.last_error_message) {
        const errorCategory = this.categorizeError(metric.last_error_message);
        analysis.errorPatterns[errorCategory] = (analysis.errorPatterns[errorCategory] || 0) + metric.error_count;
      }
    }

    // Sort recent errors by timestamp
    analysis.recentErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    analysis.recentErrors = analysis.recentErrors.slice(0, 50); // Keep last 50 errors

    return analysis;
  }

  categorizeError(errorMessage) {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('rate limit') || message.includes('403') || message.includes('quota')) {
      return 'rate_limit';
    } else if (message.includes('timeout') || message.includes('network') || message.includes('connection')) {
      return 'network';
    } else if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return 'authentication';
    } else if (message.includes('not found') || message.includes('404')) {
      return 'not_found';
    } else if (message.includes('schema') || message.includes('column') || message.includes('constraint')) {
      return 'database';
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    } else {
      return 'unknown';
    }
  }

  async aggregatePerformanceMetrics(timeWindow) {
    // Get performance data from successful jobs
    const { data: completedJobs, error } = await this.supabase
      .from('progressive_capture_jobs')
      .select('processor_type, started_at, completed_at, time_range_days, metadata')
      .eq('status', 'completed')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString())
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch performance metrics: ${error.message}`);
    }

    const performance = {
      throughput: {
        inngest: { jobsPerHour: 0, itemsPerHour: 0 },
        github_actions: { jobsPerHour: 0, itemsPerHour: 0 }
      },
      latency: {
        inngest: { avgMs: 0, p95Ms: 0, times: [] },
        github_actions: { avgMs: 0, p95Ms: 0, times: [] }
      },
      efficiency: {
        inngest: { itemsPerJob: 0, successRate: 0 },
        github_actions: { itemsPerJob: 0, successRate: 0 }
      }
    };

    const processingTimes = {
      inngest: [],
      github_actions: []
    };

    for (const job of completedJobs || []) {
      const processingTime = new Date(job.completed_at) - new Date(job.started_at);
      processingTimes[job.processor_type].push(processingTime);
      
      // Extract items processed from metadata if available
      const itemsProcessed = job.metadata?.itemsProcessed || job.metadata?.max_items || 1;
      performance.efficiency[job.processor_type].itemsPerJob += itemsProcessed;
    }

    // Calculate metrics for each processor
    Object.keys(processingTimes).forEach(processor => {
      const times = processingTimes[processor];
      const jobCount = times.length;
      
      if (jobCount > 0) {
        // Latency metrics
        performance.latency[processor].avgMs = times.reduce((sum, time) => sum + time, 0) / jobCount;
        performance.latency[processor].p95Ms = this.calculatePercentile(times, 95);
        performance.latency[processor].times = times;
        
        // Throughput metrics
        const totalHours = this.timeWindowHours;
        performance.throughput[processor].jobsPerHour = jobCount / totalHours;
        
        // Efficiency metrics
        performance.efficiency[processor].itemsPerJob /= jobCount;
        performance.efficiency[processor].successRate = 100; // These are completed jobs
      }
    });

    return performance;
  }

  async aggregateCostAnalysis(timeWindow) {
    // Estimate costs based on processor usage and processing times
    const jobMetrics = await this.getJobMetricsForCostAnalysis(timeWindow);
    
    const costAnalysis = {
      inngest: {
        jobCount: jobMetrics.inngest.total,
        estimatedCost: 0,
        avgCostPerJob: 0
      },
      github_actions: {
        jobCount: jobMetrics.github_actions.total,
        estimatedCost: 0,
        avgCostPerJob: 0,
        minutesUsed: 0
      },
      savings: {
        vsInngestOnly: 0,
        percentage: 0,
        breakdown: {}
      }
    };

    // Inngest cost estimation (based on function invocations)
    costAnalysis.inngest.estimatedCost = jobMetrics.inngest.total * 0.0002; // $0.0002 per invocation
    costAnalysis.inngest.avgCostPerJob = costAnalysis.inngest.estimatedCost / Math.max(jobMetrics.inngest.total, 1);

    // GitHub Actions cost estimation (based on compute minutes)
    costAnalysis.github_actions.minutesUsed = jobMetrics.github_actions.totalProcessingMinutes || 0;
    costAnalysis.github_actions.estimatedCost = costAnalysis.github_actions.minutesUsed * 0.008; // $0.008 per minute
    costAnalysis.github_actions.avgCostPerJob = costAnalysis.github_actions.estimatedCost / Math.max(jobMetrics.github_actions.total, 1);

    // Calculate savings vs Inngest-only approach
    const totalJobs = jobMetrics.inngest.total + jobMetrics.github_actions.total;
    const hybridCost = costAnalysis.inngest.estimatedCost + costAnalysis.github_actions.estimatedCost;
    const inngestOnlyCost = totalJobs * 0.0002;
    
    costAnalysis.savings.vsInngestOnly = inngestOnlyCost - hybridCost;
    costAnalysis.savings.percentage = inngestOnlyCost > 0 ? (costAnalysis.savings.vsInngestOnly / inngestOnlyCost) * 100 : 0;

    return costAnalysis;
  }

  async getJobMetricsForCostAnalysis(timeWindow) {
    const { data: jobs, error } = await this.supabase
      .from('progressive_capture_jobs')
      .select('processor_type, started_at, completed_at')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString());

    if (error) {
      throw new Error(`Failed to fetch jobs for cost analysis: ${error.message}`);
    }

    const metrics = {
      inngest: { total: 0 },
      github_actions: { total: 0, totalProcessingMinutes: 0 }
    };

    for (const job of jobs || []) {
      metrics[job.processor_type].total++;
      
      if (job.processor_type === 'github_actions' && job.started_at && job.completed_at) {
        const processingMinutes = (new Date(job.completed_at) - new Date(job.started_at)) / (1000 * 60);
        metrics.github_actions.totalProcessingMinutes += processingMinutes;
      }
    }

    return metrics;
  }

  async calculateTrends(timeWindow) {
    // Calculate trends by comparing current window with previous window
    const previousWindow = {
      start: new Date(timeWindow.start.getTime() - this.timeWindowHours * 60 * 60 * 1000),
      end: timeWindow.start
    };

    const currentMetrics = await this.getBasicMetricsForPeriod(timeWindow);
    const previousMetrics = await this.getBasicMetricsForPeriod(previousWindow);

    const trends = {
      jobVolume: this.calculateTrend(previousMetrics.totalJobs, currentMetrics.totalJobs),
      errorRate: this.calculateTrend(previousMetrics.errorRate, currentMetrics.errorRate),
      processingTime: this.calculateTrend(previousMetrics.avgProcessingTime, currentMetrics.avgProcessingTime),
      inngestUsage: this.calculateTrend(previousMetrics.inngestJobs, currentMetrics.inngestJobs),
      actionsUsage: this.calculateTrend(previousMetrics.actionsJobs, currentMetrics.actionsJobs)
    };

    return trends;
  }

  async getBasicMetricsForPeriod(timeWindow) {
    const { data: jobs, error } = await this.supabase
      .from('progressive_capture_jobs')
      .select('processor_type, status, started_at, completed_at')
      .gte('created_at', timeWindow.start.toISOString())
      .lte('created_at', timeWindow.end.toISOString());

    if (error) {
      return { totalJobs: 0, errorRate: 0, avgProcessingTime: 0, inngestJobs: 0, actionsJobs: 0 };
    }

    const metrics = {
      totalJobs: jobs?.length || 0,
      inngestJobs: 0,
      actionsJobs: 0,
      failed: 0,
      processingTimes: []
    };

    for (const job of jobs || []) {
      if (job.processor_type === 'inngest') {
        metrics.inngestJobs++;
      } else {
        metrics.actionsJobs++;
      }
      
      if (job.status === 'failed') {
        metrics.failed++;
      }
      
      if (job.started_at && job.completed_at) {
        const processingTime = new Date(job.completed_at) - new Date(job.started_at);
        metrics.processingTimes.push(processingTime);
      }
    }

    metrics.errorRate = metrics.totalJobs > 0 ? (metrics.failed / metrics.totalJobs) * 100 : 0;
    metrics.avgProcessingTime = metrics.processingTimes.length > 0 
      ? metrics.processingTimes.reduce((sum, time) => sum + time, 0) / metrics.processingTimes.length 
      : 0;

    return metrics;
  }

  calculateTrend(previousValue, currentValue) {
    if (previousValue === 0) {
      return currentValue > 0 ? { direction: 'up', change: 100, absolute: currentValue } : { direction: 'flat', change: 0, absolute: 0 };
    }
    
    const change = ((currentValue - previousValue) / previousValue) * 100;
    const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'flat';
    
    return {
      direction,
      change: Math.abs(change),
      absolute: currentValue - previousValue,
      previous: previousValue,
      current: currentValue
    };
  }

  calculateSummaryMetrics(metrics) {
    const summary = {
      timeWindow: `${this.timeWindowHours} hours`,
      timestamp: new Date().toISOString(),
      rolloutStatus: metrics.rolloutConfig.emergency_stop ? 'emergency_stop' : 
                     metrics.rolloutConfig.rollout_percentage === 0 ? 'disabled' : 'active',
      rolloutPercentage: metrics.rolloutConfig.rollout_percentage,
      
      // High-level metrics
      totalJobs: metrics.jobMetrics.total,
      successRate: metrics.jobMetrics.successRate,
      errorRate: metrics.jobMetrics.errorRate,
      
      // Processor breakdown
      processorDistribution: {
        inngest: {
          jobs: metrics.jobMetrics.byProcessor.inngest || 0,
          percentage: metrics.jobMetrics.total > 0 ? ((metrics.jobMetrics.byProcessor.inngest || 0) / metrics.jobMetrics.total) * 100 : 0
        },
        github_actions: {
          jobs: metrics.jobMetrics.byProcessor.github_actions || 0,
          percentage: metrics.jobMetrics.total > 0 ? ((metrics.jobMetrics.byProcessor.github_actions || 0) / metrics.jobMetrics.total) * 100 : 0
        }
      },
      
      // Repository engagement
      repositoryParticipation: metrics.repositoryMetrics.repositoryParticipationRate,
      activeRepositories: metrics.repositoryMetrics.activeRepositoriesCount,
      
      // Performance
      avgProcessingTime: metrics.jobMetrics.avgProcessingTime,
      
      // Cost efficiency
      estimatedSavings: metrics.costAnalysis?.savings?.percentage || 0,
      
      // Health indicators
      healthScore: this.calculateHealthScore(metrics),
      recommendations: this.generateRecommendations(metrics)
    };

    return summary;
  }

  calculateHealthScore(metrics) {
    let score = 100;
    
    // Deduct for high error rates
    if (metrics.jobMetrics.errorRate > 10) {
      score -= 30;
    } else if (metrics.jobMetrics.errorRate > 5) {
      score -= 15;
    }
    
    // Deduct for low success rates
    if (metrics.jobMetrics.successRate < 90) {
      score -= 20;
    }
    
    // Deduct for slow processing
    if (metrics.jobMetrics.avgProcessingTime > 300000) { // 5 minutes
      score -= 10;
    }
    
    // Deduct for emergency conditions
    if (metrics.rolloutConfig.emergency_stop) {
      score -= 50;
    }
    
    return Math.max(0, score);
  }

  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.jobMetrics.errorRate > 5) {
      recommendations.push(`High error rate (${metrics.jobMetrics.errorRate.toFixed(1)}%) - consider reducing rollout percentage`);
    }
    
    if (metrics.jobMetrics.successRate < 95) {
      recommendations.push(`Low success rate (${metrics.jobMetrics.successRate.toFixed(1)}%) - investigate processor issues`);
    }
    
    if (metrics.repositoryMetrics.repositoryParticipationRate < 10) {
      recommendations.push('Low repository participation - consider increasing rollout percentage');
    }
    
    if (metrics.costAnalysis?.savings?.percentage > 50) {
      recommendations.push('Excellent cost savings - consider expanding rollout');
    }
    
    if (metrics.performanceMetrics?.latency?.inngest?.avgMs > 60000) {
      recommendations.push('Inngest processing times are high - review job complexity');
    }
    
    return recommendations;
  }

  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  calculatePercentile(numbers, percentile) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  async saveMetrics(metrics) {
    const fs = await import('fs');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `rollout-metrics-${timestamp}-${Date.now()}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(metrics, null, 2));
    console.log(`📄 Metrics saved: ${filename}`);
    
    // Also save a latest copy
    fs.writeFileSync('rollout-metrics-latest.json', JSON.stringify(metrics, null, 2));
  }

  async sendMetricsToSentry(metrics) {
    // Send key metrics to Sentry for alerting and dashboards
    Sentry.withScope(scope => {
      scope.setTag('component', 'rollout_metrics');
      scope.setTag('rollout_percentage', metrics.rolloutConfig.rollout_percentage);
      scope.setTag('time_window_hours', this.timeWindowHours);
      
      scope.setContext('rollout_metrics', {
        totalJobs: metrics.summary.totalJobs,
        successRate: metrics.summary.successRate,
        errorRate: metrics.summary.errorRate,
        healthScore: metrics.summary.healthScore,
        costSavings: metrics.summary.estimatedSavings,
        rolloutPercentage: metrics.summary.rolloutPercentage
      });
      
      // Send different message types based on health
      if (metrics.summary.healthScore < 70) {
        Sentry.captureMessage('Rollout health degraded', 'warning');
      } else if (metrics.summary.errorRate > 5) {
        Sentry.captureMessage('Rollout error rate elevated', 'warning');
      } else {
        Sentry.captureMessage('Rollout metrics collected', 'info');
      }
    });
  }
}

// Main execution
async function main() {
  const aggregator = new RolloutMetricsAggregator();
  
  try {
    const metrics = await aggregator.aggregateMetrics();
    
    console.log('\n📊 Metrics Summary:');
    console.log(`Total Jobs: ${metrics.summary.totalJobs}`);
    console.log(`Success Rate: ${metrics.summary.successRate.toFixed(1)}%`);
    console.log(`Error Rate: ${metrics.summary.errorRate.toFixed(1)}%`);
    console.log(`Health Score: ${metrics.summary.healthScore}/100`);
    console.log(`Cost Savings: ${metrics.summary.estimatedSavings.toFixed(1)}%`);
    
    if (metrics.summary.recommendations.length > 0) {
      console.log('\nRecommendations:');
      metrics.summary.recommendations.forEach(rec => console.log(`- ${rec}`));
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Metrics aggregation failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { RolloutMetricsAggregator };