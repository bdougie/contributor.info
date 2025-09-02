import { TrendingUp } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface VelocityCardProps {
  velocity: {
    current: number;
    previous: number;
    change: number;
  };
  loading?: boolean;
}

export function VelocityCard({ velocity, loading }: VelocityCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium truncate">Weekly Velocity</h4>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">This week</span>
          <span className="text-sm font-medium truncate">{velocity.current.toFixed(1)} PRs</span>
        </div>
        <Progress
          value={(velocity.current / Math.max(velocity.current, velocity.previous)) * 100}
          className="h-2"
        />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">Last week</span>
          <span className="text-sm truncate">{velocity.previous.toFixed(1)} PRs</span>
        </div>
        {velocity.change !== 0 && (
          <p
            className={cn(
              'text-xs font-medium mt-1',
              velocity.change > 0 ? 'text-green-500' : 'text-red-500'
            )}
          >
            {velocity.change > 0 ? '+' : ''}
            {Math.round(velocity.change)}% change
          </p>
        )}
      </div>
    </Card>
  );
}
