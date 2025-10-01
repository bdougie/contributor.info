import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface GitHubAppStatus {
  isInstalled: boolean;
  hasWebhookAccess: boolean;
  installationId?: string;
  permissions?: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if the GitHub App is installed for a repository
 * Used to determine if webhook-driven features are available
 */
export function useGitHubAppStatus(repositoryId: string | undefined) {
  const [status, setStatus] = useState<GitHubAppStatus>({
    isInstalled: false,
    hasWebhookAccess: false,
    loading: true,
    error: null,
  });

  const checkInstallationStatus = useCallback(async () => {
    if (!repositoryId) {
      setStatus({
        isInstalled: false,
        hasWebhookAccess: false,
        loading: false,
        error: null,
      });
      return;
    }

    try {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));

      // Query app_enabled_repositories joined with github_app_installations
      const { data: enabledRepo, error } = await supabase
        .from('app_enabled_repositories')
        .select(
          `
          id,
          enabled_at,
          installation:github_app_installations(
            installation_id,
            settings,
            suspended_at,
            deleted_at
          )
        `
        )
        .eq('repository_id', repositoryId)
        .is('installation.deleted_at', null)
        .is('installation.suspended_at', null)
        .maybeSingle();

      if (error) {
        console.error('Error checking GitHub App status:', error);
        setStatus({
          isInstalled: false,
          hasWebhookAccess: false,
          loading: false,
          error: 'Failed to check installation status',
        });
        return;
      }

      if (enabledRepo && enabledRepo.installation) {
        const installation = Array.isArray(enabledRepo.installation)
          ? enabledRepo.installation[0]
          : enabledRepo.installation;

        setStatus({
          isInstalled: true,
          hasWebhookAccess: true,
          installationId: installation.installation_id?.toString(),
          permissions: [], // Could be extracted from settings if needed
          loading: false,
          error: null,
        });
      } else {
        setStatus({
          isInstalled: false,
          hasWebhookAccess: false,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('GitHub App status check error:', error);
      setStatus({
        isInstalled: false,
        hasWebhookAccess: false,
        loading: false,
        error: 'Something went wrong. Please try again.',
      });
    }
  }, [repositoryId]);

  // Check installation status on mount and when repositoryId changes
  useEffect(() => {
    checkInstallationStatus();
  }, [checkInstallationStatus]);

  return {
    ...status,
    refetch: checkInstallationStatus,
  };
}
