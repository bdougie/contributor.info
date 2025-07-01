import { useState, Suspense, useEffect } from "react";
import { useParams, useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "lucide-react";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { toast } from "sonner";
import { RepoStatsProvider } from "@/lib/repo-stats-context";
import { RepositoryHealthCard } from "../health";
import { Contributions, MetricsAndTrendsCard } from "../activity";
import { Distribution } from "../distribution";
import { ContributorOfMonthWrapper } from "../contributor";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { InsightsSidebar } from "@/components/insights/insights-sidebar";
import { RepoViewSkeleton } from "@/components/skeletons";
import { SocialMetaTags } from "@/components/common/layout";
import { UnifiedRepoSearch } from "@/components/common/search";
import RepoNotFound from "./repo-not-found";
import { createChartShareUrl, getDubConfig } from "@/lib/dub";

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots, setIncludeBots] = useState(false);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const dubConfig = getDubConfig();

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
  const { stats, lotteryFactor, directCommitsData } = useCachedRepoData(
    owner,
    repo,
    timeRange,
    includeBots
  );

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
    
    if (isRepoNotFound) {
      return <RepoNotFound />;
    }

    // For other errors, show the generic error card
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-destructive mb-2">
                Error
              </h2>
              <p className="text-muted-foreground">{stats.error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
          <UnifiedRepoSearch 
            isHomeView={false}
            placeholder="Search another repository (e.g., facebook/react)"
            buttonText="Search"
          />
        </CardContent>
      </Card>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {owner}/{repo}
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

            <div className="mt-6">
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
                  <Outlet />
                )}
              </RepoStatsProvider>
            </div>
          </CardContent>
        </Card>
      </div>
      <InsightsSidebar />
    </div>
  );
}

// Route components
export function LotteryFactorRoute() {
  return (
    <ProgressiveChartWrapper>
      <RepositoryHealthCard />
    </ProgressiveChartWrapper>
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
      <ProgressiveChartWrapper>
        <Contributions />
      </ProgressiveChartWrapper>
      
      <ProgressiveChartWrapper>
        <MetricsAndTrendsCard owner={owner} repo={repo} timeRange={timeRange} />
      </ProgressiveChartWrapper>
      
      <ProgressiveChartWrapper>
        <ContributorOfMonthWrapper />
      </ProgressiveChartWrapper>
    </div>
  );
}

export function DistributionRoute() {
  return (
    <ProgressiveChartWrapper>
      <Distribution />
    </ProgressiveChartWrapper>
  );
}

// Progressive Chart Wrapper - loads individual components with their own loading states
function ProgressiveChartWrapper({ children }: { children: React.ReactNode }) {
  const ChartSkeleton = () => (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-48 bg-muted rounded"></div>
          <div className="flex gap-4">
            <div className="h-8 bg-muted rounded w-16"></div>
            <div className="h-8 bg-muted rounded w-16"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Suspense fallback={<ChartSkeleton />}>
      {children}
    </Suspense>
  );
}
