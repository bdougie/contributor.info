import React from "react";
import { PullRequestActivity } from "@/types/pr-activity";
import {
  GitPullRequestIcon,
  CheckCircleIcon,
  GitMergeIcon,
  MessageSquareIcon,
  ClipboardCheckIcon,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ActivityItemProps {
  activity: PullRequestActivity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { type, user, pullRequest, repository, timestamp } = activity;

  const getActivityIcon = () => {
    switch (type) {
      case "opened":
        return <GitPullRequestIcon className="h-4 w-4 text-emerald-500" />;
      case "closed":
        return <CheckCircleIcon className="h-4 w-4 text-red-500" />;
      case "merged":
        return <GitMergeIcon className="h-4 w-4 text-purple-500" />;
      case "reviewed":
        return <ClipboardCheckIcon className="h-4 w-4 text-blue-500" />;
      case "commented":
        return <MessageSquareIcon className="h-4 w-4 text-gray-500" />;
      default:
        return <GitPullRequestIcon className="h-4 w-4" />;
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