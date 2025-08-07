import { cn } from "@/lib/utils";
import { MonthlyContributor } from "@/lib/types";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

import { ContributorHoverCard } from "./contributor-hover-card";
import { useMemo, useContext } from "react";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { createContributorStats } from "@/lib/contributor-utils";
import { GitPullRequest, MessageSquare, GitPullRequestDraft, Trophy } from "lucide-react";

interface ContributorCardProps {
  contributor: MonthlyContributor;
  showRank?: boolean;
  isWinner?: boolean;
  className?: string;
}

export function ContributorCard({
  contributor,
  showRank = true,
  isWinner = false,
  className,
}: ContributorCardProps) {
  const { login, avatar_url, activity, rank } = contributor;
  const { stats } = useContext(RepoStatsContext);

  // Create contributor data for hover card
  const contributorData = useMemo(() => {
    return createContributorStats(
      stats.pullRequests,
      login,
      avatar_url,
      login // using login as ID since we don't have the actual ID
    );
  }, [login, avatar_url, stats.pullRequests]);

  // Create tooltip content with activity breakdown
  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{login}'s Activity</div>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-3 w-3" />
          <span>{activity.pullRequests} Pull Requests</span>
        </div>
        <div className="flex items-center gap-2">
          <GitPullRequestDraft className="h-3 w-3" />
          <span>{activity.reviews} Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3 w-3" />
          <span>{activity.comments} Comments</span>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative p-4 rounded-lg border bg-card transition-all cursor-pointer",
              "hover:bg-muted/50",
              isWinner && "ring-2 ring-yellow-500 bg-yellow-50/10 dark:bg-yellow-900/10",
              className
            )}
            role={isWinner ? "article" : "listitem"}
            aria-label={`${login}${isWinner ? " - Winner" : ""}, ${activity.totalScore} points`}
            tabIndex={0}
          >
      {/* Rank Badge */}
      {showRank && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge 
            variant={rank === 1 ? "default" : "secondary"}
            className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
          >
            {rank}
          </Badge>
        </div>
      )}

      <div className="flex items-start gap-3">
        <ContributorHoverCard contributor={contributorData}>
          <OptimizedAvatar 
            src={avatar_url}
            alt={`${login}'s avatar`}
            size={40}
            lazy={true}
            className="cursor-pointer"
            fallback={login.charAt(0).toUpperCase()}
          />
        </ContributorHoverCard>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{login}</h3>
            {isWinner && (
              <Trophy 
                className="h-4 w-4 text-yellow-600" 
                data-testid="trophy-icon"
                aria-label="Winner"
                role="img"
              />
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <GitPullRequest className="h-3 w-3" />
              <span>{activity.pullRequests}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitPullRequestDraft className="h-3 w-3" />
              <span>{activity.reviews}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{activity.comments}</span>
            </div>
          </div>
          
          <div className="mt-2">
            <span className="text-xs font-medium">
              Score: {activity.totalScore}
            </span>
          </div>
        </div>
      </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
