import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ActivityItemSkeletonProps {
  className?: string;
}

export function ActivityItemSkeleton({ className }: ActivityItemSkeletonProps) {
  return (
    <div className={cn("flex items-start space-x-3 p-3 rounded-md animate-pulse", className)}>
      {/* Avatar Section */}
      <div className="relative flex-shrink-0">
        <Skeleton className="h-8 w-8 rounded-full" />
        {/* Activity type indicator dot */}
        <Skeleton className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full" />
      </div>

      {/* Content Section */}
      <div className="flex-1 space-y-1">
        {/* Header Row */}
        <div className="flex items-start justify-between">
          {/* Left side - User name, action, PR link, repo */}
          <div className="flex items-center space-x-1 flex-wrap">
            <Skeleton className="h-4 w-20" /> {/* Username */}
            <Skeleton className="h-4 w-16" /> {/* Action */}
            <Skeleton className="h-4 w-24" /> {/* PR link */}
            <Skeleton className="h-3 w-2" />   {/* in */}
            <Skeleton className="h-4 w-20" /> {/* Repo link */}
          </div>
          {/* Right side - Timestamp */}
          <Skeleton className="h-3 w-16 flex-shrink-0" />
        </div>

        {/* Title Row */}
        <div className="pr-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </div>
      </div>
    </div>
  );
}