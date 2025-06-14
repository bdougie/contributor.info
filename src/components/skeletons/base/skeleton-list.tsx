import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonListProps {
  className?: string;
  itemCount?: number;
  itemHeight?: "sm" | "md" | "lg";
  showAvatar?: boolean;
  variant?: "default" | "compact";
}

const heightClasses = {
  sm: "h-12",
  md: "h-16", 
  lg: "h-20"
};

export function SkeletonList({ 
  className, 
  itemCount = 5,
  itemHeight = "md",
  showAvatar = false,
  variant = "default"
}: SkeletonListProps) {
  return (
    <div className={cn("space-y-4", variant === "compact" && "space-y-2", className)}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div 
          key={index}
          className={cn(
            "flex items-center space-x-4 p-4 border rounded-lg animate-pulse",
            heightClasses[itemHeight],
            variant === "compact" && "p-2"
          )}
        >
          {showAvatar && (
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}