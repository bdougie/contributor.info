import { Badge } from './badge';
import { cn } from '@/lib/utils';

type Role = 'owner' | 'maintainer' | 'contributor' | 'bot';

interface RoleBadgeProps {
  role: Role;
  className?: string;
  showIcon?: boolean;
}

const roleConfig: Record<Role, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: string;
  className: string;
}> = {
  owner: {
    label: 'Owner',
    variant: 'default',
    icon: '👑',
    className: 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
  },
  maintainer: {
    label: 'Maintainer',
    variant: 'secondary', 
    icon: '🔧',
    className: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
  },
  contributor: {
    label: 'Contributor',
    variant: 'outline',
    icon: '👤',
    className: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700'
  },
  bot: {
    label: 'Bot',
    variant: 'outline',
    icon: '🤖',
    className: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
  }
};

export function RoleBadge({ role, className, showIcon = true }: RoleBadgeProps) {
  const config = roleConfig[role];
  
  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        'inline-flex items-center gap-1 text-xs font-medium',
        className
      )}
    >
      {showIcon && config.icon && (
        <span className="text-xs" role="img" aria-label={`${role} icon`}>
          {config.icon}
        </span>
      )}
      {config.label}
    </Badge>
  );
}

// Utility function to get role color for other components
export function getRoleColor(role: Role): string {
  return roleConfig[role].className;
}

// Helper component for role statistics
interface RoleStatsProps {
  stats: {
    owners: number;
    maintainers: number;
    contributors: number;
    bots: number;
    total: number;
  };
  className?: string;
}

export function RoleStats({ stats, className }: RoleStatsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {stats.owners > 0 && (
        <div className="flex items-center gap-1">
          <RoleBadge role="owner" />
          <span className="text-sm text-muted-foreground">{stats.owners}</span>
        </div>
      )}
      {stats.maintainers > 0 && (
        <div className="flex items-center gap-1">
          <RoleBadge role="maintainer" />
          <span className="text-sm text-muted-foreground">{stats.maintainers}</span>
        </div>
      )}
      {stats.contributors > 0 && (
        <div className="flex items-center gap-1">
          <RoleBadge role="contributor" />
          <span className="text-sm text-muted-foreground">{stats.contributors}</span>
        </div>
      )}
      {stats.bots > 0 && (
        <div className="flex items-center gap-1">
          <RoleBadge role="bot" />
          <span className="text-sm text-muted-foreground">{stats.bots}</span>
        </div>
      )}
    </div>
  );
}