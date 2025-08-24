import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Octokit } from '@octokit/rest';
import { env } from '@/lib/env';
import OrgView from '@/pages/org-view';
import UserView from '@/pages/user-view';

interface ProfileRouterState {
  profileType: 'user' | 'org' | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * ProfileRouter component that determines whether a profile is a user or organization
 * and renders the appropriate component.
 * 
 * Strategy:
 * 1. First try to fetch as user (users.getByUsername)
 * 2. If that fails with 404, try as organization (orgs.get)
 * 3. If both fail, show error
 */
export default function ProfileRouter() {
  const { profile } = useParams<{ profile: string }>();
  const [state, setState] = useState<ProfileRouterState>({
    profileType: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!profile) {
      setState({
        profileType: null,
        isLoading: false,
        error: new Error('Profile name is required'),
      });
      return;
    }

    const detectProfileType = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const octokit = new Octokit({
        auth: env.GITHUB_TOKEN,
      });

      try {
        // First, try to fetch as user
        await octokit.rest.users.getByUsername({ username: profile });
        setState({
          profileType: 'user',
          isLoading: false,
          error: null,
        });
        return;
      } catch (userError) {
        // If user fetch fails with 404, try as organization
        if (userError instanceof Error && userError.message.includes('404')) {
          try {
            await octokit.rest.orgs.get({ org: profile });
            setState({
              profileType: 'org',
              isLoading: false,
              error: null,
            });
            return;
          } catch (orgError) {
            // Both failed, show error
            setState({
              profileType: null,
              isLoading: false,
              error: new Error(`Profile "${profile}" not found as either user or organization`),
            });
            return;
          }
        } else {
          // Non-404 error, likely rate limiting or other API issue
          setState({
            profileType: null,
            isLoading: false,
            error: userError as Error,
          });
          return;
        }
      }
    };

    detectProfileType();
  }, [profile]);

  if (state.isLoading) {
    // Show loading skeleton that matches both user and org layouts
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Breadcrumbs skeleton */}
        <div className="flex items-center gap-2 text-sm">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <span>/</span>
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        </div>
        
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-muted animate-pulse rounded-md" />
          <div>
            <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
          </div>
        </div>
        
        {/* Table skeleton */}
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({length: 5}).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="border rounded-lg p-8">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Profile Not Found</h2>
            <p className="text-muted-foreground">
              {state.error.message}
            </p>
            <button 
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate component based on profile type
  if (state.profileType === 'user') {
    return <UserView />;
  } else if (state.profileType === 'org') {
    return <OrgView />;
  }

  return null;
}