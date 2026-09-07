/**
 * Workspaces List Page
 *
 * Shows authenticated users their workspaces list.
 * Shows unauthenticated users a marketing page with demo workspace stats.
 *
 * This component hydrates the SSR-rendered content from ssr-workspaces edge function.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getLoginRoute } from '@/lib/auth/login-redirect';
import { getSupabase } from '@/lib/supabase-lazy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Folder, Users, GitFork, Star } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useCachedAuth } from '@/hooks/use-cached-auth';
import { useUserWorkspaces, workspaceKeys } from '@/hooks/use-user-workspaces';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import {
  getSSRDataForRoute,
  isSSRDataStale,
  clearSSRData,
  type WorkspacesPageData,
} from '@/lib/ssr-hydration';

interface WorkspacePreview {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: string;
  repository_count: number;
  member_count: number;
  repositories: Array<{
    id: string;
    full_name: string;
    name: string;
    owner: string;
    language: string | null;
    stargazers_count: number;
  }>;
}

interface DemoStats {
  totalWorkspaces: number;
  totalRepositories: number;
}

interface WorkspacesSSRSeed {
  data: WorkspacesPageData;
  /** Whether the edge render is recent enough to stand in until the client query resolves. */
  fresh: boolean;
}

/**
 * Read the edge-rendered payload once, before it is cleared. Staleness has to be
 * measured here: `clearSSRData` removes the timestamp `isSSRDataStale` reads.
 */
function readSSRSeed(): WorkspacesSSRSeed | null {
  const data = getSSRDataForRoute<WorkspacesPageData>('workspaces');
  if (!data) return null;
  return { data, fresh: !isSSRDataStale(60) };
}

function seedWorkspacePreviews(seed: WorkspacesSSRSeed | null): WorkspacePreview[] {
  return (seed?.data.workspaces ?? []).map((ws) => ({
    ...ws,
    // The edge render does not carry the plan; the client query fills it in.
    tier: 'free',
    repositories: ws.repositories.map(({ stargazer_count, ...repo }) => ({
      ...repo,
      stargazers_count: stargazer_count,
    })),
  }));
}

function toWorkspacePreview(ws: WorkspacePreviewData): WorkspacePreview {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description ?? null,
    tier: ws.tier ?? 'free',
    repository_count: ws.repository_count,
    member_count: ws.member_count,
    repositories: ws.repositories.map((repo) => ({
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner,
      language: repo.language ?? null,
      stargazers_count: repo.stargazers_count ?? 0,
    })),
  };
}

async function fetchDemoStats(): Promise<DemoStats> {
  const supabase = await getSupabase();
  const [workspacesResult, reposResult] = await Promise.all([
    supabase.from('workspaces').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('workspace_repositories').select('id', { count: 'exact', head: true }),
  ]);
  return {
    totalWorkspaces: workspacesResult.count || 0,
    totalRepositories: reposResult.count || 0,
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Authenticated view - shows user's workspaces
 */
function AuthenticatedWorkspaces({ workspaces }: { workspaces: WorkspacePreview[] }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Workspaces</h1>
            <p className="text-muted-foreground mt-1">
              Manage and analyze your repositories across workspaces
            </p>
          </div>
          <Button asChild>
            <Link to="/workspaces/new">
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Link>
          </Button>
        </div>

        {/* Workspaces Grid */}
        {workspaces.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                to={`/i/${ws.slug}`}
                className="block rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{ws.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {ws.description || 'No description'}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {ws.tier}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Folder className="w-4 h-4" />
                      {ws.repository_count} repos
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {ws.member_count} members
                    </span>
                  </div>

                  {ws.repositories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Top Repositories</p>
                      <div className="flex flex-wrap gap-1">
                        {ws.repositories.slice(0, 3).map((repo) => (
                          <span
                            key={repo.id}
                            className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs"
                          >
                            {repo.name}
                          </span>
                        ))}
                        {ws.repository_count > 3 && (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            +{ws.repository_count - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="rounded-lg border bg-card p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first workspace to start tracking repositories and contributors.
            </p>
            <Button asChild>
              <Link to="/workspaces/new">Create Workspace</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Unauthenticated view - marketing page
 */
function UnauthenticatedWorkspaces({ stats }: { stats: DemoStats }) {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate(getLoginRoute('/workspaces'));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Organize Your Open Source Insights
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Create workspaces to track repositories, analyze contributors, and gain insights across
          your entire open source portfolio.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Button size="lg" onClick={handleLogin}>
            Get Started Free
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/i/demo">View Demo</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
          <div className="text-center">
            <p className="text-3xl font-bold">{formatNumber(stats.totalWorkspaces)}</p>
            <p className="text-sm text-muted-foreground">Active Workspaces</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{formatNumber(stats.totalRepositories)}</p>
            <p className="text-sm text-muted-foreground">Tracked Repositories</p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">
            Everything you need to manage contributors
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <GitFork className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Contribution Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track contribution patterns, identify top contributors, and understand your
                  community's health.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Team Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Invite team members to your workspace and collaborate on repository analysis
                  together.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Health Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor repository health metrics and get alerts when contributor activity
                  changes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-muted-foreground mb-8">
          Sign in with GitHub to create your first workspace.
        </p>
        <Button size="lg" onClick={handleLogin}>
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}

/**
 * Loading skeleton
 */
function WorkspacesSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-5 w-72 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-36 bg-muted animate-pulse rounded" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="flex gap-4">
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  <div className="flex gap-1">
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-20 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  // The SSR seed keeps the edge-rendered list on screen through hydration and until
  // the client query resolves, so nothing flashes to a skeleton.
  const [seed] = useState(readSSRSeed);
  useEffect(() => {
    if (seed) clearSSRData();
  }, [seed]);

  // Both hooks read the shared React Query cache synchronously. `WorkspaceProvider`
  // already resolved the user's workspaces for every route, so a warm navigation
  // here renders the final list on the first frame with no extra requests.
  const { isAuthenticated, isLoading: authLoading } = useCachedAuth();
  const {
    workspaces: userWorkspaces,
    loading: workspacesLoading,
    error: workspacesError,
  } = useUserWorkspaces();
  const authenticated = authLoading ? (seed?.data.authenticated ?? false) : isAuthenticated;

  useEffect(() => {
    if (workspacesError) {
      logger.error('Error fetching workspaces: %s', workspacesError.message);
    }
  }, [workspacesError]);

  const seededStats = seed?.data.stats;
  const { data: stats } = useQuery({
    queryKey: workspaceKeys.demoStats(),
    queryFn: fetchDemoStats,
    enabled: !authLoading && !isAuthenticated,
    staleTime: 5 * 60 * 1000,
    // A fresh edge render is the answer; a stale one is shown while the counts refresh.
    initialData: seed?.fresh ? seededStats : undefined,
    placeholderData: seededStats,
  });

  const workspaces = useMemo(
    () =>
      workspacesLoading && !workspacesError
        ? seedWorkspacePreviews(seed)
        : userWorkspaces.map(toWorkspacePreview),
    [seed, userWorkspaces, workspacesLoading, workspacesError]
  );

  if (authenticated) {
    if (workspacesLoading && !seed) {
      return <WorkspacesSkeleton />;
    }
    return <AuthenticatedWorkspaces workspaces={workspaces} />;
  }

  if (!stats) {
    return <WorkspacesSkeleton />;
  }

  return <UnauthenticatedWorkspaces stats={stats} />;
}
