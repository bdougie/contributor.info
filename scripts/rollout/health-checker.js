/**
 * Rollout Health Checker
 * 
 * Monitors the hybrid progressive capture rollout health and triggers
 * automatic rollbacks when error rates exceed thresholds.
 */

import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

dotenv.config();

class RolloutHealthChecker {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Initialize Sentry for alerts
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.ENVIRONMENT || 'production',
        serverName: 'rollout-health-checker'
      });
    }
    
    this.checkType = process.env.CHECK_TYPE || 'full';
    this.forceCheck = process.env.FORCE_CHECK === 'true';
    
    console.log(`🏥 Rollout Health Checker initialized`);
    console.log(`Check type: ${this.checkType}`);
    console.log(`Force check: ${this.forceCheck}`);
  }

  async checkRolloutHealth() {
    try {
      console.log(`🔍 Starting rollout health check...`);
      
      // Get current rollout configuration
      const rolloutConfig = await this.getRolloutConfiguration();
      if (!rolloutConfig) {
        throw new Error('No active rollout configuration found');
      }

      console.log(`📊 Current rollout: ${rolloutConfig.rollout_percentage}%`);
      
      // Skip checks if rollout is at 0% (unless forced)
      if (rolloutConfig.rollout_percentage === 0 && !this.forceCheck) {
        console.log('✅ Rollout at 0% - skipping health check');
        return { status: 'healthy', reason: 'rollout_disabled' };
      }

      // Check if emergency stop is active
      if (rolloutConfig.emergency_stop) {
        console.log('🚨 Emergency stop is active');
        return { status: 'emergency_stop', reason: 'manual_emergency_stop' };
      }

      // Perform health checks based on type
      const healthResults = await this.performHealthChecks(rolloutConfig);
      
      // Evaluate overall health
      const overallHealth = this.evaluateOverallHealth(healthResults, rolloutConfig);
      
      // Generate health report
      const report = this.generateHealthReport(rolloutConfig, healthResults, overallHealth);
      
      // Save health report
      await this.saveHealthReport(report);
      
      // Trigger alerts if needed
      if (overallHealth.status !== 'healthy') {
        await this.triggerHealthAlert(overallHealth, rolloutConfig);
      }
      
      // Auto-rollback if critical
      if (overallHealth.status === 'critical' && rolloutConfig.auto_rollback_enabled) {
        await this.triggerAutoRollback(overallHealth, rolloutConfig);
      }
      
      console.log(`✅ Health check completed: ${overallHealth.status}`);
      return overallHealth;
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      
      Sentry.captureException(error, {
        tags: {
          component: 'rollout_health_checker',
          check_type: this.checkType
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

  async performHealthChecks(rolloutConfig) {
    const checks = {};
    
    if (this.checkType === 'full' || this.checkType === 'error_rates') {
      checks.errorRates = await this.checkErrorRates(rolloutConfig);
    }
    
    if (this.checkType === 'full' || this.checkType === 'metrics_only') {
      checks.processorHealth = await this.checkProcessorHealth(rolloutConfig);
      checks.queueHealth = await this.checkQueueHealth(rolloutConfig);
      checks.repositoryHealth = await this.checkRepositoryHealth(rolloutConfig);
    }
    
    return checks;
  }

  async checkErrorRates(rolloutConfig) {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - rolloutConfig.monitoring_window_hours);

    // Get metrics for the monitoring window
    const { data: metrics, error } = await this.supabase
      .from('rollout_metrics')
      .select('*')
      .eq('rollout_config_id', rolloutConfig.id)
      .gte('created_at', windowStart.toISOString());

    if (error) {
      throw new Error(`Failed to fetch rollout metrics: ${error.message}`);
    }

    if (!metrics || metrics.length === 0) {
      return {
        status: 'unknown',
        errorRate: 0,
        totalJobs: 0,
        message: 'No metrics available for analysis'
      };
    }

    // Calculate overall error rate
    const totalJobs = metrics.reduce((sum, m) => sum + m.total_jobs, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.error_count, 0);
    const errorRate = totalJobs > 0 ? (totalErrors / totalJobs) * 100 : 0;

    // Group by processor type
    const processorMetrics = {};
    for (const metric of metrics) {
      if (!processorMetrics[metric.processor_type]) {
        processorMetrics[metric.processor_type] = {
          totalJobs: 0,
          errorCount: 0,
          successCount: 0
        };
      }
      
      processorMetrics[metric.processor_type].totalJobs += metric.total_jobs;
      processorMetrics[metric.processor_type].errorCount += metric.error_count;
      processorMetrics[metric.processor_type].successCount += metric.success_count;
    }

    const status = errorRate > rolloutConfig.max_error_rate ? 'critical' : 
                   errorRate > rolloutConfig.max_error_rate * 0.8 ? 'warning' : 'healthy';

    return {
      status,
      errorRate,
      totalJobs,
      totalErrors,
      processorMetrics,
      threshold: rolloutConfig.max_error_rate,
      message: `Error rate: ${errorRate.toFixed(2)}% (threshold: ${rolloutConfig.max_error_rate}%)`
    };
  }

  async checkProcessorHealth(rolloutConfig) {
    // Check if processors are responding and processing jobs
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - 30); // Last 30 minutes

    const { data: recentJobs, error } = await this.supabase
      .from('progressive_capture_jobs')
      .select('processor_type, status, created_at')
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch recent jobs: ${error.message}`);
    }

    const processorHealth = {
      inngest: { active: false, recentJobs: 0, stuck: 0 },
      github_actions: { active: false, recentJobs: 0, stuck: 0 }
    };

    for (const job of recentJobs || []) {
      processorHealth[job.processor_type].recentJobs++;
      
      if (job.status === 'processing') {
        const jobAge = Date.now() - new Date(job.created_at).getTime();
        if (jobAge > 60 * 60 * 1000) { // Stuck for over 1 hour
          processorHealth[job.processor_type].stuck++;
        }
      }
    }

    // Determine health status
    let status = 'healthy';
    const issues = [];

    Object.keys(processorHealth).forEach(processor => {
      const health = processorHealth[processor];
      
      if (health.recentJobs > 0) {
        health.active = true;
      }
      
      if (health.stuck > 0) {
        status = 'warning';
        issues.push(`${processor} has ${health.stuck} stuck jobs`);
      }
      
      if (rolloutConfig.rollout_percentage > 0 && health.recentJobs === 0) {
        status = 'warning';
        issues.push(`${processor} has no recent activity`);
      }
    });

    return {
      status,
      processorHealth,
      issues,
      message: issues.length > 0 ? issues.join(', ') : 'All processors healthy'
    };
  }

  async checkQueueHealth(rolloutConfig) {
    // Check for queue backlogs and processing delays
    const { data: pendingJobs, error } = await this.supabase
      .from('progressive_capture_jobs')
      .select('processor_type, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch pending jobs: ${error.message}`);
    }

    const queueHealth = {
      totalPending: pendingJobs?.length || 0,
      oldestPending: null,
      processorQueues: {
        inngest: 0,
        github_actions: 0
      }
    };

    if (pendingJobs && pendingJobs.length > 0) {
      queueHealth.oldestPending = pendingJobs[0].created_at;
      
      for (const job of pendingJobs) {
        queueHealth.processorQueues[job.processor_type]++;
      }
    }

    // Determine status
    let status = 'healthy';
    const issues = [];

    if (queueHealth.totalPending > 100) {
      status = 'warning';
      issues.push(`High queue backlog: ${queueHealth.totalPending} pending jobs`);
    }

    if (queueHealth.oldestPending) {
      const ageMinutes = (Date.now() - new Date(queueHealth.oldestPending).getTime()) / (1000 * 60);
      if (ageMinutes > 60) {
        status = 'critical';
        issues.push(`Oldest pending job is ${Math.round(ageMinutes)} minutes old`);
      }
    }

    return {
      status,
      queueHealth,
      issues,
      message: issues.length > 0 ? issues.join(', ') : 'Queue processing normally'
    };
  }

  async checkRepositoryHealth(rolloutConfig) {
    // Check repository categorization and eligibility distribution
    const { data: categories, error } = await this.supabase
      .from('repository_categories')
      .select('category, is_test_repository');

    if (error) {
      throw new Error(`Failed to fetch repository categories: ${error.message}`);
    }

    const categoryDistribution = {};
    let testRepos = 0;

    for (const repo of categories || []) {
      categoryDistribution[repo.category] = (categoryDistribution[repo.category] || 0) + 1;
      if (repo.is_test_repository) testRepos++;
    }

    // Check if we have test repositories for safe rollout
    let status = 'healthy';
    const issues = [];

    if (rolloutConfig.rollout_percentage > 0 && testRepos === 0) {
      status = 'warning';
      issues.push('No test repositories available for safe rollout');
    }

    if (rolloutConfig.rollout_percentage > 50 && (categoryDistribution.small || 0) < 10) {
      status = 'warning';
      issues.push('Limited small repositories for gradual rollout validation');
    }

    return {
      status,
      categoryDistribution,
      testRepos,
      totalRepos: categories?.length || 0,
      issues,
      message: issues.length > 0 ? issues.join(', ') : 'Repository distribution healthy'
    };
  }

  evaluateOverallHealth(healthResults, rolloutConfig) {
    const statuses = Object.values(healthResults).map(result => result.status);
    
    // Determine overall status
    let overallStatus = 'healthy';
    const issues = [];
    const recommendations = [];

    if (statuses.includes('critical')) {
      overallStatus = 'critical';
    } else if (statuses.includes('warning')) {
      overallStatus = 'warning';
    }

    // Collect all issues
    Object.entries(healthResults).forEach(([checkType, result]) => {
      if (result.issues && result.issues.length > 0) {
        issues.push(...result.issues.map(issue => `${checkType}: ${issue}`));
      }
    });

    // Generate recommendations
    if (healthResults.errorRates?.status === 'critical') {
      recommendations.push('Immediate rollback recommended due to high error rate');
    } else if (healthResults.errorRates?.status === 'warning') {
      recommendations.push('Monitor error rates closely, consider pausing rollout');
    }

    if (healthResults.processorHealth?.status === 'warning') {
      recommendations.push('Investigate processor health issues');
    }

    if (healthResults.queueHealth?.status === 'critical') {
      recommendations.push('Address queue backlogs immediately');
    }

    return {
      status: overallStatus,
      issues,
      recommendations,
      rolloutPercentage: rolloutConfig.rollout_percentage,
      autoRollbackEnabled: rolloutConfig.auto_rollback_enabled,
      timestamp: new Date().toISOString()
    };
  }

  generateHealthReport(rolloutConfig, healthResults, overallHealth) {
    return {
      timestamp: new Date().toISOString(),
      checkType: this.checkType,
      rolloutConfig: {
        percentage: rolloutConfig.rollout_percentage,
        strategy: rolloutConfig.rollout_strategy,
        autoRollbackEnabled: rolloutConfig.auto_rollback_enabled,
        maxErrorRate: rolloutConfig.max_error_rate,
        emergencyStop: rolloutConfig.emergency_stop
      },
      healthResults,
      overallHealth,
      environment: process.env.ENVIRONMENT || 'production',
      version: '1.0.0'
    };
  }

  async saveHealthReport(report) {
    const fs = await import('fs');
    const filename = `rollout-health-${report.timestamp.split('T')[0]}-${Date.now()}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`📄 Health report saved: ${filename}`);
  }

  async triggerHealthAlert(overallHealth, rolloutConfig) {
    const alertLevel = overallHealth.status === 'critical' ? 'error' : 'warning';
    
    Sentry.withScope(scope => {
      scope.setTag('component', 'rollout_health');
      scope.setTag('rollout_percentage', rolloutConfig.rollout_percentage);
      scope.setTag('health_status', overallHealth.status);
      scope.setLevel(alertLevel);
      
      scope.setContext('rollout_health', {
        status: overallHealth.status,
        rolloutPercentage: rolloutConfig.rollout_percentage,
        issues: overallHealth.issues,
        recommendations: overallHealth.recommendations,
        autoRollbackEnabled: rolloutConfig.auto_rollback_enabled
      });
      
      const message = `Rollout health ${overallHealth.status}: ${overallHealth.issues.join(', ')}`;
      Sentry.captureMessage(message, alertLevel);
    });
    
    console.log(`🚨 Health alert sent: ${overallHealth.status}`);
  }

  async triggerAutoRollback(overallHealth, rolloutConfig) {
    console.log('🔄 Triggering automatic rollback...');
    
    try {
      // Update rollout percentage to 0
      const { error } = await this.supabase
        .from('rollout_configuration')
        .update({
          rollout_percentage: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', rolloutConfig.id);

      if (error) {
        throw new Error(`Failed to update rollout percentage: ${error.message}`);
      }

      // Log rollback in history
      await this.supabase
        .from('rollout_history')
        .insert({
          rollout_config_id: rolloutConfig.id,
          action: 'rollback',
          previous_percentage: rolloutConfig.rollout_percentage,
          new_percentage: 0,
          reason: `Automatic rollback triggered: ${overallHealth.issues.join(', ')}`,
          triggered_by: 'auto_health_check',
          metadata: {
            health_status: overallHealth.status,
            issues: overallHealth.issues,
            timestamp: new Date().toISOString()
          }
        });

      console.log('✅ Automatic rollback completed');
      
      // Send critical alert
      Sentry.withScope(scope => {
        scope.setTag('component', 'auto_rollback');
        scope.setTag('previous_percentage', rolloutConfig.rollout_percentage);
        scope.setLevel('error');
        
        scope.setContext('auto_rollback', {
          previousPercentage: rolloutConfig.rollout_percentage,
          reason: overallHealth.issues.join(', '),
          healthStatus: overallHealth.status,
          timestamp: new Date().toISOString()
        });
        
        Sentry.captureMessage('Automatic rollback executed due to health check failure', 'error');
      });
      
    } catch (error) {
      console.error('❌ Auto rollback failed:', error.message);
      
      Sentry.captureException(error, {
        tags: {
          component: 'auto_rollback_failure',
          rollout_percentage: rolloutConfig.rollout_percentage
        }
      });
      
      throw error;
    }
  }
}

// Main execution
async function main() {
  const checker = new RolloutHealthChecker();
  
  try {
    const result = await checker.checkRolloutHealth();
    
    console.log('\n📊 Health Check Summary:');
    console.log(`Status: ${result.status}`);
    console.log(`Rollout: ${result.rolloutPercentage}%`);
    
    if (result.issues.length > 0) {
      console.log('Issues:', result.issues);
    }
    
    if (result.recommendations.length > 0) {
      console.log('Recommendations:', result.recommendations);
    }
    
    // Exit with appropriate code
    process.exit(result.status === 'critical' ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { RolloutHealthChecker };