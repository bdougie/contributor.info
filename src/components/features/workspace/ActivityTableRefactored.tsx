import React, { useState, useMemo, useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { AnalyticsErrorBoundary } from './ErrorBoundary';
import { ActivityTableSkeleton } from './skeletons/AnalyticsSkeletons';
import {
  ActivityTableHeader,
  type SortField,
  type SortOrder,
} from './components/ActivityTableHeader';
import { ActivityTableRow } from './components/ActivityTableRow';
import { ActivityTableFilters } from './components/ActivityTableFilters';
import { useKeyboardNavigation, useScreenReaderAnnounce } from './hooks/useAccessibility';
import { sortData, filterData } from './utils/analytics-utils';
import type { ActivityItem } from './AnalyticsDashboard';

export interface ActivityTableProps {
  activities: ActivityItem[];
  loading?: boolean;
  pageSize?: number;
  className?: string;
}

// Main component wrapped with memo for performance
const ActivityTableContent = memo(
  ({ activities, loading = false, pageSize = 50, className }: ActivityTableProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [page, setPage] = useState(0);

    const parentRef = useRef<HTMLDivElement>(null);
    const announce = useScreenReaderAnnounce();

    // Filter and sort activities with memoization
    const processedActivities = useMemo(() => {
      // Apply filters
      const filtered = filterData(
        activities,
        {
          search: searchQuery,
          type: typeFilter === 'all' ? undefined : typeFilter,
        },
        ['title', 'repository']
      );

      // Apply sorting
      const sorted = sortData(filtered, { key: sortField, direction: sortOrder }, (item, key) => {
        switch (key) {
          case 'author':
            return item.author.username;
          case 'created_at':
            return new Date(item.created_at).getTime();
          default:
            return (item as unknown as Record<string, unknown>)[key];
        }
      });

      // Announce results to screen readers
      if (filtered.length !== activities.length) {
        announce(`Found ${filtered.length} activities matching your filters`);
      }

      return sorted;
    }, [activities, searchQuery, typeFilter, sortField, sortOrder, announce]);

    // Pagination with memoization
    const paginatedActivities = useMemo(() => {
      const start = page * pageSize;
      const end = start + pageSize;
      return processedActivities.slice(start, end);
    }, [processedActivities, page, pageSize]);

    const totalPages = Math.ceil(processedActivities.length / pageSize);

    // Virtual scrolling for performance
    const virtualizer = useVirtualizer({
      count: paginatedActivities.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 60,
      overscan: 5,
    });

    // Keyboard navigation
    const { containerRef } = useKeyboardNavigation<HTMLDivElement>(
      paginatedActivities.length,
      (index) => {
        const activity = paginatedActivities[index];
        if (activity?.url) {
          window.open(activity.url, '_blank', 'noopener,noreferrer');
        }
      }
    );

    // Sort handler with memoization
    const handleSort = useCallback(
      (field: SortField) => {
        if (sortField === field) {
          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
          setSortField(field);
          setSortOrder('desc');
        }
        announce(`Sorted by ${field} ${sortOrder === 'asc' ? 'descending' : 'ascending'}`);
      },
      [sortField, sortOrder, announce]
    );

    // Loading state
    if (loading) {
      return <ActivityTableSkeleton />;
    }

    return (
      <div className={cn('space-y-4 w-full', className)}>
        {/* Filters */}
        <ActivityTableFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />

        {/* Table with virtualization */}
        <div
          className="rounded-md border w-full"
          role="grid"
          aria-label="Activity table"
          aria-rowcount={processedActivities.length}
          aria-colcount={7}
        >
          {/* Table Header */}
          <ActivityTableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />

          {/* Table Body */}
          <div>
            {paginatedActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" role="row" aria-rowindex={1}>
                <div role="cell" aria-colindex={1} aria-colspan={7}>
                  No activities found
                </div>
              </div>
            ) : (
              <div
                ref={(el) => {
                  if (el) {
                    (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                    if (containerRef.current !== el) {
                      (containerRef as React.MutableRefObject<HTMLDivElement>).current = el;
                    }
                  }
                }}
                className="h-[600px] w-full overflow-auto"
                style={{
                  contain: 'strict',
                  width: '100%',
                }}
                tabIndex={0}
                aria-label="Scrollable activity list"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const activity = paginatedActivities[virtualItem.index];

                    return (
                      <div
                        key={activity.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                        aria-rowindex={virtualItem.index + 2} // +2 because header is row 1
                      >
                        <ActivityTableRow activity={activity} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <div className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1} to{' '}
              {Math.min((page + 1) * pageSize, processedActivities.length)} of{' '}
              {processedActivities.length} activities
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ActivityTableContent.displayName = 'ActivityTableContent';

// Export the component wrapped with error boundary
export const ActivityTable = (props: ActivityTableProps) => {
  return (
    <AnalyticsErrorBoundary
      fallback={
        <div className="p-4 text-center text-muted-foreground">
          Failed to load activity table. Please try refreshing the page.
        </div>
      }
    >
      <ActivityTableContent {...props} />
    </AnalyticsErrorBoundary>
  );
};
