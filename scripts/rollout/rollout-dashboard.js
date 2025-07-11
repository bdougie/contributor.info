#!/usr/bin/env node

/**
 * Rollout Dashboard - Interactive CLI for managing Phase 6 rollout
 * 
 * Provides an interactive interface for monitoring and controlling
 * the hybrid progressive capture rollout.
 * 
 * Usage: node scripts/rollout/rollout-dashboard.js
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../../src/lib/env.js';
import readline from 'readline';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

class RolloutDashboard {
  constructor() {
    this.featureName = 'hybrid_progressive_capture';
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('🎛️  Hybrid Progressive Capture - Rollout Dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await this.showMainMenu();
  }

  async showMainMenu() {
    console.log('\n🚀 Main Menu');
    console.log('──────────────────────────────────────────────────────────────────────');
    console.log('1. 📊 Show Rollout Status');
    console.log('2. 📈 Show Detailed Statistics');
    console.log('3. 🏥 Perform Health Check');
    console.log('4. 🔧 Manage Rollout Percentage');
    console.log('5. 📂 Manage Repository Categories');
    console.log('6. 📝 Manage Whitelist');
    console.log('7. 🚨 Emergency Controls');
    console.log('8. 📋 View Rollout History');
    console.log('9. 🔄 Real-time Monitoring');
    console.log('0. 🚪 Exit');
    console.log('──────────────────────────────────────────────────────────────────────');
    
    const choice = await this.prompt('Select an option (0-9): ');
    
    switch (choice) {
      case '1': await this.showRolloutStatus(); break;
      case '2': await this.showDetailedStats(); break;
      case '3': await this.performHealthCheck(); break;
      case '4': await this.manageRolloutPercentage(); break;
      case '5': await this.manageRepositoryCategories(); break;
      case '6': await this.manageWhitelist(); break;
      case '7': await this.emergencyControls(); break;
      case '8': await this.viewRolloutHistory(); break;
      case '9': await this.startRealTimeMonitoring(); break;
      case '0': 
        console.log('👋 Goodbye!');
        this.rl.close();
        return;
      default:
        console.log('❌ Invalid option. Please try again.');
    }
    
    await this.showMainMenu();
  }

  async showRolloutStatus() {
    console.log('\n📊 Current Rollout Status');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      console.log(`🎯 Feature: ${config.feature_name}`);
      console.log(`📈 Rollout Percentage: ${config.rollout_percentage}%`);
      console.log(`🎭 Strategy: ${config.rollout_strategy}`);
      console.log(`🔄 Auto Rollback: ${config.auto_rollback_enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`⚠️  Max Error Rate: ${config.max_error_rate}%`);
      console.log(`🚨 Emergency Stop: ${config.emergency_stop ? 'ACTIVE' : 'Inactive'}`);
      console.log(`🕐 Monitoring Window: ${config.monitoring_window_hours} hours`);
      console.log(`📝 Whitelist: ${config.target_repositories.length} repositories`);
      console.log(`🚫 Blacklist: ${config.excluded_repositories.length} repositories`);
      console.log(`🆕 Created: ${new Date(config.created_at).toLocaleString()}`);
      console.log(`🔄 Updated: ${new Date(config.updated_at).toLocaleString()}`);
      
    } catch (error) {
      console.error('❌ Error fetching rollout status:', error);
    }
  }

  async showDetailedStats() {
    console.log('\n📈 Detailed Rollout Statistics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      const stats = await this.getRolloutStats(config);
      
      console.log(`🏢 Total Repositories: ${stats.totalRepositories}`);
      console.log(`✅ Eligible Repositories: ${stats.eligibleRepositories}`);
      console.log(`📈 Rollout Percentage: ${config.rollout_percentage}%`);
      console.log(`❌ Error Rate: ${stats.errorRate.toFixed(2)}%`);
      console.log(`✅ Success Rate: ${stats.successRate.toFixed(2)}%`);
      console.log(`🔄 Active Jobs: ${stats.activeJobs}`);
      
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
      
    } catch (error) {
      console.error('❌ Error fetching detailed stats:', error);
    }
  }

  async performHealthCheck() {
    console.log('\n🏥 Performing Health Check');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      const stats = await this.getRolloutStats(config);
      
      // Check rollout health
      const errorRateHealthy = stats.errorRate <= config.max_error_rate;
      const successRateHealthy = stats.successRate >= 95;
      const sampleSizeHealthy = stats.activeJobs >= 10;
      
      console.log(`🎯 Rollout Health Status:`);
      console.log(`   Error Rate: ${errorRateHealthy ? '✅' : '❌'} ${stats.errorRate.toFixed(2)}% (threshold: ${config.max_error_rate}%)`);
      console.log(`   Success Rate: ${successRateHealthy ? '✅' : '⚠️'} ${stats.successRate.toFixed(2)}%`);
      console.log(`   Sample Size: ${sampleSizeHealthy ? '✅' : '⚠️'} ${stats.activeJobs} jobs`);
      
      const overall = errorRateHealthy && successRateHealthy ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION';
      console.log(`\n🏥 Overall Health: ${overall}`);
      
      // Check for auto-rollback conditions
      if (config.auto_rollback_enabled && stats.errorRate > config.max_error_rate && stats.activeJobs > 10) {
        console.log('\n🚨 AUTO-ROLLBACK RECOMMENDED!');
        console.log(`   Error rate ${stats.errorRate.toFixed(2)}% exceeds threshold ${config.max_error_rate}%`);
        
        const rollback = await this.prompt('Trigger rollback now? (y/n): ');
        if (rollback.toLowerCase() === 'y') {
          await this.triggerRollback(config, stats);
        }
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  async manageRolloutPercentage() {
    console.log('\n🔧 Manage Rollout Percentage');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      console.log(`📈 Current rollout percentage: ${config.rollout_percentage}%`);
      console.log('🎯 Recommended progression: 0% → 10% → 25% → 50% → 75% → 100%');
      
      const newPercentage = await this.prompt('Enter new rollout percentage (0-100): ');
      const percentage = parseInt(newPercentage);
      
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        console.log('❌ Invalid percentage. Must be between 0 and 100.');
        return;
      }
      
      const confirm = await this.prompt(`Update rollout from ${config.rollout_percentage}% to ${percentage}%? (y/n): `);
      if (confirm.toLowerCase() === 'y') {
        await this.updateRolloutPercentage(config, percentage);
        console.log(`✅ Rollout percentage updated to ${percentage}%`);
      }
      
    } catch (error) {
      console.error('❌ Error managing rollout percentage:', error);
    }
  }

  async emergencyControls() {
    console.log('\n🚨 Emergency Controls');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('1. 🚨 Emergency Stop');
    console.log('2. 🔄 Resume Rollout');
    console.log('3. 🔙 Rollback to 0%');
    console.log('4. 🔒 Disable Auto-Rollback');
    console.log('5. 🔓 Enable Auto-Rollback');
    console.log('6. 🔙 Back to Main Menu');
    
    const choice = await this.prompt('Select emergency control (1-6): ');
    
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      switch (choice) {
        case '1':
          const reason = await this.prompt('Enter reason for emergency stop: ');
          await this.emergencyStop(config, reason);
          break;
        case '2':
          await this.resumeRollout(config);
          break;
        case '3':
          await this.rollbackToZero(config);
          break;
        case '4':
          await this.toggleAutoRollback(config, false);
          break;
        case '5':
          await this.toggleAutoRollback(config, true);
          break;
        case '6':
          return;
        default:
          console.log('❌ Invalid option.');
      }
    } catch (error) {
      console.error('❌ Emergency control failed:', error);
    }
  }

  async viewRolloutHistory() {
    console.log('\n📋 Rollout History');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      const { data: history, error } = await supabase
        .from('rollout_history')
        .select('*')
        .eq('rollout_config_id', config.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`Failed to fetch rollout history: ${error.message}`);
      }

      if (!history || history.length === 0) {
        console.log('ℹ️  No rollout history found');
        return;
      }

      console.log('📜 Recent Rollout Changes:');
      history.forEach((entry, index) => {
        const date = new Date(entry.created_at).toLocaleString();
        const action = entry.action.toUpperCase();
        const change = entry.previous_percentage !== null && entry.new_percentage !== null 
          ? `${entry.previous_percentage}% → ${entry.new_percentage}%`
          : 'N/A';
        
        console.log(`\n${index + 1}. ${date}`);
        console.log(`   Action: ${action}`);
        console.log(`   Change: ${change}`);
        console.log(`   Reason: ${entry.reason || 'N/A'}`);
        console.log(`   Triggered by: ${entry.triggered_by || 'N/A'}`);
      });
      
    } catch (error) {
      console.error('❌ Error fetching rollout history:', error);
    }
  }

  async startRealTimeMonitoring() {
    console.log('\n🔄 Starting Real-time Monitoring');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Press Ctrl+C to stop monitoring and return to menu\n');
    
    let monitoringActive = true;
    
    // Handle Ctrl+C to stop monitoring
    const originalHandler = process.listeners('SIGINT')[0];
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      monitoringActive = false;
      process.on('SIGINT', originalHandler);
    });
    
    let checkCount = 0;
    while (monitoringActive) {
      try {
        checkCount++;
        console.log(`\n🔍 Health Check #${checkCount} - ${new Date().toLocaleString()}`);
        console.log('──────────────────────────────────────────────────────────────────────');
        
        const config = await this.getRolloutConfiguration();
        if (!config) {
          console.log('❌ No active rollout configuration found');
          break;
        }

        const stats = await this.getRolloutStats(config);
        
        console.log(`📊 Status: ${config.rollout_percentage}% | Error: ${stats.errorRate.toFixed(2)}% | Success: ${stats.successRate.toFixed(2)}% | Jobs: ${stats.activeJobs}`);
        
        // Check for issues
        if (stats.errorRate > config.max_error_rate && stats.activeJobs > 10) {
          console.log('🚨 WARNING: Error rate exceeds threshold!');
        }
        
        // Wait for 30 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 30000));
        
      } catch (error) {
        console.error('❌ Monitoring error:', error);
        break;
      }
    }
    
    console.log('✅ Monitoring stopped');
  }

  // Helper methods
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
    // Get metrics within monitoring window
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

    if (allRepos) {
      for (const repo of allRepos) {
        categoryDistribution[repo.category] = (categoryDistribution[repo.category] || 0) + 1;
        
        if (this.isRepositoryEligible(repo.repository_id, config.rollout_percentage)) {
          eligibleRepositories++;
        }
      }
    }

    const totalJobs = metrics?.reduce((sum, m) => sum + m.total_jobs, 0) || 0;
    const totalErrors = metrics?.reduce((sum, m) => sum + m.error_count, 0) || 0;
    const totalSuccesses = metrics?.reduce((sum, m) => sum + m.success_count, 0) || 0;

    const errorRate = totalJobs > 0 ? (totalErrors / totalJobs) * 100 : 0;
    const successRate = totalJobs > 0 ? (totalSuccesses / totalJobs) * 100 : 0;

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
      categoryDistribution,
      processorDistribution
    };
  }

  async updateRolloutPercentage(config, percentage) {
    const { error } = await supabase
      .from('rollout_configuration')
      .update({
        rollout_percentage: percentage,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (error) {
      throw new Error(`Failed to update rollout percentage: ${error.message}`);
    }

    // Log the change
    await supabase
      .from('rollout_history')
      .insert({
        rollout_config_id: config.id,
        action: 'updated',
        previous_percentage: config.rollout_percentage,
        new_percentage: percentage,
        reason: 'Manual update via dashboard',
        triggered_by: 'dashboard'
      });
  }

  async emergencyStop(config, reason) {
    const { error } = await supabase
      .from('rollout_configuration')
      .update({
        emergency_stop: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (error) {
      throw new Error(`Failed to activate emergency stop: ${error.message}`);
    }

    // Log the emergency stop
    await supabase
      .from('rollout_history')
      .insert({
        rollout_config_id: config.id,
        action: 'emergency_stop',
        reason,
        triggered_by: 'dashboard'
      });

    console.log('🚨 Emergency stop activated');
  }

  async resumeRollout(config) {
    const { error } = await supabase
      .from('rollout_configuration')
      .update({
        emergency_stop: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (error) {
      throw new Error(`Failed to resume rollout: ${error.message}`);
    }

    console.log('✅ Rollout resumed');
  }

  async rollbackToZero(config) {
    await this.updateRolloutPercentage(config, 0);
    console.log('🔙 Rolled back to 0%');
  }

  async toggleAutoRollback(config, enabled) {
    const { error } = await supabase
      .from('rollout_configuration')
      .update({
        auto_rollback_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (error) {
      throw new Error(`Failed to toggle auto-rollback: ${error.message}`);
    }

    console.log(`${enabled ? '🔓 Auto-rollback enabled' : '🔒 Auto-rollback disabled'}`);
  }

  isRepositoryEligible(repositoryId, percentage) {
    const hash = this.hashCode(repositoryId);
    return (Math.abs(hash) % 100) < percentage;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  async prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}

// Run the dashboard
const dashboard = new RolloutDashboard();
dashboard.start().catch(console.error);