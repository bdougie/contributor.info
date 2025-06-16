import { useState } from "react";
import { useParams, useNavigate, Outlet } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchIcon } from "lucide-react";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { RepoStatsProvider } from "@/lib/repo-stats-context";
import { LotteryFactor } from "../health";
import { Contributions, PRActivity } from "../activity";
import { Distribution } from "../distribution";
import { ContributorOfMonthWrapper } from "../contributor";
import { ExampleRepos } from "./example-repos";
import { useRepoData } from "@/hooks/use-repo-data";
import { useRepoSearch } from "@/hooks/use-repo-search";
import { InsightsDrawer } from "@/components/insights/insights-drawer";
import { RepoViewSkeleton } from "@/components/skeletons";
import { SocialMetaTags } from "@/components/common/layout";

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots, setIncludeBots] = useState(false);

  // Use our custom hooks
  const { stats, lotteryFactor, directCommitsData } = useRepoData(
    owner,
    repo,
    timeRange,
    includeBots
  );

  const { searchInput, setSearchInput, handleSearch, handleSelectExample } =
    useRepoSearch({ isHomeView: false });

  if (stats.loading) {
    return <RepoViewSkeleton />;
  }

  if (stats.error) {
    return (
      <div className="container mx-auto py-8">
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
    <div className="container mx-auto py-8">
      <SocialMetaTags
        title={repoTitle}
        description={repoDescription}
        url={repoUrl}
        type="article"
        image={`social-cards/repo-${owner}-${repo}.png`}
      />
      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder="Search another repository (e.g., facebook/react)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" aria-label="Search">
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
          <ExampleRepos onSelect={handleSelectExample} />
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
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="lottery"
              className="space-y-4"
              onValueChange={(value) => {
                navigate(
                  `/${owner}/${repo}${value === "lottery" ? "" : `/${value}`}`
                );
              }}
            >
              <TabsList>
                <TabsTrigger value="lottery">Health</TabsTrigger>
                <TabsTrigger value="contributions">Activity</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
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
                <Outlet />
              </RepoStatsProvider>
            </div>
          </CardContent>
        </Card>
      </div>
      <InsightsDrawer />
    </div>
  );
}

// Route components
export function LotteryFactorRoute() {
  return <LotteryFactor />;
}

export function ContributionsRoute() {
  return (
    <div className="space-y-8">
      <Contributions />
      <ContributorOfMonthWrapper />
      <PRActivity />
    </div>
  );
}

export function DistributionRoute() {
  return <Distribution />;
}