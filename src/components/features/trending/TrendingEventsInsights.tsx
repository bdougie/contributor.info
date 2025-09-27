import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, GitFork, TrendingUp, Activity, Users, BarChart3, Zap } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface TrendingEventsInsightsProps {
  repositories: Array<{
    full_name: string;
    owner: string;
    name: string;
    language?: string;
  }>;
  timeRange?: string;
}

interface TrendingInsights {
  totalStars: number;
  totalForks: number;
  totalActivity: number;
  uniqueContributors: number;
  avgVelocity: number;
  mostActiveRepo: {
    owner: string;
    name: string;
    events: number;
  } | null;
  languageBreakdown: Record<string, number>;
}

export function TrendingEventsInsights({
  repositories,
  timeRange = '30d',
}: TrendingEventsInsightsProps) {
  const [insights, setInsights] = useState<TrendingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingInsights = async () => {
      if (!repositories.length) {
        setInsights(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        let days = 30;
        if (timeRange === '7d') {
          days = 7;
        } else if (timeRange === '24h') {
          days = 1;
        }
        startDate.setDate(endDate.getDate() - days);

        // Get event data for trending repositories
        const repoConditions = repositories
          .map((repo) => `(repository_owner.eq.${repo.owner},repository_name.eq.${repo.name})`)
          .join(',');

        const { data: eventData, error: eventError } = await supabase
          .from('github_events_cache')
          .select('repository_owner, repository_name, event_type, actor_login, created_at')
          .or(repoConditions)
          .in('event_type', ['WatchEvent', 'ForkEvent', 'PullRequestEvent', 'IssuesEvent'])
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (eventError) throw eventError;

        if (!eventData?.length) {
          setInsights({
            totalStars: 0,
            totalForks: 0,
            totalActivity: 0,
            uniqueContributors: 0,
            avgVelocity: 0,
            mostActiveRepo: null,
            languageBreakdown: {},
          });
          return;
        }

        // Process event data
        const starEvents = eventData.filter((e) => e.event_type === 'WatchEvent');
        const forkEvents = eventData.filter((e) => e.event_type === 'ForkEvent');
        const uniqueActors = new Set(eventData.map((e) => e.actor_login));

        // Find most active repository
        const repoActivity = eventData.reduce(
          (acc, event) => {
            const repoKey = `${event.repository_owner}/${event.repository_name}`;
            acc[repoKey] = (acc[repoKey] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const mostActiveEntry = Object.entries(repoActivity).sort(([, a], [, b]) => b - a)[0];

        let mostActiveRepo = null;
        if (mostActiveEntry) {
          const [fullName, events] = mostActiveEntry;
          const [owner, name] = fullName.split('/');
          mostActiveRepo = { owner, name, events };
        }

        // Language breakdown
        const languageBreakdown = repositories.reduce(
          (acc, repo) => {
            if (repo.language) {
              const repoEvents = eventData.filter(
                (e) => e.repository_owner === repo.owner && e.repository_name === repo.name
              ).length;
              acc[repo.language] = (acc[repo.language] || 0) + repoEvents;
            }
            return acc;
          },
          {} as Record<string, number>
        );

        // Calculate velocity (events per day)
        const avgVelocity = eventData.length / Math.max(days, 1);

        setInsights({
          totalStars: starEvents.length,
          totalForks: forkEvents.length,
          totalActivity: eventData.length,
          uniqueContributors: uniqueActors.size,
          avgVelocity: Math.round(avgVelocity * 100) / 100,
          mostActiveRepo,
          languageBreakdown,
        });
      } catch (err) {
        console.error('Error fetching trending insights:', err);
        setError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingInsights();
  }, [repositories, timeRange]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trending Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trending Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {error || 'No event data available for trending analysis'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTopLanguages = () => {
    return Object.entries(insights.languageBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang, events]) => ({ lang, events }));
  };

  return (
    <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          📊 Trending Insights
        </CardTitle>
        <CardDescription>
          Real-time activity metrics from GitHub events across {repositories.length} trending
          repositories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Stars */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-2xl font-bold">{insights.totalStars}</span>
            </div>
            <p className="text-xs text-muted-foreground">New Stars</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {timeRange}
            </Badge>
          </div>

          {/* Total Forks */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <GitFork className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{insights.totalForks}</span>
            </div>
            <p className="text-xs text-muted-foreground">New Forks</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {timeRange}
            </Badge>
          </div>

          {/* Total Activity */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{insights.totalActivity}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Events</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{insights.avgVelocity}/day</span>
            </div>
          </div>

          {/* Unique Contributors */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">{insights.uniqueContributors}</span>
            </div>
            <p className="text-xs text-muted-foreground">Contributors</p>
            <Badge variant="secondary" className="text-xs mt-1">
              Unique
            </Badge>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          {/* Most Active Repository */}
          {insights.mostActiveRepo && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Most Active
              </h4>
              <div className="bg-background rounded-lg p-3">
                <p className="font-medium text-sm">
                  {insights.mostActiveRepo.owner}/{insights.mostActiveRepo.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {insights.mostActiveRepo.events} events
                </p>
              </div>
            </div>
          )}

          {/* Top Languages */}
          <div>
            <h4 className="text-sm font-medium mb-2">Top Languages by Activity</h4>
            <div className="space-y-1">
              {getTopLanguages().map(({ lang, events }, index) => (
                <div key={lang} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        (() => {
                          if (index === 0) return 'bg-blue-500';
                          if (index === 1) return 'bg-green-500';
                          return 'bg-yellow-500';
                        })()
                      )}
                    />
                    <span>{lang}</span>
                  </div>
                  <span className="text-muted-foreground">{events}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
