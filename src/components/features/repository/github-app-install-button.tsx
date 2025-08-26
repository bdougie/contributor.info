import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink } from '@/components/ui/icon';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useGitHubAuth } from '@/hooks/use-github-auth';

interface GitHubAppInstallButtonProps {
  owner: string;
  repo: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function GitHubAppInstallButton({
  owner,
  repo,
  variant = 'outline',
  size = 'sm',
  className = '',
}: GitHubAppInstallButtonProps) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const { isLoggedIn } = useGitHubAuth();

  useEffect(() => {
    checkInstallationStatus();
    if (isLoggedIn) {
      checkUserPermissions();
    }
  }, [owner, repo, isLoggedIn]);

  async function checkInstallationStatus() {
    try {
      setIsChecking(true);

      // Try API endpoint first (works in production and with netlify dev)
      try {
        // Detect development environment more robustly
        const isDev =
          import.meta.env?.DEV ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname.includes('localhost') ||
          window.location.hostname.includes('.local');

        // Build endpoint URL based on environment
        const baseUrl = isDev ? 'http://localhost:8888' : '';
        const endpoint = isDev
          ? `${baseUrl}/.netlify/functions/github-app-installation-status?owner=${owner}&repo=${repo}`
          : `/api/github-app/installation-status?owner=${owner}&repo=${repo}`;

        const response = await fetch(endpoint);
        if (response.ok) {
          const _ = await response.json();
          setIsInstalled(_data.installed);
          return;
        } else if (response.status === 404) {
          // 404 means the app is not installed - this is expected, not an error
          setIsInstalled(false);
          return;
        }
        // Other status codes (500, etc.) fall through to Supabase fallback
      } catch (apiError) {
        // Network error or other issues, fall back to direct Supabase check
        console.debug('GitHub app installation status API unavailable, using fallback');
      }

      // Fallback: Check the database for GitHub App installation status
      // Check if the repository has an associated app installation
      try {
        const { data: repoData, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .maybeSingle();

        if (!repoError && repoData) {
          // Repository exists, now check if it has an app installation
          const { data: appData, error: appError } = await supabase
            .from('app_enabled_repositories')
            .select('id')
            .eq('repository_id', repoData.id)
            .maybeSingle();

          setIsInstalled(!appError && !!appData);
        } else {
          // Repository not in database
          setIsInstalled(false);
        }
      } catch (dbError) {
        // If all else fails, assume not installed
        console.debug('Error checking app installation status:', dbError);
        setIsInstalled(false);
      }
    } catch (error) {
      // Silently fail and assume not installed
      setIsInstalled(false);
    } finally {
      setIsChecking(false);
    }
  }

  async function checkUserPermissions() {
    try {
      // Get the user's session to access their GitHub token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.provider_token) {
        // No provider token available - user may need to re-authenticate
        setCanInstall(false);
        return;
      }

      // Check user's permissions on the repository using GitHub API
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${session.provider_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const repoData = await response.json();
        // User needs admin permission to install GitHub Apps
        // The permissions object will have admin: true if the user is an admin/owner
        const hasPermission =
          repoData.permissions?.admin === true || repoData.permissions?.maintain === true;
        setCanInstall(hasPermission);
      } else {
        // Failed to fetch repo permissions - user may not have access
        setCanInstall(false);
      }
    } catch (error) {
      // Silently fail and assume user cannot install
      setCanInstall(false);
    }
  }

  const handleInstallClick = () => {
    // GitHub App installation URL
    // The app slug is usually the app name with dots replaced by hyphens
    const appSlug = 'contributor-info'; // GitHub Apps don't allow dots in slugs
    const installUrl = `https://github.com/apps/${appSlug}/installations/new`;

    // Open in new tab
    window.open(installUrl, '_blank', 'noopener,noreferrer');

    // Show toast notification
    toast.info('Opening GitHub App installation page...', {
      description: 'Complete the installation in the new tab',
      action: {
        label: 'Check Status',
        onClick: () => {
          checkInstallationStatus();
        },
      },
    });
  };

  // Don't show the button if user is not logged in or can't install
  if (!isLoggedIn || (!canInstall && !isInstalled)) {
    return null;
  }

  if (isChecking) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
        title="Checking installation status..."
      >
        <span className="animate-pulse">Checking...</span>
      </Button>
    );
  }

  if (isInstalled) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          // Open GitHub App settings page where user can manage the installation
          window.open(`https://github.com/settings/installations`, '_blank', 'noopener,noreferrer');

          toast.info('Opening GitHub App settings...', {
            description: 'Manage your app installation settings',
          });
        }}
        className={`${className} text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300`}
        title="Manage GitHub App installation"
      >
        <Check className="h-4 w-4" />
        <span className="ml-2">Installed</span>
        <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
    );
  }

  // Only show install button if user has permission
  if (canInstall) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleInstallClick}
        className={className}
        title="Install GitHub App for PR insights"
      >
        <span>Install</span>
        <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
    );
  }

  return null;
}
