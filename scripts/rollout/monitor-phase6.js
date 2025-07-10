#!/usr/bin/env node

/**
 * Phase 6 Monitoring Script
 * 
 * Monitors the 10% gradual rollout implementation with real-time health checks,
 * error tracking, and automatic rollback capabilities.
 * 
 * Usage: node scripts/rollout/monitor-phase6.js
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../../src/lib/env.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

class Phase6Monitor {
  constructor() {
    this.featureName = 'hybrid_progressive_capture';
    this.checkInterval = 15 * 60 * 1000; // 15 minutes
    this.isRunning = false;
    this.healthCheckCount = 0;
  }

  async start() {
    console.log('🔍 Phase 6 Monitoring - Starting Health Monitor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    this.isRunning = true;
    
    // Initial health check
    await this.performHealthCheck();
    
    // Start monitoring loop
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      
      await this.performHealthCheck();
    }, this.checkInterval);
    
    console.log(`📊 Monitoring active - Health checks every ${this.checkInterval / 1000 / 60} minutes`);
    console.log('Press Ctrl+C to stop monitoring\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping Phase 6 Monitor...');
      this.isRunning = false;
      clearInterval(interval);
      process.exit(0);
    });
  }

  async performHealthCheck() {
    this.healthCheckCount++;
    const timestamp = new Date().toISOString();
    
    console.log(`\n🏥 Health Check #${this.healthCheckCount} - ${new Date().toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // Get current rollout configuration
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No rollout configuration found');
        return;
      }
      
      // Check if rollout is active
      if (!config.is_active || config.emergency_stop) {
        console.log('⚠️  Rollout is not active or emergency stop is enabled');
        return;
      }
      
      // Get rollout statistics
      const stats = await this.getRolloutStats(config);
      
      // Display current status
      this.displayHealthStatus(config, stats);
      
      // Check for auto-rollback conditions
      await this.checkAutoRollback(config, stats);
      
      // Record health check
      await this.recordHealthCheck(config, stats);
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  async getRolloutConfiguration() {
    const { data, error } = await supabase
      .from('rollout_configuration')
      .select('*')
      .eq('feature_name', this.featureName)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch rollout configuration: ${error.message}`);
    }

    return data;
  }

  async getRolloutStats(config) {
    // Get recent metrics within monitoring window
    const windowStart = new Date(Date.now() - config.monitoring_window_hours * 60 * 60 * 1000);
    
    const { data: metrics, error: metricsError } = await supabase
      .from('rollout_metrics')
      .select('*')
      .eq('rollout_config_id', config.id)
      .gte('created_at', windowStart.toISOString());

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    // Get repository counts
    const { data: allRepos, error: repoError } = await supabase
      .from('repository_categories')
      .select('category, repository_id');

    if (repoError) {
      throw new Error(`Failed to fetch repository categories: ${repoError.message}`);
    }

    const totalRepositories = allRepos?.length || 0;
    let eligibleRepositories = 0;
    const categoryDistribution = {};

    // Calculate eligible repositories
    if (allRepos) {
      for (const repo of allRepos) {
        categoryDistribution[repo.category] = (categoryDistribution[repo.category] || 0) + 1;
        
        // Simple eligibility check based on hash
        if (this.isRepositoryEligible(repo.repository_id, config.rollout_percentage)) {
          eligibleRepositories++;
        }
      }
    }

    // Calculate error rates
    const totalJobs = metrics?.reduce((sum, m) => sum + m.total_jobs, 0) || 0;
    const totalErrors = metrics?.reduce((sum, m) => sum + m.error_count, 0) || 0;
    const totalSuccesses = metrics?.reduce((sum, m) => sum + m.success_count, 0) || 0;

    const errorRate = totalJobs > 0 ? (totalErrors / totalJobs) * 100 : 0;
    const successRate = totalJobs > 0 ? (totalSuccesses / totalJobs) * 100 : 0;

    // Processor distribution
    const processorDistribution = {};
    if (metrics) {
      for (const metric of metrics) {
        processorDistribution[metric.processor_type] = (processorDistribution[metric.processor_type] || 0) + metric.total_jobs;
      }
    }

    return {
      totalRepositories,
      eligibleRepositories,
      errorRate,
      successRate,
      activeJobs: totalJobs,
      totalErrors,
      totalSuccesses,
      categoryDistribution,
      processorDistribution,
      metricsCount: metrics?.length || 0
    };
  }

  displayHealthStatus(config, stats) {
    console.log(`📊 Rollout Status: ${config.rollout_percentage}% (${stats.eligibleRepositories}/${stats.totalRepositories} repositories)`);
    console.log(`✅ Success Rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`❌ Error Rate: ${stats.errorRate.toFixed(2)}%`);
    console.log(`🔄 Active Jobs: ${stats.activeJobs}`);
    console.log(`📈 Total Processed: ${stats.totalSuccesses + stats.totalErrors}`);
    
    if (Object.keys(stats.categoryDistribution).length > 0) {
      console.log('\n📂 Repository Categories:');
      Object.entries(stats.categoryDistribution).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} repositories`);
      });
    }
    
    if (Object.keys(stats.processorDistribution).length > 0) {
      console.log('\n⚡ Processor Distribution:');
      Object.entries(stats.processorDistribution).forEach(([processor, count]) => {
        console.log(`   ${processor}: ${count} jobs`);
      });
    }
    
    // Health indicators
    console.log('\n🏥 Health Indicators:');
    console.log(`   Error Rate: ${this.getHealthIndicator(stats.errorRate, config.max_error_rate)} (${stats.errorRate.toFixed(2)}% / ${config.max_error_rate}% threshold)`);
    console.log(`   Success Rate: ${this.getHealthIndicator(stats.successRate, 95, true)} (${stats.successRate.toFixed(2)}%)`);
    console.log(`   Sample Size: ${this.getHealthIndicator(stats.activeJobs, 10, true)} (${stats.activeJobs} jobs)`);
  }

  getHealthIndicator(value, threshold, higherIsBetter = false) {
    if (higherIsBetter) {
      return value >= threshold ? '✅' : '⚠️';
    } else {
      return value <= threshold ? '✅' : '❌';
    }
  }

  async checkAutoRollback(config, stats) {
    if (!config.auto_rollback_enabled) {
      console.log('\n🔄 Auto-rollback disabled');
      return;
    }

    const shouldRollback = (
      stats.errorRate > config.max_error_rate &&
      stats.activeJobs > 10 // Minimum sample size
    );

    if (shouldRollback) {
      console.log('\n🚨 AUTO-ROLLBACK TRIGGERED!');
      console.log(`   Reason: Error rate ${stats.errorRate.toFixed(2)}% exceeds threshold ${config.max_error_rate}%`);
      console.log(`   Sample size: ${stats.activeJobs} jobs`);
      
      try {
        // Trigger rollback
        await this.triggerRollback(config, stats);
        console.log('✅ Rollback completed successfully');
        
        // Stop monitoring since rollback was triggered
        this.isRunning = false;
      } catch (error) {
        console.error('❌ Rollback failed:', error);
      }
    } else {
      console.log('\n✅ Auto-rollback check passed');
    }
  }

  async triggerRollback(config, stats) {
    const reason = `Error rate ${stats.errorRate.toFixed(2)}% exceeded threshold ${config.max_error_rate}%`;
    
    // Update rollout percentage to 0
    const { error: updateError } = await supabase
      .from('rollout_configuration')
      .update({
        rollout_percentage: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (updateError) {
      throw new Error(`Failed to update rollout percentage: ${updateError.message}`);
    }

    // Log the rollback
    const { error: historyError } = await supabase
      .from('rollout_history')
      .insert({
        rollout_config_id: config.id,
        action: 'rollback',
        previous_percentage: config.rollout_percentage,
        new_percentage: 0,
        reason,
        triggered_by: 'auto_rollback',
        metadata: {
          error_rate: stats.errorRate,
          success_rate: stats.successRate,
          active_jobs: stats.activeJobs,
          timestamp: new Date().toISOString()
        }
      });

    if (historyError) {
      console.warn('⚠️  Failed to log rollback history:', historyError.message);
    }
  }

  async recordHealthCheck(config, stats) {
    // This could be used to record health check history
    // For now, we'll just log key metrics
    console.log(`\n📝 Health check recorded at ${new Date().toLocaleString()}`);
  }

  isRepositoryEligible(repositoryId, percentage) {
    // Simple hash-based eligibility check
    const hash = this.hashCode(repositoryId);
    return (Math.abs(hash) % 100) < percentage;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

// Run the monitor
const monitor = new Phase6Monitor();
monitor.start().catch(console.error);