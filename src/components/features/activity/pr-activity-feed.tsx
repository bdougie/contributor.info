import { ActivityItem } from "./activity-item";
import { PullRequestActivity, ActivityType } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { ActivityItemSkeleton } from "@/components/skeletons";

export interface PullRequestActivityFeedProps {
  activities?: PullRequestActivity[];
  loading?: boolean;
  error?: Error | null;
  selectedTypes: ActivityType[];
}

export function PullRequestActivityFeed({
  activities = [],
  loading = false,
  error = null,
  selectedTypes,
}: PullRequestActivityFeedProps) {
  // Filter activities by selected types if needed
  const filteredActivities =
    selectedTypes.length > 0
      ? activities.filter((activity) => selectedTypes.includes(activity.type))
      : activities;

  if (loading && filteredActivities.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <ActivityItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-destructive">
        <p>Error loading PR activity: {error.message}</p>
      </div>
    );
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="py-2 text-center text-muted-foreground">
        <p>No PR activity found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredActivities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
      {loading && filteredActivities.length > 0 && (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
