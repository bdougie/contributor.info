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

/**
 * SkeletonCard component for displaying animated placeholder cards
 * 
 * @param className - Additional CSS classes to apply
 * @param hasHeader - Whether to display the card header
 * @param headerHeight - Height variant for header: sm, md, or lg
 * @param contentHeight - Height variant for main content: sm, md, lg, or xl
 * @param children - Custom content to override default skeleton layout
 * @returns A skeleton card component with accessibility features
 */
export function SkeletonCard({ 
  className, 
  hasHeader = true,
  headerHeight = "md",
  contentHeight = "lg",
  children 
}: SkeletonCardProps) {
  return (
    <Card 
      className={cn("animate-pulse skeleton-container skeleton-optimized", className)}
      aria-label="Loading card content..."
      aria-busy="true"
    >
      {hasHeader && (
        <CardHeader className="space-y-2" aria-label="Loading card header">
          <Skeleton className={cn("w-3/4", heightClasses[headerHeight])} />
          <Skeleton className="w-1/2 h-4" />
        </CardHeader>
      )}
      <CardContent className="space-y-4" aria-label="Loading card body">
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