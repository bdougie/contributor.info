import { ContributorRanking } from "@/lib/types";
import { ContributorCard } from "./ContributorCard";
import {
  ContributorEmptyState,
  MinimalActivityDisplay,
} from "./ContributorEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContributorOfTheMonthProps {
  ranking: ContributorRanking | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function ContributorOfTheMonth({
  ranking,
  loading = false,
  error,
  className,
}: ContributorOfTheMonthProps) {
  if (loading) {
    return (
      <Card
        className={cn("w-full", className)}
        aria-label="Loading contributor data"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Contributor of the Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse" aria-hidden="true">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-200 dark:bg-gray-700 rounded"
                ></div>
              ))}
            </div>
          </div>
          <span className="sr-only">Loading contributor rankings...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <ContributorEmptyState
        type="loading_error"
        message={error}
        className={className}
      />
    );
  }

  if (!ranking || ranking.contributors.length === 0) {
    return <ContributorEmptyState type="no_activity" className={className} />;
  }

  const isWinnerPhase = ranking.phase === "winner_announcement";
  const topContributors = ranking.contributors.slice(0, 5);

  // Handle minimal activity case (less than 3 contributors or very low total activity)
  const totalActivity = ranking.contributors.reduce(
    (sum, c) => sum + c.activity.totalScore,
    0
  );
  const hasMinimalActivity =
    ranking.contributors.length < 3 || totalActivity < 10;

  if (hasMinimalActivity && !isWinnerPhase) {
    return (
      <MinimalActivityDisplay
        contributors={ranking.contributors}
        month={ranking.month}
        year={ranking.year}
        className={className}
      />
    );
  }

  return (
    <Card
      className={cn(
        "w-full transition-all duration-300 ease-in-out",
        "bg-white dark:bg-gray-900",
        "border border-gray-200 dark:border-gray-800",
        "shadow-sm hover:shadow-md",
        className
      )}
      role="region"
      aria-labelledby="contributor-heading"
    >
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle
            id="contributor-heading"
            className="flex items-center gap-3 text-xl sm:text-2xl font-bold"
          >
            {isWinnerPhase ? (
              <>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500">
                  <Trophy className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <span className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                  Contributor of the Month
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
                  <TrendingUp
                    className="h-5 w-5 text-white"
                    aria-hidden="true"
                  />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Current Leaderboard
                </span>
              </>
            )}
          </CardTitle>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <time className="font-medium">
              {ranking.month} {ranking.year}
            </time>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge
            className={cn(
              "text-xs font-semibold px-3 py-1 transition-all duration-200",
              isWinnerPhase
                ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 shadow-md"
                : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
            )}
          >
            {isWinnerPhase ? "🏆 Winner Announcement" : "📊 Running Tally"}
          </Badge>

          {isWinnerPhase && ranking.winner && (
            <span className="text-xs text-gray-600 dark:text-gray-400 italic">
              Announcing {ranking.month}'s champion!
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {isWinnerPhase && ranking.winner ? (
          <div className="space-y-8">
            {/* Winner Display */}
            <section aria-labelledby="winner-heading" className="text-center">
              <h3
                id="winner-heading"
                className={cn(
                  "text-lg sm:text-xl font-bold mb-6",
                  "text-gray-900 dark:text-gray-100",
                  "flex items-center justify-center gap-2 flex-wrap"
                )}
              >
                <span
                  role="img"
                  aria-label="Celebration"
                  className="text-2xl animate-bounce"
                >
                  🎉
                </span>
                <span>
                  Congratulations to our {ranking.month} {ranking.year} Winner!
                </span>
                <span
                  role="img"
                  aria-label="Celebration"
                  className="text-2xl animate-bounce [animation-delay:0.1s]"
                >
                  🎉
                </span>
              </h3>
              <div className="max-w-sm mx-auto transform hover:scale-[1.02] transition-transform duration-300">
                <ContributorCard
                  contributor={ranking.winner}
                  isWinner={true}
                  showRank={false}
                />
              </div>
            </section>

            {/* Top 5 Runners-up */}
            {topContributors.length > 1 && (
              <section aria-labelledby="runners-up-heading">
                <h4
                  id="runners-up-heading"
                  className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></span>
                  Top Contributors
                </h4>
                <ul
                  className={cn(
                    "grid gap-4",
                    "grid-cols-1",
                    "sm:grid-cols-2",
                    "lg:grid-cols-3",
                    "xl:grid-cols-4"
                  )}
                  role="list"
                  aria-label="Top contributor rankings"
                >
                  {topContributors.slice(1).map((contributor, index) => (
                    <li
                      key={contributor.login}
                      className="transform hover:scale-[1.02] transition-all duration-200"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <ContributorCard
                        contributor={contributor}
                        showRank={true}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <section aria-labelledby="leaderboard-heading">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h3
                id="leaderboard-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-green-500 to-blue-500 animate-pulse"></span>
                This Month's Leaders
              </h3>
              <span
                className={cn(
                  "text-sm px-3 py-1 rounded-full",
                  "bg-gradient-to-r from-gray-100 to-gray-200",
                  "dark:from-gray-800 dark:to-gray-700",
                  "text-gray-700 dark:text-gray-300 font-medium"
                )}
                aria-label={`${topContributors.length} active contributors this month`}
              >
                {topContributors.length} active contributor
                {topContributors.length !== 1 ? "s" : ""}
              </span>
            </div>

            <ul
              className={cn(
                "grid gap-4",
                "grid-cols-1",
                "sm:grid-cols-2",
                "lg:grid-cols-3",
                "xl:grid-cols-4"
              )}
              role="list"
              aria-label="Current month contributor leaderboard"
            >
              {topContributors.map((contributor, index) => (
                <li
                  key={contributor.login}
                  className="transform hover:scale-[1.02] transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <ContributorCard contributor={contributor} showRank={true} />
                </li>
              ))}
            </ul>

            {ranking.contributors.length > 5 && (
              <div
                className={cn(
                  "text-center pt-6 mt-6",
                  "border-t border-gray-200 dark:border-gray-700"
                )}
                aria-live="polite"
              >
                <p
                  className={cn(
                    "text-sm text-gray-600 dark:text-gray-400",
                    "bg-gradient-to-r from-gray-50 to-gray-100",
                    "dark:from-gray-800/50 dark:to-gray-700/50",
                    "rounded-lg px-4 py-2 inline-block"
                  )}
                >
                  And{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {ranking.contributors.length - 5}
                  </span>{" "}
                  more contributors contributing this month...
                </p>
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
