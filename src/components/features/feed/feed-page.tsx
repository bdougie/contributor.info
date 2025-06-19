import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RepoStatsProvider } from "@/lib/repo-stats-context";
import { PRActivity } from "../activity";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { FeedSkeleton } from "@/components/skeletons";
import { SocialMetaTags } from "@/components/common/layout";

export default function FeedPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots, setIncludeBots] = useState(false);

  // Use our custom hooks
  const { stats, lotteryFactor, directCommitsData } = useCachedRepoData(
    owner,
    repo,
    timeRange,
    includeBots
  );

  if (!owner || !repo) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Invalid Repository</h2>
              <p className="text-muted-foreground">
                Please navigate to a specific repository to view its feed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stats.loading) {
    return <FeedSkeleton />;
  }

  if (stats.error) {
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

  const feedTitle = `${owner}/${repo} - Activity Feed`;
  const feedDescription = `Real-time activity feed for ${owner}/${repo}. Track pull requests, reviews, comments, and other repository activities.`;
  const feedUrl = `https://contributor.info/${owner}/${repo}/feed`;

  return (
    <div className="container mx-auto py-2">
      <SocialMetaTags
        title={feedTitle}
        description={feedDescription}
        url={feedUrl}
        type="article"
        image={`social-cards/repo-${owner}-${repo}.png`}
      />
      

      <RepoStatsProvider
        value={{
          stats,
          lotteryFactor,
          directCommitsData,
          includeBots,
          setIncludeBots,
        }}
      >
        <PRActivity />
      </RepoStatsProvider>
    </div>
  );
}