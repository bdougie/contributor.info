import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight?: number | ((index: number) => number);
  overscan?: number;
  className?: string;
  containerClassName?: string;
  estimateSize?: (index: number) => number;
  gap?: number;
}

/**
 * Virtualized list component for efficiently rendering large lists
 * Optimized for Core Web Vitals performance
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 100,
  overscan = 5,
  className,
  containerClassName,
  estimateSize,
  gap = 0,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize:
      estimateSize || (typeof itemHeight === 'function' ? itemHeight : () => itemHeight as number),
    overscan,
  });

  return (
    <div ref={parentRef} className={cn('overflow-auto will-change-scroll', containerClassName)}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start + virtualItem.index * gap}px)`,
              }}
              className={className}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  columnCount?: number;
  itemHeight?: number;
  gap?: number;
  className?: string;
  containerClassName?: string;
  overscan?: number;
}

/**
 * Virtualized grid component for contributor cards
 * Optimized for Core Web Vitals performance
 */
export function VirtualizedGrid<T>({
  items,
  renderItem,
  columnCount = 3,
  itemHeight = 200,
  gap = 16,
  className,
  containerClassName,
  overscan = 2,
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate rows from items and columns
  const rowCount = Math.ceil(items.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan,
  });

  return (
    <div ref={parentRef} className={cn('overflow-auto will-change-scroll', containerClassName)}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const endIndex = Math.min(startIndex + columnCount, items.length);
          const rowItems = items.slice(startIndex, endIndex);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={cn('grid', `grid-cols-${columnCount}`, gap && `gap-${gap / 4}`, className)}
            >
              {rowItems.map((item, colIndex) => {
                const actualIndex = startIndex + colIndex;
                return <div key={actualIndex}>{renderItem(item, actualIndex)}</div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Window scroller for full-page virtualization
 * Use when the list takes up the entire viewport
 */
export const WindowVirtualizedList = forwardRef<HTMLDivElement, VirtualizedListProps<unknown>>(
  function WindowVirtualizedList(
    { items, renderItem, itemHeight = 100, overscan = 5, className, estimateSize, gap = 0 },
    ref
  ) {
    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => (typeof window !== 'undefined' ? document.documentElement : null),
      estimateSize:
        estimateSize ||
        (typeof itemHeight === 'function' ? itemHeight : () => itemHeight as number),
      overscan,
    });

    return (
      <div ref={ref}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start + virtualItem.index * gap}px)`,
                }}
                className={className}
              >
                {renderItem(item, virtualItem.index)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

export default VirtualizedList;
