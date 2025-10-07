import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Activity } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export interface MyWorkItem {
  id: string;
  type: 'pr' | 'issue' | 'discussion';
  itemType: 'authored' | 'assigned' | 'review_requested' | 'mentioned' | 'participant';
  title: string;
  repository: string;
  status: 'open' | 'merged' | 'closed' | 'answered';
  url: string;
  updated_at: string;
  needsAttention?: boolean;
  number: number;
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
  totalCount?: number;
  currentPage?: number;
  itemsPerPage?: number;
  onItemClick?: (item: MyWorkItem) => void;
  onViewAll?: () => void;
  onPageChange?: (page: number) => void;
  onRespond?: (item: MyWorkItem) => void;
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
  onRespond,
}: {
  item: MyWorkItem;
  onClick?: (item: MyWorkItem) => void;
  onRespond?: (item: MyWorkItem) => void;
}) {
  // Only show respond button for open items where user can respond
  const canRespond = item.status === 'open' || item.status === 'answered';
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
    if (item.type === 'discussion') {
      return 'bg-blue-500';
    }
    return 'bg-gray-400';
  };

  const getActivityText = () => {
    // Describe the relationship to the item
    switch (item.itemType) {
      case 'authored':
        if (item.type === 'pr') {
          if (item.status === 'open') return 'opened PR';
          if (item.status === 'merged') return 'merged PR';
          return 'closed PR';
        } else if (item.type === 'issue') {
          return item.status === 'open' ? 'opened issue' : 'closed issue';
        } else if (item.type === 'discussion') {
          return item.status === 'answered'
            ? 'started discussion (answered)'
            : 'started discussion';
        }
        return 'authored';

      case 'review_requested':
        return 'requested to review PR';

      case 'assigned':
        return 'assigned to issue';

      case 'mentioned': {
        if (item.type === 'pr') return 'mentioned in PR';
        if (item.type === 'issue') return 'mentioned in issue';
        return 'mentioned in discussion';
      }

      case 'participant':
        if (item.type === 'discussion') return 'unanswered discussion';
        return 'participating in discussion';

      default:
        return 'updated';
    }
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
                {item.type === 'pr' && `PR #${item.number}`}
                {item.type === 'issue' && `Issue #${item.number}`}
                {item.type === 'discussion' && `Discussion #${item.number}`}
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
          <div className="flex items-center gap-2 sm:ml-2">
            <time className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
            </time>
            {canRespond && onRespond && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRespond(item);
                }}
              >
                Respond
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MyWorkCard({
  items,
  loading = false,
  className,
  totalCount = 0,
  currentPage = 1,
  itemsPerPage = 10,
  onItemClick,
  onViewAll,
  onPageChange,
  onRespond,
}: MyWorkCardProps) {
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  if (loading) {
    return (
      <Card className={cn('transition-all', className)}>
        <CardHeader>
          <CardTitle>My Work</CardTitle>
          <CardDescription>Items requiring your attention</CardDescription>
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
          <CardDescription>Items requiring your attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nothing needs your attention</p>
            <p className="text-xs text-muted-foreground mt-1">
              Review requests, assigned issues, and unanswered discussions will appear here
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
        <CardDescription>
          {totalCount > 0
            ? `${totalCount} items requiring attention`
            : 'Items requiring your attention'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <MyWorkItemComponent
              key={item.id}
              item={item}
              onClick={onItemClick}
              onRespond={onRespond}
            />
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && onPageChange && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}

        {onViewAll && (
          <Button variant="ghost" className="w-full mt-3 text-sm" onClick={onViewAll}>
            View all {totalCount} items
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
