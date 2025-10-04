import { Users, GitPullRequest, Target, TrendingUp } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StatCardConfig, WidgetData } from './widget-types';
import { getIconSize } from '@/lib/utils/size-styling';

interface StatCardProps {
  config: StatCardConfig;
  data: WidgetData;
  className?: string;
}

const METRIC_CONFIG = {
  contributors: {
    icon: Users,
    label: 'Contributors',
    getValue: (data: WidgetData) => data.stats.totalContributors,
    getSubtext: undefined,
    color: 'text-blue-600 dark:text-primary',
  },
  'pull-requests': {
    icon: GitPullRequest,
    label: 'Pull Requests',
    getValue: (data: WidgetData) => data.stats.totalPRs,
    getSubtext: undefined,
    color: 'text-green-600 dark:text-primary',
  },
  'lottery-factor': {
    icon: Target,
    label: 'Lottery Factor',
    getValue: (data: WidgetData) => data.stats.lotteryFactor?.toFixed(1) || 'N/A',
    getSubtext: (data: WidgetData) => data.stats.lotteryRating,
    color: 'text-orange-600 dark:text-primary',
  },
  'merge-rate': {
    icon: TrendingUp,
    label: 'Merge Rate',
    getValue: (data: WidgetData) => `${data.stats.mergeRate.toFixed(1)}%`,
    getSubtext: undefined,
    color: 'text-purple-600 dark:text-primary',
  },
};

export function StatCard({ config, data, className }: StatCardProps) {
  const metrics = config.metrics || ['contributors', 'pull-requests', 'lottery-factor'];
  const theme = config.theme || 'dark';
  const size = config.size || 'medium';

  // Size variants
  const sizeClasses = {
    small: 'p-3 text-sm',
    medium: 'p-4',
    large: 'p-6 text-lg',
  };

  return (
    <Card
      className={cn(
        'embeddable-widget stat-card',
        sizeClasses[size],
        theme === 'dark' && 'dark bg-[#0A0A0A] border-[#141414]',
        theme === 'light' && 'bg-white',
        className
      )}
      style={theme === 'dark' ? { backgroundColor: '#0A0A0A', borderColor: '#141414' } : undefined}
    >
      <CardHeader className={cn('pb-2', size === 'small' && 'pb-1', size === 'large' && 'pb-4')}>
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              'flex items-center gap-2',
              size === 'small' && 'text-sm',
              size === 'large' && 'text-xl'
            )}
          >
            {config.showLogo !== false && <span className="text-lg">🌱</span>}
            {data.repository.owner}/{data.repository.repo}
          </CardTitle>
          <Badge
            variant="secondary"
            className={cn(
              size === 'small' && 'text-xs px-1.5 py-0.5',
              size === 'large' && 'text-sm px-3 py-1',
              theme === 'dark' && 'bg-[#141414] text-gray-300 border-primary/20'
            )}
          >
            {data.repository.language}
          </Badge>
        </div>
        {data.repository.description && (
          <p className={cn('text-muted-foreground text-xs', size === 'large' && 'text-sm')}>
            {data.repository.description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'grid gap-3',
            metrics.length <= 2 && 'grid-cols-1',
            metrics.length === 3 && 'grid-cols-1 sm:grid-cols-3',
            metrics.length >= 4 && 'grid-cols-2'
          )}
        >
          {metrics.map((metric) => {
            const metricConfig = METRIC_CONFIG[metric];
            if (!metricConfig) return null;

            const Icon = metricConfig.icon;
            const value = metricConfig.getValue(data);
            const subtext = metricConfig.getSubtext?.(data);

            return (
              <div key={metric} className="flex items-center gap-2">
                <Icon className={cn('flex-shrink-0', metricConfig.color, getIconSize(size))} />
                <div className="min-w-0">
                  <div
                    className={cn(
                      'font-semibold',
                      size === 'small' && 'text-sm',
                      size === 'large' && 'text-lg'
                    )}
                  >
                    {value}
                  </div>
                  <div
                    className={cn('text-muted-foreground text-xs', size === 'large' && 'text-sm')}
                  >
                    {subtext || metricConfig.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with attribution */}
        {config.showLogo !== false && (
          <div className={cn(
            "mt-3 pt-2 border-t text-xs text-center",
            theme === 'dark' ? 'border-[#141414] text-gray-400' : 'text-muted-foreground'
          )}>
            <span>Powered by </span>
            <a
              href="https://contributor.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              contributor.info
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
