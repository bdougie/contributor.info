import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingRepositoryCard } from './TrendingRepositoryCard';
import type { TrendingRepositoryData } from './TrendingRepositoryCard';
import { TrendingUp, Zap, Sparkles, Calendar } from '@/components/ui/icon';

export interface TrendingPageProps {
  repositories: TrendingRepositoryData[];
  loading?: boolean;
  className?: string;
}

type TimePeriod = '24h' | '7d' | '30d';
type SortOption = 'trending_score' | 'star_change' | 'pr_change' | 'contributor_change';

export function TrendingPage({ repositories, loading = false, className }: TrendingPageProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7d');
  const [sortBy, setSortBy] = useState<SortOption>('trending_score');
  const [languageFilter, setLanguageFilter] = useState<string>('all');

  // Get unique languages for filter
  const availableLanguages = useMemo(() => {
    const languages = repositories
      .map(repo => repo.language)
      .filter((lang): lang is string => Boolean(lang))
      .reduce((acc, lang) => acc.add(lang), new Set<string>());
    return Array.from(languages).sort();
  }, [repositories]);

  // Filter and sort repositories
  const filteredRepos = useMemo(() => {
    let filtered = repositories;

    // Apply language filter
    if (languageFilter !== 'all') {
      filtered = filtered.filter(repo => repo.language === languageFilter);
    }

    // Sort repositories
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'trending_score':
          return b.trending_score - a.trending_score;
        case 'star_change':
          return b.star_change - a.star_change;
        case 'pr_change':
          return b.pr_change - a.pr_change;
        case 'contributor_change':
          return b.contributor_change - a.contributor_change;
        default:
          return b.trending_score - a.trending_score;
      }
    });

    return filtered;
  }, [repositories, languageFilter, sortBy]);

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'trending_score':
        return 'Overall Trending';
      case 'star_change':
        return 'Star Growth';
      case 'pr_change':
        return 'PR Activity';
      case 'contributor_change':
        return 'New Contributors';
      default:
        return 'Overall Trending';
    }
  };

  const getTimePeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case '24h':
        return 'Last 24 Hours';
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      default:
        return 'Last 7 Days';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-2" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start sm:items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex-shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trending Repositories</h1>
              <p className="text-sm sm:text-base text-muted-foreground hidden sm:block">
                Discover repositories with significant recent activity and growth
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Showing trends for {getTimePeriodLabel(timePeriod).toLowerCase()}</span>
              <span className="sm:hidden">{getTimePeriodLabel(timePeriod)}</span>
            </div>
            <Badge variant="secondary">
              {filteredRepos.length} {filteredRepos.length === 1 ? 'repo' : 'repos'}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6">
          <Tabs value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
            <div className="flex flex-col gap-4 mb-6">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="24h" className="flex-1 sm:flex-none flex items-center gap-1 sm:gap-2">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>24h</span>
                </TabsTrigger>
                <TabsTrigger value="7d" className="flex-1 sm:flex-none flex items-center gap-1 sm:gap-2">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>7d</span>
                </TabsTrigger>
                <TabsTrigger value="30d" className="flex-1 sm:flex-none">30d</TabsTrigger>
              </TabsList>

              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trending_score">Overall Trending</SelectItem>
                    <SelectItem value="star_change">Star Growth</SelectItem>
                    <SelectItem value="pr_change">PR Activity</SelectItem>
                    <SelectItem value="contributor_change">New Contributors</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    {availableLanguages.map(lang => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value={timePeriod} className="space-y-0">
              {filteredRepos.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No trending repositories found</h3>
                      <p className="text-muted-foreground">
                        Try adjusting your filters or check back later for new trending content.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Top trending highlight */}
                  {filteredRepos.length > 0 && (
                    <Card className="mb-6 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          🔥 Hottest Repository
                        </CardTitle>
                        <CardDescription>
                          Top trending by {getSortLabel(sortBy).toLowerCase()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <TrendingRepositoryCard 
                          repository={filteredRepos[0]} 
                          showDataFreshness={true}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Repository grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredRepos.slice(1).map((repo) => (
                      <TrendingRepositoryCard
                        key={repo.id}
                        repository={repo}
                        showDataFreshness={true}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}