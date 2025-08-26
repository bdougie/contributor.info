import { Users, GitPullRequest, Target, TrendingUp } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatCardConfig, WidgetData } from "./widget-types";

interface StatCardProps {
  config: StatCardConfig;
  data: WidgetData;
  className?: string;
}

const METRIC_CONFIG = {
  contributors: {
    icon: Users,
    label: "Contributors",
    getValue: (_data: WidgetData) => data.stats.totalContributors,
    getSubtext: undefined,
    color: "text-blue-600 dark:text-blue-400",
  },
  "pull-requests": {
    icon: GitPullRequest,
    label: "Pull Requests", 
    getValue: (_data: WidgetData) => data.stats.totalPRs,
    getSubtext: undefined,
    color: "text-green-600 dark:text-green-400",
  },
  "lottery-factor": {
    icon: Target,
    label: "Lottery Factor",
    getValue: (_data: WidgetData) => data.stats.lotteryFactor?.toFixed(1) || "N/A",
    getSubtext: (_data: WidgetData) => data.stats.lotteryRating,
    color: "text-orange-600 dark:text-orange-400",
  },
  "merge-rate": {
    icon: TrendingUp,
    label: "Merge Rate",
    getValue: (_data: WidgetData) => `${data.stats.mergeRate.toFixed(1)}%`,
    getSubtext: undefined,
    color: "text-purple-600 dark:text-purple-400",
  },
};

export function StatCard({ config, _data, className }: StatCardProps) {
  const metrics = config.metrics || ['contributors', 'pull-requests', 'lottery-factor'];
  const theme = config.theme || 'light';
  const size = config.size || 'medium';

  // Size variants
  const sizeClasses = {
    small: "p-3 text-sm",
    medium: "p-4",
    large: "p-6 text-lg",
  };

  return (
    <Card className={cn(
      "embeddable-widget stat-card",
      sizeClasses[size],
      theme === 'dark' && "dark",
      className
    )}>
      <CardHeader className={cn(
        "pb-2",
        size === 'small' && "pb-1",
        size === 'large' && "pb-4"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "flex items-center gap-2",
            size === 'small' && "text-sm",
            size === 'large' && "text-xl"
          )}>
            {config.showLogo !== false && (
              <span className="text-lg">🌱</span>
            )}
            {data.repository.owner}/{data.repository.repo}
          </CardTitle>
          <Badge variant="secondary" className={cn(
            size === 'small' && "text-xs px-1.5 py-0.5",
            size === 'large' && "text-sm px-3 py-1"
          )}>
            {data.repository.language}
          </Badge>
        </div>
        {data.repository.description && (
          <p className={cn(
            "text-muted-foreground text-xs",
            size === 'large' && "text-sm"
          )}>
            {data.repository.description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid gap-3",
          metrics.length <= 2 && "grid-cols-1",
          metrics.length === 3 && "grid-cols-1 sm:grid-cols-3",
          metrics.length >= 4 && "grid-cols-2"
        )}>
          {metrics.map((metric) => {
            const metricConfig = METRIC_CONFIG[metric];
            if (!metricConfig) return null;
            
            const Icon = metricConfig.icon;
            const value = metricConfig.getValue(_data);
            const subtext = metricConfig.getSubtext?.(_data);

            return (
              <div key={metric} className="flex items-center gap-2">
                <Icon className={cn(
                  "flex-shrink-0",
                  metricConfig.color,
                  size === 'small'
? "h-3 w-3" : 
                  size === 'large' ? "h-6 w-6" : "h-4 w-4"
                )} />
                <div className="min-w-0">
                  <div className={cn(
                    "font-semibold",
                    size === 'small' && "text-sm",
                    size === 'large' && "text-lg"
                  )}>
                    {value}
                  </div>
                  <div className={cn(
                    "text-muted-foreground text-xs",
                    size === 'large' && "text-sm"
                  )}>
                    {subtext || metricConfig.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with attribution */}
        {config.showLogo !== false && (
          <div className="mt-3 pt-2 border-t text-xs text-muted-foreground text-center">
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