import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Repository } from '@/components/features/workspace';
import { getFallbackAvatar } from '@/lib/utils/avatar';

/**
 * Query keys for workspace repository queries
 */
export const workspaceRepositoryKeys = {
  all: ['workspace-repositories'] as const,
  byWorkspace: (workspaceId: string) => 
    [...workspaceRepositoryKeys.all, workspaceId] as const,
};

interface WorkspaceRepository {
  id: string;
  is_pinned: boolean;
  repositories: {
    id: string;
    full_name: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    avatar_url: string | null;
  };
}

/**
 * Hook to fetch workspace repositories with automatic deduplication
 * 
 * This replaces direct Supabase queries to prevent redundant fetches
 * that were causing 4x "Fetched workspace repositories" logs.
 * 
 * @param workspaceId - The workspace ID to fetch repositories for
 * @see https://github.com/bdougie/contributor.info/issues/1188
 */
export function useWorkspaceRepositoriesQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceRepositoryKeys.byWorkspace(workspaceId || ''),
    queryFn: async (): Promise<Repository[]> => {
      if (!workspaceId) {
        return [];
      }
      
      logger.debug('[Workspace Repositories Query] Fetching repositories for workspace:', workspaceId);
      
      const { data: repoData, error: repoError } = await supabase
        .from('workspace_repositories')
        .select(
          `
            *,
            repositories (
              id,
              full_name,
              name,
              owner,
              description,
              language,
              stargazers_count,
              forks_count,
              open_issues_count,
              avatar_url
            )
          `
        )
        .eq('workspace_id', workspaceId);
      
      if (repoError) {
        logger.error('[Workspace Repositories Query] Error fetching repositories:', repoError);
        throw new Error(`Failed to fetch repositories: ${repoError.message}`);
      }
      
      // Transform repository data to match the Repository interface
      const transformedRepos: Repository[] = (repoData || [])
        .filter((r: WorkspaceRepository) => r.repositories)
        .map((r: WorkspaceRepository) => ({
          id: r.repositories.id,
          full_name: r.repositories.full_name,
          owner: r.repositories.owner,
          name: r.repositories.name,
          description: r.repositories.description ?? undefined,
          language: r.repositories.language ?? undefined,
          stars: r.repositories.stargazers_count,
          forks: r.repositories.forks_count,
          open_prs: 0, // Will be populated from real data
          open_issues: r.repositories.open_issues_count,
          contributors: 0, // Will be populated from real data
          last_activity: new Date().toISOString(),
          is_pinned: r.is_pinned,
          avatar_url:
            r.repositories?.avatar_url ||
            (r.repositories?.owner
              ? `https://avatars.githubusercontent.com/${r.repositories.owner}`
              : getFallbackAvatar()),
          html_url: `https://github.com/${r.repositories.full_name}`,
        }));
      
      logger.debug('[Workspace Repositories Query] Fetched workspace repositories:', transformedRepos.length);
      
      return transformedRepos;
    },
    enabled: !!workspaceId, // Only run when we have a workspace ID
    staleTime: 5 * 60 * 1000, // 5 minutes - repository list doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
  });
}
