import { hybridRolloutManager } from './rollout-manager';
import { repositoryCategorizer } from './repository-categorization';
import { supabase } from '../supabase';
import { env } from '../env';

/**
 * Rollout Console - Manual override and management utilities
 *
 * This module provides console utilities for managing hybrid progressive capture rollout.
 * Available as global functions for debugging and manual operations.
 */

export interface RolloutConsole {
  // Status and monitoring
  status(): Promise<void>;
  stats(): Promise<void>;
  categories(): Promise<void>;

  // Rollout controls
  setRollout(percentage: number): Promise<void>;
  emergencyStop(reason?: string): Promise<void>;
  resume(): Promise<void>;

  // Whitelist management
  addToWhitelist(repositoryIds: string[]): Promise<void>;
  removeFromWhitelist(repositoryIds: string[]): Promise<void>;
  showWhitelist(): Promise<void>;

  // Repository management
  categorizeAll(): Promise<void>;
  markAsTest(repositoryId: string): Promise<void>;
  unmarkAsTest(repositoryId: string): Promise<void>;

  // Rollback procedures
  rollbackToPercentage(percentage: number): Promise<void>;
  rollbackToZero(): Promise<void>;
  enableAutoRollback(): Promise<void>;
  disableAutoRollback(): Promise<void>;

  // Monitoring
  checkHealth(): Promise<void>;
  showMetrics(): Promise<void>;
  monitorPhase4(): Promise<void>;

  // Help
  help(): void;

  // Utility
  clearCache(): void;
}

