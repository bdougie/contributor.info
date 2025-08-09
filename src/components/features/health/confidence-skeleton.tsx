import { UserPlus } from '@/components/ui/icon';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ConfidenceSkeletonProps {
  className?: string;
  message?: string;
}

export function ConfidenceSkeleton({ 
  className, 
  message = "Calculating..." 
}: ConfidenceSkeletonProps) {
  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 py-1 flex-1">
            <UserPlus className="w-[18px] h-[18px]" />
            <div className="font-semibold text-foreground text-sm whitespace-nowrap">
              Contributor Confidence
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground animate-pulse">
                {message}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex items-start gap-4 w-full">
          {/* Progress Circle Skeleton */}
          <div className="relative w-[98px] h-[52px]">
            <div className="relative h-[98px] mb-[46px]">
              <div className="absolute w-[98px] h-[98px] top-0 left-0">
                <div className="relative h-[49px]">
                  {/* Background semicircle with subtle animation */}
                  <svg
                    width="98"
                    height="49"
                    viewBox="0 0 98 49"
                    className="absolute top-0 left-0"
                  >
                    <path
                      d="M98 49C98 36.0044 92.8375 23.5411 83.6482 14.3518C74.459 5.16249 61.9956 9.81141e-07 49 0C36.0044 -9.81141e-07 23.5411 5.16248 14.3518 14.3518C5.16249 23.541 1.96228e-06 36.0044 0 49H7.84C7.84 38.0837 12.1765 27.6145 19.8955 19.8955C27.6145 12.1765 38.0837 7.84 49 7.84C59.9163 7.84 70.3855 12.1765 78.1045 19.8955C85.8235 27.6145 90.16 38.0837 90.16 49H98Z"
                      className="fill-muted animate-pulse"
                    />
                  </svg>
                  
                  {/* Animated progress overlay */}
                  <svg
                    width="98"
                    height="49"
                    viewBox="0 0 98 49"
                    className="absolute top-0 left-0"
                  >
                    <path
                      d="M0 49 A49 49 0 0 1 24.5 14.3518 L31.58 21.4578 A41.16 41.16 0 0 0 7.84 49 Z"
                      className="fill-primary/30 animate-pulse"
                      style={{
                        animation: "pulse 2s ease-in-out infinite"
                      }}
                    />
                  </svg>
                </div>
              </div>

              {/* Percentage Skeleton */}
              <div className="absolute w-14 top-7 left-[21px] font-normal text-muted-foreground text-[28px] text-center leading-5">
                <span className="font-bold tracking-[-0.05px] animate-pulse">--</span>
                <span className="font-bold text-xs tracking-[-0.01px] animate-pulse">%</span>
              </div>
            </div>
          </div>

          {/* Text Content Skeleton */}
          <div className="flex flex-col items-start gap-1 flex-1">
            {/* Status skeleton */}
            <div className="h-4 bg-muted rounded animate-pulse w-32" />
            
            {/* Description skeleton */}
            <div className="space-y-1 w-full">
              <div className="h-3 bg-muted rounded animate-pulse w-full" />
              <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for smaller spaces
export function ConfidenceSkeletonCompact({ 
  className 
}: ConfidenceSkeletonProps) {
  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-lg border bg-card", className)}>
      {/* Mini progress circle */}
      <div className="relative w-12 h-6">
        <svg width="48" height="24" viewBox="0 0 48 24" className="animate-pulse">
          <path
            d="M48 24C48 17.7 42.3 12.3 35.3 12.3C28.3 12.3 22.7 17.7 22.7 24H26.7C26.7 19.9 30.3 16.3 35.3 16.3C40.3 16.3 43.9 19.9 43.9 24H48Z"
            className="fill-muted"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground animate-pulse">--</span>
        </div>
      </div>
      
      {/* Text */}
      <div className="flex-1">
        <div className="h-3 bg-muted rounded animate-pulse w-24 mb-1" />
        <div className="h-2 bg-muted rounded animate-pulse w-16" />
      </div>
      
      {/* Loading indicator */}
      <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
    </div>
  );
}