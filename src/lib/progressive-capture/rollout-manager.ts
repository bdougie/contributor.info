import { supabase } from '../supabase';
import { env } from '../env';

export interface RolloutConfiguration {
  id: string;
  feature_name: string;
  rollout_percentage: number;
  is_active: boolean;
  target_repositories: string[];
  excluded_repositories: string[];
  rollout_strategy: 'percentage' | 'whitelist' | 'repository_size';
  max_error_rate: number;
  monitoring_window_hours: number;
  auto_rollback_enabled: boolean;
  emergency_stop: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RepositoryCategory {
  id: string;
  repository_id: string;
  category: 'test' | 'small' | 'medium' | 'large' | 'enterprise';
  priority_level: number;
  is_test_repository: boolean;
  star_count: number;
  contributor_count: number;
  pr_count: number;
  monthly_activity_score: number;
  last_categorized_at: string;
}

export interface RolloutMetrics {
  id: string;
  rollout_config_id: string;
  repository_id: string;
  processor_type: 'inngest' | 'github_actions';
  success_count: number;
  error_count: number;
  total_jobs: number;
  average_processing_time: number;
  last_error_message?: string;
  last_error_at?: string;
  metrics_window_start: string;
  metrics_window_end: string;
}

export interface RolloutStats {
  total_repositories: number;
  eligible_repositories: number;
  rollout_percentage: number;
  error_rate: number;
  success_rate: number;
  active_jobs: number;
  categories: Record<string, number>;
  processor_distribution: Record<string, number>;
}

/**
 * HybridRolloutManager - Manages gradual rollout of hybrid progressive capture
 *
 * Features:
 * - Percentage-based and whitelist-based rollout strategies
 * - Repository categorization and prioritization
 * - Automatic rollback on error thresholds
 * - Manual override and emergency stop capabilities
 * - Comprehensive monitoring and metrics
 */
export class HybridRolloutManager {
  private featureName: string;
  private emergencyStopOverride: boolean;

  constructor(featureName: string = 'hybrid_progressive_capture') {
    this.featureName = featureName;
    this.emergencyStopOverride = env.HYBRID_EMERGENCY_STOP === 'true';
  }

  /**
   * Check if a repository is eligible for hybrid progressive capture rollout
   */
  async isRepositoryEligible(repositoryId: string): Promise<boolean> {
    try {
      // Check environment variable override first
      if (this.emergencyStopOverride) {
        console.log(
          '[RolloutManager] Emergency stop active - repository %s not eligible',
          repositoryId,
        );
        return false;
      }

      // Use database function for eligibility check
      const { data, error: _error } = await supabase.rpc('is_repository_eligible_for_rollout', {
        repo_id: repositoryId,
        feature_name: this.featureName,
      });

      if (_error) {
        console.error(`[RolloutManager] Error checking eligibility for ${repositoryId}:`, _error);
        return false;
      }

      return data as boolean;
    } catch (_error) {
      console.error(`[RolloutManager] Exception checking eligibility for ${repositoryId}:`, _error);
      return false;
    }
  }

  /**
   * Get or create repository category
   */
  async categorizeRepository(repositoryId: string): Promise<RepositoryCategory | null> {
    try {
      // Use database function to categorize repository
      const { error: _error } = await supabase.rpc('categorize_repository', {
        repo_id: repositoryId,
      });

      if (_error) {
        console.error(`[RolloutManager] Error categorizing repository ${repositoryId}:`, _error);
        return null;
      }

      // Fetch the categorization result
      const { data: category, error: fetchError } = await supabase
        .from('repository_categories')
        .select('*')
        .eq('repository_id', repositoryId)
        .maybeSingle();

      if (fetchError) {
        console.error(`[RolloutManager] Error fetching category for ${repositoryId}:`, fetchError);
        return null;
      }

      return category as RepositoryCategory;
    } catch (_error) {
      console.error(`[RolloutManager] Exception categorizing repository ${repositoryId}:`, _error);
      return null;
    }
  }

