// Remove React import as it's not needed with modern JSX transform
import { PullRequestActivity } from "@/types/pr-activity";
// Remove unused icon imports
import { BotIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActivityItemProps {
  activity: PullRequestActivity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { type, user, pullRequest, repository, timestamp } = activity;

  // This function is being used in the component
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
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>
            {user.name ? user.name.charAt(0).toUpperCase() : "?"}
          </AvatarFallback>
        </Avatar>
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
