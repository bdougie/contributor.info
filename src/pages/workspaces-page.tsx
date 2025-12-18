/**
 * Workspaces List Page
 *
 * Shows authenticated users their workspaces list.
 * Shows unauthenticated users a marketing page with demo workspace stats.
 *
 * This component hydrates the SSR-rendered content from ssr-workspaces edge function.
 */

import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { getSupabase } from '@/lib/supabase-lazy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Folder, Users, GitFork, Star } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getAppUserId } from '@/lib/auth-helpers';
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
    stargazer_count: number;
  }>;
}

interface DemoStats {
  totalWorkspaces: number;
  totalRepositories: number;
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
    navigate('/login?redirect=/workspaces');
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
  // Get SSR data if available (prevents flash during hydration)
  const ssrData = useMemo(() => getSSRDataForRoute<WorkspacesPageData>('workspaces'), []);

  // Initialize state from SSR data to prevent hydration flash
  const [loading, setLoading] = useState(!ssrData);
  const [isAuthenticated, setIsAuthenticated] = useState(ssrData?.authenticated ?? false);
  const [workspaces, setWorkspaces] = useState<WorkspacePreview[]>(
    ssrData?.workspaces?.map((w) => ({
      ...w,
      tier: 'free', // Default tier, will be updated on client
    })) ?? []
  );
  const [stats, setStats] = useState<DemoStats>(
    ssrData?.stats ?? { totalWorkspaces: 0, totalRepositories: 0 }
  );

  useEffect(() => {
    // Clear SSR data after initial render to prevent memory leaks
    const hasSSRData = !!ssrData;
    if (hasSSRData) {
      clearSSRData();
    }

    async function loadData() {
      // Skip fetch if SSR data is fresh (not stale)
      if (hasSSRData && !isSSRDataStale(60)) {
        logger.debug('[workspaces-page] Using fresh SSR data, skipping fetch');
        setLoading(false);
        return;
      }

      try {
        const supabase = await getSupabase();

        // Check authentication status
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);

        if (user) {
          // Authenticated - fetch user's workspaces
          const appUserId = await getAppUserId();
          if (!appUserId) {
            setLoading(false);
            return;
          }

          // Fetch workspaces the user is a member of
          const { data: memberWorkspaces, error: memberError } = await supabase
            .from('workspace_members')
            .select(
              `
              workspace_id,
              workspaces!inner(
                id,
                name,
                slug,
                description,
                tier,
                owner_id,
                created_at,
                is_active
              )
            `
            )
            .eq('user_id', appUserId);

          if (memberError) {
            logger.error('Error fetching workspaces: %o', memberError);
            setLoading(false);
            return;
          }

          // Transform and fetch additional data for each workspace
          const workspacePreviews: WorkspacePreview[] = [];

          for (const member of memberWorkspaces || []) {
            // Supabase returns joined data - extract the workspace object
            const wsData = member.workspaces;
            if (!wsData || typeof wsData !== 'object') continue;

            const ws = wsData as unknown as {
              id: string;
              name: string;
              slug: string;
              description: string | null;
              tier: string;
              owner_id: string;
              created_at: string;
              is_active: boolean;
            };

            if (!ws.is_active) continue;

            // Get repository count
            const { count: repoCount } = await supabase
              .from('workspace_repositories')
              .select('id', { count: 'exact', head: true })
              .eq('workspace_id', ws.id);

            // Get member count
            const { count: memberCount } = await supabase
              .from('workspace_members')
              .select('id', { count: 'exact', head: true })
              .eq('workspace_id', ws.id);

            // Get top 3 repositories for preview
            const { data: repos } = await supabase
              .from('workspace_repositories')
              .select(
                `
                repositories(
                  id,
                  full_name,
                  name,
                  owner,
                  language,
                  stargazer_count
                )
              `
              )
              .eq('workspace_id', ws.id)
              .limit(3);

            const repositories = (repos || [])
              .filter((r) => r.repositories && typeof r.repositories === 'object')
              .map((r) => {
                const repoData = r.repositories as unknown as {
                  id: string;
                  full_name: string;
                  name: string;
                  owner: string;
                  language: string | null;
                  stargazer_count: number;
                };
                return repoData;
              });

            workspacePreviews.push({
              id: ws.id,
              name: ws.name,
              slug: ws.slug,
              description: ws.description,
              tier: ws.tier,
              repository_count: repoCount || 0,
              member_count: memberCount || 0,
              repositories,
            });
          }

          setWorkspaces(workspacePreviews);
        } else {
          // Unauthenticated - fetch demo stats
          const [workspacesResult, reposResult] = await Promise.all([
            supabase
              .from('workspaces')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true),
            supabase.from('workspace_repositories').select('id', { count: 'exact', head: true }),
          ]);

          setStats({
            totalWorkspaces: workspacesResult.count || 0,
            totalRepositories: reposResult.count || 0,
          });
        }
      } catch (error) {
        logger.error('Error loading workspaces page: %o', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [ssrData]);

  if (loading) {
    return <WorkspacesSkeleton />;
  }

  if (isAuthenticated) {
    return <AuthenticatedWorkspaces workspaces={workspaces} />;
  }

  return <UnauthenticatedWorkspaces stats={stats} />;
}
