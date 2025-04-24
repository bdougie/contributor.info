import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useContext } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PullRequestActivityFeed } from "./pr-activity/pr-activity-feed";
import { usePRActivity } from "@/hooks/use-pr-activity";

export default function PRActivity() {
  const { stats } = useContext(RepoStatsContext);
  const [selectedTypes, setSelectedTypes] = useState<
    Array<"opened" | "closed" | "merged" | "reviewed" | "commented">
  >(["opened", "merged", "commented"]);
  const [visibleCount, setVisibleCount] = useState(15);

  const { activities, loading, error } = usePRActivity(stats.pullRequests);

  const filteredActivities = activities.filter((activity) =>
    selectedTypes.includes(activity.type)
  );

  const visibleActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = visibleActivities.length < filteredActivities.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 15);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PR Activity Feed</CardTitle>
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
              onCheckedChange={(checked) => {
                setSelectedTypes((prev) =>
                  checked
                    ? [...prev, "opened"]
                    : prev.filter((type) => type !== "opened")
                );
              }}
            />
            <Label htmlFor="filter-opened" className="text-sm">
              Opened
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-closed"
              checked={selectedTypes.includes("closed")}
              onCheckedChange={(checked) => {
                setSelectedTypes((prev) =>
                  checked
                    ? [...prev, "closed"]
                    : prev.filter((type) => type !== "closed")
                );
              }}
            />
            <Label htmlFor="filter-closed" className="text-sm">
              Closed
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-merged"
              checked={selectedTypes.includes("merged")}
              onCheckedChange={(checked) => {
                setSelectedTypes((prev) =>
                  checked
                    ? [...prev, "merged"]
                    : prev.filter((type) => type !== "merged")
                );
              }}
            />
            <Label htmlFor="filter-merged" className="text-sm">
              Merged
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-reviewed"
              checked={selectedTypes.includes("reviewed")}
              onCheckedChange={(checked) => {
                setSelectedTypes((prev) =>
                  checked
                    ? [...prev, "reviewed"]
                    : prev.filter((type) => type !== "reviewed")
                );
              }}
            />
            <Label htmlFor="filter-reviewed" className="text-sm">
              Reviewed
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-commented"
              checked={selectedTypes.includes("commented")}
              onCheckedChange={(checked) => {
                setSelectedTypes((prev) =>
                  checked
                    ? [...prev, "commented"]
                    : prev.filter((type) => type !== "commented")
                );
              }}
            />
            <Label htmlFor="filter-commented" className="text-sm">
              Commented
            </Label>
          </div>
        </div>

        <div className="mb-2 text-sm text-muted-foreground">
          Showing {visibleActivities.length} of {filteredActivities.length}{" "}
          activities
        </div>

        <PullRequestActivityFeed
          activities={visibleActivities}
          loading={loading}
          error={error}
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
