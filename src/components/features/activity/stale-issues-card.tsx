import { Clock, ExternalLink } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StaleIssuesCardProps {
  staleCount: number;
  totalCount: number;
  loading?: boolean;
}

export function StaleIssuesCard({ staleCount, totalCount, loading }: StaleIssuesCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  // If we have very limited data (suggesting incomplete comment tracking)
  if (totalCount === 0 || (staleCount === totalCount && totalCount < 5)) {
    return (
      <Card className="p-3 min-w-0">
        <div className="flex items-center justify-between">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground truncate">No Replies</span>
        </div>
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">Limited data</p>
          <a
            href="https://github.com/bdougie/contributor.info/issues/670"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
          >
            <span>Enhance metrics</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground truncate">No Replies</span>
      </div>
      <p className="text-2xl font-bold mt-2 truncate">{staleCount}</p>
      <p className="text-xs text-muted-foreground truncate">of {totalCount} total</p>
      <a
        href="https://github.com/bdougie/contributor.info/issues/670"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
      >
        <span>Enhance accuracy</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  );
}
