import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface WorkspaceGitHubAppStatus {
  // Overall status
  hasAnyInstalled: boolean;
  allInstalled: boolean;
  loading: boolean;
  error: string | null;

  // Per-repository status
  repoStatuses: Map<
    string,
    {
      isInstalled: boolean;
      installationId?: string;
    }
  >;

  // Repos that need installation
  uninstalledRepoIds: string[];
}

/**
 * Hook to check GitHub App installation status across multiple repositories
 * Used to show CTA only when NO repos have the app installed
 */
export function useWorkspaceGitHubAppStatus(repositoryIds: string[]) {
  const [status, setStatus] = useState<WorkspaceGitHubAppStatus>({
    hasAnyInstalled: false,
    allInstalled: false,
    loading: true,
    error: null,
    repoStatuses: new Map(),
    uninstalledRepoIds: [],
  });

  // Track latest request to prevent stale async responses from overwriting state
  const latestRequestRef = useRef<string>('');

  const checkInstallationStatus = useCallback(async () => {
    // Create unique request ID for this call
    const requestId = `${Date.now()}-${Math.random()}`;
    latestRequestRef.current = requestId;

    if (!repositoryIds || repositoryIds.length === 0) {
      // Guard: Only update if this is still the latest request
      if (latestRequestRef.current !== requestId) return;

      setStatus({
        hasAnyInstalled: false,
        allInstalled: false,
        loading: false,
        error: null,
        repoStatuses: new Map(),
        uninstalledRepoIds: [],
      });
      return;
    }

    try {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));

      // Query app_enabled_repositories for all repos at once
      const { data: enabledRepos, error } = await supabase
        .from('app_enabled_repositories')
        .select(
          `
          id,
          repository_id,
          enabled_at,
          installation:github_app_installations(
            installation_id,
            settings,
            suspended_at,
            deleted_at
          )
        `
        )
        .in('repository_id', repositoryIds)
        .is('installation.deleted_at', null)
        .is('installation.suspended_at', null);

      if (error) {
        console.error('Error checking GitHub App status for workspace:', error);
        // Guard: Only update if this is still the latest request
        if (latestRequestRef.current !== requestId) return;

        setStatus({
          hasAnyInstalled: false,
          allInstalled: false,
          loading: false,
          error: 'Failed to check installation status',
          repoStatuses: new Map(),
          uninstalledRepoIds: repositoryIds,
        });
        return;
      }

      // Build map of repo statuses
      const repoStatuses = new Map<string, { isInstalled: boolean; installationId?: string }>();
      const installedRepoIds = new Set<string>();

      if (enabledRepos && enabledRepos.length > 0) {
        enabledRepos.forEach((repo) => {
          const installation = Array.isArray(repo.installation)
            ? repo.installation[0]
            : repo.installation;

          if (installation && !installation.deleted_at && !installation.suspended_at) {
            repoStatuses.set(repo.repository_id, {
              isInstalled: true,
              installationId: installation.installation_id?.toString(),
            });
            installedRepoIds.add(repo.repository_id);
          }
        });
      }

      // Mark uninstalled repos
      repositoryIds.forEach((repoId) => {
        if (!installedRepoIds.has(repoId)) {
          repoStatuses.set(repoId, {
            isInstalled: false,
          });
        }
      });

      const uninstalledRepoIds = repositoryIds.filter((id) => !installedRepoIds.has(id));
      const hasAnyInstalled = installedRepoIds.size > 0;
      const allInstalled = installedRepoIds.size === repositoryIds.length;

      // Guard: Only update if this is still the latest request
      if (latestRequestRef.current !== requestId) return;

      setStatus({
        hasAnyInstalled,
        allInstalled,
        loading: false,
        error: null,
        repoStatuses,
        uninstalledRepoIds,
      });
    } catch (error) {
      console.error('GitHub App status check error:', error);
      // Guard: Only update if this is still the latest request
      if (latestRequestRef.current !== requestId) return;

      setStatus({
        hasAnyInstalled: false,
        allInstalled: false,
        loading: false,
        error: 'Something went wrong. Please try again.',
        repoStatuses: new Map(),
        uninstalledRepoIds: repositoryIds,
      });
    }
  }, [repositoryIds]);

  // Check installation status on mount and when repositoryIds change
  useEffect(() => {
    checkInstallationStatus();
  }, [checkInstallationStatus]);

  return {
    ...status,
    refetch: checkInstallationStatus,
  };
}
