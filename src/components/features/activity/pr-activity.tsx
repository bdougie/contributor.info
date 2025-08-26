import { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PullRequestActivityFeed } from "./pr-activity-feed";
import { useCachedPRActivity } from "@/hooks/use-cached-pr-activity";
import { useFastPRData } from "@/hooks/use-fast-pr-data";
import { usePRActivityStore } from "@/lib/pr-activity-store";
import { useTimeRange } from "@/lib/time-range-store";

export default function PRActivity() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { timeRange } = useTimeRange();
  const { stats } = useContext(RepoStatsContext);
  const { selectedTypes, includeBots, toggleActivityType, setIncludeBots } = usePRActivityStore();
  const [visibleCount, setVisibleCount] = useState(15);
  const [hasBots, setHasBots] = useState(false);

  // Use fast PR data for immediate loading, fallback to context data
  const { pullRequests: fastPRs, loading: fastLoading, error: fastError } = useFastPRData(owner, repo, timeRange);
  
  // Use fast data if available, otherwise fallback to context data
  const effectivePRs = fastPRs.length > 0 ? fastPRs : stats.pullRequests;
  const effectiveLoading = fastLoading && stats.loading;
  const effectiveError = fastError || stats.error;

  const {
    activities: allActivities,
    loading: activityLoading,
    error: activityError,
  } = useCachedPRActivity(effectivePRs);

  // Combined loading state and error
  const loading = effectiveLoading || activityLoading;
  const _error = activityError || (effectiveError ? new Error(effectiveError) : null);

  // Check if there are any bot activities
  useEffect(() => {
    const botActivities = allActivities.some(
      (activity) => activity.user.isBot === true
    );
    setHasBots(botActivities);
  }, [allActivities]);

  // Filter activities based on type and bot settings
  const filteredActivities = allActivities.filter(
    (activity) =>
      selectedTypes.includes(activity.type) &&
      (includeBots || activity.user.isBot !== true)
  );

  const visibleActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = visibleActivities.length < filteredActivities.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 15);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull Request Activity Feed</CardTitle>
        <CardDescription>
          Track detailed activity on pull requests in this repository
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-opened"
              checked={selectedTypes.includes("opened")}
              onCheckedChange={() => toggleActivityType("opened")}
            />
            <Label htmlFor="filter-opened" className="text-sm">
              Opened
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-closed"
              checked={selectedTypes.includes("closed")}
              onCheckedChange={() => toggleActivityType("closed")}
            />
            <Label htmlFor="filter-closed" className="text-sm">
              Closed
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-merged"
              checked={selectedTypes.includes("merged")}
              onCheckedChange={() => toggleActivityType("merged")}
            />
            <Label htmlFor="filter-merged" className="text-sm">
              Merged
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-reviewed"
              checked={selectedTypes.includes("reviewed")}
              onCheckedChange={() => toggleActivityType("reviewed")}
            />
            <Label htmlFor="filter-reviewed" className="text-sm">
              Reviewed
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-commented"
              checked={selectedTypes.includes("commented")}
              onCheckedChange={() => toggleActivityType("commented")}
            />
            <Label htmlFor="filter-commented" className="text-sm">
              Commented
            </Label>
          </div>
          {hasBots && (
            <div className="flex items-center space-x-2">
              <Switch
                id="filter-bots"
                checked={includeBots}
                onCheckedChange={setIncludeBots}
              />
              <Label htmlFor="filter-bots" className="text-sm">
                Show Bots
              </Label>
            </div>
          )}
        </div>

        <div className="mb-2 text-sm text-muted-foreground">
          Showing {visibleActivities.length} of {filteredActivities.length}{" "}
          activities
        </div>

        <PullRequestActivityFeed
          activities={visibleActivities}
          loading={loading}
          error={error: _error}
          selectedTypes={selectedTypes}
        />

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              onClick={handleLoadMore}
              disabled={loading}
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
