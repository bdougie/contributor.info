import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

// Types for Supabase query results
type WorkspaceWithMember = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  workspace_members: Array<{
    user_id: string;
    role: string;
  }>;
};

type RepositoryWithWorkspace = {
  id: string;
  is_pinned: boolean;
  repositories: {
    id: string;
    full_name: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    github_pushed_at: string | null;
    pull_request_count: number | null;
  };
};

type UserMetadata = {
  raw_user_meta_data: {
    avatar_url?: string;
    full_name?: string;
    name?: string;
  } | null;
};

export interface UseUserWorkspacesReturn {
  workspaces: WorkspacePreviewData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch workspaces for the current authenticated user
 * Returns user's workspaces with repository preview data
 */
export function useUserWorkspaces(): UseUserWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<WorkspacePreviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setWorkspaces([]);
        return;
      }

      // Fetch workspaces where user is owner or member
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select(`
          id,
          name,
          slug,
          description,
          owner_id,
          created_at,
          workspace_members!inner(
            user_id,
            role
          )
        `)
        .eq('workspace_members.user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .returns<WorkspaceWithMember[]>();

      if (workspaceError) {
        throw new Error(`Failed to fetch workspaces: ${workspaceError.message}`);
      }

      if (!workspaceData || workspaceData.length === 0) {
        setWorkspaces([]);
        return;
      }

      // Fetch additional data for each workspace
      const enrichedWorkspaces = await Promise.all(
        workspaceData.map(async (workspace) => {
          // Get repository count and member count
          const [repositoriesResult, membersResult, ownerResult] = await Promise.all([
            supabase
              .from('workspace_repositories')
              .select(`
                id,
                is_pinned,
                repositories!inner(
                  id,
                  full_name,
                  name,
                  owner,
                  description,
                  language,
                  github_pushed_at,
                  pull_request_count
                )
              `)
              .eq('workspace_id', workspace.id)
              .order('is_pinned', { ascending: false })
              .order('repositories.github_pushed_at', { ascending: false })
              .limit(3)
              .returns<RepositoryWithWorkspace[]>(),
            
            supabase
              .from('workspace_members')
              .select('id')
              .eq('workspace_id', workspace.id),
              
            supabase
              .from('auth.users')
              .select('raw_user_meta_data')
              .eq('id', workspace.owner_id)
              .single()
              .returns<UserMetadata>()
          ]);

          // Check for errors in individual queries
          if (repositoriesResult.error) {
            console.warn(`Failed to fetch repositories for workspace ${workspace.id}:`, repositoriesResult.error.message);
          }
          if (membersResult.error) {
            console.warn(`Failed to fetch members for workspace ${workspace.id}:`, membersResult.error.message);
          }
          if (ownerResult.error) {
            console.warn(`Failed to fetch owner info for workspace ${workspace.id}:`, ownerResult.error.message);
          }

          const repositories = repositoriesResult.data?.map(item => ({
            id: item.repositories.id,
            full_name: item.repositories.full_name,
            name: item.repositories.name,
            owner: item.repositories.owner,
            description: item.repositories.description,
            language: item.repositories.language,
            activity_score: item.repositories.pull_request_count || 0,
            last_activity: item.repositories.github_pushed_at || new Date().toISOString(),
            avatar_url: `https://github.com/${item.repositories.owner}.png`,
            html_url: `https://github.com/${item.repositories.full_name}`,
          })) || [];

          const ownerMetadata = ownerResult.data?.raw_user_meta_data;

          return {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
            owner: {
              id: workspace.owner_id,
              avatar_url: ownerMetadata?.avatar_url,
              display_name: ownerMetadata?.full_name || ownerMetadata?.name,
            },
            repository_count: repositoriesResult.data?.length || 0,
            member_count: membersResult.data?.length || 0,
            repositories,
            created_at: workspace.created_at,
          } as WorkspacePreviewData;
        })
      );

      setWorkspaces(enrichedWorkspaces);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workspaces';
      setError(new Error(errorMessage));
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserWorkspaces();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        await fetchUserWorkspaces();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    workspaces,
    loading,
    error,
    refetch: fetchUserWorkspaces,
  };
}

/**
 * Hook to get the user's primary workspace (first one)
 * Useful for showing a single workspace preview on homepage
 */
export function usePrimaryWorkspace() {
  const { workspaces, loading, error, refetch } = useUserWorkspaces();

  return {
    workspace: workspaces[0] || null,
    hasWorkspace: workspaces.length > 0,
    loading,
    error,
    refetch,
  };
}