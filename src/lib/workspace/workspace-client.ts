/**
 * Workspace Supabase Client Functions
 * Helper functions for workspace database operations
 */

import { supabase } from '@/lib/supabase';
import { workspaceMetricsCache } from '@/lib/cache/workspace-metrics-cache';
import type {
  WorkspaceWithStats,
  WorkspaceMetrics,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddRepositoryRequest,
  InviteMemberRequest,
  WorkspaceFilters,
  WorkspaceRepositoryFilters,
  MetricsTimeRange,
  WorkspaceRole,
} from '@/types/workspace';

// =====================================================
// WORKSPACE CRUD OPERATIONS
// =====================================================

/**
 * Create a new workspace
 */
export async function createWorkspace(data: CreateWorkspaceRequest) {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) {
    throw new Error('User not authenticated');
  }

  // Generate slug from name
  const { data: slugData, error: slugError } = await supabase.rpc('generate_workspace_slug', {
    workspace_name: data.name,
  });

  if (slugError) {
    throw new Error('Failed to generate workspace slug');
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      name: data.name,
      slug: slugData,
      description: data.description || null,
      owner_id: user.user.id,
      visibility: data.visibility || 'public',
      settings: data.settings || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create workspace: ${error.message}`);
  }

  // Automatically add owner as a member
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.user.id,
    role: 'owner',
    accepted_at: new Date().toISOString(),
  });

  if (memberError) {
    // Clean up the workspace if membership creation fails
    await supabase.from('workspaces').delete().eq('id', workspace.id);

    throw new Error(`Failed to create workspace membership: ${memberError.message}`);
  }

  return workspace;
}

/**
 * Get workspace by ID or slug
 */
export async function getWorkspace(idOrSlug: string): Promise<WorkspaceWithStats | null> {
  // First try to get the workspace
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  const query = supabase
    .from('workspaces')
    .select(
      `
      *,
      owner:owner_id(id, email, raw_user_meta_data),
      workspace_repositories(count),
      workspace_members(count)
    `
    )
    .eq('is_active', true);

  if (isUuid) {
    query.eq('id', idOrSlug);
  } else {
    query.eq('slug', idOrSlug);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  // Get aggregated stats
  const { data: stats } = await supabase
    .from('workspace_repositories')
    .select(
      `
      repository:repositories(
        stargazers_count,
        contributors(count)
      )
    `
    )
    .eq('workspace_id', data.id);

  const total_stars =
    stats?.reduce((sum, item: any) => sum + (item.repository?.stargazers_count || 0), 0) || 0;

  const total_contributors =
    stats?.reduce((sum, item: any) => sum + (item.repository?.contributors?.[0]?.count || 0), 0) ||
    0;

  return {
    ...data,
    repository_count: (data as any).workspace_repositories[0]?.count || 0,
    member_count: (data as any).workspace_members[0]?.count || 0,
    total_stars,
    total_contributors,
    owner: {
      id: (data as any).owner.id,
      email: (data as any).owner.email,
      avatar_url: (data as any).owner.raw_user_meta_data?.avatar_url,
      display_name: (data as any).owner.raw_user_meta_data?.full_name,
    },
  } as WorkspaceWithStats;
}

/**
 * Update workspace
 */
export async function updateWorkspace(id: string, data: UpdateWorkspaceRequest) {
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .update({
      name: data.name,
      description: data.description,
      visibility: data.visibility,
      settings: data.settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update workspace: ${error.message}`);
  }

  return workspace;
}

/**
 * Delete workspace (soft delete)
 */
export async function deleteWorkspace(id: string) {
  const { error } = await supabase.from('workspaces').update({ is_active: false }).eq('id', id);

  if (error) {
    throw new Error(`Failed to delete workspace: ${error.message}`);
  }
}

/**
 * List workspaces with filters
 */
