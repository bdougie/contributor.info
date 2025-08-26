import { Clock, TrendingUp, TrendingDown } from '@/components/ui/icon';
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AvgTimeCardProps {
  averageMergeTime: number;
  averageMergeTimeTrend?: "up" | "down" | "stable";
  loading?: boolean;
}

export function AvgTimeCard({ averageMergeTime, averageMergeTimeTrend, loading }: AvgTimeCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const mergeTimeColor = averageMergeTime <= 24
? "text-green-500" : 
                        averageMergeTime <= 72 ? "text-yellow-500" : "text-red-500";

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">Avg Time</span>
      </div>
      <p className={cn("text-2xl font-bold mt-2 truncate", mergeTimeColor)}>
        {averageMergeTime < 24 
          ? `${Math.round(averageMergeTime)}hrs`
          : `${(averageMergeTime / 24).toFixed(1)}d`
        }
      </p>
      <div className="flex items-center gap-1">
        {averageMergeTimeTrend === "down"
? (
          <TrendingDown className="h-3 w-3 text-green-500" />
        )
: averageMergeTimeTrend === "up"
? (
          <TrendingUp className="h-3 w-3 text-red-500" />
        )
: null}
        <p className="text-xs text-muted-foreground truncate">to merge</p>
      </div>
    </Card>
  );
}