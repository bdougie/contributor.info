import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitHubSearchInput } from "@/components/ui/github-search-input";
import type { GitHubRepository } from "@/lib/github";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "lucide-react";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { toast } from "sonner";
import { RepoStatsProvider } from "@/lib/repo-stats-context";
import { RepositoryHealthCard } from "../health";
import { Contributions, MetricsAndTrendsCard } from "../activity";
import { Distribution } from "../distribution";
import { ContributorOfMonthWrapper } from "../contributor";
import { ExampleRepos } from "./example-repos";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { InsightsSidebar } from "@/components/insights/insights-sidebar";
import { RepoViewSkeleton } from "@/components/skeletons";
import { SocialMetaTags } from "@/components/common/layout";
import RepoNotFound from "./repo-not-found";
import { createChartShareUrl, getDubConfig } from "@/lib/dub";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { DataProcessingIndicator } from "./data-processing-indicator";
import { ErrorBoundary } from "@/components/error-boundary";
import { RepositoryInlineMetadata } from "@/components/ui/repository-inline-metadata";
import { useRepositoryDiscovery } from "@/hooks/use-repository-discovery";
import { DataStateIndicator } from "@/components/ui/data-state-indicator";

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots, setIncludeBots] = useState(false);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);
  const dubConfig = getDubConfig();
  const { isLoggedIn } = useGitHubAuth();
  
  // Handle repository discovery for new repositories
  const discoveryState = useRepositoryDiscovery({
    owner,
    repo,
    enabled: Boolean(owner && repo)
  });

  // Determine current tab based on URL
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.endsWith("/health")) return "lottery";
    if (path.endsWith("/distribution")) return "distribution";
    if (path.endsWith("/feed") || path.includes("/feed/")) return "feed";
    if (path.endsWith("/activity") || path.endsWith("/contributions"))
      return "contributions";
    return "contributions"; // default for root path
  };

  // Use our custom hooks
  const { stats, lotteryFactor, directCommitsData, dataStatus } = useCachedRepoData(
    owner,
    repo,
    timeRange,
    includeBots
  );

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

  // Handle share button click - create oss.fyi short link
  const handleShare = async () => {
    setIsGeneratingUrl(true);
    
    try {
      // Generate short URL for repository page
      const currentUrl = window.location.href;
      const chartType = getCurrentTab(); // Get current tab as chart type
      const repository = `${owner}/${repo}`;
      
      const shortUrl = await createChartShareUrl(
        currentUrl,
        `repository-${chartType}`,
        repository
      );
      
      // Create a descriptive share message
      const shareText = `Check out the ${chartType} analysis for ${repository}\n${shortUrl}`;
      
      await navigator.clipboard.writeText(shareText);
      
      const domain = dubConfig.isDev ? "dub.sh" : "oss.fyi";
      const isShortened = shortUrl !== currentUrl;
      
      if (isShortened) {
        toast.success(`Short link copied! (${domain})`);
      } else {
        toast.success("Repository link copied to clipboard!");
      }
    } catch (err) {
      console.error("Failed to create short URL:", err);
      // Fallback to original URL with descriptive text
      try {
        const fallbackText = `Check out the analysis for ${owner}/${repo}\n${window.location.href}`;
        await navigator.clipboard.writeText(fallbackText);
        toast.success("Repository link copied to clipboard!");
      } catch (fallbackErr) {
        toast.error("Failed to copy link");
      }
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  // Only show full skeleton if we don't have owner/repo params yet
  if (stats.loading && (!owner || !repo)) {
    return <RepoViewSkeleton />;
  }

  if (stats.error) {
    // Check if this is a 404 repository error
    const isRepoNotFound = stats.error.includes('not found') || 
                           stats.error.includes('does not exist') ||
                           stats.error.includes('404');
    
    // If it's a new repository being tracked, don't show error
    if (isRepoNotFound && discoveryState.isNewRepository) {
      // Continue to show the normal view with skeleton loaders
      // The tracking notification will inform the user
    } else if (isRepoNotFound) {
      return <RepoNotFound />;
    } else {
      // For other errors, show the generic error card
      return (
        <div className="container mx-auto py-2">
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-destructive mb-2">
                  Error
                </h2>
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
    <div className="container mx-auto py-2">
      <SocialMetaTags
        title={repoTitle}
        description={repoDescription}
        url={repoUrl}
        type="article"
        image={`social-cards/repo-${owner}-${repo}.png`}
      />
      <Card className="mb-8">
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
          <ExampleRepos onSelect={handleSelectExample} />
        </CardContent>
      </Card>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <span>{owner}/{repo}</span>
                  <RepositoryInlineMetadata owner={owner} repo={repo} />
                </CardTitle>
                <CardDescription>
                  Contribution analysis of recent pull requests
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                disabled={isGeneratingUrl}
                className="h-8 w-8"
                title={isGeneratingUrl ? "Generating short link..." : "Copy repository link"}
              >
                <Link className={`h-4 w-4 ${isGeneratingUrl ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={getCurrentTab()}
              className="space-y-4"
              onValueChange={(value) => {
                if (value === "contributions") {
                  navigate(`/${owner}/${repo}`);
                } else if (value === "lottery") {
                  navigate(`/${owner}/${repo}/health`);
                } else {
                  navigate(`/${owner}/${repo}/${value}`);
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="contributions">Activity</TabsTrigger>
                <TabsTrigger value="lottery">Health</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
                <TabsTrigger value="feed">Feed</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Show data processing indicator or new repository message */}
            {owner && repo && (
              <>
                <DataProcessingIndicator 
                  repository={`${owner}/${repo}`} 
                  className="mt-4" 
                />
                {discoveryState.isNewRepository && !stats.loading && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Welcome to {owner}/{repo}!
                        </h3>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                          This is a new repository. We're gathering contributor data and it will be ready in about 1-2 minutes. 
                          You can explore the interface while we work in the background.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {/* Show data state indicator for pending/partial data */}
                {!stats.loading && dataStatus && dataStatus.status !== 'success' && (
                  <DataStateIndicator
                    status={dataStatus.status}
                    message={dataStatus.message}
                    metadata={dataStatus.metadata}
                    className="mt-4"
                  />
                )}
              </>
            )}

            <div className="mt-6">
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
                    <div className="space-y-4">
                      <div className="text-center text-muted-foreground">
                        Loading repository data...
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-6">
                            <div className="animate-pulse space-y-3">
                              <div className="h-4 bg-muted rounded w-1/2"></div>
                              <div className="h-32 bg-muted rounded"></div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-6">
                            <div className="animate-pulse space-y-3">
                              <div className="h-4 bg-muted rounded w-1/2"></div>
                              <div className="h-32 bg-muted rounded"></div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <ErrorBoundary context="Repository Chart Display">
                      <Outlet />
                    </ErrorBoundary>
                  )}
                </RepoStatsProvider>
              </ErrorBoundary>
            </div>
          </CardContent>
        </Card>
      </div>
      <ErrorBoundary context="Repository Insights">
        <InsightsSidebar />
      </ErrorBoundary>
    </div>
  );
}

// Route components
export function LotteryFactorRoute() {
  return (
    <ErrorBoundary context="Repository Health Analysis">
      <ProgressiveChartWrapper>
        <RepositoryHealthCard />
      </ProgressiveChartWrapper>
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
      <ErrorBoundary context="Contributions Chart">
        <ProgressiveChartWrapper>
          <Contributions />
        </ProgressiveChartWrapper>
      </ErrorBoundary>
      
      <ErrorBoundary context="Metrics and Trends">
        <ProgressiveChartWrapper>
          <MetricsAndTrendsCard owner={owner} repo={repo} timeRange={timeRange} />
        </ProgressiveChartWrapper>
      </ErrorBoundary>
      
      <ErrorBoundary context="Contributor of the Month">
        <ProgressiveChartWrapper>
          <ContributorOfMonthWrapper />
        </ProgressiveChartWrapper>
      </ErrorBoundary>
    </div>
  );
}

export function DistributionRoute() {
  return (
    <ErrorBoundary context="Distribution Analysis">
      <ProgressiveChartWrapper>
        <Distribution />
      </ProgressiveChartWrapper>
    </ErrorBoundary>
  );
}

// Progressive Chart Wrapper - simplified since routes are already lazy loaded
function ProgressiveChartWrapper({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  // Remove Suspense here since the routes are already lazy loaded with Suspense in App.tsx
  // This double Suspense was causing the blank page issue
  return <>{children}</>;
}
