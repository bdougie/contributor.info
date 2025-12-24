import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase-lazy';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ContributorRole {
  id: string;
  user_id: string;
  repository_owner: string;
  repository_name: string;
  role: 'owner' | 'maintainer' | 'contributor' | 'bot';
  confidence_score: number;
  detected_at: string;
  last_verified: string;
  detection_methods: string[];
  permission_events_count: number;
}

export interface ContributorRoleWithStats extends ContributorRole {
  is_bot?: boolean;
  activity_level?: 'high' | 'medium' | 'low';
  days_since_last_active?: number;
}

interface UseContributorRolesOptions {
  enableRealtime?: boolean;
  minimumConfidence?: number;
}

export function useContributorRoles(
  owner: string,
  repo: string,
  options: UseContributorRolesOptions = {}
) {
  const { enableRealtime = false, minimumConfidence = 0 } = options;
  const queryClient = useQueryClient();
  // Include minimumConfidence in the key so changing it triggers a refetch with the new filter
  const queryKey = useMemo(
    () => ['contributor-roles', owner, repo, minimumConfidence],
    [owner, repo, minimumConfidence]
  );

  const {
    data: roles = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const supabase = await getSupabase();
      let query = supabase
        .from('contributor_roles')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .order('confidence_score', { ascending: false });

      if (minimumConfidence > 0) {
        query = query.gte('confidence_score', minimumConfidence);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Enhance with additional computed properties
      return (data || []).map((role) => ({
        ...role,
        is_bot: checkIfBot(role.user_id),
        activity_level: getActivityLevel(role.permission_events_count),
        days_since_last_active: getDaysSinceLastActive(role.last_verified),
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!owner && !!repo,
  });

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime || !owner || !repo) return;

    let channel: RealtimeChannel | null = null;

    getSupabase().then((supabase) => {
      channel = supabase
        .channel(`roles:${owner}/${repo}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contributor_roles',
            filter: `repository_owner=eq.${owner}&repository_name=eq.${repo}`,
          },
          (payload) => {
            queryClient.setQueryData(
              queryKey,
              (oldRoles: ContributorRoleWithStats[] | undefined) => {
                const currentRoles = oldRoles || [];

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const newRole = payload.new as ContributorRole;

                  // Check confidence threshold
                  if (minimumConfidence > 0 && newRole.confidence_score < minimumConfidence) {
                    // Remove if it doesn't meet threshold anymore
                    return currentRoles.filter((r) => r.id !== newRole.id);
                  }

                  const enhancedRole: ContributorRoleWithStats = {
                    ...newRole,
                    is_bot: checkIfBot(newRole.user_id),
                    activity_level: getActivityLevel(newRole.permission_events_count),
                    days_since_last_active: getDaysSinceLastActive(newRole.last_verified),
                  };

                  const filtered = currentRoles.filter((r) => r.id !== enhancedRole.id);
                  return [...filtered, enhancedRole].sort(
                    (a, b) => b.confidence_score - a.confidence_score
                  );
                } else if (payload.eventType === 'DELETE') {
                  return currentRoles.filter((r) => r.id !== payload.old.id);
                }
                return currentRoles;
              }
            );
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        getSupabase().then((sb) => sb.removeChannel(channel!));
      }
    };
  }, [owner, repo, enableRealtime, minimumConfidence, queryClient, queryKey]);

  return { roles, loading, error: error as Error | null };
}

// Helper function to check if user is a bot
function checkIfBot(userId: string): boolean {
  const botPatterns = [/\[bot\]$/i, /^dependabot/i, /^renovate/i, /^greenkeeper/i, /-bot$/i];
  return botPatterns.some((pattern) => pattern.test(userId));
}

// Helper function to determine activity level
function getActivityLevel(eventCount: number): 'high' | 'medium' | 'low' {
  if (eventCount >= 20) return 'high';
  if (eventCount >= 5) return 'medium';
  return 'low';
}

// Helper function to calculate days since last active
function getDaysSinceLastActive(lastVerified: string): number {
  const now = new Date();
  const lastActive = new Date(lastVerified);
  const diffTime = Math.abs(now.getTime() - lastActive.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Hook to get role for a specific contributor
export function useContributorRole(owner: string, repo: string, userId: string) {
  const { roles, loading, error } = useContributorRoles(owner, repo);
  const role = roles.find((r) => r.user_id === userId);

  return { role, loading, error };
}

// Hook to get role statistics
export function useRoleStatistics(owner: string, repo: string) {
  const { roles, loading, error } = useContributorRoles(owner, repo);

  const stats = {
    total: roles.length,
    owners: roles.filter((r) => r.role === 'owner').length,
    maintainers: roles.filter((r) => r.role === 'maintainer').length,
    contributors: roles.filter((r) => r.role === 'contributor').length,
    bots: roles.filter((r) => r.role === 'bot').length,
    highConfidence: roles.filter((r) => r.confidence_score >= 0.8).length,
    activeInLast7Days: roles.filter((r) => (r.days_since_last_active || 0) <= 7).length,
  };

  return { stats, loading, error };
}
