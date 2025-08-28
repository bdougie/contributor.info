/**
 * Inngest Function: Aggregate Workspace Metrics
 * Background job that aggregates metrics for workspaces on a schedule
 */

import { inngest } from '../client';
import { WorkspaceAggregationService } from '@/services/workspace-aggregation.service';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { cacheInvalidator } from '@/lib/cache/workspace-metrics-cache';
import type { MetricsTimeRange } from '@/types/workspace';
import { getWorkspacePriority } from '@/lib/utils/workspace-priority';

// Event types for workspace metric aggregation
export interface WorkspaceAggregationEvent {
  name: 'workspace.metrics.aggregate';
  data: {
    workspaceId: string;
    timeRange: MetricsTimeRange;
    priority?: number;
    forceRefresh?: boolean;
    triggeredBy?: 'schedule' | 'webhook' | 'manual' | 'dependency';
    triggerMetadata?: Record<string, any>;
  };
}

export interface WorkspaceAggregationScheduledEvent {
  name: 'workspace.metrics.aggregate.scheduled';
  data: {
    tier?: 'free' | 'pro' | 'enterprise';
  };
}

export interface WorkspaceRepositoryChangeEvent {
  name: 'workspace.repository.changed';
  data: {
    workspaceId: string;
    action: 'added' | 'removed';
    repositoryId: string;
    repositoryName: string;
  };
}

/**
 * Main aggregation function - processes a single workspace
 */
