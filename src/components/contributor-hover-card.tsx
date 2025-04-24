import { GitPullRequest, UserIcon } from "lucide-react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ContributorStats } from "@/lib/types";
import React from "react";

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
    <HoverCardPrimitive.Root openDelay={100} closeDelay={200}>
      <HoverCardPrimitive.Trigger asChild>
        <div className="inline-block" style={{ pointerEvents: "auto" }}>
          {children}
        </div>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Content
        className={cn(
          "z-50 w-80 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        )}
        sideOffset={5}
        align="center"
        avoidCollisions={true}
      >
        <div className="flex justify-between space-x-4">
          <a
            href={`https://github.com/${contributor.login}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={contributor.avatar_url} />
              <AvatarFallback>
                {contributor.login ? (
                  contributor.login[0].toUpperCase()
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
          </a>
          <div className="space-y-1">
            <a
              href={`https://github.com/${contributor.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block hover:underline"
            >
              <h4 className="text-sm font-semibold">{contributor.login}</h4>
            </a>
            {role && <p className="text-sm text-muted-foreground">{role}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <GitPullRequest className="h-4 w-4" />
          <span>{contributor.pullRequests} pull requests</span>
          {contributor.percentage > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{Math.round(contributor.percentage)}% of total</span>
            </>
          )}
        </div>

        {contributor.organizations && contributor.organizations.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="text-sm font-medium">Organizations</div>
              <div className="flex gap-2">
                {contributor.organizations.map((org) => (
                  <a
                    key={org.login}
                    href={`https://github.com/${org.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Avatar className="h-6 w-6 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarImage src={org.avatar_url} alt={org.login} />
                      <AvatarFallback>
                        {org.login[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </a>
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
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Root>
  );
}
