import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ContributorCardSkeletonProps {
  className?: string;
  isWinner?: boolean;
  showRank?: boolean;
}

export function ContributorCardSkeleton({ 
  className, 
  isWinner = false,
  showRank = true 
}: ContributorCardSkeletonProps) {
  return (
    <div
      className={cn(
        "relative p-4 rounded-lg border bg-card transition-all animate-pulse",
        "hover:bg-muted/50",
        isWinner && "ring-2 ring-yellow-500 bg-yellow-50/10 dark:bg-yellow-900/10",
        className
      )}
    >
      {/* Rank Badge */}
      {showRank && (
        <div className="absolute -top-2 -right-2 z-10">
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />

        <div className="flex-1 min-w-0">
          {/* Username and trophy */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            {isWinner && (
              <Skeleton className="h-4 w-4" />
            )}
          </div>
          
          {/* Activity stats */}
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-4" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-4" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-4" />
            </div>
          </div>
          
          {/* Score */}
          <div className="mt-2">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}