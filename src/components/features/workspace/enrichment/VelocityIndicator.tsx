import { TrendingUp, TrendingDown, Minus } from '@/components/ui/icon';
import type { VelocityMetrics } from '@/lib/llm/contributor-enrichment-types';
import { cn } from '@/lib/utils';

interface VelocityIndicatorProps {
  velocity: VelocityMetrics;
  className?: string;
  /** Show numeric change percentage */
  showPercentage?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Get trend icon based on velocity trend
 */
function getTrendIcon(trend: VelocityMetrics['trend']) {
  switch (trend) {
    case 'accelerating':
      return TrendingUp;
    case 'declining':
      return TrendingDown;
    case 'steady':
      return Minus;
  }
}

/**
 * Get trend color based on velocity trend
 */
function getTrendColor(trend: VelocityMetrics['trend']): string {
  switch (trend) {
    case 'accelerating':
      return 'text-green-600 dark:text-green-400';
    case 'declining':
      return 'text-red-600 dark:text-red-400';
    case 'steady':
      return 'text-muted-foreground';
  }
}

/**
 * Get trend label for accessibility
 */
function getTrendLabel(trend: VelocityMetrics['trend'], changePercent: number): string {
  const absChange = Math.abs(changePercent);
  switch (trend) {
    case 'accelerating':
      return `Activity accelerating: +${Math.round(absChange)}%`;
    case 'declining':
      return `Activity declining: -${Math.round(absChange)}%`;
    case 'steady':
      return 'Activity steady';
  }
}

/**
 * Get trend emoji based on velocity trend
 */
function getTrendEmoji(trend: VelocityMetrics['trend']): string {
  switch (trend) {
    case 'accelerating':
      return '🟢';
    case 'declining':
      return '🔴';
    case 'steady':
      return '🟡';
  }
}

export function VelocityIndicator({
  velocity,
  className,
  showPercentage = true,
  size = 'sm',
}: VelocityIndicatorProps) {
  const TrendIcon = getTrendIcon(velocity.trend);
  const trendColor = getTrendColor(velocity.trend);
  const trendLabel = getTrendLabel(velocity.trend, velocity.changePercent);
  const trendEmoji = getTrendEmoji(velocity.trend);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      title={trendLabel}
      aria-label={trendLabel}
    >
      <span className={iconSize} role="img" aria-hidden="true">
        {trendEmoji}
      </span>
      <TrendIcon className={cn(iconSize, trendColor)} aria-hidden="true" />
      {showPercentage && Math.abs(velocity.changePercent) > 0 && (
        <span className={cn(textSize, 'font-medium', trendColor)}>
          {velocity.changePercent > 0 ? '+' : ''}
          {Math.round(velocity.changePercent)}%
        </span>
      )}
    </div>
  );
}
