import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export interface TrendingBadgeProps {
  score: number;
  variant?: 'default' | 'hot' | 'subtle';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showIcon?: boolean;
  showScore?: boolean;
}

export function TrendingBadge({
  score,
  variant = 'default',
  size = 'default',
  className,
  showIcon = true,
  showScore = true,
}: TrendingBadgeProps) {
  // Determine badge style based on score and variant
  const isHot = score > 100;
  const effectiveVariant = variant === 'hot' || (variant === 'default' && isHot) ? 'hot' : variant;

  const getBadgeClasses = () => {
    const baseClasses = 'flex items-center gap-1 font-medium';

    switch (effectiveVariant) {
      case 'hot':
        return cn(
          baseClasses,
          'bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 hover:from-orange-600 hover:to-red-600',
          size === 'sm' && 'text-xs px-2 py-1',
          size === 'lg' && 'text-base px-3 py-2',
        );
      case 'subtle':
        return cn(
          baseClasses,
          'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
          size === 'sm' && 'text-xs px-2 py-1',
          size === 'lg' && 'text-base px-3 py-2',
        );
      default:
        return cn(
          baseClasses,
          'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700',
          size === 'sm' && 'text-xs px-2 py-1',
          size === 'lg' && 'text-base px-3 py-2',
        );
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  const Icon = effectiveVariant === 'hot' ? Zap : TrendingUp;

  return (
    <Badge className={cn(getBadgeClasses(), className)}>
      {showIcon && <Icon className={getIconSize()} />}
      {showScore && (
        <span>{score >= 1000 ? `${(score / 1000).toFixed(1)}k` : Math.round(score)}</span>
      )}
      {!showScore && 'Trending'}
    </Badge>
  );
}
