import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles } from '@/components/ui/icon';
import type { TopicShift } from '@/lib/llm/contributor-enrichment-types';
import { cn } from '@/lib/utils';

interface TopicShiftBadgeProps {
  shift: TopicShift;
  className?: string;
  /** Show full shift details or just new topics */
  mode?: 'full' | 'new-only';
  size?: 'sm' | 'md';
}

/**
 * Get color based on shift significance
 */
function getShiftColor(significance: TopicShift['significance']): string {
  switch (significance) {
    case 'major':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
    case 'minor':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
  }
}

/**
 * Format topic list for display
 */
function formatTopics(topics: string[], maxTopics = 2): string {
  if (topics.length === 0) return 'None';
  const displayed = topics.slice(0, maxTopics);
  const remaining = topics.length - displayed.length;

  const formatted = displayed.map((t) => t.replace(/_/g, ' ')).join(', ');
  return remaining > 0 ? `${formatted} +${remaining}` : formatted;
}

export function TopicShiftBadge({
  shift,
  className,
  mode = 'new-only',
  size = 'sm',
}: TopicShiftBadgeProps) {
  const shiftColor = getShiftColor(shift.significance);
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  if (mode === 'new-only' && shift.to.length === 0) {
    return null;
  }

  const label =
    mode === 'full'
      ? `${formatTopics(shift.from)} → ${formatTopics(shift.to)}`
      : formatTopics(shift.to, 3);

  const ariaLabel =
    mode === 'full'
      ? `Topic shift from ${shift.from.join(', ')} to ${shift.to.join(', ')}`
      : `New focus: ${shift.to.join(', ')}`;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        shiftColor,
        sizeClasses,
        className
      )}
      title={`${shift.significance === 'major' ? 'Major' : 'Minor'} topic shift (${shift.timeframe}): ${ariaLabel}`}
      aria-label={ariaLabel}
    >
      <Sparkles className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {mode === 'full' ? (
        <>
          <span className="capitalize">{formatTopics(shift.from, 1)}</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
          <span className="capitalize">{formatTopics(shift.to, 1)}</span>
        </>
      ) : (
        <span className="capitalize">{label}</span>
      )}
    </Badge>
  );
}
