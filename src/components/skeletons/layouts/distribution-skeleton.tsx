import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SkeletonChart } from "../base/skeleton-chart";
import { cn } from "@/lib/utils";

interface DistributionSkeletonProps {
  className?: string;
  isMobile?: boolean;
}

export function DistributionSkeleton({ className, isMobile = false }: DistributionSkeletonProps) {
  return (
    <Card className={cn("overflow-visible animate-pulse", className)}>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-7 w-80" />
        </CardTitle>
        <CardDescription>
          <div className="space-y-1">
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-4 w-72" />
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 w-full overflow-visible">
        {/* Stats summary */}
        <div className="text-sm text-muted-foreground">
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Language Legend skeleton */}
        <LanguageLegendSkeleton isMobile={isMobile} />

        {/* QuadrantChart skeleton */}
        <div className="overflow-visible">
          <QuadrantChartSkeleton isMobile={isMobile} />
        </div>

        {/* Description skeleton */}
        <DescriptionSkeleton />
      </CardContent>
    </Card>
  );
}

function LanguageLegendSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-3",
      isMobile ? "justify-center" : "justify-center sm:justify-start"
    )}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function QuadrantChartSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    // Mobile placeholder
    return (
      <div className="md:hidden">
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <Skeleton className="h-6 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  // Desktop chart
  return (
    <div className="hidden md:block">
      <div className="aspect-[16/9] w-full">
        <SkeletonChart
          height="xl"
          variant="quadrant"
          showAxes={true}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}

function DescriptionSkeleton() {
  return (
    <div className="text-sm text-muted-foreground mt-4 space-y-4">
      {/* Paragraph */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* List items */}
      <div className="pl-5 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-1 h-1 rounded-full mt-2 flex-shrink-0" />
            <Skeleton className="h-4 flex-1" style={{ width: `${85 - i * 5}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}