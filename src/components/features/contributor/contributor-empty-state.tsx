import { Trophy, Users, Calendar, TrendingUp } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  type: "no_data" | "no_activity" | "minimal_activity" | "loading_error";
  message?: string;
  suggestion?: string;
  className?: string;
}

export function ContributorEmptyState({
  type,
  message,
  suggestion,
  className,
}: EmptyStateProps) {
  const getEmptyStateContent = () => {
    switch (type) {
      case "no_data":
        return {
          icon: (
            <Users
              className="h-16 w-16 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
          ),
          title: "No Contributor Data Available",
          description:
            message ||
            "We couldn't find any contributor data for this repository.",
          suggestionText:
            suggestion ||
            "Make sure the repository has some activity and try again.",
          severity: "info" as const,
          bgColor:
            "from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900",
        };

      case "no_activity":
        return {
          icon: (
            <Calendar
              className="h-16 w-16 text-blue-400 dark:text-blue-500"
              aria-hidden="true"
            />
          ),
          title: "No Activity This Month",
          description:
            message || "No contributor activity found for the current period.",
          suggestionText:
            suggestion ||
            "Check back later as contributors start making contributions this month.",
          severity: "info" as const,
          bgColor:
            "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
        };

      case "minimal_activity":
        return {
          icon: (
            <TrendingUp
              className="h-14 w-14 text-yellow-500 dark:text-yellow-400"
              aria-hidden="true"
            />
          ),
          title: "Limited Activity",
          description:
            message || "There's been minimal contributor activity this month.",
          suggestionText:
            suggestion ||
            "The leaderboard will be more meaningful as more contributors join.",
          severity: "warning" as const,
          bgColor:
            "from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30",
        };

      case "loading_error":
        return {
          icon: (
            <Trophy
              className="h-16 w-16 text-red-400 dark:text-red-500"
              aria-hidden="true"
            />
          ),
          title: "Unable to Load Contributor Data",
          description:
            message ||
            "We encountered an error while loading contributor information.",
          suggestionText:
            suggestion ||
            "Please try refreshing the page or check your network connection.",
          severity: "error" as const,
          bgColor:
            "from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30",
        };

      default:
        return {
          icon: (
            <Users
              className="h-16 w-16 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
          ),
          title: "No Data Available",
          description:
            "Unable to display contributor information at this time.",
          suggestionText: "Please try again later.",
          severity: "info" as const,
          bgColor:
            "from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900",
        };
    }
  };

  const content = getEmptyStateContent();

  return (
    <Card
      className={cn(
        "w-full transition-all duration-300",
        "border border-gray-200 dark:border-gray-800",
        "shadow-sm hover:shadow-md",
        className
      )}
      role={content.severity === "error" ? "alert" : "status"}
      aria-live={content.severity === "error" ? "assertive" : "polite"}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl font-bold">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500">
            <Trophy className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-gray-900 dark:text-gray-100">
            Contributor of the Month
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div
          className={cn(
            "text-center py-12 px-6 rounded-xl",
            "bg-gradient-to-br",
            content.bgColor
          )}
        >
          {/* Icon with animated background */}
          <div
            className={cn(
              "flex justify-center mb-6 relative",
              "before:absolute before:inset-0 before:rounded-full",
              "before:bg-gradient-to-br before:from-white/20 before:to-transparent",
              "before:blur-xl before:scale-150",
              content.severity === "warning" && "animate-pulse"
            )}
          >
            <div
              className={cn(
                "relative z-10 p-4 rounded-full",
                "bg-primary-white-glass dark:bg-primary-white-glass-dark",
                "backdrop-blur-sm border border-white/20 dark:border-gray-700/20",
                "shadow-lg"
              )}
            >
              {content.icon}
            </div>
          </div>

          <h3
            className={cn(
              "text-xl font-bold mb-3",
              "text-gray-900 dark:text-gray-100"
            )}
          >
            {content.title}
          </h3>

          <p
            className={cn(
              "text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto",
              "leading-relaxed"
            )}
          >
            {content.description}
          </p>

          {content.suggestionText && (
            <div
              className={cn(
                "max-w-md mx-auto p-4 rounded-lg",
                "bg-primary-white-glass dark:bg-primary-white-glass-dark",
                "backdrop-blur-sm border border-white/30 dark:border-gray-700/30",
                "shadow-sm"
              )}
            >
              <Badge
                className={cn(
                  "mb-3 px-3 py-1 font-semibold",
                  content.severity === "error" &&
                    "bg-red-500 hover:bg-red-600 text-white",
                  content.severity === "warning" &&
                    "bg-yellow-500 hover:bg-yellow-600 text-white",
                  content.severity === "info" &&
                    "bg-blue-500 hover:bg-blue-600 text-white"
                )}
              >
                {content.severity === "error"
                  ? "⚠️ Error"
                  : content.severity === "warning"
                  ? "💡 Note"
                  : "✨ Tip"}
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {content.suggestionText}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Additional component for minimal activity display
interface MinimalActivityDisplayProps {
  contributors: Array<{
    login: string;
    avatar_url: string;
    activity: {
      pullRequests: number;
      reviews: number;
      comments: number;
      totalScore: number;
    };
    rank: number;
  }>;
  month: string;
  year: number;
  className?: string;
}

export function MinimalActivityDisplay({
  contributors,
  month,
  year,
  className,
}: MinimalActivityDisplayProps) {
  const totalContributors = contributors.length;
  const totalActivity = contributors.reduce(
    (sum, c) => sum + c.activity.totalScore,
    0
  );

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-yellow-500" />
          Early Activity - {month} {year}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Getting Started
          </Badge>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {totalContributors} contributor{totalContributors !== 1 ? "s" : ""}{" "}
            • {totalActivity} total points
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Early Month Activity Detected
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  We're tracking some initial contributor activity. The
                  leaderboard will become more competitive as the month
                  progresses.
                </p>
              </div>
            </div>
          </div>

          {contributors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Current Activity
              </h4>
              <div className="space-y-2">
                {contributors.slice(0, 3).map((contributor) => (
                  <div
                    key={contributor.login}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {contributor.login.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {contributor.login}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {contributor.activity.totalScore} pts
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