  /**
   * Get current rollout configuration
   */
  async getRolloutConfiguration(): Promise<RolloutConfiguration | null> {
    try {
      const { data, error: _error } = await supabase
        .from('rollout_configuration')
        .select('*')
        .eq('feature_name', this.featureName)
        .eq('is_active', true)
        .maybeSingle();

      if (error && _error.code !== 'PGRST116') {
        // PGRST116 is "not found"
        console.error(`[RolloutManager] Error fetching rollout configuration:`, _error);
        return null;
      }

      return data as RolloutConfiguration;
    } catch (_error) {
      console.error(`[RolloutManager] Exception fetching rollout configuration:`, _error);
      return null;
    }
  }

  /**
   * Update rollout percentage
   */
  async updateRolloutPercentage(
    percentage: number,
    triggeredBy: string = 'manual',
    reason?: string,
  ): Promise<boolean> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.error(`[RolloutManager] No active rollout configuration found`);
        return false;
      }

      const previousPercentage = config.rollout_percentage;

      // Update rollout configuration
      const { error: updateError } = await supabase
        .from('rollout_configuration')
        .update({
          rollout_percentage: percentage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (updateError) {
        console.error(`[RolloutManager] Error updating rollout percentage:`, updateError);
        return false;
      }

      // Log the change in rollout history
      const { error: historyError } = await supabase.from('rollout_history').insert({
        rollout_config_id: config.id,
        action: 'updated',
        previous_percentage: previousPercentage,
        new_percentage: percentage,
        reason:
          reason || `Rollout percentage updated from ${previousPercentage}% to ${percentage}%`,
        triggered_by: triggeredBy,
        metadata: { timestamp: new Date().toISOString() },
      });

      if (historyError) {
        console.error(`[RolloutManager] Error logging rollout history:`, historyError);
      }

      console.log(
        '[RolloutManager] Updated rollout percentage from %s% to %s%',
        previousPercentage,
        percentage,
      );
      return true;
    } catch (_error) {
      console.error(`[RolloutManager] Exception updating rollout percentage:`, _error);
      return false;
    }
  }

