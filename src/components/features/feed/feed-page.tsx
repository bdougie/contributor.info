import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { RepoStatsProvider } from "@/lib/repo-stats-context";
import PRActivityWrapper from "../activity/pr-activity-wrapper";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { FeedSkeleton } from "@/components/skeletons";
import { SocialMetaTags } from "@/components/common/layout";
import { LastUpdated } from "@/components/ui/last-updated";
import { useDataTimestamp } from "@/hooks/use-data-timestamp";

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

  // Track data timestamps for freshness indicators
  const { lastUpdated } = useDataTimestamp([stats, lotteryFactor, directCommitsData], {
    autoUpdate: true
  });

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

  if (stats._error) {
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
      
      {/* Add timestamp indicator for feed freshness */}
      {!stats.loading && (
        <div className="mb-4 flex justify-end">
          <LastUpdated 
            timestamp={lastUpdated}
            label="Feed updated"
            size="sm"
          />
        </div>
      )}

      <RepoStatsProvider
        value={{
          stats,
          lotteryFactor,
          directCommitsData,
          includeBots,
          setIncludeBots,
        }}
      >
        <PRActivityWrapper />
      </RepoStatsProvider>
    </div>
  );
}