export async function listWorkspaces(filters: WorkspaceFilters = {}) {
  const { data: user } = await supabase.auth.getUser();

  let query = supabase
    .from('workspaces')
    .select(
      `
      *,
      workspace_repositories(count),
      workspace_members(count)
    `
    )
    .eq('is_active', true);

  // Apply filters
  if (filters.visibility) {
    query = query.eq('visibility', filters.visibility);
  }

  if (filters.owned_by_me && user?.user) {
    query = query.eq('owner_id', user.user.id);
  }

  if (filters.member_of && user?.user) {
    query = query.or(`owner_id.eq.${user.user.id},workspace_members.user_id.eq.${user.user.id}`);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  // Apply sorting
  const sortBy = filters.sort_by || 'created_at';
  const sortOrder = filters.sort_order || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list workspaces: ${error.message}`);
  }

  return data || [];
}

// =====================================================
// REPOSITORY MANAGEMENT
// =====================================================

/**
 * Add repository to workspace
 */
export async function addRepositoryToWorkspace(workspaceId: string, data: AddRepositoryRequest) {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) {
    throw new Error('User not authenticated');
  }

  const { data: repo, error } = await supabase
    .from('workspace_repositories')
    .insert({
      workspace_id: workspaceId,
      repository_id: data.repository_id,
      added_by: user.user.id,
      notes: data.notes || null,
      tags: data.tags || [],
      is_pinned: data.is_pinned || false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique violation
      throw new Error('Repository already exists in this workspace');
    }
    throw new Error(`Failed to add repository: ${error.message}`);
  }

  return repo;
}

/**
 * Remove repository from workspace
 */
export async function removeRepositoryFromWorkspace(workspaceId: string, repositoryId: string) {
  const { error } = await supabase
    .from('workspace_repositories')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('repository_id', repositoryId);

  if (error) {
    throw new Error(`Failed to remove repository: ${error.message}`);
  }
}

/**
 * List repositories in workspace
 */
export async function listWorkspaceRepositories(
  workspaceId: string,
  filters: WorkspaceRepositoryFilters = {}
) {
  let query = supabase
    .from('workspace_repositories')
    .select(
      `
      *,
      repository:repositories(*)
    `
    )
    .eq('workspace_id', workspaceId);

  // Apply filters
  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  if (filters.is_pinned !== undefined) {
    query = query.eq('is_pinned', filters.is_pinned);
  }

  if (filters.search) {
    // Escape special characters to prevent PostgREST injection
    const escapedSearch = filters.search.replace(/[%_\\]/g, '\\$&');
    query = query.or(
      `repository.name.ilike.%${escapedSearch}%,repository.description.ilike.%${escapedSearch}%`
    );
  }

  if (filters.language) {
    query = query.eq('repository.language', filters.language);
  }

  // Apply sorting
  const sortBy = filters.sort_by || 'added_at';
  const sortOrder = filters.sort_order || 'desc';

  if (sortBy === 'name') {
    query = query.order('repository.name', { ascending: sortOrder === 'asc' });
  } else if (sortBy === 'stars') {
    query = query.order('repository.stargazers_count', { ascending: sortOrder === 'asc' });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list repositories: ${error.message}`);
  }

  return data || [];
}

// =====================================================
// MEMBER MANAGEMENT
// =====================================================

/**
 * Invite member to workspace
 */
export async function inviteMemberToWorkspace(workspaceId: string, data: InviteMemberRequest) {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) {
    throw new Error('User not authenticated');
  }

  const { data: invitation, error } = await supabase
    .from('workspace_invitations')
    .insert({
      workspace_id: workspaceId,
      email: data.email,
      role: data.role,
      invited_by: user.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique violation
      throw new Error('An invitation for this email already exists');
    }
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return invitation;
}

/**
 * Accept workspace invitation
 */