  /**
   * Emergency stop - immediately halt rollout
   */
  async emergencyStop(reason: string, triggeredBy: string = 'manual'): Promise<boolean> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.error(`[RolloutManager] No active rollout configuration found`);
        return false;
      }

      // Set emergency stop
      const { error: updateError } = await supabase
        .from('rollout_configuration')
        .update({
          emergency_stop: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (updateError) {
        console.error(`[RolloutManager] Error setting emergency stop:`, updateError);
        return false;
      }

      // Log the emergency stop
      const { error: historyError } = await supabase.from('rollout_history').insert({
        rollout_config_id: config.id,
        action: 'emergency_stop',
        previous_percentage: config.rollout_percentage,
        new_percentage: 0,
        reason,
        triggered_by: triggeredBy,
        metadata: { timestamp: new Date().toISOString() },
      });

      if (historyError) {
        console.error(`[RolloutManager] Error logging emergency stop:`, historyError);
      }

      console.log('[RolloutManager] Emergency stop activated: %s', reason);
      return true;
    } catch (_error) {
      console.error(`[RolloutManager] Exception during emergency stop:`, _error);
      return false;
    }
  }

  /**
   * Add repositories to whitelist
   */
  async addToWhitelist(repositoryIds: string[], reason?: string): Promise<boolean> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.error(`[RolloutManager] No active rollout configuration found`);
        return false;
      }

      const updatedWhitelist = [...new Set([...config.target_repositories, ...repositoryIds])];

      const { error: _error } = await supabase
        .from('rollout_configuration')
        .update({
          target_repositories: updatedWhitelist,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (_error) {
        console.error(`[RolloutManager] Error updating whitelist:`, _error);
        return false;
      }

      // Log the change
      const { error: historyError } = await supabase.from('rollout_history').insert({
        rollout_config_id: config.id,
        action: 'updated',
        reason: reason || `Added ${repositoryIds.length} repositories to whitelist`,
        triggered_by: 'manual',
        metadata: {
          added_repositories: repositoryIds,
          timestamp: new Date().toISOString(),
        },
      });

      if (historyError) {
        console.error(`[RolloutManager] Error logging whitelist update:`, historyError);
      }

      console.log('[RolloutManager] Added %s repositories to whitelist', repositoryIds.length);
      return true;
    } catch (_error) {
      console.error(`[RolloutManager] Exception adding to whitelist:`, _error);
      return false;
    }
  }

  /**
   * Remove repositories from whitelist
   */
  async removeFromWhitelist(repositoryIds: string[], reason?: string): Promise<boolean> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        console.error(`[RolloutManager] No active rollout configuration found`);
        return false;
      }

      const updatedWhitelist = config.target_repositories.filter(
        (id) => !repositoryIds.includes(id),
      );

      const { error: _error } = await supabase
        .from('rollout_configuration')
        .update({
          target_repositories: updatedWhitelist,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (_error) {
        console.error(`[RolloutManager] Error updating whitelist:`, _error);
        return false;
      }

      // Log the change
      const { error: historyError } = await supabase.from('rollout_history').insert({
        rollout_config_id: config.id,
        action: 'updated',
        reason: reason || `Removed ${repositoryIds.length} repositories from whitelist`,
        triggered_by: 'manual',
        metadata: {
          removed_repositories: repositoryIds,
          timestamp: new Date().toISOString(),
        },
      });

      if (historyError) {
        console.error(`[RolloutManager] Error logging whitelist update:`, historyError);
      }

      console.log('[RolloutManager] Removed %s repositories from whitelist', repositoryIds.length);
      return true;
    } catch (_error) {
      console.error(`[RolloutManager] Exception removing from whitelist:`, _error);
      return false;
    }
  }

  /**
   * Record rollout metrics for monitoring
   */
  async recordMetrics(
    repositoryId: string,
    processorType: 'inngest' | 'github_actions',
    success: boolean,
    processingTime?: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        return;
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - config.monitoring_window_hours * 60 * 60 * 1000);

      // Get or create metrics record for this window
      // Check if we have a recent metrics record within the monitoring window
      const { data: existingMetrics, error: fetchError } = await supabase
        .from('rollout_metrics')
        .select('*')
        .eq('rollout_config_id', config.id)
        .eq('repository_id', repositoryId)
        .eq('processor_type', processorType)
        .gte('metrics_window_start', windowStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`[RolloutManager] Error fetching metrics:`, fetchError);
        return;
      }

      if (existingMetrics) {
        // Update existing metrics
        const { error: updateError } = await supabase
          .from('rollout_metrics')
          .update({
            success_count: success
              ? existingMetrics.success_count + 1
              : existingMetrics.success_count,
            error_count: success ? existingMetrics.error_count : existingMetrics.error_count + 1,
            total_jobs: existingMetrics.total_jobs + 1,
            average_processing_time: processingTime
              ? (existingMetrics.average_processing_time * existingMetrics.total_jobs +
                  processingTime) /
                (existingMetrics.total_jobs + 1)
              : existingMetrics.average_processing_time,
            last_error_message: success ? existingMetrics.last_error_message : errorMessage,
            last_error_at: success ? existingMetrics.last_error_at : now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existingMetrics.id);

        if (updateError) {
          console.error(`[RolloutManager] Error updating metrics:`, updateError);
        }
      } else {
        // Create new metrics record
        const { error: insertError } = await supabase.from('rollout_metrics').insert({
          rollout_config_id: config.id,
          repository_id: repositoryId,
          processor_type: processorType,
          success_count: success ? 1 : 0,
          error_count: success ? 0 : 1,
          total_jobs: 1,
          average_processing_time: processingTime || 0,
          last_error_message: success ? null : errorMessage,
          last_error_at: success ? null : now.toISOString(),
          metrics_window_start: windowStart.toISOString(),
          metrics_window_end: now.toISOString(),
        });

        if (insertError) {
          console.error(`[RolloutManager] Error inserting metrics:`, insertError);
        }
      }
    } catch (_error) {
      console.error(`[RolloutManager] Exception recording metrics:`, _error);
    }
  }

  /**
   * Get rollout statistics and health metrics
   */
  async getRolloutStats(): Promise<RolloutStats | null> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config) {
        return null;
      }

      // Get repository categories
      const { data: categories, error: categoryError } = await supabase
        .from('repository_categories')
        .select('category, repository_id');

      if (categoryError) {
        console.error(`[RolloutManager] Error fetching categories:`, categoryError);
        return null;
      }

      // Get metrics for error rate calculation
      const windowStart = new Date(Date.now() - config.monitoring_window_hours * 60 * 60 * 1000);
      const { data: metrics, error: metricsError } = await supabase
        .from('rollout_metrics')
        .select('*')
        .eq('rollout_config_id', config.id)
        .gte('created_at', windowStart.toISOString());

      if (metricsError) {
        console.error(`[RolloutManager] Error fetching metrics:`, metricsError);
        return null;
      }

      // Calculate stats
      const totalRepositories = categories?.length || 0;
      let eligibleRepositories = 0;
      const categoryDistribution: Record<string, number> = {};

      if (categories) {
        for (const category of categories) {
          categoryDistribution[category.category] =
            (categoryDistribution[category.category] || 0) + 1;

          // Check eligibility (simplified for stats)
          if (config.rollout_strategy === 'percentage') {
            // Use hash-based check like in database function
            if (this.hashCode(category.repository_id) % 100 < config.rollout_percentage) {
              eligibleRepositories++;
            }
          } else if (config.rollout_strategy === 'whitelist') {
            if (config.target_repositories.includes(category.repository_id)) {
              eligibleRepositories++;
            }
          }
        }
      }

      const totalJobs = metrics?.reduce((sum, m) => sum + m.total_jobs, 0) || 0;
      const totalErrors = metrics?.reduce((sum, m) => sum + m.error_count, 0) || 0;
      const totalSuccesses = metrics?.reduce((sum, m) => sum + m.success_count, 0) || 0;

      const errorRate = totalJobs > 0 ? (totalErrors / totalJobs) * 100 : 0;
      const successRate = totalJobs > 0 ? (totalSuccesses / totalJobs) * 100 : 0;

      const processorDistribution: Record<string, number> = {};
      if (metrics) {
        for (const metric of metrics) {
          processorDistribution[metric.processor_type] =
            (processorDistribution[metric.processor_type] || 0) + metric.total_jobs;
        }
      }

      return {
        total_repositories: totalRepositories,
        eligible_repositories: eligibleRepositories,
        rollout_percentage: config.rollout_percentage,
        error_rate: errorRate,
        success_rate: successRate,
        active_jobs: totalJobs,
        categories: categoryDistribution,
        processor_distribution: processorDistribution,
      };
    } catch (_error) {
      console.error(`[RolloutManager] Exception getting rollout stats:`, _error);
      return null;
    }
  }

  /**
   * Check if automatic rollback should be triggered
   */
  async checkAndTriggerAutoRollback(): Promise<boolean> {
    try {
      const config = await this.getRolloutConfiguration();
      if (!config || !config.auto_rollback_enabled) {
        return false;
      }

      const stats = await this.getRolloutStats();
      if (!stats) {
        return false;
      }

      // Check if error rate exceeds threshold
      if (stats.error_rate > config.max__error_rate && stats.active_jobs > 10) {
        console.log(
          '[RolloutManager] Error rate %s% exceeds threshold %s%',
          stats._error_rate.toFixed(2),
          config.max_error_rate,
        );

        // Trigger rollback to 0%
        const rollbackSuccess = await this.updateRolloutPercentage(
          0,
          'auto_rollback',
          `Error rate ${stats.error_rate.toFixed(2)}% exceeded threshold ${config.max_error_rate}%`,
        );

        if (rollbackSuccess) {
          console.log(`[RolloutManager] Automatic rollback triggered due to high _error rate`);
          return true;
        }
      }

      return false;
    } catch (_error) {
      console.error(`[RolloutManager] Exception during auto rollback check:`, _error);
      return false;
    }
  }

  /**
   * Simple hash function for consistent repository selection
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const hybridRolloutManager = new HybridRolloutManager();