class RolloutConsoleManager implements RolloutConsole {
  /**
   * Show current rollout status
   */
  async status(): Promise<void> {
    try {
      console.log('\n🚀 Hybrid Progressive Capture Rollout Status');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const config = await hybridRolloutManager.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No active rollout configuration found');
        return;
      }

      console.log('📊 Feature: %s', config.feature_name);
      console.log('📈 Rollout Percentage: %s%', config.rollout_percentage);
      console.log('🎯 Strategy: %s', config.rollout_strategy);
      console.log('🔄 Auto Rollback: %s', config.auto_rollback_enabled ? 'Enabled' : 'Disabled');
      console.log('⚠️  Max Error Rate: %s%', config.max_error_rate);
      console.log('🚨 Emergency Stop: %s', config.emergency_stop ? 'ACTIVE' : 'Inactive');
      console.log('🕐 Monitoring Window: %s hours', config.monitoring_window_hours);
      console.log('📝 Whitelist: %s repositories', config.target_repositories.length);
      console.log('🚫 Blacklist: %s repositories', config.excluded_repositories.length);
      console.log('🆕 Created: %s', new Date(config.created_at).toLocaleString());
      console.log('🔄 Updated: %s', new Date(config.updated_at).toLocaleString());

      // Environment overrides
      const envPercentage = env.HYBRID_ROLLOUT_PERCENTAGE;
      const envEmergencyStop = env.HYBRID_EMERGENCY_STOP;

      if (envPercentage || envEmergencyStop) {
        console.log('\n🔧 Environment Overrides:');
        if (envPercentage) console.log('   HYBRID_ROLLOUT_PERCENTAGE: %s', envPercentage);
        if (envEmergencyStop) console.log('   HYBRID_EMERGENCY_STOP: %s', envEmergencyStop);
      }
    } catch (error) {
      console.error('❌ Error getting rollout status:', error);
    }
  }

  /**
   * Show rollout statistics
   */
  async stats(): Promise<void> {
    try {
      console.log('\n📊 Rollout Statistics');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const stats = await hybridRolloutManager.getRolloutStats();
      if (!stats) {
        console.log('❌ Unable to fetch rollout statistics');
        return;
      }

      console.log('🏢 Total Repositories: %s', stats.total_repositories);
      console.log('✅ Eligible Repositories: %s', stats.eligible_repositories);
      console.log('📈 Rollout Percentage: %s%', stats.rollout_percentage);
      console.log('❌ Error Rate: %s%', stats.error_rate.toFixed(2));
      console.log('✅ Success Rate: %s%', stats.success_rate.toFixed(2));
      console.log('🔄 Active Jobs: %s', stats.active_jobs);

      console.log('\n📂 Repository Categories:');
      Object.entries(stats.categories).forEach(([category, count]) => {
        console.log('   %s: %s repositories', category, count);
      });

      console.log('\n⚡ Processor Distribution:');
      Object.entries(stats.processor_distribution).forEach(([processor, count]) => {
        console.log('   %s: %s jobs', processor, count);
      });
    } catch (error) {
      console.error('❌ Error getting rollout stats:', error);
    }
  }

  /**
   * Show category statistics
   */
  async categories(): Promise<void> {
    try {
      console.log('\n📂 Repository Categories');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const categoryStats = await repositoryCategorizer.getCategoryStats();

      if (categoryStats.length === 0) {
        console.log('ℹ️  No repositories categorized yet. Run rollout.categorizeAll() first.');
        return;
      }

      categoryStats.forEach((stat) => {
        console.log('\n📁 %s', stat.category.toUpperCase());
        console.log('   Count: %s', stat.count);
        console.log('   Total Stars: %s', stat.total_star_count.toLocaleString());
        console.log('   Total Contributors: %s', stat.total_contributor_count.toLocaleString());
        console.log('   Total PRs: %s', stat.total_pr_count.toLocaleString());
        console.log('   Avg Activity Score: %s', stat.average_activity_score.toFixed(1));
      });
    } catch (error) {
      console.error('❌ Error getting category stats:', error);
    }
  }

  /**
   * Set rollout percentage
   */
  async setRollout(percentage: number): Promise<void> {
    try {
      if (percentage < 0 || percentage > 100) {
        console.log('❌ Rollout percentage must be between 0 and 100');
        return;
      }

      const success = await hybridRolloutManager.updateRolloutPercentage(
        percentage,
        'manual',
        `Manual rollout update via console`
      );

      if (success) {
        console.log('✅ Rollout percentage updated to %s%', percentage);
      } else {
        console.log('❌ Failed to update rollout percentage');
      }
    } catch (error) {
      console.error('❌ Error setting rollout percentage:', error);
    }
  }

  /**
   * Emergency stop
   */
  async emergencyStop(reason: string = 'Manual emergency stop via console'): Promise<void> {
    try {
      const success = await hybridRolloutManager.emergencyStop(reason, 'manual');

      if (success) {
        console.log('🚨 EMERGENCY STOP ACTIVATED');
        console.log('   Reason: %s', reason);
        console.log('   All rollout traffic has been halted');
      } else {
        console.log('❌ Failed to activate emergency stop');
      }
    } catch (error) {
      console.error('❌ Error activating emergency stop:', error);
    }
  }

  /**
   * Resume rollout after emergency stop
   */
  async resume(): Promise<void> {
    try {
      const config = await hybridRolloutManager.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No rollout configuration found');
        return;
      }

      // Clear emergency stop flag
      const { error } = await supabase
        .from('rollout_configuration')
        .update({
          emergency_stop: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) {
        console.error('❌ Error resuming rollout:', error);
        return;
      }

      console.log('✅ Rollout resumed');
      console.log('   Current rollout percentage: %s%', config.rollout_percentage);
    } catch (error) {
      console.error('❌ Error resuming rollout:', error);
    }
  }

  /**
   * Add repositories to whitelist
   */
  async addToWhitelist(repositoryIds: string[]): Promise<void> {
    try {
      const success = await hybridRolloutManager.addToWhitelist(
        repositoryIds,
        'Manual whitelist addition via console'
      );

      if (success) {
        console.log('✅ Added %s repositories to whitelist', repositoryIds.length);
        repositoryIds.forEach((id) => console.log('   - %s', id));
      } else {
        console.log('❌ Failed to add repositories to whitelist');
      }
    } catch (error) {
      console.error('❌ Error adding to whitelist:', error);
    }
  }

  /**
   * Remove repositories from whitelist
   */
  async removeFromWhitelist(repositoryIds: string[]): Promise<void> {
    try {
      const success = await hybridRolloutManager.removeFromWhitelist(
        repositoryIds,
        'Manual whitelist removal via console'
      );

      if (success) {
        console.log('✅ Removed %s repositories from whitelist', repositoryIds.length);
        repositoryIds.forEach((id) => console.log('   - %s', id));
      } else {
        console.log('❌ Failed to remove repositories from whitelist');
      }
    } catch (error) {
      console.error('❌ Error removing from whitelist:', error);
    }
  }

  /**
   * Show current whitelist
   */
  async showWhitelist(): Promise<void> {
    try {
      const config = await hybridRolloutManager.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No rollout configuration found');
        return;
      }

      console.log('\n📝 Current Whitelist');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (config.target_repositories.length === 0) {
        console.log('ℹ️  Whitelist is empty');
      } else {
        console.log('📊 %s repositories in whitelist:', config.target_repositories.length);
        config.target_repositories.forEach((id, index) => {
          console.log('   %s. %s', index + 1, id);
        });
      }

      if (config.excluded_repositories.length > 0) {
        console.log('\n🚫 %s repositories in blacklist:', config.excluded_repositories.length);
        config.excluded_repositories.forEach((id, index) => {
          console.log('   %s. %s', index + 1, id);
        });
      }
    } catch (error) {
      console.error('❌ Error showing whitelist:', error);
    }
  }

  /**
   * Categorize all repositories
   */
  async categorizeAll(): Promise<void> {
    try {
      console.log('🔍 Starting repository categorization...');
      await repositoryCategorizer.categorizeAll();
      console.log('✅ Repository categorization completed');
    } catch (error) {
      console.error('❌ Error categorizing repositories:', error);
    }
  }

  /**
   * Mark repository as test
   */
  async markAsTest(repositoryId: string): Promise<void> {
    try {
      const success = await repositoryCategorizer.markAsTestRepository(repositoryId);

      if (success) {
        console.log('✅ Marked repository %s as test repository', repositoryId);
      } else {
        console.log('❌ Failed to mark repository %s as test', repositoryId);
      }
    } catch (error) {
      console.error('❌ Error marking repository as test:', error);
    }
  }

  /**
   * Unmark repository as test
   */
  async unmarkAsTest(repositoryId: string): Promise<void> {
    try {
      const success = await repositoryCategorizer.unmarkAsTestRepository(repositoryId);

      if (success) {
        console.log('✅ Unmarked repository %s as test repository', repositoryId);
      } else {
        console.log('❌ Failed to unmark repository %s as test', repositoryId);
      }
    } catch (error) {
      console.error('❌ Error unmarking repository as test:', error);
    }
  }

  /**
   * Rollback to specific percentage
   */
  async rollbackToPercentage(percentage: number): Promise<void> {
    try {
      const success = await hybridRolloutManager.updateRolloutPercentage(
        percentage,
        'manual_rollback',
        `Manual rollback to ${percentage}% via console`
      );

      if (success) {
        console.log('✅ Rolled back to %s%', percentage);
      } else {
        console.log('❌ Failed to rollback');
      }
    } catch (error) {
      console.error('❌ Error rolling back:', error);
    }
  }

  /**
   * Rollback to zero
   */
  async rollbackToZero(): Promise<void> {
    await this.rollbackToPercentage(0);
  }

  /**
   * Enable auto rollback
   */
  async enableAutoRollback(): Promise<void> {
    try {
      const config = await hybridRolloutManager.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No rollout configuration found');
        return;
      }

      const { error } = await supabase
        .from('rollout_configuration')
        .update({
          auto_rollback_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) {
        console.error('❌ Error enabling auto rollback:', error);
        return;
      }

      console.log('✅ Auto rollback enabled');
    } catch (error) {
      console.error('❌ Error enabling auto rollback:', error);
    }
  }

  /**
   * Disable auto rollback
   */
  async disableAutoRollback(): Promise<void> {
    try {
      const config = await hybridRolloutManager.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No rollout configuration found');
        return;
      }

      const { error } = await supabase
        .from('rollout_configuration')
        .update({
          auto_rollback_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) {
        console.error('❌ Error disabling auto rollback:', error);
        return;
      }

      console.log('✅ Auto rollback disabled');
    } catch (error) {
      console.error('❌ Error disabling auto rollback:', error);
    }
  }

  /**
   * Check rollout health
   */
  async checkHealth(): Promise<void> {
    try {
      console.log('\n🏥 Rollout Health Check');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const rollbackTriggered = await hybridRolloutManager.checkAndTriggerAutoRollback();

      if (rollbackTriggered) {
        console.log('⚠️  Auto rollback was triggered due to high error rate');
      } else {
        console.log('✅ Rollout health is normal');
      }

      // Show current stats
      await this.stats();
    } catch (error) {
      console.error('❌ Error checking rollout health:', error);
    }
  }

  /**
   * Show detailed metrics
   */
  async showMetrics(): Promise<void> {
    try {
      console.log('\n📈 Detailed Rollout Metrics');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // This would query rollout_metrics table for detailed metrics
      // Implementation depends on specific metrics needed
      console.log('ℹ️  Detailed metrics implementation pending');
    } catch (error) {
      console.error('❌ Error showing metrics:', error);
    }
  }

  /**
   * Monitor Phase 4: 10% test repository rollout
   */
  async monitorPhase4(): Promise<void> {
    try {
      console.log('\n🚀 PHASE 4 MONITORING: 10% Test Repository Rollout\n');

      // Get current rollout configuration
      const config = await hybridRolloutManager.getRolloutConfiguration();
      if (!config) {
        console.log('❌ No rollout configuration found');
        return;
      }

      console.log(
        '📊 Current Rollout: %s% (Strategy: %s)',
        config.rollout_percentage,
        config.rollout_strategy
      );
      console.log(
        '🛡️ Auto Rollback: %s',
        config.auto_rollback_enabled ? '✅ Enabled' : '❌ Disabled'
      );
      console.log('🚨 Emergency Stop: %s', config.emergency_stop ? '🔴 ACTIVE' : '🟢 Normal');
      console.log('⚠️ Max Error Rate: %s%', config.max_error_rate);

      // Check which repositories are eligible
      const { data: testRepos } = await supabase
        .from('repository_categories')
        .select(
          'repository_id, category, priority_level, is_test_repository, repositories!inner(full_name)'
        )
        .eq('category', 'test');

      console.log('\n📋 Test Repositories (%s total):', testRepos?.length || 0);
      if (testRepos) {
        for (const repo of testRepos) {
          const isEligible = await hybridRolloutManager.isRepositoryEligible(repo.repository_id);
          const status = isEligible ? '✅ ELIGIBLE' : '❌ Not eligible';
          console.log('   %s: %s', (repo.repositories as any).full_name, status);
        }
      }

      // Get rollout metrics
      const stats = await hybridRolloutManager.getRolloutStats();
      if (stats) {
        console.log(`\n📈 Rollout Metrics:`);
        console.log(
          '   Eligible Repositories: %s/%s',
          stats.eligible_repositories,
          stats.total_repositories
        );
        console.log('   Error Rate: %s%', stats.error_rate.toFixed(2));
        console.log('   Success Rate: %s%', stats.success_rate.toFixed(2));
        console.log('   Active Jobs: %s', stats.active_jobs);

        if (Object.keys(stats.processor_distribution).length > 0) {
          console.log(`   Processor Distribution:`);
          Object.entries(stats.processor_distribution).forEach(([processor, count]) => {
            console.log('     %s: %s jobs', processor, count);
          });
        }
      }

      // Check recent rollout history
      const { data: history } = await supabase
        .from('rollout_history')
        .select('*')
        .eq('rollout_config_id', config.id)
        .order('created_at', { ascending: false })
        .limit(5);

      console.log(`\n📜 Recent History:`);
      if (history && history.length > 0) {
        history.forEach((entry) => {
          const timestamp = new Date(entry.created_at).toLocaleString();
          console.log(
            '   %s: %s (%s% → %s%)',
            timestamp,
            entry.action,
            entry.previous_percentage,
            entry.new_percentage
          );
          if (entry.reason) console.log('     Reason: %s', entry.reason);
        });
      } else {
        console.log('   No history entries found');
      }

      // Check for any recent errors
      const { data: recentMetrics } = await supabase
        .from('rollout_metrics')
        .select('*')
        .eq('rollout_config_id', config.id)
        .gt('error_count', 0)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentMetrics && recentMetrics.length > 0) {
        console.log(`\n⚠️ Recent Errors:`);
        recentMetrics.forEach((metric) => {
          console.log('   Repository: %s', metric.repository_id);
          console.log('   Processor: %s', metric.processor_type);
          console.log('   Errors: %s/%s', metric.error_count, metric.total_jobs);
          if (metric.last_error_message) {
            console.log('   Last Error: %s', metric.last_error_message);
          }
        });
      }

      // Recommendations
      console.log(`\n💡 Phase 4 Recommendations:`);

      if (config.rollout_percentage < 10) {
        console.log(`   📈 Increase rollout to 10% with: rollout.setRollout(10)`);
      } else if (config.rollout_percentage === 10) {
        console.log(`   ✅ Phase 4 active! Monitor for 24-48 hours before proceeding`);
        console.log(`   📊 Next: Phase 5 (25%) when ready with small production repos`);
      }

      if (stats && stats.error_rate > 2) {
        console.log(
          '   ⚠️ Error rate elevated (%s%). Consider investigation.',
          stats.error_rate.toFixed(2)
        );
      }

      if (!config.auto_rollback_enabled) {
        console.log(`   🛡️ Enable auto rollback with: rollout.enableAutoRollback()`);
      }

      console.log(`\n🔄 Refresh monitoring with: rollout.monitorPhase4()`);
      console.log(`🆘 Emergency stop with: rollout.emergencyStop("reason")`);
    } catch (error) {
      console.error('❌ Error monitoring Phase 4:', error);
    }
  }

  /**
   * Show help
   */
  help(): void {
    console.log(`
🚀 Hybrid Progressive Capture Rollout Console

MONITORING COMMANDS:
  rollout.status()                    - Show current rollout status
  rollout.stats()                     - Show rollout statistics
  rollout.categories()                - Show repository categories
  rollout.checkHealth()               - Check rollout health and trigger auto-rollback if needed
  rollout.showMetrics()               - Show detailed metrics
  rollout.monitorPhase4()             - 🚀 Monitor Phase 4: 10% test rollout

ROLLOUT CONTROLS:
  rollout.setRollout(percentage)      - Set rollout percentage (0-100)
  rollout.emergencyStop(reason?)      - Emergency stop rollout
  rollout.resume()                    - Resume rollout after emergency stop

WHITELIST MANAGEMENT:
  rollout.addToWhitelist([ids])       - Add repositories to whitelist
  rollout.removeFromWhitelist([ids])  - Remove repositories from whitelist
  rollout.showWhitelist()             - Show current whitelist

REPOSITORY MANAGEMENT:
  rollout.categorizeAll()             - Categorize all repositories
  rollout.markAsTest(id)              - Mark repository as test
  rollout.unmarkAsTest(id)            - Unmark repository as test

ROLLBACK PROCEDURES:
  rollout.rollbackToPercentage(pct)   - Rollback to specific percentage
  rollout.rollbackToZero()            - Rollback to 0%
  rollout.enableAutoRollback()        - Enable automatic rollback
  rollout.disableAutoRollback()       - Disable automatic rollback

UTILITIES:
  rollout.clearCache()                - Clear browser cache and reload

EXAMPLES:
  rollout.setRollout(10)              - Start with 10% rollout
  rollout.addToWhitelist(['repo-id']) - Add test repository
  rollout.emergencyStop('High errors')- Emergency stop with reason
  rollout.checkHealth()               - Check if rollback needed
    `);
  }

  /**
   * Clear browser cache and reload
   */
  clearCache(): void {
    console.log('🧹 Clearing browser cache...');
    try {
      // Clear localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
        console.log('✅ localStorage cleared');
      }

      // Clear sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.clear();
        console.log('✅ sessionStorage cleared');
      }

      console.log('🔄 Reloading page...');
      // Small delay to ensure console messages are visible
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const rolloutConsole = new RolloutConsoleManager();

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).rollout = rolloutConsole;
}
