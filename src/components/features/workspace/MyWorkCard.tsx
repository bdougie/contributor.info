import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Activity } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export interface MyWorkItem {
  id: string;
  type: 'pr' | 'issue' | 'mention';
  title: string;
  repository: string;
  status: 'open' | 'merged' | 'closed';
  url: string;
  updated_at: string;
  needsAttention?: boolean;
}

export interface MyWorkStats {
  prs: {
    totalOpen: number;
    draft: number;
    approved: number;
    changesRequested: number;
    pending: number;
  };
  issues: {
    totalAssigned: number;
    open: number;
    inProgress: number;
  };
}

export interface MyWorkCardProps {
  items: MyWorkItem[];
  stats?: MyWorkStats;
  loading?: boolean;
  className?: string;
  onItemClick?: (item: MyWorkItem) => void;
  onViewAll?: () => void;
}

function MyWorkItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <Skeleton className="h-8 w-8 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function MyWorkItemComponent({
  item,
  onClick,
}: {
  item: MyWorkItem;
  onClick?: (item: MyWorkItem) => void;
}) {
  const getActivityColor = () => {
    if (item.type === 'pr') {
      switch (item.status) {
        case 'open':
          return 'bg-emerald-500';
        case 'merged':
          return 'bg-purple-500';
        case 'closed':
          return 'bg-red-500';
        default:
          return 'bg-gray-400';
      }
    }
    if (item.type === 'issue') {
      return 'bg-orange-500';
    }
    if (item.type === 'mention') {
      return 'bg-gray-500';
    }
    return 'bg-gray-400';
  };

  const getActivityText = () => {
    if (item.type === 'pr') {
      switch (item.status) {
        case 'open':
          return 'opened';
        case 'merged':
          return 'merged';
        case 'closed':
          return 'closed';
        default:
          return 'updated';
      }
    }
    if (item.type === 'issue') {
      return item.status === 'open' ? 'opened issue' : 'closed issue';
    }
    if (item.type === 'mention') {
      return 'mentioned you in';
    }
    return 'updated';
  };

  return (
    <article
      className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => onClick?.(item)}
    >
      <div className="relative flex-shrink-0">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium">You</span>
        </div>
        <div
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border border-background',
            getActivityColor()
          )}
          aria-hidden="true"
        ></div>
      </div>

      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-1 text-sm flex-wrap">
              <span className="font-medium">You</span>
              <span className="text-muted-foreground">{getActivityText()}</span>
              <a
                href={item.url}
                className="text-orange-500 hover:underline cursor-pointer transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {item.type === 'pr' && 'PR'}
                {item.type === 'issue' && 'Issue'}
              </a>
              <span className="text-muted-foreground hidden sm:inline">in</span>
              <span className="text-orange-500 truncate max-w-xs sm:max-w-none hidden sm:inline">
                {item.repository}
              </span>
            </div>
            <h3 className="text-sm line-clamp-1 pr-2 font-normal hover:text-primary transition-colors">
              {item.title}
            </h3>
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap sm:ml-2">
            {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
          </time>
        </div>
      </div>
    </article>
  );
}

export function MyWorkCard({
  items,
  loading = false,
  className,
  onItemClick,
  onViewAll,
}: MyWorkCardProps) {
  if (loading) {
    return (
      <Card className={cn('transition-all', className)}>
        <CardHeader>
          <CardTitle>My Work</CardTitle>
          <CardDescription>Your recent activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <MyWorkItemSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasActivity = items.length > 0;

  if (!hasActivity) {
    return (
      <Card className={cn('transition-all', className)}>
        <CardHeader>
          <CardTitle>My Work</CardTitle>
          <CardDescription>Your recent activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No activity to display</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your PRs, issues, and mentions will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('transition-all', className)}>
      <CardHeader>
        <CardTitle>My Work</CardTitle>
        <CardDescription>Your recent activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <MyWorkItemComponent key={item.id} item={item} onClick={onItemClick} />
          ))}
        </div>
        {items.length > 5 && onViewAll && (
          <Button variant="ghost" className="w-full mt-3 text-sm" onClick={onViewAll}>
            View all {items.length} items
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Export skeleton for easier usage
export function MyWorkCardSkeleton({ className }: { className?: string }) {
  return <MyWorkCard items={[]} loading={true} className={className} />;
}
