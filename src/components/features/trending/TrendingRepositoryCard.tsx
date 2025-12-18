import { Link } from 'react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { DataFreshnessIndicator } from '@/components/ui/data-freshness-indicator';
import { cn } from '@/lib/utils';
import { getChangeDirectionColor, formatPercentageChange } from '@/lib/utils/state-mapping';
import {
  ChevronUp,
  ChevronDown,
  TrendingUp,
  Star,
  GitPullRequest,
  Users,
  ExternalLink,
} from '@/components/ui/icon';

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
  /** Optional callback when card is clicked for analytics */
  onClick?: () => void;
}

interface MetricChangeProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  formatValue?: (value: number) => string;
}

function MetricChange({ value, icon: Icon, formatValue }: MetricChangeProps) {
  // Show metric even if value is 0 for consistent display
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const displayValue = formatValue ? formatValue(Math.abs(value)) : `${Math.abs(value)}`;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs',
        getChangeDirectionColor(isPositive, isNeutral)
      )}
    >
      {!isNeutral &&
        (isPositive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      <Icon className="w-3 h-3" />
      <span>{formatPercentageChange(isNeutral, isPositive, displayValue)}</span>
    </div>
  );
}

export function TrendingRepositoryCard({
  repository,
  className,
  showDataFreshness = true,
  compact = false,
  onClick,
}: TrendingRepositoryCardProps) {
  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  const internalUrl = `/${repository.owner}/${repository.name}`;

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
    <Link to={internalUrl} onClick={onClick} className="block group">
      <Card
        className={cn(
          'hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 transition-all cursor-pointer',
          className
        )}
      >
        <CardHeader className={cn('pb-3', compact && 'pb-2')}>
          <div className="space-y-3">
            {/* First row: Avatar and repo name */}
            <div className="flex items-center gap-3">
              <OptimizedAvatar
                src={repository.avatar_url}
                alt={repository.owner}
                fallback={repository.owner?.[0]?.toUpperCase() || '?'}
                size={compact ? 32 : 40}
                className="flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      'font-semibold truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors',
                      compact ? 'text-sm' : 'text-base'
                    )}
                  >
                    {repository.owner}/{repository.name}
                  </h3>
                  <a
                    href={repository.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="View on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {/* Freshness indicator next to repo name */}
                  {showDataFreshness && (
                    <DataFreshnessIndicator
                      freshness={calculateFreshness(repository.last_activity)}
                      lastUpdate={repository.last_activity}
                      className="flex-shrink-0"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Second row: Description (desktop only) */}
            {repository.description && !compact && (
              <p className="text-sm text-muted-foreground line-clamp-2 hidden sm:block">
                {repository.description}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn('pt-0', compact && 'pt-0')}>
          <div className="flex flex-col gap-2">
            {/* Mobile: Metrics on top row - aligned left */}
            <div className="flex items-center justify-start gap-2 sm:hidden">
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

            {/* Mobile: Badges on bottom row - aligned left */}
            <div className="flex items-center justify-start gap-2 sm:hidden">
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <TrendingUp className="w-3 h-3" />
                <span>{Math.round(repository.trending_score)}</span>
              </Badge>
              {repository.language && (
                <Badge variant="outline" className="text-xs">
                  {repository.language}
                </Badge>
              )}
            </div>

            {/* Desktop: Original layout */}
            <div className="hidden sm:flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
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
              {/* Desktop badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  <span>{Math.round(repository.trending_score)}</span>
                </Badge>
                {repository.language && (
                  <Badge variant="outline" className="text-xs">
                    {repository.language}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
