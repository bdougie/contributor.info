import { GitPullRequest } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ContributorStats } from "@/lib/types";

// Function to get status badge styling
const getStatusBadgeStyle = (state: string, merged: boolean) => {
  if (merged)
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
  if (state === "closed")
    return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
};

// Function to get status label
const getStatusLabel = (state: string, merged: boolean) => {
  if (merged) return "merged";
  return state;
};

interface ContributorHoverCardProps {
  contributor: ContributorStats;
  role?: string;
  children: React.ReactNode;
}

export function ContributorHoverCard({
  contributor,
  role,
  children,
}: ContributorHoverCardProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <Avatar>
            <AvatarImage src={contributor.avatar_url} />
            <AvatarFallback>
              {contributor.login[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{contributor.login}</h4>
            {role && <p className="text-sm text-muted-foreground">{role}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <GitPullRequest className="h-4 w-4" />
          <span>{contributor.pullRequests} pull requests</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{Math.round(contributor.percentage)}% of total</span>
        </div>

        {contributor.organizations && contributor.organizations.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="text-sm font-medium">Organizations</div>
              <div className="flex gap-2">
                {contributor.organizations.map((org) => (
                  <Avatar key={org.login} className="h-6 w-6">
                    <AvatarImage src={org.avatar_url} alt={org.login} />
                    <AvatarFallback>
                      {org.login[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </>
        )}

        {contributor.recentPRs && contributor.recentPRs.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="text-sm font-medium">Recent Pull Requests</div>
              <div className="space-y-2">
                {contributor.recentPRs.slice(0, 5).map((pr) => (
                  <a
                    key={pr.id}
                    href={`https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        #{pr.number}
                      </Badge>
                      <span className="truncate">{pr.title}</span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs shrink-0 ${getStatusBadgeStyle(
                          pr.state,
                          pr.merged_at !== null
                        )}`}
                      >
                        {getStatusLabel(pr.state, pr.merged_at !== null)}
                      </Badge>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
