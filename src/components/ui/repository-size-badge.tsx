import { Badge } from '@/components/ui/badge';
import { RepositorySize } from '@/lib/validation/database-schemas';
import { cn } from '@/lib/utils';

interface RepositorySizeBadgeProps {
  size?: RepositorySize;
  className?: string;
}

const sizeConfig = {
  small: {
    label: 'S',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  medium: {
    label: 'M',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  large: {
    label: 'L',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  },
  xl: {
    label: 'XL',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
} as const;

export function RepositorySizeBadge({ size, className }: RepositorySizeBadgeProps) {
  if (!size) {
    return (
      <Badge
        variant="secondary"
        className={cn('text-xs font-medium h-5 flex items-center px-2', className)}
        title="Repository size not yet classified"
      >
        ?
      </Badge>
    );
  }

  const config = sizeConfig[size];

  return (
    <Badge
      className={cn(
        'text-xs font-medium border-0 h-5 flex items-center px-2',
        config.color,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
