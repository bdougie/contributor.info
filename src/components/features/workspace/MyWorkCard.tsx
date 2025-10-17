import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowRight, Activity } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useState, memo } from 'react';
import { sanitizeText, sanitizeURL } from '@/lib/sanitize';
import { WorkspaceSubTabs } from '@/components/features/workspace/components/WorkspaceSubTabs';

export interface MyWorkItem {
  id: string;
  type: 'pr' | 'issue' | 'discussion';
  itemType:
    | 'authored'
    | 'assigned'
    | 'review_requested'
    | 'mentioned'
    | 'participant'
    | 'follow_up';
  title: string;
  repository: string;
  status: 'open' | 'merged' | 'closed' | 'answered';
  url: string;
  updated_at: string;
  responded_at?: string;
  needsAttention?: boolean;
  number: number;
  user: {
    username: string;
    avatar_url?: string;
  };
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

const MyWorkItemComponent = memo(function MyWorkItemComponent({
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
    // Simplified logic to avoid Rollup conditional expression analysis bugs
    const type = item.type;
    const status = item.status;

    if (type === 'pr') {
      if (status === 'open') return 'bg-emerald-500';
      if (status === 'merged') return 'bg-purple-500';
      if (status === 'closed') return 'bg-red-500';
      return 'bg-gray-400';
    }
    if (type === 'issue') {
      return 'bg-orange-500';
    }
    if (type === 'discussion') {
      return 'bg-blue-500';
    }
    return 'bg-gray-400';
  };

  const getActivityText = () => {
    // Describe the relationship to the item
    // Simplified logic to avoid Rollup conditional expression analysis bugs
    const itemType = item.itemType;
    const type = item.type;
    const status = item.status;

    if (itemType === 'authored') {
      if (type === 'pr') {
        if (status === 'open') return 'opened PR';
        if (status === 'merged') return 'merged PR';
        return 'closed PR';
      }
      if (type === 'issue') {
        // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
        if (status === 'open') return 'opened issue';
        return 'closed issue';
      }
      if (type === 'discussion') {
        // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
        if (status === 'answered') return 'started discussion (answered)';
        return 'started discussion';
      }
      return 'authored';
    }

    if (itemType === 'review_requested') {
      return 'requested to review PR';
    }

    if (itemType === 'assigned') {
      return 'opened issue';
    }

    if (itemType === 'mentioned') {
      if (type === 'pr') return 'mentioned in PR';
      if (type === 'issue') return 'mentioned in issue';
      return 'mentioned in discussion';
    }

    if (itemType === 'participant') {
      if (type === 'discussion') return 'started discussion';
      return 'participating in discussion';
    }

    if (itemType === 'follow_up') {
      if (type === 'pr') return 'PR with new activity';
      if (type === 'issue') return 'issue with new activity';
      return 'discussion with new replies';
    }

    return 'updated';
  };

  const getItemTypeLabel = () => {
    // Avoid ternary/logical-AND - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
    const type = item.type;
    const number = item.number;

    if (type === 'pr') {
      return `PR #${number}`;
    }
    if (type === 'issue') {
      return `Issue #${number}`;
    }
    if (type === 'discussion') {
      return `Discussion #${number}`;
    }
    return `Item #${number}`;
  };

  // Avoid conditional rendering with && - Rollup 4.45.0 bug
  const renderRespondButton = () => {
    if (!canRespond || !onRespond) {
      return null;
    }
    return (
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
    );
  };

  return (
    <article
      className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => onClick?.(item)}
    >
      <div className="relative flex-shrink-0">
        {item.user.avatar_url ? (
          <img
            src={item.user.avatar_url}
            alt={item.user.username}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-medium">{item.user.username.slice(0, 2)}</span>
          </div>
        )}
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
              <span className="font-medium">{sanitizeText(item.user.username)}</span>
              <span className="text-muted-foreground">{getActivityText()}</span>
              <a
                href={sanitizeURL(item.url)}
                className="text-orange-500 hover:underline cursor-pointer transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {getItemTypeLabel()}
              </a>
              <span className="text-muted-foreground hidden sm:inline">in</span>
              <span className="text-orange-500 truncate max-w-xs sm:max-w-none hidden sm:inline">
                {sanitizeText(item.repository)}
              </span>
            </div>
            <h3 className="text-sm line-clamp-1 pr-2 font-normal hover:text-primary transition-colors">
              {sanitizeText(item.title)}
            </h3>
          </div>
          <div className="flex items-center gap-2 sm:ml-2">
            <time className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
            </time>
            {renderRespondButton()}
          </div>
        </div>
      </div>
    </article>
  );
});

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
  const [selectedTypes, setSelectedTypes] = useState<Array<'pr' | 'issue' | 'discussion'>>([
    'pr',
    'issue',
    'discussion',
  ]);
  const [issueTab, setIssueTab] = useState<'needs_response' | 'follow_ups'>('needs_response');

  const toggleType = (type: 'pr' | 'issue' | 'discussion') => {
    setSelectedTypes((prev) => {
      const isSelected = prev.includes(type);

      if (isSelected) {
        // Don't allow deselecting all types
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((t) => t !== type);
      }

      return [...prev, type];
    });
  };

  // Filter items by selected types
  let filteredItems = items.filter((item) => selectedTypes.includes(item.type));

  // Apply tab filter to ALL item types (not just issues)
  // This ensures PRs, Issues, and Discussions are filtered consistently
  if (issueTab === 'needs_response') {
    // Show items needing response (not yet responded to)
    filteredItems = filteredItems.filter((item) => item.itemType !== 'follow_up');
  } else {
    // Show items with follow-up activity (you've responded, now they've replied)
    filteredItems = filteredItems.filter((item) => item.itemType === 'follow_up');
  }
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

  const hasActivity = filteredItems.length > 0;

  // Build conditional sections to avoid Rollup 4.45.0 bug with && operators
  let itemCountSection = null;
  if (filteredItems.length < items.length) {
    itemCountSection = (
      <div className="mb-2 text-sm text-muted-foreground">
        Showing {filteredItems.length} of {items.length} items
      </div>
    );
  }

  let noMatchesSection = null;
  if (!hasActivity && items.length > 0) {
    noMatchesSection = (
      <div className="text-center py-8">
        <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No items match selected filters</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try selecting different item types above
        </p>
      </div>
    );
  }

  let itemsListSection = null;
  if (hasActivity) {
    itemsListSection = (
      <div className="space-y-2">
        {filteredItems.map((item) => (
          <MyWorkItemComponent
            key={item.id}
            item={item}
            onClick={onItemClick}
            onRespond={onRespond}
          />
        ))}
      </div>
    );
  }

  let paginationSection = null;
  if (totalPages > 1 && onPageChange && hasActivity) {
    paginationSection = (
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
    );
  }

  let viewAllSection = null;
  if (onViewAll && hasActivity) {
    viewAllSection = (
      <Button variant="ghost" className="w-full mt-3 text-sm" onClick={onViewAll}>
        View all {totalCount} items
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    );
  }

  if (!hasActivity && items.length === 0) {
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
              Assigned issues and unanswered discussions will appear here
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
        {/* Type Filters */}
        <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b">
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-pr"
              checked={selectedTypes.includes('pr')}
              onCheckedChange={() => toggleType('pr')}
            />
            <Label htmlFor="filter-pr" className="text-sm">
              PRs
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-issue"
              checked={selectedTypes.includes('issue')}
              onCheckedChange={() => toggleType('issue')}
            />
            <Label htmlFor="filter-issue" className="text-sm">
              Issues
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="filter-discussion"
              checked={selectedTypes.includes('discussion')}
              onCheckedChange={() => toggleType('discussion')}
            />
            <Label htmlFor="filter-discussion" className="text-sm">
              Discussions
            </Label>
          </div>
        </div>

        {/* Tabs: "Needs Response" and "Follow-ups" for all item types */}
        <div className="mb-4">
          <WorkspaceSubTabs
            tabs={[
              {
                value: 'needs_response',
                label: 'Needs Response',
                count: items.filter((item) => item.itemType !== 'follow_up').length,
              },
              {
                value: 'follow_ups',
                label: 'Follow-ups',
                count: items.filter((item) => item.itemType === 'follow_up').length,
              },
            ]}
            activeTab={issueTab}
            onTabChange={(value) => setIssueTab(value as 'needs_response' | 'follow_ups')}
          />
        </div>

        {/* Items count */}
        {itemCountSection}

        {/* Show message when all items are filtered out */}
        {noMatchesSection}

        {/* Show items list */}
        {itemsListSection}

        {/* Pagination Controls */}
        {paginationSection}

        {viewAllSection}
      </CardContent>
    </Card>
  );
}

// Export skeleton for easier usage
export function MyWorkCardSkeleton({ className }: { className?: string }) {
  return <MyWorkCard items={[]} loading={true} className={className} />;
}