export const aggregateWorkspaceMetrics = inngest.createFunction(
  {
    id: 'aggregate-workspace-metrics',
    name: 'Aggregate Workspace Metrics',
    throttle: {
      key: 'event.data.workspaceId',
      limit: 1,
      period: '1m', // Max 1 aggregation per minute per workspace
    },
    retries: 3,
  },
  { event: 'workspace.metrics.aggregate' },
  async ({ event, step }) => {
    const { workspaceId, timeRange, forceRefresh, triggeredBy } = event.data;

    // Step 1: Check if workspace exists and is active
    const workspace = await step.run('check-workspace', async () => {
      const supabaseAdmin = createSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from('workspaces')
        .select('id, name, tier, is_active')
        .eq('id', workspaceId)
        .single();

      if (error || !data) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      if (!data.is_active) {
        throw new Error(`Workspace is not active: ${workspaceId}`);
      }

      return data;
    });

    // Step 2: Add to aggregation queue
    const queueEntry = await step.run('queue-aggregation', async () => {
      const priority = event.data.priority || getWorkspacePriority(workspace.tier);

      const supabaseAdmin = createSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from('workspace_aggregation_queue')
        .insert({
          workspace_id: workspaceId,
          time_range: timeRange,
          priority,
          status: 'processing',
          started_at: new Date().toISOString(),
          triggered_by: triggeredBy || 'manual',
          trigger_metadata: event.data.triggerMetadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create queue entry:', error);
      }

      return data;
    });

    // Step 3: Perform aggregation
    const result = await step.run('perform-aggregation', async () => {
      const service = new WorkspaceAggregationService();

      try {
        const aggregationResult = await service.aggregateWorkspaceMetrics(workspaceId, {
          timeRange,
          forceRefresh: forceRefresh || false,
          includeRepositoryStats: true,
        });

        return {
          success: true,
          cacheHit: aggregationResult.cacheHit,
          calculationTimeMs: aggregationResult.calculationTimeMs,
          githubApiCalls: aggregationResult.githubApiCalls,
          metrics: aggregationResult.metrics,
        };
      } catch (error) {
        console.error('Aggregation failed:', error);
        throw error;
      }
    });

    // Step 4: Update queue status
    await step.run('update-queue-status', async () => {
      if (queueEntry) {
        const updateData = result.success
          ? {
              status: 'completed',
              completed_at: new Date().toISOString(),
            }
          : {
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_message: 'Aggregation failed',
            };

        const supabaseAdmin = createSupabaseAdmin();
        await supabaseAdmin
          .from('workspace_aggregation_queue')
          .update(updateData)
          .eq('id', queueEntry.id);
      }
    });

    // Step 5: Trigger dependent aggregations (other time ranges)
    if (result.success && timeRange === '30d' && !forceRefresh) {
      await step.run('trigger-dependent-aggregations', async () => {
        const otherTimeRanges: MetricsTimeRange[] = ['7d', '90d'];

        // Trigger aggregation for other time ranges
        await Promise.all(
          otherTimeRanges.map((range) =>
            inngest.send({
              name: 'workspace.metrics.aggregate',
              data: {
                workspaceId,
                timeRange: range,
                priority: event.data.priority,
                triggeredBy: 'dependency',
                triggerMetadata: {
                  parentTimeRange: timeRange,
                  parentTriggeredBy: triggeredBy,
                },
              },
            })
          )
        );
      });
    }

    return {
      workspaceId,
      workspaceName: workspace.name,
      timeRange,
      success: result.success,
      cacheHit: result.cacheHit,
      calculationTimeMs: result.calculationTimeMs,
      githubApiCalls: result.githubApiCalls,
    };
  }
);

/**
 * Scheduled aggregation - runs every 5 minutes for all active workspaces
 */
export const scheduledWorkspaceAggregation = inngest.createFunction(
  {
    id: 'scheduled-workspace-aggregation',
    name: 'Scheduled Workspace Aggregation',
  },
  {
    cron: '*/5 * * * *', // Every 5 minutes
  },
  async ({ step }) => {
    // Step 1: Get all active workspaces
    const workspaces = await step.run('get-active-workspaces', async () => {
      const supabaseAdmin = createSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from('workspaces')
        .select('id, name, tier')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to fetch workspaces: ${error.message}`);
      }

      return data || [];
    });

    // Step 2: Check which workspaces need aggregation
    const workspacesToAggregate = await step.run('check-aggregation-needed', async () => {
      const needsAggregation = [];

      const supabaseAdmin = createSupabaseAdmin();
      for (const workspace of workspaces) {
        // Check if there's already a pending/processing job
        const { data: existingJob } = await supabaseAdmin
          .from('workspace_aggregation_queue')
          .select('id')
          .eq('workspace_id', workspace.id)
          .eq('time_range', '30d')
          .in('status', ['pending', 'processing'])
          .single();

        if (!existingJob) {
          // Check if cache is stale or expired
          const { data: cache } = await supabaseAdmin
            .from('workspace_metrics_cache')
            .select('expires_at, is_stale')
            .eq('workspace_id', workspace.id)
            .eq('time_range', '30d')
            .single();

          const needsUpdate = !cache || cache.is_stale || new Date(cache.expires_at) < new Date();

          if (needsUpdate) {
            needsAggregation.push(workspace);
          }
        }
      }

      return needsAggregation;
    });

    // Step 3: Trigger aggregation for workspaces that need it
    const triggered = await step.run('trigger-aggregations', async () => {
      const events = workspacesToAggregate.map((workspace) => ({
        name: 'workspace.metrics.aggregate' as const,
        data: {
          workspaceId: workspace.id,
          timeRange: '30d' as MetricsTimeRange,
          priority: getWorkspacePriority(workspace.tier),
          triggeredBy: 'schedule' as const,
        },
      }));

      if (events.length > 0) {
        await inngest.send(events);
      }

      return events.length;
    });

    return {
      totalWorkspaces: workspaces.length,
      workspacesNeedingUpdate: workspacesToAggregate.length,
      aggregationsTriggered: triggered,
    };
  }
);

/**
 * Handle repository changes - invalidate cache and trigger re-aggregation
 */
export const handleWorkspaceRepositoryChange = inngest.createFunction(
  {
    id: 'handle-workspace-repository-change',
    name: 'Handle Workspace Repository Change',
    debounce: {
      key: 'event.data.workspaceId',
      period: '30s', // Debounce rapid changes
    },
  },
  { event: 'workspace.repository.changed' },
  async ({ event, step }) => {
    const { workspaceId, action, repositoryId, repositoryName } = event.data;

    // Step 1: Invalidate cache
    await step.run('invalidate-cache', async () => {
      // Mark all time ranges as stale in database
      const supabaseAdmin = createSupabaseAdmin();
      await supabaseAdmin.rpc('mark_workspace_cache_stale', {
        p_workspace_id: workspaceId,
      });

      // Invalidate in-memory cache
      cacheInvalidator.onDataUpdate(workspaceId);

      return { invalidated: true };
    });

    // Step 2: Log the change
    await step.run('log-change', async () => {
      console.log(
        `Workspace ${workspaceId}: Repository ${action} - ${repositoryName} (${repositoryId})`
      );

      // Could also log to a separate audit table if needed
      return { logged: true };
    });

    // Step 3: Trigger re-aggregation with high priority
    await step.run('trigger-reaggregation', async () => {
      await inngest.send({
        name: 'workspace.metrics.aggregate',
        data: {
          workspaceId,
          timeRange: '30d',
          priority: 1, // High priority for user-triggered changes
          forceRefresh: true,
          triggeredBy: 'webhook',
          triggerMetadata: {
            action,
            repositoryId,
            repositoryName,
          },
        },
      });

      return { triggered: true };
    });

    return {
      workspaceId,
      action,
      repositoryName,
      cacheInvalidated: true,
      aggregationTriggered: true,
    };
  }
);

/**
 * Clean up old cache entries and queue items
 */
export const cleanupWorkspaceMetricsData = inngest.createFunction(
  {
    id: 'cleanup-workspace-metrics-data',
    name: 'Cleanup Workspace Metrics Data',
  },
  {
    cron: '0 3 * * *', // Daily at 3 AM
  },
  async ({ step }) => {
    // Step 1: Clean up expired cache entries
    const cacheCleanup = await step.run('cleanup-cache', async () => {
      const supabaseAdmin = createSupabaseAdmin();
      const { data, error } = await supabaseAdmin.rpc('cleanup_expired_workspace_cache');

      if (error) {
        console.error('Cache cleanup failed:', error);
        return { deleted: 0 };
      }

      return { deleted: data || 0 };
    });

    // Step 2: Clean up old queue entries
    const queueCleanup = await step.run('cleanup-queue', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep 7 days of history

      const supabaseAdmin = createSupabaseAdmin();
      const { error, count } = await supabaseAdmin
        .from('workspace_aggregation_queue')
        .delete()
        .in('status', ['completed', 'failed'])
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        console.error('Queue cleanup failed:', error);
        return { deleted: 0 };
      }

      return { deleted: count || 0 };
    });

    // Step 3: Clean up old metrics history (based on tier retention)
    const historyCleanup = await step.run('cleanup-history', async () => {
      // Get workspaces with their retention settings
      const supabaseAdmin = createSupabaseAdmin();
      const { data: workspaces } = await supabaseAdmin
        .from('workspaces')
        .select('id, data_retention_days');

      if (!workspaces) return { deleted: 0 };

      let totalDeleted = 0;

      for (const workspace of workspaces) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - workspace.data_retention_days);

        const { count } = await supabaseAdmin
          .from('workspace_metrics_history')
          .delete()
          .eq('workspace_id', workspace.id)
          .lt('metric_date', cutoffDate.toISOString().split('T')[0]);

        totalDeleted += count || 0;
      }

      return { deleted: totalDeleted };
    });

    return {
      cacheEntriesDeleted: cacheCleanup.deleted,
      queueEntriesDeleted: queueCleanup.deleted,
      historyEntriesDeleted: historyCleanup.deleted,
    };
  }
);

// Export all functions
export const workspaceMetricsFunctions = [
  aggregateWorkspaceMetrics,
  scheduledWorkspaceAggregation,
  handleWorkspaceRepositoryChange,
  cleanupWorkspaceMetricsData,
];
