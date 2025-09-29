import { useState, useMemo } from 'react';
import { Database } from '@/components/ui/icon';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SpamFilterControls } from '@/components/features/spam/spam-filter-controls';
import { SpamAwareActivityItem } from './spam-aware-activity-item';
import { ActivityItemSkeleton } from '@/components/skeletons';
import { detectBot } from '@/lib/utils/bot-detection';
import { useSpamFilteredFeed } from '@/hooks/use-spam-filtered-feed';
import { usePRActivityStore } from '@/lib/pr-activity-store';
import {
  convertDatabasePRsToActivities,
  sortActivitiesByTimestamp,
} from '@/lib/api/pr-activity-adapter';

export default function FilteredPRActivity() {
  const { owner, repo: repoName } = useParams<{ owner: string; repo: string }>();
  const { includeBots, setIncludeBots } = usePRActivityStore();
  const [visibleCount, setVisibleCount] = useState(15);

  const { pullRequests, loading, error, spamStats, filterOptions, updateFilterOptions } =
    useSpamFilteredFeed(owner || '', repoName || '', 100);

  // Convert database PRs to activity format
  const activities = useMemo(() => {
    const converted = convertDatabasePRsToActivities(pullRequests);
    return sortActivitiesByTimestamp(converted);
  }, [pullRequests]);

  // Filter by bot status only (spam filtering is handled by SpamFilterControls)
  const filteredActivities = activities.filter((activity) => {
    // Check both the existing isBot flag and detect using name (which is actually the username/login)
    const isBot = activity.user.isBot || detectBot({ username: activity.user.name }).isBot;
    return includeBots || !isBot;
  });

  const visibleActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = visibleActivities.length < filteredActivities.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 15);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pull Request Feed</CardTitle>
          <CardDescription>Loading pull requests...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pull Request Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasBots = activities.some(
    (activity) => activity.user.isBot || detectBot({ username: activity.user.name }).isBot
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pull Request Feed</CardTitle>
            <CardDescription>Recent pull requests with spam filtering</CardDescription>
          </div>
          <SpamFilterControls
            filterOptions={filterOptions}
            onFilterChange={updateFilterOptions}
            spamStats={spamStats || undefined}
          />
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {/* Database source indicator */}
        <Alert className="mb-4">
          <Database className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Using cached data</span> - This feed shows PRs from our
            database with spam detection.
            {spamStats && spamStats.totalAnalyzed > 0 && (
              <span className="block mt-1 text-xs">
                {spamStats.totalAnalyzed} PRs analyzed • {spamStats.spamCount} marked as spam (
                {spamStats.spamPercentage.toFixed(1)}%)
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Filter toggles */}
        {hasBots && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <Switch id="filter-bots" checked={includeBots} onCheckedChange={setIncludeBots} />
              <Label htmlFor="filter-bots" className="text-sm">
                Show Bots
              </Label>
            </div>
          </div>
        )}

        <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2">
          <span>
            Showing {visibleActivities.length} of {filteredActivities.length} activities
          </span>
          <span>•</span>
          <span className="text-xs bg-muted px-2 py-1 rounded">
            📊 Sorted by spam score (highest first)
          </span>
        </div>

        {/* Activity Feed */}
        <div className="space-y-2">
          {visibleActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {spamStats && spamStats.spamCount === 0 ? (
                <div>
                  <p className="font-medium">No spam detected in this repository</p>
                  <p className="text-sm mt-1">All pull requests appear to be legitimate</p>
                </div>
              ) : (
                <p>No pull requests match your filter criteria</p>
              )}
            </div>
          ) : (
            visibleActivities.map((activity) => (
              <SpamAwareActivityItem key={activity.id} activity={activity} />
            ))
          )}
        </div>

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={handleLoadMore} disabled={loading}>
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
