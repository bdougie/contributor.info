import { Plus, Minus } from "lucide-react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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

// Function to format numbers with commas
const formatNumber = (num: number) => {
  return num.toLocaleString();
};

// Function to format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return "today";
  if (diffInDays === 1) return "1 day ago";
  return `${diffInDays} days ago`;
};

interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  additions: number;
  deletions: number;
  repository_owner: string;
  repository_name: string;
  user: {
    login: string;
    avatar_url: string;
    type?: string;
  };
  html_url?: string;
}

interface PrHoverCardProps {
  pullRequest: PullRequest;
  role?: string;
  children: React.ReactNode;
}

export function PrHoverCard({
  pullRequest,
  role,
  children,
}: PrHoverCardProps) {
  const totalLines = pullRequest.additions + pullRequest.deletions;
  const prUrl = pullRequest.html_url || 
    `https://github.com/${pullRequest.repository_owner}/${pullRequest.repository_name}/pull/${pullRequest.number}`;

  return (
    <HoverCardPrimitive.Root openDelay={0} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <div className="inline-block" style={{ pointerEvents: "auto" }}>
          {children}
        </div>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          className={cn(
            "relative z-[100] w-80 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          )}
          side="top"
          align="center"
          alignOffset={0}
          sideOffset={5}
          collisionPadding={10}
          sticky="always"
          avoidCollisions={true}
          onPointerDownOutside={(e) => e.preventDefault()}
          forceMount
        >
          {role && (
            <Badge 
              className={cn(
                "absolute top-4 right-4 border-0",
                role.toLowerCase() === "contributor" 
                  ? "bg-blue-500 text-white hover:bg-blue-600" 
                  : role.toLowerCase() === "bot"
                  ? "bg-gray-500 text-white hover:bg-gray-600"
                  : "bg-green-500 text-white hover:bg-green-600"
              )}
              variant="default"
            >
              {role}
            </Badge>
          )}
          
          {/* Contributor Info */}
          <div className="flex gap-3 mb-4">
            <a
              href={`https://github.com/${pullRequest.user.login}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OptimizedAvatar
                src={pullRequest.user.avatar_url}
                alt={pullRequest.user.login}
                size={48}
                priority={true}
                fallback={pullRequest.user.login ? pullRequest.user.login[0].toUpperCase() : '?'}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            </a>
            <div className="flex-1 min-w-0">
              <a
                href={`https://github.com/${pullRequest.user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block hover:underline"
              >
                <h4 className="text-sm font-semibold">{pullRequest.user.login}</h4>
              </a>
              <div className="text-xs text-muted-foreground">
                {formatRelativeTime(pullRequest.created_at)}
              </div>
            </div>
          </div>

          <Separator className="my-3" />

          {/* PR Details */}
          <div className="space-y-3">
            {/* PR Title and Status */}
            <div>
              <div className="flex items-start gap-2 mb-2">
                <div className="flex items-center gap-1 mt-0.5 flex-shrink-0">
                  <Badge
                    className={cn(
                      "text-xs border-0",
                      getStatusBadgeStyle(pullRequest.state, pullRequest.merged)
                    )}
                    variant="secondary"
                  >
                    {getStatusLabel(pullRequest.state, pullRequest.merged)}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    #{pullRequest.number}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline line-clamp-2"
                    title={pullRequest.title}
                  >
                    {pullRequest.title}
                  </a>
                </div>
              </div>
            </div>

            {/* Lines Changed */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Lines Changed</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Plus className="h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium">
                    +{formatNumber(pullRequest.additions)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Minus className="h-3 w-3 text-red-600" />
                  <span className="text-red-600 font-medium">
                    -{formatNumber(pullRequest.deletions)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">
                    {formatNumber(totalLines)}
                  </span>
                </div>
              </div>
              
              {/* Visual bar for additions/deletions */}
              {totalLines > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div 
                    className="bg-green-500" 
                    style={{ 
                      width: `${(pullRequest.additions / totalLines) * 100}%` 
                    }}
                  />
                  <div 
                    className="bg-red-500" 
                    style={{ 
                      width: `${(pullRequest.deletions / totalLines) * 100}%` 
                    }}
                  />
                </div>
              )}
            </div>

            {/* Repository Link */}
            <div className="text-xs text-muted-foreground">
              <a
                href={`https://github.com/${pullRequest.repository_owner}/${pullRequest.repository_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {pullRequest.repository_owner}/{pullRequest.repository_name}
              </a>
            </div>
          </div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}