export async function acceptInvitation(invitationToken: string) {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) {
    throw new Error('User not authenticated');
  }

  // Get invitation
  const { data: invitation, error: invError } = await supabase
    .from('workspace_invitations')
    .select('*')
    .eq('invitation_token', invitationToken)
    .eq('status', 'pending')
    .single();

  if (invError || !invitation) {
    throw new Error('Invalid or expired invitation');
  }

  // Start transaction
  const { error: updateError } = await supabase
    .from('workspace_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  if (updateError) {
    throw new Error('Failed to accept invitation');
  }

  // Add user as member
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: invitation.workspace_id,
      user_id: user.user.id,
      role: invitation.role,
      invited_by: invitation.invited_by,
      invited_at: invitation.invited_at,
      accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (memberError) {
    throw new Error('Failed to add member to workspace');
  }

  return member;
}

/**
 * List workspace members
 */
export async function listWorkspaceMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(
      `
      *,
      user:user_id(id, email, raw_user_meta_data),
      invited_by_user:invited_by(id, email, raw_user_meta_data)
    `
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list members: ${error.message}`);
  }

  return data || [];
}

/**
 * Update member role
 */
export async function updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole) {
  if (role === 'owner') {
    throw new Error('Cannot assign owner role through this method');
  }

  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`);
  }
}

/**
 * Remove member from workspace
 */
export async function removeMemberFromWorkspace(workspaceId: string, userId: string) {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}

// =====================================================
// METRICS AND ANALYTICS
// =====================================================

/**
 * Get user's role in workspace
 */
export async function getUserWorkspaceRole(workspaceId: string): Promise<WorkspaceRole | null> {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) {
    return null;
  }

  // Check if owner
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();

  if (workspace?.owner_id === user.user.id) {
    return 'owner';
  }

  // Check member role
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.user.id)
    .single();

  return member?.role || null;
}

/**
 * Check if user can access workspace
 */
export async function canAccessWorkspace(workspaceId: string): Promise<boolean> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('visibility')
    .eq('id', workspaceId)
    .single();

  if (workspace?.visibility === 'public') {
    return true;
  }

  const role = await getUserWorkspaceRole(workspaceId);
  return role !== null;
}

// =====================================================
// WORKSPACE METRICS OPERATIONS
// =====================================================

/**
 * Get workspace metrics with cache-first strategy
 */
export async function getWorkspaceMetrics(
  workspaceId: string,
  timeRange: MetricsTimeRange = '30d',
  forceRefresh = false
): Promise<WorkspaceMetrics | null> {
  try {
    // Check in-memory cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedMetrics = workspaceMetricsCache.get(workspaceId, timeRange);
      if (cachedMetrics && !cachedMetrics.is_stale) {
        return cachedMetrics;
      }
    }

    // Query database cache
    const { data, error } = await supabase
      .from('workspace_metrics_cache')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('time_range', timeRange)
      .single();

    if (error) {
      console.error('Error fetching workspace metrics:', error);

      // If cache miss, trigger aggregation in background
      await triggerMetricsAggregation(workspaceId, timeRange);
      return null;
    }

    // Transform database format to TypeScript format
    const metrics: WorkspaceMetrics = {
      id: data.id,
      workspace_id: data.workspace_id,
      period_start: data.period_start,
      period_end: data.period_end,
      time_range: data.time_range,
      metrics: {
        total_prs: data.total_prs,
        merged_prs: data.merged_prs,
        open_prs: data.open_prs,
        draft_prs: data.draft_prs,
        total_issues: data.total_issues,
        closed_issues: data.closed_issues,
        open_issues: data.open_issues,
        total_contributors: data.total_contributors,
        active_contributors: data.active_contributors,
        new_contributors: data.new_contributors,
        total_commits: data.total_commits,
        total_stars: data.total_stars,
        total_forks: data.total_forks,
        total_watchers: data.total_watchers,
        avg_pr_merge_time_hours: data.avg_pr_merge_time_hours,
        pr_velocity: data.pr_velocity,
        issue_closure_rate: data.issue_closure_rate,
        languages: data.language_distribution || {},
        top_contributors: data.top_contributors || [],
        activity_timeline: data.activity_timeline || [],
        repository_stats: data.repository_stats,
      },
      calculated_at: data.calculated_at,
      expires_at: data.expires_at,
      is_stale: data.is_stale,
    };

    // Update in-memory cache
    if (!data.is_stale) {
      workspaceMetricsCache.set(workspaceId, timeRange, metrics);
    }

    // If stale, trigger background refresh
    if (data.is_stale && !forceRefresh) {
      await triggerMetricsAggregation(workspaceId, timeRange);
    }

    return metrics;
  } catch (error) {
    console.error('Failed to get workspace metrics:', error);
    return null;
  }
}

