import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SkeletonListProps {
  className?: string;
  itemCount?: number;
  itemHeight?: 'sm' | 'md' | 'lg';
  showAvatar?: boolean;
  variant?: 'default' | 'compact';
}

const heightClasses = {
  sm: 'h-12',
  md: 'h-16',
  lg: 'h-20',
};

/**
 * SkeletonList component for displaying animated placeholder list items
 *
 * @param className - Additional CSS classes to apply
 * @param itemCount - Number of skeleton list items to display
 * @param itemHeight - Height variant for each item: sm, md, or lg
 * @param showAvatar - Whether to display avatar placeholders
 * @param variant - List style variant: default or compact
 * @returns A skeleton list component with accessibility features
 */
export function SkeletonList({
  className,
  itemCount = 5,
  itemHeight = 'md',
  showAvatar = false,
  variant = 'default',
}: SkeletonListProps) {
  return (
    <div
      className={cn(
        'space-y-4 skeleton-container',
        variant === 'compact' && 'space-y-2',
        className
      )}
      aria-label="Loading list items..."
      aria-busy="true"
      role="list"
    >
      {Array.from({ length: itemCount }).map((_, index) => (
        <div
          key={`skeleton-item-${index}`}
          className={cn(
            'flex items-center space-x-4 p-4 border rounded-lg animate-pulse skeleton-list-item skeleton-optimized',
            heightClasses[itemHeight],
            variant === 'compact' && 'p-2'
          )}
          role="listitem"
          aria-label={`Loading item ${index + 1} of ${itemCount}`}
        >
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
