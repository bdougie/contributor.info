import { useLocation, useParams } from 'react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertCircle,
  GitPullRequest,
  Layout,
  MessageSquare,
  Settings,
  Shield,
  Users,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Route-level skeleton for workspace pages (`/i/:workspaceId`, `/workspaces/:workspaceId`,
 * and the `/workspaces` list).
 *
 * This component is imported eagerly by `src/App.tsx` as the Suspense fallback while the
 * `workspace-page` chunk downloads, so it must stay free of any import from
 * `src/components/features/workspace/**` (that would pull the dashboard chunk into the
 * entry bundle). Every class below mirrors the real page so the dashboard replaces the
 * skeleton without layout shift:
 *
 * - header: `src/components/features/workspace-page/components/WorkspaceHeader.tsx`
 * - tabs: `src/components/ui/section-navigation.tsx` via `WorkspaceTabNavigation.tsx`
 * - metrics: `src/components/features/workspace/WorkspaceDashboard.tsx` + `MetricCard.tsx`
 * - list page: `src/pages/workspaces-page.tsx`
 */

interface WorkspaceSkeletonProps {
  className?: string;
}

/** Mirrors the `sections` array in `WorkspaceTabNavigation.tsx`; labels are real text so the tab row measures the same. */
const WORKSPACE_SECTIONS = [
  { value: 'overview', label: 'Overview', Icon: Layout },
  { value: 'prs', label: 'PRs', Icon: GitPullRequest },
  { value: 'issues', label: 'Issues', Icon: AlertCircle },
  { value: 'discussions', label: 'Discussions', Icon: MessageSquare },
  { value: 'spam', label: 'Spam', Icon: Shield },
  { value: 'contributors', label: 'Contributors', Icon: Users },
  { value: 'activity', label: 'Activity', Icon: Activity },
  { value: 'settings', label: 'Settings', Icon: Settings },
] as const;

/** Mirrors the four always-visible `MetricCard`s in `WorkspaceDashboard.tsx`. */
const METRIC_TITLES = ['Star Velocity', 'Open PRs', 'Open Issues', 'Contributors'] as const;

/**
 * Resolve the workspace slug from the URL.
 *
 * The App-level Suspense fallback renders outside the matched `<Route>`, so `useParams()`
 * is empty there; fall back to parsing the pathname so the heading shows the real slug
 * instead of a grey bar (no text swap once the page mounts).
 */
function useWorkspaceSlug(): string | undefined {
  const params = useParams();
  const { pathname } = useLocation();

  if (params.workspaceId) {
    return params.workspaceId;
  }

  const match = pathname.match(/^\/(?:i|workspaces)\/([^/]+)/);
  const slug = match?.[1];
  if (!slug || slug === 'new') {
    return undefined;
  }
  return slug;
}

/** Matches `WorkspaceHeader`: title + description on the left, time range and repo filter on the right. */
function StaticWorkspaceHeader({ slug }: { slug: string }) {
  return (
    <div className="container max-w-7xl mx-auto p-6 pb-0">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{slug}</h1>
            {/* Description line: text-base line-height (24px) + mt-1 */}
            <Skeleton className="mt-1 h-6 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* TimeRangeSelector select trigger: h-9 w-[180px] */}
            <Skeleton className="h-9 w-[180px] rounded-md" />
            {/* RepositoryFilter button: h-9 w-[200px] */}
            <Skeleton className="h-9 w-[200px] rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Matches `SectionNavigation` in both of its modes. The real component picks compact vs
 * tab-row by measuring; the eight workspace tabs only fit from roughly the `lg` breakpoint,
 * so the skeleton uses that breakpoint as a static stand-in.
 */
function StaticSectionNavigation() {
  return (
    <div className="relative min-w-0 w-full mb-6" aria-hidden="true">
      {/* Compact mode: label + h-11 select trigger */}
      <div className="space-y-1.5 sm:max-w-xs lg:hidden">
        <span className="block text-xs font-medium text-muted-foreground">Workspace section</span>
        <div className="flex h-11 items-center justify-between rounded-lg border border-input bg-background px-3 text-base font-medium sm:text-sm">
          <span>Overview</span>
        </div>
      </div>
      {/* Tab-row mode: TabsList h-auto min-h-12 p-1 with min-h-11 triggers */}
      <div className="hidden lg:block">
        <div className="inline-flex h-auto min-h-12 w-full items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
          {WORKSPACE_SECTIONS.map(({ value, label, Icon }, index) => (
            <span
              key={value}
              className={cn(
                'inline-flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium',
                index === 0 && 'bg-background text-foreground shadow'
              )}
            >
              <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                <Icon />
              </span>
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Matches `MetricCard` in its `loading` state (default layout). */
function StaticMetricCard({ title }: { title: string }) {
  return (
    <Card className="min-w-0 p-4 shadow-none sm:p-5" aria-label={`Loading ${title}`}>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 max-w-full" />
      </div>
      <div className="mt-3 space-y-3">
        <Skeleton className="h-9 w-24 max-w-full" />
        <Skeleton className="h-5 w-20" />
      </div>
    </Card>
  );
}

/** Matches the `WorkspaceDashboard` overview: metrics section, My Work card, repository list. */
function StaticDashboard() {
  return (
    <div className="mt-6 space-y-4">
      <div className="w-full min-w-0">
        <div className="space-y-6">
          <section aria-label="Loading workspace metrics" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-semibold">At a glance</p>
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
              {METRIC_TITLES.map((title) => (
                <StaticMetricCard key={title} title={title} />
              ))}
            </div>
          </section>

          {/* My Work card */}
          <Card className="skeleton-optimized">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Repository list */}
          <Card className="skeleton-optimized">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Matches `AuthenticatedWorkspaces` in `src/pages/workspaces-page.tsx`. */
function StaticWorkspaceList() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Workspaces</h1>
            <p className="text-muted-foreground mt-1">
              Manage and analyze your repositories across workspaces
            </p>
          </div>
          {/* "New Workspace" button: h-9 */}
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="block rounded-lg border bg-card shadow-sm skeleton-optimized">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="ml-3 h-6 w-12 rounded-full" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * WorkspaceSkeleton renders the above-the-fold shape of a workspace page while its chunk
 * loads. With a slug in the URL it mirrors the workspace dashboard; without one (the
 * `/workspaces` list) it mirrors the workspaces grid.
 *
 * @param className - Additional CSS classes to apply
 */
export function WorkspaceSkeleton({ className }: WorkspaceSkeletonProps) {
  const slug = useWorkspaceSlug();

  return (
    <div
      className={cn('skeleton-container', className)}
      role="status"
      aria-label="Loading workspace..."
      aria-busy="true"
    >
      {slug ? (
        <div className="min-h-screen">
          <StaticWorkspaceHeader slug={slug} />
          <div className="container max-w-7xl mx-auto px-6 mt-6">
            <div className="w-full">
              <StaticSectionNavigation />
              <StaticDashboard />
            </div>
          </div>
        </div>
      ) : (
        <StaticWorkspaceList />
      )}
      <span className="sr-only">Loading workspace, please wait...</span>
    </div>
  );
}