/**
 * Get workspace trend data for charts
 */
export async function getWorkspaceTrendData(
  workspaceId: string,
  timeRange: MetricsTimeRange = '30d'
) {
  const metrics = await getWorkspaceMetrics(workspaceId, timeRange);

  if (!metrics?.metrics.activity_timeline) {
    return null;
  }

  // Transform activity timeline into chart-friendly format
  const timeline = metrics.metrics.activity_timeline;
  const labels = timeline.map((point) => {
    const date = new Date(point.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return {
    labels,
    datasets: [
      {
        label: 'Pull Requests',
        data: timeline.map((p) => p.prs),
        color: '#10b981',
      },
      {
        label: 'Issues',
        data: timeline.map((p) => p.issues),
        color: '#f97316',
      },
      {
        label: 'Commits',
        data: timeline.map((p) => p.commits),
        color: '#8b5cf6',
      },
    ],
  };
}

/**
 * Trigger metrics aggregation via API
 */
async function triggerMetricsAggregation(
  workspaceId: string,
  timeRange: MetricsTimeRange
): Promise<void> {
  try {
    // Call the API endpoint to trigger aggregation
    const response = await fetch('/api/workspaces/metrics/aggregate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        timeRange,
        priority: 50,
      }),
    });

    if (!response.ok) {
      console.error('Failed to trigger metrics aggregation:', response.statusText);
    }
  } catch (error) {
    console.error('Error triggering metrics aggregation:', error);
  }
}

/**
 * Invalidate metrics cache when data changes
 */
export async function invalidateWorkspaceMetrics(workspaceId: string): Promise<void> {
  // Invalidate in-memory cache
  workspaceMetricsCache.invalidate(workspaceId);

  // Mark database cache as stale
  const { error } = await supabase.rpc('mark_workspace_cache_stale', {
    p_workspace_id: workspaceId,
  });

  if (error) {
    console.error('Failed to invalidate workspace metrics:', error);
  }

  // Trigger re-aggregation for default time range
  await triggerMetricsAggregation(workspaceId, '30d');
}

/**
 * Get multiple time ranges at once for a workspace
 */
export async function getWorkspaceMetricsMultiple(
  workspaceId: string,
  timeRanges: MetricsTimeRange[]
): Promise<Map<MetricsTimeRange, WorkspaceMetrics | null>> {
  const results = new Map<MetricsTimeRange, WorkspaceMetrics | null>();

  // Fetch all time ranges in parallel
  const promises = timeRanges.map(async (timeRange) => {
    const metrics = await getWorkspaceMetrics(workspaceId, timeRange);
    return { timeRange, metrics };
  });

  const allResults = await Promise.all(promises);

  allResults.forEach(({ timeRange, metrics }) => {
    results.set(timeRange, metrics);
  });

  return results;
}

/**
 * Warm cache for a workspace
 */
export async function warmWorkspaceCache(workspaceId: string): Promise<void> {
  const timeRanges: MetricsTimeRange[] = ['7d', '30d', '90d'];

  // Trigger aggregation for all time ranges
  await Promise.all(
    timeRanges.map((timeRange) => triggerMetricsAggregation(workspaceId, timeRange))
  );
}
