import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SkeletonChart } from "../base/skeleton-chart";
import { cn } from "@/lib/utils";

interface ContributionsSkeletonProps {
  className?: string;
  isMobile?: boolean;
}

export function ContributionsSkeleton({ className, isMobile = false }: ContributionsSkeletonProps) {
  return (
    <Card className={cn("animate-pulse", className)}>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-7 w-56" />
        </CardTitle>
        <div className="space-y-1">
          <CardDescription>
            <span className="inline-block h-4 w-80 animate-pulse rounded-md bg-primary/10" />
          </CardDescription>
          {isMobile && (
            <CardDescription>
              <span className="inline-block h-4 w-64 animate-pulse rounded-md bg-primary/10" />
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className={isMobile ? "p-0" : "p-6"}>
        <ContributionsChartSkeleton isMobile={isMobile} />
      </CardContent>
    </Card>
  );
}

function ContributionsChartSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="space-y-4 w-full">
      {/* Controls and stats section */}
      <div className={cn(
        "flex flex-col items-start justify-between pt-3",
        isMobile ? "px-6" : "md:flex-row md:px-7"
      )}>
        {/* Stats display */}
        <Skeleton className="h-5 w-32" />
        
        {/* Controls */}
        <div className={cn(
          "flex flex-wrap gap-4 mt-3 md:mt-0",
          isMobile && "w-full"
        )}>
          {/* Show Bots Toggle */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          
          {/* Logarithmic Scale Toggle */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className={cn(
        "w-full",
        isMobile ? "h-[300px]" : "h-[400px]"
      )}>
        <SkeletonChart
          height={isMobile ? "md" : "lg"}
          variant="scatter"
          showAxes={true}
          className="w-full h-full"
        />
      </div>

      {/* Chart loading indicators - scattered avatar placeholders */}
      <div className="relative -mt-80 pointer-events-none">
        <div className={cn(
          "absolute inset-0",
          isMobile ? "mx-6" : "mx-7"
        )}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "absolute rounded-full",
                isMobile ? "w-7 h-7" : "w-9 h-9"
              )}
              style={{
                left: `${Math.random() * 70 + 15}%`,
                top: `${Math.random() * 60 + 20}%`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}