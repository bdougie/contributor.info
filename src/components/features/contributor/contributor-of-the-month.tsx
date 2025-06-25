import { ContributorRanking } from "@/lib/types";
import { ContributorCard } from "./contributor-card";
import {
  ContributorEmptyState,
  MinimalActivityDisplay,
} from "./contributor-empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContributorOfMonthSkeleton } from "@/components/skeletons";

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
      <ContributorOfMonthSkeleton 
        className={className}
        phase="leaderboard"
        contributorCount={5}
      />
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
    <Card className={cn("w-full", className)} role="region" aria-labelledby="contributor-heading">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle id="contributor-heading">
                {isWinnerPhase ? "Contributor of the Month" : "Monthly Leaderboard"}
              </CardTitle>
              <CardDescription>
                {isWinnerPhase 
                  ? `Celebrating ${ranking.month} ${ranking.year}'s top contributor`
                  : `Top contributors for ${ranking.month} ${ranking.year}`}
              </CardDescription>
            </div>
            <Badge variant={isWinnerPhase ? "default" : "secondary"}>
              {isWinnerPhase ? "Winner" : "Current"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isWinnerPhase && ranking.winner ? (
            <div className="space-y-6">
              {/* Winner Display */}
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Trophy 
                    className="h-5 w-5 text-yellow-600" 
                    aria-label="Trophy" 
                    role="img" 
                  />
                  <h3 className="text-lg font-semibold">
                    {ranking.month} {ranking.year} Winner
                  </h3>
                </div>
                <div className="max-w-sm mx-auto">
                  <ContributorCard
                    contributor={ranking.winner}
                    isWinner={true}
                    showRank={false}
                  />
                </div>
              </div>

              {/* Top 5 Runners-up */}
              {topContributors.length > 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Top Contributors
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {topContributors.length - 1} runners-up
                    </span>
                  </div>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {topContributors.slice(1).map((contributor) => (
                      <ContributorCard
                        key={contributor.login}
                        contributor={contributor}
                        showRank={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {topContributors.length} active contributor{topContributors.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {topContributors.map((contributor) => (
                  <ContributorCard 
                    key={contributor.login}
                    contributor={contributor} 
                    showRank={true} 
                  />
                ))}
              </div>

              {ranking.contributors.length > 5 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    And {ranking.contributors.length - 5} more contributors this month
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
    </Card>
  );
}
