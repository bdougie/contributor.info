import { useState } from 'react';
import { ArrowLeft } from '@/components/ui/icon';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RepoStatsProvider } from '@/lib/repo-stats-context';
import FilteredPRActivity from '../activity/pr-activity-filtered';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { useCachedRepoData } from '@/hooks/use-cached-repo-data';
import { FeedSkeleton } from '@/components/skeletons';
import { SocialMetaTags } from '@/components/common/layout';

export default function SpamFeedPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots, setIncludeBots] = useState(false);

  const handleBackToFeed = () => {
    if (owner && repo) {
      navigate(`/${owner}/${repo}/feed`);
    }
  };

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
                Please navigate to a specific repository to view its spam feed.
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
              <h2 className="text-2xl font-semibold text-destructive mb-2">Error</h2>
              <p className="text-muted-foreground">{stats.error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const feedTitle = `${owner}/${repo} - Spam Analysis Feed`;
  const feedDescription = `Spam detection and analysis feed for ${owner}/${repo}. Review potentially suspicious pull requests and contributions with advanced filtering.`;
  const feedUrl = `https://contributor.info/${owner}/${repo}/feed/spam`;

  return (
    <div className="container mx-auto py-2">
      <SocialMetaTags
        title={feedTitle}
        description={feedDescription}
        url={feedUrl}
        type="article"
        image={`social-cards/repo-${owner}-${repo}.png`}
      />

      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToFeed}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to feed
        </Button>
      </div>

      <RepoStatsProvider
        value={{
          stats,
          lotteryFactor,
          directCommitsData,
          includeBots,
          setIncludeBots,
        }}
      >
        <FilteredPRActivity />
      </RepoStatsProvider>
    </div>
  );
}
