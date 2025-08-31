import { useState, useEffect, Suspense } from 'react';
import { Link } from '@/components/ui/icon';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import type { GitHubRepository } from '@/lib/github';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { toast } from 'sonner';
import { RepoStatsProvider } from '@/lib/repo-stats-context';
import { RepositoryHealthCard } from '../health';
import { MetricsAndTrendsCard } from '../activity';
import { Distribution } from '../distribution';
import { LazyContributions } from '../charts/lazy-charts';
import { ContributorOfMonthWrapper } from '../contributor';
import { ExampleRepos } from './example-repos';
import { useCachedRepoData } from '@/hooks/use-cached-repo-data';
import { InsightsSidebar } from '@/components/insights/insights-sidebar';
import { RepoViewSkeleton } from '@/components/skeletons';
import { SocialMetaTags } from '@/components/common/layout';
import { Breadcrumbs } from '@/components/common/layout/breadcrumbs';
import RepoNotFound from './repo-not-found';
import { createChartShareUrl, getDubConfig } from '@/lib/dub';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { DataProcessingIndicator } from './data-processing-indicator';
import { ErrorBoundary } from '@/components/error-boundary';
import { RepositoryInlineMetadata } from '@/components/ui/repository-inline-metadata';
import { useRepositoryTracking } from '@/hooks/use-repository-tracking';
import { DataStateIndicator } from '@/components/ui/data-state-indicator';
import { LastUpdated } from '@/components/ui/last-updated';
import { useDataTimestamp } from '@/hooks/use-data-timestamp';
import { RepositoryTrackingCard } from './repository-tracking-card';
import { GitHubAppInstallButton } from './github-app-install-button';
import { UnifiedSyncButton } from './unified-sync-button';
import { useAnalytics } from '@/hooks/use-analytics';

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots, setIncludeBots] = useState(false);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const dubConfig = getDubConfig();
  const { isLoggedIn } = useGitHubAuth();
  const { trackRepositoryPageViewed, trackRepositoryTabSwitch } = useAnalytics();

  // Handle repository tracking for new repositories
  const trackingState = useRepositoryTracking({
    owner,
    repo,
    enabled: Boolean(owner && repo),
    onTrackingComplete: () => {
      // Refresh the page when tracking completes
      window.location.reload();
    },
  });

  // Determine current tab based on URL
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.endsWith('/health')) return 'lottery';
    if (path.endsWith('/distribution')) return 'distribution';
    if (path.endsWith('/feed') || path.includes('/feed/')) return 'feed';
    if (path.endsWith('/activity') || path.endsWith('/contributions')) return 'contributions';
    return 'contributions'; // default for root path
  };

  // Use our custom hooks
  const { stats, lotteryFactor, directCommitsData, dataStatus } = useCachedRepoData(
    owner,
    repo,
    timeRange,
    includeBots
  );

  // Track data timestamps for freshness indicators
  const { lastUpdated } = useDataTimestamp([stats, lotteryFactor, directCommitsData], {
    autoUpdate: true,
  });

  const handleSelectExample = (repo: string) => {
    const match = repo.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    if (match) {
      const [, newOwner, newRepo] = match;

      // Check if login is required (second search while not logged in)
      if (hasSearchedOnce && !isLoggedIn) {
        localStorage.setItem('redirectAfterLogin', `/${newOwner}/${newRepo}`);
        navigate('/login');
        return;
      }

      // Mark that a search has been performed
      setHasSearchedOnce(true);
      navigate(`/${newOwner}/${newRepo}`);
    }
  };

  // Update document title when owner/repo changes
  useEffect(() => {
    if (owner && repo) {
      document.title = `${owner}/${repo} - Contributor Analysis`;
    }
  }, [owner, repo]);

  // Track repository page view
  useEffect(() => {
    if (owner && repo) {
      // For now, assume public repos since we don't have private repo data readily available
      trackRepositoryPageViewed('public');
    }
  }, [owner, repo, trackRepositoryPageViewed]);

  // Show skeleton immediately on navigation and hide when data is ready
  useEffect(() => {
    setShowSkeleton(true);

    // Hide skeleton when we have data or after timeout
    if (dataStatus?.status === 'success' || dataStatus?.status === 'partial_data' || stats.error) {
      setShowSkeleton(false);
    } else {
      const timeout = setTimeout(() => setShowSkeleton(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [owner, repo, dataStatus?.status, stats.error]);

  // Handle share button click - create oss.fyi short link
  const handleShare = async () => {
    setIsGeneratingUrl(true);

    try {
      // Generate short URL for repository page
      const currentUrl = window.location.href;
      const chartType = getCurrentTab(); // Get current tab as chart type
      const repository = `${owner}/${repo}`;

      const shortUrl = await createChartShareUrl(currentUrl, `repository-${chartType}`, repository);

      // Create a descriptive share message
      const shareText = `Check out the ${chartType} analysis for ${repository}\n${shortUrl}`;

      await navigator.clipboard.writeText(shareText);

      const domain = dubConfig.isDev ? 'dub.sh' : 'oss.fyi';
      const isShortened = shortUrl !== currentUrl;

      if (isShortened) {
        toast.success(`Short link copied! (${domain})`);
      } else {
        toast.success('Repository link copied to clipboard!');
      }
    } catch (err) {
      console.error('Failed to create short URL:', err);
      // Fallback to original URL with descriptive text
      try {
        const fallbackText = `Check out the analysis for ${owner}/${repo}\n${window.location.href}`;
        await navigator.clipboard.writeText(fallbackText);
        toast.success('Repository link copied to clipboard!');
      } catch {
        toast.error('Failed to copy link');
      }
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  // Show skeleton during initial load or navigation
  if (showSkeleton && dataStatus?.status === 'pending') {
    return <RepoViewSkeleton />;
  }

  // Check if repository needs tracking (show tracking card instead of error)
  if (trackingState.status === 'not_tracked' && !showSkeleton) {
    return (
      <article className="py-2">
        <Breadcrumbs />
        <section className="mb-8">
          <Card>
            <CardContent className="pt-6">
              <GitHubSearchInput
                placeholder="Search another repository (e.g., facebook/react)"
                onSearch={(repositoryPath) => {
                  const match = repositoryPath.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
                  if (match) {
                    const [, newOwner, newRepo] = match;
                    navigate(`/${newOwner}/${newRepo}`);
                  }
                }}
                onSelect={(repository: GitHubRepository) => {
                  navigate(`/${repository.full_name}`);
                }}
              />
              <aside>
                <ExampleRepos onSelect={handleSelectExample} />
              </aside>
            </CardContent>
          </Card>
        </section>
        <section className="grid gap-8">
          <RepositoryTrackingCard owner={owner || ''} repo={repo || ''} />
        </section>
      </article>
    );
  }

  if (stats.error) {
    // Check if this is a 404 repository error
    const isRepoNotFound =
      stats.error.includes('not found') ||
      stats.error.includes('does not exist') ||
      stats.error.includes('404');

    if (isRepoNotFound) {
      return <RepoNotFound />;
    } else {
      // For other errors, show the generic error card
      return (
        <div className="py-2">
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-destructive mb-2">Error</h2>
                <p className="text-muted-foreground">
                  We encountered an issue loading repository data. Please try again later.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  const repoTitle = `${owner}/${repo} - Contributor Analysis`;
  const repoDescription = `Analyze GitHub contributors for ${owner}/${repo}. View contribution patterns, pull request activity, and community impact metrics.`;
  const repoUrl = `https://contributor.info/${owner}/${repo}`;

  return (
    <article className="py-2">
      <SocialMetaTags
        title={repoTitle}
        description={repoDescription}
        url={repoUrl}
        type="article"
        image={`social-cards/repo-${owner}-${repo}.png`}
      />
      <Breadcrumbs />
      <section className="mb-8">
        <Card>
          <CardContent className="pt-6">
            <GitHubSearchInput
              placeholder="Search another repository (e.g., facebook/react)"
              onSearch={(repositoryPath) => {
                const match = repositoryPath.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
                if (match) {
                  const [, newOwner, newRepo] = match;

                  // Check if login is required (second search while not logged in)
                  if (hasSearchedOnce && !isLoggedIn) {
                    localStorage.setItem('redirectAfterLogin', `/${newOwner}/${newRepo}`);
                    navigate('/login');
                    return;
                  }

                  // Mark that a search has been performed
                  setHasSearchedOnce(true);
                  navigate(`/${newOwner}/${newRepo}`);
                }
              }}
              onSelect={(repository: GitHubRepository) => {
                // Check if login is required (second search while not logged in)
                if (hasSearchedOnce && !isLoggedIn) {
                  localStorage.setItem('redirectAfterLogin', `/${repository.full_name}`);
                  navigate('/login');
                  return;
                }

                // Mark that a search has been performed
                setHasSearchedOnce(true);
                navigate(`/${repository.full_name}`);
              }}
            />
            <aside>
              <ExampleRepos onSelect={handleSelectExample} />
            </aside>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="break-words">
                    {owner}/{repo}
                  </span>
                  <RepositoryInlineMetadata owner={owner} repo={repo} />
                </h1>
                <p className="text-muted-foreground">
                  Contribution analysis of recent pull requests
                </p>
                {/* Reserve space for last updated timestamp to prevent CLS */}
                <div className="mt-2 repo-header-timestamp">
                  {!stats.loading ? (
                    <time className="text-sm text-muted-foreground">
                      <LastUpdated timestamp={lastUpdated} label="Data last updated" size="sm" />
                    </time>
                  ) : (
                    <div className="h-5 skeleton-loading" aria-hidden="true" />
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <GitHubAppInstallButton owner={owner || ''} repo={repo || ''} size="sm" />
                <UnifiedSyncButton
                  owner={owner || ''}
                  repo={repo || ''}
                  lastUpdated={lastUpdated}
                  variant="outline"
                  size="icon"
                  showLabel={false}
                  autoTriggerOnLoad={true}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleShare}
                  disabled={isGeneratingUrl}
                  className="h-8 w-8 stable-button"
                  title={isGeneratingUrl ? 'Generating short link...' : 'Copy repository link'}
                  aria-label={isGeneratingUrl ? 'Generating short link...' : 'Copy repository link'}
                >
                  <Link className={`h-4 w-4 ${isGeneratingUrl ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <nav className="space-y-4" style={{ background: 'transparent', border: 'none' }}>
              <Tabs
                value={getCurrentTab()}
                onValueChange={(value) => {
                  const currentTab = getCurrentTab();
                  trackRepositoryTabSwitch(currentTab, value, 'public');

                  if (value === 'contributions') {
                    navigate(`/${owner}/${repo}`);
                  } else if (value === 'lottery') {
                    navigate(`/${owner}/${repo}/health`);
                  } else {
                    navigate(`/${owner}/${repo}/${value}`);
                  }
                }}
              >
                <TabsList
                  className="grid grid-cols-4 w-full max-w-md"
                  role="tablist"
                  aria-label="Repository analysis sections"
                >
                  <TabsTrigger value="contributions" className="text-xs sm:text-sm">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="lottery" className="text-xs sm:text-sm">
                    Health
                  </TabsTrigger>
                  <TabsTrigger value="distribution" className="text-xs sm:text-sm">
                    Distribution
                  </TabsTrigger>
                  <TabsTrigger value="feed" className="text-xs sm:text-sm">
                    Feed
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </nav>

            {/* Show data processing indicator or new repository message */}
            {owner && repo && (
              <>
                <DataProcessingIndicator repository={`${owner}/${repo}`} className="mt-4" />
                {/* Container with reserved space to prevent layout shifts */}
                <div className="status-indicators-container smooth-height">
                  {/* Show tracking status if currently tracking */}
                  {trackingState.status === 'tracking' && (
                    <aside className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h2 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Setting up {owner}/{repo}
                          </h2>
                          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                            We're gathering contributor data and it will be ready in about 1-2
                            minutes. The page will refresh automatically when ready.
                          </p>
                        </div>
                      </div>
                    </aside>
                  )}
                  {/* Show data state indicator for pending/partial data */}
                  {!stats.loading &&
                    dataStatus &&
                    dataStatus.status !== 'success' &&
                    trackingState.status === 'tracked' && (
                      <aside>
                        <DataStateIndicator
                          status={dataStatus.status}
                          message={dataStatus.message}
                          metadata={dataStatus.metadata}
                          className="mt-4"
                        />
                      </aside>
                    )}
                </div>
              </>
            )}

            <section className="mt-6 tab-content-container">
              <ErrorBoundary context="Repository Data Provider">
                <RepoStatsProvider
                  value={{
                    stats,
                    lotteryFactor,
                    directCommitsData,
                    includeBots,
                    setIncludeBots,
                  }}
                >
                  {stats.loading ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="text-center text-muted-foreground">
                        Loading repository data...
                      </div>
                      {/* Use feed skeleton instead of generic card grid */}
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Card key={i} className="p-4">
                            <div className="space-y-3">
                              <div className="h-4 bg-muted rounded w-3/4"></div>
                              <div className="h-3 bg-muted rounded w-1/2"></div>
                              <div className="h-3 bg-muted rounded w-5/6"></div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ErrorBoundary context="Repository Chart Display">
                      <Outlet />
                    </ErrorBoundary>
                  )}
                </RepoStatsProvider>
              </ErrorBoundary>
            </section>
          </CardContent>
        </Card>
      </section>
      <aside>
        <ErrorBoundary context="Repository Insights">
          <InsightsSidebar />
        </ErrorBoundary>
      </aside>
    </article>
  );
}

// Route components
export function LotteryFactorRoute() {
  return (
    <ErrorBoundary context="Repository Health Analysis">
      <RepositoryHealthCard />
    </ErrorBoundary>
  );
}

export function ContributionsRoute() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);

  if (!owner || !repo) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Progressive loading: Charts load independently */}
      {/* Temporarily removed ErrorBoundary to debug chart rendering */}
      <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
        <LazyContributions />
      </Suspense>

      <ErrorBoundary context="Metrics and Trends">
        <MetricsAndTrendsCard owner={owner} repo={repo} timeRange={timeRange} />
      </ErrorBoundary>

      <ErrorBoundary context="Contributor of the Month">
        <ContributorOfMonthWrapper />
      </ErrorBoundary>
    </div>
  );
}

export function DistributionRoute() {
  return (
    <ErrorBoundary context="Distribution Analysis">
      <Distribution />
    </ErrorBoundary>
  );
}
