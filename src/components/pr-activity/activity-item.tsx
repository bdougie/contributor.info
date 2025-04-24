import { PullRequestActivity } from "@/lib/types";
import { BotIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContributorHoverCard } from "@/components/contributor-hover-card";
import { useContext, useMemo } from "react";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { createContributorStats } from "@/lib/contributor-utils";

interface ActivityItemProps {
  activity: PullRequestActivity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { type, user, pullRequest, repository, timestamp } = activity;
  const { stats } = useContext(RepoStatsContext);

  // Create contributor data with memoization to avoid recalculations
  const contributorData = useMemo(() => {
    return createContributorStats(
      stats.pullRequests,
      user.name,
      user.avatar,
      user.id
    );
  }, [user, stats.pullRequests]);

  const getActivityColor = () => {
    switch (type) {
      case "opened":
        return "bg-emerald-500";
      case "closed":
        return "bg-red-500";
      case "merged":
        return "bg-purple-500";
      case "reviewed":
        return "bg-blue-500";
      case "commented":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const getActivityText = () => {
    switch (type) {
      case "opened":
        return "opened";
      case "closed":
        return "closed";
      case "merged":
        return "merged";
      case "reviewed":
        return "reviewed";
      case "commented":
        return "commented on";
      default:
        return "updated";
    }
  };

  return (
    <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="relative flex-shrink-0">
        <ContributorHoverCard
          contributor={contributorData}
          role={user.isBot ? "Bot" : undefined}
        >
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>
              {user.name ? user.name.charAt(0).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
        </ContributorHoverCard>
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${getActivityColor()} border border-background`}
        ></div>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-sm">
              <span className="font-medium">{user.name}</span>
              {user.isBot && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <BotIcon className="h-3 w-3 text-muted-foreground ml-1" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Bot</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="text-muted-foreground">{getActivityText()}</span>
              <a
                href={pullRequest.url}
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                #{pullRequest.number}
              </a>
              <span className="text-muted-foreground">in</span>
              <a
                href={repository.url}
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {repository.owner}/{repository.name}
              </a>
            </div>
            <p className="text-sm line-clamp-1">{pullRequest.title}</p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
            {timestamp}
          </span>
        </div>
      </div>
    </div>
  );
}
