import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  hasHeader?: boolean;
  headerHeight?: "sm" | "md" | "lg";
  contentHeight?: "sm" | "md" | "lg" | "xl";
  children?: React.ReactNode;
}

const heightClasses = {
  sm: "h-4",
  md: "h-6", 
  lg: "h-8",
  xl: "h-32"
};

export function SkeletonCard({ 
  className, 
  hasHeader = true,
  headerHeight = "md",
  contentHeight = "lg",
  children 
}: SkeletonCardProps) {
  return (
    <Card className={cn("animate-pulse", className)}>
      {hasHeader && (
        <CardHeader className="space-y-2">
          <Skeleton className={cn("w-3/4", heightClasses[headerHeight])} />
          <Skeleton className="w-1/2 h-4" />
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {children || (
          <>
            <Skeleton className={cn("w-full", heightClasses[contentHeight])} />
            <div className="space-y-2">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-4/5 h-4" />
              <Skeleton className="w-3/5 h-4" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}