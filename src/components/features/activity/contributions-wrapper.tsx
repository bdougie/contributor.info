// Wrapper component to conditionally load contributions chart
import { lazy, Suspense, useContext } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PullRequestActivityFeed } from "./pr-activity-feed";
import { usePRActivity } from "@/hooks/use-pr-activity";
import { usePRActivityStore } from "@/lib/pr-activity-store";
import { RepoStatsContext } from "@/lib/repo-stats-context";

// Lazy load the contributions component to avoid ES module issues in tests
const ContributionsChart = lazy(() => {
  // Check if we're in a test environment
  if (
    import.meta.env?.MODE === "test" ||
    (typeof global !== "undefined" && global.process?.env?.NODE_ENV === "test")
  ) {
    // Return a mock component for tests
    return Promise.resolve({
      default: () => (
        <div
          data-testid="mock-contributions-chart"
          className="h-[400px] w-full flex items-center justify-center"
        >
          <span>Mock Contributions Chart</span>
        </div>
      ),
    });
  }

  // Load the actual component in production
  return import("./contributions").then((module) => ({
    default: module.default,
  }));
});

export default function ContributionsWrapper() {
  const { stats } = useContext(RepoStatsContext);
  const { selectedTypes } = usePRActivityStore();
  const { activities, loading, error } = usePRActivity(stats.pullRequests);

  // Limit activities for the sidebar view
  const visibleActivities = activities.slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Suspense
          fallback={
            <Card>
              <CardContent className="p-6">
                <div className="h-[400px] w-full flex items-center justify-center">
                  <span className="text-muted-foreground">Loading chart...</span>
                </div>
              </CardContent>
            </Card>
          }
        >
          <ContributionsChart />
        </Suspense>
      </div>
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Recent PR Activity</CardTitle>
            <CardDescription>Latest pull request actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              <PullRequestActivityFeed
                activities={visibleActivities}
                loading={loading}
                error={error}
                selectedTypes={selectedTypes}
              />
            </div>
            {activities.length > 10 && (
              <>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing {visibleActivities.length} of {activities.length} activities
                </p>
                <div className="mt-3 text-center">
                  <button
                    onClick={() => {
                      // Scroll to the PR activity section
                      const prActivitySection = document.querySelector('[data-testid="pr-activity-section"]');
                      if (prActivitySection) {
                        prActivitySection.scrollIntoView({ 
                          behavior: 'smooth',
                          block: 'start'
                        });
                      }
                    }}
                    className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  >
                    See more →
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
