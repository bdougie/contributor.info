import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useParams } from 'react-router';
import { ChevronRight } from '@/components/ui/icon';

interface RepoViewSkeletonProps {
  className?: string;
}

/**
 * Static breadcrumbs that match the real Breadcrumbs component exactly
 * Uses useParams to show actual owner/repo values - no CLS
 */
function StaticBreadcrumbs() {
  const { owner, repo } = useParams();

  return (
    <nav aria-label="breadcrumb" className="hidden md:flex mb-4">
      <ol className="flex flex-wrap items-center gap-1 break-words text-xs text-muted-foreground">
        {/* Home */}
        <li className="inline-flex items-center gap-1">
          <span className="transition-colors hover:text-foreground">home</span>
        </li>
        <li role="presentation" aria-hidden="true" className="[&>svg]:size-3 opacity-50">
          <ChevronRight />
        </li>
        {/* Owner */}
        <li className="inline-flex items-center gap-1">
          <span className="transition-colors hover:text-foreground">{owner || 'owner'}</span>
        </li>
        <li role="presentation" aria-hidden="true" className="[&>svg]:size-3 opacity-50">
          <ChevronRight />
        </li>
        {/* Repo (current page) */}
        <li className="inline-flex items-center gap-1">
          <span className="font-normal text-muted-foreground">{repo || 'repo'}</span>
        </li>
      </ol>
    </nav>
  );
}

/**
 * Static search section that renders immediately (no DB dependency)
 * Shows real UI elements in disabled state rather than animated skeletons
 */
function StaticSearchSection() {
  const exampleRepos = [
    'continuedev/continue',
    'argoproj/argo-cd',
    'TanStack/table',
    'vitejs/vite',
    'etcd-io/etcd',
    'better-auth/better-auth',
  ];

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        <div className="flex gap-4 mb-4">
          <Input
            disabled
            placeholder="Search another repository (e.g., facebook/react)"
            className="flex-1"
          />
          <Button disabled variant="default">
            Search
          </Button>
        </div>
        <div className="mt-4 w-full">
          <div className="text-sm text-muted-foreground mb-2">Popular examples:</div>
          <div className="flex flex-wrap gap-2">
            {exampleRepos.map((repo) => (
              <Button
                key={repo}
                variant="outline"
                size="sm"
                disabled
                className="text-xs sm:text-sm"
              >
                {repo}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * RepoViewSkeleton component for displaying placeholder layout for repository view pages
 *
 * @param className - Additional CSS classes to apply
 * @returns A skeleton layout with static search bar and loading content areas
 */
export function RepoViewSkeleton({ className }: RepoViewSkeletonProps) {
  return (
    <div
      className={cn('skeleton-container', className)}
      aria-label="Loading repository view..."
      aria-busy="true"
    >
      {/* Breadcrumbs - static, uses URL params for pixel-perfect match */}
      <StaticBreadcrumbs />

      {/* Search Bar Section - static, no DB dependency */}
      <StaticSearchSection />

      {/* Main Content Section */}
      <div className="grid gap-8" aria-label="Loading main content">
        <Card className="animate-pulse skeleton-optimized">
          <CardHeader aria-label="Loading repository header">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                {/* Repository name */}
                <Skeleton className="h-8 w-64" />
                {/* Description */}
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs skeleton */}
            <div className="space-y-4">
              <div
                className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground grid grid-cols-4 w-full max-w-md"
                aria-label="Loading navigation tabs"
              >
                <Skeleton className="h-7 rounded-md mx-1" />
                <Skeleton className="h-7 rounded-md mx-1" />
                <Skeleton className="h-7 rounded-md mx-1" />
                <Skeleton className="h-7 rounded-md mx-1" />
              </div>
            </div>

            {/* Content area placeholder */}
            <div className="mt-6">
              <ContentAreaSkeleton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Default content area skeleton - feed-style layout that matches actual content structure
 * @returns A skeleton layout with stacked feed-style cards
 */
function ContentAreaSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Loading content area">
      <div className="text-center text-muted-foreground">Loading repository data...</div>
      {/* Feed-style skeleton to match expected content */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 skeleton-optimized">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
