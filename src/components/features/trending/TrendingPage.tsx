import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingRepositoryCard } from './TrendingRepositoryCard';
import type { TrendingRepositoryData } from './TrendingRepositoryCard';
import { TrendingEventsInsights } from './TrendingEventsInsights';
import {
  TrendingUp,
  Zap,
  Sparkles,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
} from '@/components/ui/icon';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import type { GitHubRepository } from '@/lib/github';

const REPOS_PER_PAGE = 12;

export interface TrendingPageProps {
  repositories: TrendingRepositoryData[];
  loading?: boolean;
  className?: string;
  /** Called when a repository card is clicked for analytics */
  onRepositoryClick?: () => void;
}

type TimePeriod = '24h' | '7d' | '30d';
type SortOption = 'trending_score' | 'star_change' | 'pr_change' | 'contributor_change';

export function TrendingPage({
  repositories,
  loading = false,
  className,
  onRepositoryClick,
}: TrendingPageProps) {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7d');
  const [sortBy, setSortBy] = useState<SortOption>('trending_score');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Handle repository search/select for tracking CTA
  const handleSearch = useCallback(
    (repository: string) => {
      // Parse owner/repo format
      if (repository.includes('/')) {
        navigate(`/${repository}`);
      }
    },
    [navigate]
  );

  const handleSelectRepository = useCallback(
    (repository: GitHubRepository) => {
      navigate(`/${repository.full_name}`);
    },
    [navigate]
  );

  // Get unique languages for filter
  const availableLanguages = useMemo(() => {
    const languages = repositories
      .map((repo) => repo.language)
      .filter((lang): lang is string => Boolean(lang))
      .reduce((acc, lang) => acc.add(lang), new Set<string>());
    return Array.from(languages).sort();
  }, [repositories]);

  // Filter and sort repositories
  const filteredRepos = useMemo(() => {
    let filtered = repositories;

    // Apply language filter
    if (languageFilter !== 'all') {
      filtered = filtered.filter((repo) => repo.language === languageFilter);
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

  // Reset to page 1 when filters change (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [languageFilter, sortBy, timePeriod]);

  // Calculate pagination
  const totalPages = Math.ceil(Math.max(0, filteredRepos.length - 1) / REPOS_PER_PAGE);

  // Get repos for the current page (excluding the first "hottest" repo which is always shown)
  const paginatedRepos = useMemo(() => {
    if (filteredRepos.length <= 1) return [];
    const reposWithoutHottest = filteredRepos.slice(1);
    const startIndex = (currentPage - 1) * REPOS_PER_PAGE;
    const endIndex = startIndex + REPOS_PER_PAGE;
    return reposWithoutHottest.slice(startIndex, endIndex);
  }, [filteredRepos, currentPage]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

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

  return (
    <div className={className}>
      <div className="container mx-auto px-4 py-8">
        {/* Header - Always visible */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start sm:items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex-shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Trending Repositories
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground hidden sm:block">
                Discover repositories with significant recent activity and growth
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">
                Showing trends for {getTimePeriodLabel(timePeriod).toLowerCase()}
              </span>
              <span className="sm:hidden">{getTimePeriodLabel(timePeriod)}</span>
            </div>
            {!loading && (
              <Badge variant="secondary">
                {filteredRepos.length} {filteredRepos.length === 1 ? 'repo' : 'repos'}
              </Badge>
            )}
            {loading && (
              <Badge variant="secondary" className="text-muted-foreground" aria-live="polite">
                Loading...
              </Badge>
            )}
          </div>
        </div>

        {/* Controls - Always visible */}
        <div className="mb-6">
          <Tabs value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
            <div className="flex flex-col gap-4 mb-6">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger
                  value="24h"
                  className="flex-1 sm:flex-none flex items-center gap-1 sm:gap-2"
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>24h</span>
                </TabsTrigger>
                <TabsTrigger
                  value="7d"
                  className="flex-1 sm:flex-none flex items-center gap-1 sm:gap-2"
                >
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>7d</span>
                </TabsTrigger>
                <TabsTrigger value="30d" className="flex-1 sm:flex-none">
                  30d
                </TabsTrigger>
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
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value={timePeriod} className="space-y-0">
              {/* Loading state - skeleton matching hottest repository card */}
              {loading && (
                <>
                  <Card className="mb-8 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        🔥 Hottest Repository
                      </CardTitle>
                      <CardDescription>Loading top trending repository...</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Skeleton card matching TrendingRepositoryCard structure */}
                      <Card className="animate-pulse">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-muted" />
                              <div className="min-w-0 space-y-2">
                                <div className="h-5 w-40 bg-muted rounded" />
                                <div className="h-3 w-24 bg-muted rounded" />
                              </div>
                            </div>
                            <div className="h-6 w-16 bg-muted rounded-full" />
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-4 w-full bg-muted rounded mb-4" />
                          <div className="h-4 w-3/4 bg-muted rounded mb-4" />
                          <div className="flex items-center gap-4">
                            <div className="h-4 w-16 bg-muted rounded" />
                            <div className="h-4 w-16 bg-muted rounded" />
                            <div className="h-4 w-16 bg-muted rounded" />
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>

                  {/* Skeleton grid for remaining repos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted" />
                            <div className="space-y-2">
                              <div className="h-4 w-32 bg-muted rounded" />
                              <div className="h-3 w-20 bg-muted rounded" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="h-3 w-full bg-muted rounded mb-2" />
                          <div className="h-3 w-2/3 bg-muted rounded" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Content only shown when not loading */}
              {!loading && (
                <>
                  {/* Trending Events Insights */}
                  {filteredRepos.length > 0 && (
                    <TrendingEventsInsights
                      repositories={filteredRepos.map((repo) => ({
                        full_name: `${repo.owner}/${repo.name}`,
                        owner: repo.owner,
                        name: repo.name,
                        language: repo.language,
                      }))}
                      timeRange={timePeriod}
                    />
                  )}

                  {filteredRepos.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex items-center justify-center py-16">
                        <div className="text-center max-w-md">
                          <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full w-fit mx-auto mb-4">
                            <TrendingUp className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">
                            No trending repositories yet
                          </h3>
                          <p className="text-muted-foreground mb-6">
                            {languageFilter !== 'all'
                              ? `No ${languageFilter} repositories are trending right now. Try a different language or be the first to track one!`
                              : 'Be the first to track a repository and help populate our trending data.'}
                          </p>
                          <div className="space-y-4">
                            <GitHubSearchInput
                              placeholder="Search for a repository to track..."
                              onSearch={handleSearch}
                              onSelect={handleSelectRepository}
                              searchLocation="trending"
                              buttonText="Track"
                              className="max-w-sm mx-auto"
                            />
                            <p className="text-xs text-muted-foreground">
                              Try: facebook/react, microsoft/vscode, or vercel/next.js
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Top trending highlight */}
                      {filteredRepos.length > 0 && (
                        <Card className="mb-8 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/10">
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
                              onClick={onRepositoryClick}
                            />
                          </CardContent>
                        </Card>
                      )}

                      {/* Repository grid */}
                      {paginatedRepos.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {paginatedRepos.map((repo) => (
                            <TrendingRepositoryCard
                              key={repo.id}
                              repository={repo}
                              showDataFreshness={true}
                              onClick={onRepositoryClick}
                            />
                          ))}
                        </div>
                      )}

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1}
                            className="gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Previous</span>
                          </Button>

                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Page</span>
                            <Badge variant="secondary" className="px-2">
                              {currentPage}
                            </Badge>
                            <span>of {totalPages}</span>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                          >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Track a Repository CTA */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="w-5 h-5 text-muted-foreground" />
              Don't see your repository?
            </CardTitle>
            <CardDescription>
              Track any GitHub repository to add it to our trending data and get contributor
              insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GitHubSearchInput
              placeholder="Search for a repository to track (e.g., facebook/react)"
              onSearch={handleSearch}
              onSelect={handleSelectRepository}
              searchLocation="trending"
              buttonText="Track"
              className="max-w-xl"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
