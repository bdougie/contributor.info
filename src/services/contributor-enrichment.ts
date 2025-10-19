/**
 * Contributor Enrichment Orchestration Service
 *
 * Orchestrates all enrichment processes:
 * - Persona detection
 * - Quality scoring
 * - Topic clustering
 * - Trend analysis
 */

import { supabase } from '@/lib/supabase';
import { updateContributorPersona } from './persona-detection';
import { updateContributorQualityScores } from './quality-scoring';
import { clusterContributionsByTopic } from './topic-clustering';
import { analyzeTrends } from './trend-analysis';

/**
 * Process complete enrichment for a single contributor
 */
export async function enrichContributor(contributorId: string, workspaceId: string): Promise<void> {
  console.log('[Enrichment] Processing contributor %s in workspace %s', contributorId, workspaceId);

  try {
    // Run all enrichment processes in parallel where possible
    await Promise.all([
      // Persona detection (independent)
      updateContributorPersona(contributorId, workspaceId),

      // Quality scoring (independent)
      updateContributorQualityScores(contributorId, workspaceId),
    ]);

    // Topic clustering needs to run separately as it requires workspace-level data
    // This will be done at the workspace level, not per contributor

    // Trends analysis - get current topics from contributor
    const { data: contributor } = await supabase
      .from('contributors')
      .select('primary_topics')
      .eq('id', contributorId)
      .maybeSingle();

    const currentTopics = (contributor?.primary_topics as string[]) || [];

    // Analyze trends
    const trends = await analyzeTrends(contributorId, workspaceId, currentTopics);

    // Update trends in database
    await supabase.from('contributor_analytics').upsert(
      {
        contributor_id: contributorId,
        workspace_id: workspaceId,
        snapshot_date: new Date().toISOString().split('T')[0],
        contribution_velocity: trends.velocityData,
        topic_shifts: trends.topicShifts,
        engagement_pattern: trends.engagementPattern,
      },
      {
        onConflict: 'contributor_id,workspace_id,snapshot_date',
      }
    );

    // Update last_analytics_update timestamp
    await supabase
      .from('contributors')
      .update({
        last_analytics_update: new Date().toISOString(),
      })
      .eq('id', contributorId);

    console.log('[Enrichment] ✅ Successfully enriched contributor %s', contributorId);
  } catch (error) {
    console.error('[Enrichment] ❌ Error enriching contributor %s:', contributorId, error);
    throw error;
  }
}

/**
 * Process topic clustering for an entire workspace
 * This identifies common technical topics across all contributions
 */
export async function enrichWorkspaceTopics(workspaceId: string): Promise<void> {
  console.log('[Enrichment] Clustering topics for workspace %s', workspaceId);

  try {
    // Run topic clustering
    const topicClusters = await clusterContributionsByTopic(workspaceId, { k: 7 });

    if (topicClusters.length === 0) {
      console.log('[Enrichment] No topic clusters found for workspace %s', workspaceId);
      return;
    }

    console.log('[Enrichment] Found %s topic clusters', topicClusters.length);

    // For each contributor, assign their primary topics based on cluster membership
    for (const cluster of topicClusters) {
      // Get contributors active in this topic
      const contributorUsernames = cluster.topContributors;

      if (contributorUsernames.length === 0) continue;

      // Find contributor IDs
      const { data: contributors } = await supabase
        .from('contributors')
        .select('id, primary_topics, workspace_id')
        .eq('workspace_id', workspaceId)
        .in('username', contributorUsernames);

      if (!contributors || contributors.length === 0) continue;

      // Update each contributor's topics
      for (const contributor of contributors) {
        const existingTopics = (contributor.primary_topics as string[]) || [];
        const newTopics = [...new Set([...existingTopics, cluster.label])];

        // Keep top 5 topics
        const topTopics = newTopics.slice(0, 5);

        await supabase
          .from('contributors')
          .update({
            primary_topics: topTopics,
            topic_confidence: cluster.confidence,
          })
          .eq('id', contributor.id);

        // Also update analytics
        await supabase.from('contributor_analytics').upsert(
          {
            contributor_id: contributor.id,
            workspace_id: workspaceId,
            snapshot_date: new Date().toISOString().split('T')[0],
            primary_topics: topTopics,
            topic_confidence: cluster.confidence,
          },
          {
            onConflict: 'contributor_id,workspace_id,snapshot_date',
          }
        );
      }
    }

    console.log(`[Enrichment] ✅ Successfully enriched workspace topics`);
  } catch (error) {
    console.error(`[Enrichment] ❌ Error enriching workspace topics:`, error);
    throw error;
  }
}

/**
 * Process enrichment for all contributors in a workspace
 */
export async function enrichWorkspace(workspaceId: string): Promise<void> {
  console.log('[Enrichment] Starting enrichment for workspace %s', workspaceId);

  try {
    // Get all contributors in this workspace
    const { data: contributors, error: contributorsError } = await supabase
      .from('contributors')
      .select('id, username')
      .eq('workspace_id', workspaceId);

    if (contributorsError) {
      throw contributorsError;
    }

    if (!contributors || contributors.length === 0) {
      console.log('[Enrichment] No contributors found for workspace %s', workspaceId);
      return;
    }

    console.log('[Enrichment] Processing %s contributors', contributors.length);

    // First, do topic clustering at workspace level
    await enrichWorkspaceTopics(workspaceId);

    // Then enrich each contributor
    // Process in batches of 5 to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < contributors.length; i += batchSize) {
      const batch = contributors.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map((contributor) => enrichContributor(contributor.id, workspaceId))
      );

      console.log(
        '[Enrichment] Processed batch %s/%s',
        Math.floor(i / batchSize) + 1,
        Math.ceil(contributors.length / batchSize)
      );
    }

    console.log('[Enrichment] ✅ Successfully enriched workspace %s', workspaceId);
  } catch (error) {
    console.error('[Enrichment] ❌ Error enriching workspace %s:', workspaceId, error);
    throw error;
  }
}

/**
 * Process enrichment for all active workspaces
 */
export async function enrichAllWorkspaces(): Promise<void> {
  console.log('[Enrichment] Starting enrichment for all workspaces');

  try {
    // Get all workspaces (optionally filter by active status)
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name');

    if (workspacesError) {
      throw workspacesError;
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('[Enrichment] No workspaces found');
      return;
    }

    console.log('[Enrichment] Processing %s workspaces', workspaces.length);

    // Process workspaces sequentially to avoid overwhelming the system
    for (const workspace of workspaces) {
      console.log('[Enrichment] Processing workspace: %s', workspace.name);

      try {
        await enrichWorkspace(workspace.id);
      } catch (error) {
        console.error('[Enrichment] Error enriching workspace %s:', workspace.name, error);
        // Continue with other workspaces
      }
    }

    console.log('[Enrichment] ✅ Successfully enriched all workspaces');
  } catch (error) {
    console.error('[Enrichment] ❌ Error enriching all workspaces:', error);
    throw error;
  }
}
