import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { DataFreshnessIndicator } from '@/components/ui/data-freshness-indicator';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, TrendingUp, Star, GitPullRequest, Users } from '@/components/ui/icon';

export interface TrendingRepositoryData {
  id: string;
  owner: string;
  name: string;
  description?: string;
  language?: string;
  stars: number;
  trending_score: number;
  star_change: number;
  pr_change: number;
  contributor_change: number;
  last_activity: string;
  avatar_url?: string;
  html_url: string;
}

export interface TrendingRepositoryCardProps {
  repository: TrendingRepositoryData;
  className?: string;
  showDataFreshness?: boolean;
  compact?: boolean;
}

interface MetricChangeProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  formatValue?: (value: number) => string;
}

function MetricChange({ label, value, icon: Icon, formatValue }: MetricChangeProps) {
  if (value === 0) return null;
  
  const isPositive = value > 0;
  const displayValue = formatValue ? formatValue(Math.abs(value)) : `${Math.abs(value)}`;
  
  return (
    <div className={cn(
      'flex items-center gap-1 text-xs',
      isPositive ? 'text-green-600' : 'text-red-600'
    )}>
      {isPositive ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
      <Icon className="w-3 h-3" />
      <span>{isPositive ? '+' : '-'}{displayValue}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export function TrendingRepositoryCard({
  repository,
  className,
  showDataFreshness = true,
  compact = false,
}: TrendingRepositoryCardProps) {
  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  
  // Calculate data freshness based on last activity
  const calculateFreshness = (lastActivity: string): 'fresh' | 'stale' | 'old' => {
    const lastUpdate = new Date(lastActivity);
    const now = new Date();
    const hoursSince = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSince <= 24) return 'fresh';
    if (hoursSince <= 168) return 'stale'; // 7 days
    return 'old';
  };

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className={cn('pb-3', compact && 'pb-2')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <OptimizedAvatar
              src={repository.avatar_url}
              alt={repository.owner}
              fallback={repository.owner[0].toUpperCase()}
              size={compact ? 32 : 40}
              className="flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <a
                href={repository.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <h3 className={cn(
                  'font-semibold truncate',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {repository.owner}/{repository.name}
                </h3>
              </a>
              {repository.description && !compact && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {repository.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {Math.round(repository.trending_score)}
            </Badge>
            {repository.language && (
              <Badge variant="outline" className="text-xs">
                {repository.language}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'pt-0')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-4 h-4" />
              <span>{repository.stars.toLocaleString()}</span>
            </div>
          </div>
          
          {showDataFreshness && (
            <DataFreshnessIndicator 
              freshness={calculateFreshness(repository.last_activity)}
              lastUpdate={repository.last_activity}
            />
          )}
        </div>

        {/* Metric Changes */}
        <div className="flex flex-wrap gap-3 mt-3">
          <MetricChange
            label="stars"
            value={repository.star_change}
            icon={Star}
            formatValue={formatPercentage}
          />
          <MetricChange
            label="PRs"
            value={repository.pr_change}
            icon={GitPullRequest}
            formatValue={formatPercentage}
          />
          <MetricChange
            label="contributors"
            value={repository.contributor_change}
            icon={Users}
            formatValue={formatPercentage}
          />
        </div>
      </CardContent>
    </Card>
  );
}