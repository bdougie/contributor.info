import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContributorCardSkeleton } from "../components/contributor-card-skeleton";
import { cn } from "@/lib/utils";

interface ContributorOfMonthSkeletonProps {
  className?: string;
  phase?: "winner" | "leaderboard";
  contributorCount?: number;
}

export function ContributorOfMonthSkeleton({ 
  className,
  phase = "leaderboard",
  contributorCount = 5
}: ContributorOfMonthSkeletonProps) {
  const isWinnerPhase = phase === "winner";
  const showContributors = Math.min(contributorCount, 5);

  return (
    <Card className={cn("w-full animate-pulse", className)} role="region">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle>
              <Skeleton className="h-7 w-56" />
            </CardTitle>
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isWinnerPhase
? (
          <WinnerPhaseSkeleton showContributors={showContributors} />
        )
: (
          <LeaderboardPhaseSkeleton showContributors={showContributors} />
        )}
      </CardContent>
    </Card>
  );
}

function WinnerPhaseSkeleton({ showContributors }: { showContributors: number }) {
  return (
    <div className="space-y-6">
      {/* Winner Display */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="max-w-sm mx-auto">
          <ContributorCardSkeleton
            isWinner={true}
            showRank={false}
          />
        </div>
      </div>

      {/* Top Contributors (Runners-up) */}
      {showContributors > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: showContributors - 1 }).map((_, i) => (
              <ContributorCardSkeleton
                key={i}
                showRank={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardPhaseSkeleton({ showContributors }: { showContributors: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: showContributors }).map((_, i) => (
          <ContributorCardSkeleton
            key={i}
            showRank={true}
          />
        ))}
      </div>

      {/* "And X more contributors" footer */}
      <div className="text-center pt-4">
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  );
}