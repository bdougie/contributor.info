import { cn } from "@/lib/utils";
import { MonthlyContributor } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ContributorHoverCard } from "./contributor-hover-card";
import { useMemo, useContext } from "react";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { createContributorStats } from "@/lib/contributor-utils";
import { GitPullRequest, MessageSquare, GitPullRequestDraft, Trophy, Shield, User, Bot } from "lucide-react";
import { useContributorRole } from "@/hooks/useContributorRoles";

interface ContributorCardWithRoleProps {
  contributor: MonthlyContributor;
  owner: string;
  repo: string;
  showRank?: boolean;
  isWinner?: boolean;
  showConfidence?: boolean;
  className?: string;
}

export function ContributorCardWithRole({
  contributor,
  owner,
  repo,
  showRank = true,
  isWinner = false,
  showConfidence = false,
  className,
}: ContributorCardWithRoleProps) {
  const { login, avatar_url, activity, rank } = contributor;
  const { stats } = useContext(RepoStatsContext);
  const { role, loading: roleLoading } = useContributorRole(owner, repo, login);

  // Create contributor data for hover card
  const contributorData = useMemo(() => {
    return createContributorStats(
      stats.pullRequests,
      login,
      avatar_url,
      login
    );
  }, [login, avatar_url, stats.pullRequests]);

  // Determine role badge variant and label
  const getRoleBadge = () => {
    if (!role || roleLoading) return null;

    const badges = [];

    // Role badge
    if (role.role === 'owner') {
      badges.push(
        <Badge key="role" variant="default" className="bg-purple-600 hover:bg-purple-700">
          <Shield className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      );
    } else if (role.role === 'maintainer') {
      badges.push(
        <Badge key="role" variant="default" className="bg-blue-600 hover:bg-blue-700">
          <User className="h-3 w-3 mr-1" />
          Maintainer
        </Badge>
      );
    }

    // Bot indicator
    if (role.is_bot) {
      badges.push(
        <Badge key="bot" variant="outline" className="border-muted-foreground/50">
          <Bot className="h-3 w-3 mr-1" />
          Bot
        </Badge>
      );
    }

    // Confidence score (if enabled and user is maintainer/owner)
    if (showConfidence && role.role !== 'contributor') {
      const confidencePercent = Math.round(role.confidence_score * 100);
      const confidenceColor = 
        confidencePercent >= 90 ? 'text-green-600' :
        confidencePercent >= 70 ? 'text-yellow-600' :
        'text-orange-600';
      
      badges.push(
        <span key="confidence" className={cn("text-xs font-medium", confidenceColor)}>
          {confidencePercent}% confidence
        </span>
      );
    }

    return badges;
  };

  // Create enhanced tooltip content
  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-medium">{login}'s Activity</div>
      
      {role && (
        <div className="text-xs space-y-1 border-b pb-2">
          <div className="font-medium">Role Detection</div>
          <div>Status: {role.role === 'contributor' ? 'External' : 'Internal'} Contributor</div>
          {role.role !== 'contributor' && (
            <>
              <div>Confidence: {Math.round(role.confidence_score * 100)}%</div>
              <div>Detection Methods: {role.detection_methods.join(', ')}</div>
              <div>Privileged Events: {role.permission_events_count}</div>
            </>
          )}
        </div>
      )}
      
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
              role?.role === 'owner' && "border-purple-500/30",
              role?.role === 'maintainer' && "border-blue-500/30",
              className
            )}
            role={isWinner ? "article" : "listitem"}
            aria-label={`${login}${isWinner ? " - Winner" : ""}, ${activity.totalScore} points${role ? `, ${role.role}` : ''}`}
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

            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <ContributorHoverCard contributor={contributorData}>
                  <Avatar className="h-10 w-10 cursor-pointer">
                    <AvatarImage 
                      src={`${avatar_url}?s=80`}
                      alt={login}
                      loading="lazy"
                      width={40}
                      height={40}
                    />
                    <AvatarFallback>
                      {login.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
                  
                  {/* Role badges */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {getRoleBadge()}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
                  
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-medium">
                      Score: {activity.totalScore}
                    </span>
                    {role && role.role !== 'contributor' && (
                      <span className="text-xs text-muted-foreground">
                        {role.role === 'owner' ? 'Internal' : 'Internal'} Contributor
                      </span>
                    )}
                  </div>
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