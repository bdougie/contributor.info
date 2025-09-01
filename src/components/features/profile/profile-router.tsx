import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Octokit } from '@octokit/rest';
import { env } from '@/lib/env';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Lazy load views to reduce bundle size
const UserView = lazy(() => import('@/pages/user-view'));
const OrgView = lazy(() => import('@/pages/org-view'));

interface ProfileRouterState {
  profileType: 'user' | 'org' | null;
  isLoading: boolean;
  error: string | null;
}

// Cache for profile type detection to avoid repeated API calls
const profileTypeCache: { [key: string]: { type: 'user' | 'org'; timestamp: number } } = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function ProfileRouter() {
  const { username } = useParams<{ username: string }>();
  const [state, setState] = useState<ProfileRouterState>({
    profileType: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!username) {
      setState({
        profileType: null,
        isLoading: false,
        error: 'Profile name is required',
      });
      return;
    }

    const detectProfileType = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Check cache first
        const cached = profileTypeCache[username];
        const now = Date.now();

        if (cached && now - cached.timestamp < CACHE_DURATION) {
          setState({
            profileType: cached.type,
            isLoading: false,
            error: null,
          });
          return;
        }

        const octokit = new Octokit({
          auth: env.GITHUB_TOKEN,
        });

        // Try users API first (more common case)
        try {
          await octokit.rest.users.getByUsername({ username });

          // If successful, it's a user
          profileTypeCache[username] = { type: 'user', timestamp: now };
          setState({
            profileType: 'user',
            isLoading: false,
            error: null,
          });
          return;
        } catch (userError: unknown) {
          // If user API fails with 404, try org API
          if (
            (userError as { status?: number })?.status === 404 ||
            (userError instanceof Error && userError.message.includes('404'))
          ) {
            try {
              await octokit.rest.orgs.get({ org: username });

              // If successful, it's an organization
              profileTypeCache[username] = { type: 'org', timestamp: now };
              setState({
                profileType: 'org',
                isLoading: false,
                error: null,
              });
              return;
            } catch {
              // Both APIs failed
              setState({
                profileType: null,
                isLoading: false,
                error: `Profile "${username}" not found`,
              });
              return;
            }
          } else {
            // Non-404 error from user API
            throw userError as Error;
          }
        }
      } catch (error: unknown) {
        let errorMessage = 'Failed to determine profile type';
        if (
          (error as { status?: number })?.status === 403 ||
          (error instanceof Error && error.message.includes('403'))
        ) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        setState({
          profileType: null,
          isLoading: false,
          error: errorMessage,
        });
      }
    };

    detectProfileType();
  }, [username]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 text-sm">
          <Skeleton className="h-4 w-12" />
          <span>/</span>
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        {/* Table skeleton */}
        <Card>
          <div className="p-4 border-b">
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">Profile Not Found</h2>
              <p className="text-muted-foreground">{state.error}</p>
              <Button asChild>
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile loading skeleton component
  const ProfileLoadingSkeleton = () => (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Profile header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Content skeleton */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );

  // Render the appropriate component based on profile type
  if (state.profileType === 'user') {
    return (
      <Suspense fallback={<ProfileLoadingSkeleton />}>
        <UserView />
      </Suspense>
    );
  } else if (state.profileType === 'org') {
    return (
      <Suspense fallback={<ProfileLoadingSkeleton />}>
        <OrgView />
      </Suspense>
    );
  }

  // This shouldn't happen, but provide fallback
  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Unknown Profile Type</h2>
            <p className="text-muted-foreground">
              Unable to determine if this is a user or organization profile.
            </p>
            <Button asChild>
              <Link to="/">Return to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
