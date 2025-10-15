import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LastUpdated } from '@/components/ui/last-updated';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataTimestamp } from '@/hooks/use-data-timestamp';
import { supabase } from '@/lib/supabase';
import { useWorkspaceDiscussions } from '@/hooks/useWorkspaceDiscussions';
import {
  MessageSquare,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from '@/components/ui/icon';
import { Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';
import { convertGithubEmoji } from '@/lib/utils/github-emoji';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';
import type { ContributorStats } from '@/lib/types';

export interface Discussion {
  id: string;
  github_id: string;
  repository_id: string;
  number: number;
  title: string;
  body: string | null;
  summary?: string | null;
  category_id: string | null;
  category_name: string | null;
  category_description: string | null;
  category_emoji: string | null;
  author_id: string | null;
  author_login: string | null;
  author_avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  is_answered: boolean;
  answer_id: string | null;
  answer_chosen_at: string | null;
  answer_chosen_by: string | null;
  upvote_count: number;
  comment_count: number;
  url: string;
  locked: boolean;
  responded_by?: string | null;
  responded_at?: string | null;
  repositories?: {
    name: string;
    owner: string;
    full_name: string;
  };
}

type SortOption = 'newest' | 'upvotes' | 'comments';
type FilterOption = 'all' | 'answered' | 'unanswered';

interface WorkspaceDiscussionsTableProps {
  repositories: Array<{
    id: string;
    name: string;
    owner: string;
    full_name: string;
  }>;
  selectedRepositories: string[];
  workspaceId: string;
  timeRange?: string;
  onRefresh?: () => void;
  userRole?: string | null;
  isLoggedIn?: boolean;
  onRespondClick?: (discussion: Discussion) => void;
}

export function WorkspaceDiscussionsTable({
  repositories,
  selectedRepositories,
  workspaceId,
  onRefresh,
  userRole,
  isLoggedIn = false,
  onRespondClick,
}: WorkspaceDiscussionsTableProps) {
  // Use the new hook for automatic discussion syncing and caching
  const { discussions, loading, error, lastSynced, isStale, refresh } = useWorkspaceDiscussions({
    repositories,
    selectedRepositories,
    workspaceId,
    refreshInterval: 60, // Hourly refresh interval
    maxStaleMinutes: 60, // Consider data stale after 60 minutes
    autoSyncOnMount: true, // Auto-sync enabled with hourly refresh
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDiscussionForSimilar, setSelectedDiscussionForSimilar] =
    useState<Discussion | null>(null);
  const [similarDiscussionsMap, setSimilarDiscussionsMap] = useState<Map<string, Discussion[]>>(
    new Map()
  );
  const itemsPerPage = 10;

  // Track data timestamps
  const { lastUpdated } = useDataTimestamp([discussions], {
    autoUpdate: true,
  });

  // Log sync status for debugging
  useEffect(() => {
    if (lastSynced) {
      const minutesAgo = ((Date.now() - lastSynced.getTime()) / (1000 * 60)).toFixed(1);
      console.log(
        `Discussion data last synced ${minutesAgo} minutes ago${isStale ? ' (stale)' : ' (fresh)'}`
      );
    }
  }, [lastSynced, isStale]);

  // Check for similar discussions in the background (check if embeddings exist)
  useEffect(() => {
    const checkSimilarDiscussions = async () => {
      if (discussions.length === 0) return;

      // Batch query all discussion IDs at once to avoid N+1 query problem
      const discussionIds = discussions.map((discussion) => discussion.id);
      const similarMap = new Map<string, Discussion[]>();

      try {
        // Check which discussions have embeddings (needed for similarity search)
        // Note: We check the discussions table directly since similarity_cache uses UUIDs
        // but discussions use VARCHAR GitHub node IDs
        const { data, error } = await supabase
          .from('discussions')
          .select('id')
          .in('id', discussionIds)
          .not('embedding', 'is', null);

        if (error) {
          console.error('Error checking discussion embeddings:', error);
          return;
        }

        if (data && data.length > 0) {
          // Create a Set for O(1) lookup performance
          const discussionsWithEmbeddings = new Set(data.map((item) => item.id));

          // Mark discussions that have embeddings (can search for similar)
          for (const discussion of discussions) {
            if (discussionsWithEmbeddings.has(discussion.id)) {
              similarMap.set(discussion.id, []);
            }
          }
        }
      } catch (error) {
        console.error('Failed to check discussion embeddings:', error);
      }

      setSimilarDiscussionsMap(similarMap);
    };

    checkSimilarDiscussions();
  }, [discussions]);

  // Filter and sort discussions
  const filteredDiscussions = useMemo(
    () =>
      discussions
        .filter((discussion) => {
          // Search filter
          if (searchTerm && !discussion.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
          }

          // Answered filter
          if (filterBy === 'answered' && !discussion.is_answered) return false;
          if (filterBy === 'unanswered' && discussion.is_answered) return false;

          // Category filter
          if (selectedCategory && discussion.category_name !== selectedCategory) return false;

          return true;
        })
        .sort((a, b) => {
          switch (sortBy) {
            case 'upvotes':
              return b.upvote_count - a.upvote_count;
            case 'comments':
              return b.comment_count - a.comment_count;
            case 'newest':
            default:
              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          }
        }),
    [discussions, searchTerm, filterBy, selectedCategory, sortBy]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, filterBy, selectedCategory]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredDiscussions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDiscussions = filteredDiscussions.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  // Get unique categories
  const categories = Array.from(new Set(discussions.map((d) => d.category_name).filter(Boolean)));

  // Check if user has workspace access (must be logged in and have a role)
  const hasWorkspaceAccess = isLoggedIn && userRole;
  const showUpgradePrompt = !hasWorkspaceAccess;

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Discussions</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Community discussions across workspace repositories
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && discussions.length > 0 && (
              <LastUpdated timestamp={lastUpdated} label="Updated" size="sm" />
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                refresh();
                onRefresh?.();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Search discussions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                aria-label="Search discussions"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-2" role="group" aria-label="Sort discussions">
              <Button
                variant={sortBy === 'newest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('newest')}
                aria-pressed={sortBy === 'newest'}
                aria-label="Sort by newest"
              >
                Newest
              </Button>
              <Button
                variant={sortBy === 'upvotes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('upvotes')}
                aria-pressed={sortBy === 'upvotes'}
                aria-label="Sort by most upvoted"
              >
                Most Upvoted
              </Button>
              <Button
                variant={sortBy === 'comments' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('comments')}
                aria-pressed={sortBy === 'comments'}
                aria-label="Sort by most commented"
              >
                Most Commented
              </Button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter discussions">
            <Button
              variant={filterBy === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('all')}
              aria-pressed={filterBy === 'all'}
              aria-label="Show all discussions"
            >
              All
            </Button>
            <Button
              variant={filterBy === 'answered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('answered')}
              aria-pressed={filterBy === 'answered'}
              aria-label="Show answered discussions only"
            >
              Answered
            </Button>
            <Button
              variant={filterBy === 'unanswered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('unanswered')}
              aria-pressed={filterBy === 'unanswered'}
              aria-label="Show unanswered discussions only"
            >
              Unanswered
            </Button>

            {categories.length > 0 && (
              <>
                <div className="border-l mx-2" aria-hidden="true" />
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setSelectedCategory(selectedCategory === category ? null : category)
                    }
                    aria-pressed={selectedCategory === category}
                    aria-label={`Filter by ${category} category`}
                  >
                    {category}
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center p-8">
            <h2 className="text-lg font-semibold text-destructive mb-2">Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh} className="mt-4">
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredDiscussions.length === 0 && (
          <div className="text-center p-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No Discussions Found</h2>
            <p className="text-muted-foreground">
              {(() => {
                if (searchTerm || filterBy !== 'all' || selectedCategory) {
                  return 'Try adjusting your filters or search terms.';
                }
                if (discussions.length === 0) {
                  return 'No discussions in workspace repositories yet.';
                }
                return 'No discussions match your criteria.';
              })()}
            </p>
          </div>
        )}

        {/* Discussions List */}
        {!loading && !error && filteredDiscussions.length > 0 && (
          <>
            <div className="space-y-3" role="feed" aria-label="Discussions feed">
              {paginatedDiscussions.map((discussion) => (
                <article
                  key={discussion.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  aria-labelledby={`discussion-title-${discussion.id}`}
                >
                  <div className="flex gap-4">
                    {/* Author Avatar with Hover Card */}
                    <div className="flex-shrink-0">
                      {(() => {
                        const authoredDiscussions = discussions.filter(
                          (d) => d.author_login === discussion.author_login
                        );

                        const contributorStats: ContributorStats = {
                          login: discussion.author_login || 'Unknown',
                          avatar_url: discussion.author_avatar_url || '',
                          pullRequests: authoredDiscussions.length,
                          percentage: 0,
                          recentIssues: authoredDiscussions.slice(0, 5).map((d) => ({
                            id: d.id,
                            number: d.number,
                            title: d.title,
                            state: (d.is_answered ? 'closed' : 'open') as 'open' | 'closed',
                            created_at: d.created_at,
                            updated_at: d.updated_at,
                            repository_owner: d.repositories?.owner || '',
                            repository_name: d.repositories?.name || '',
                            comments_count: d.comment_count,
                            url: d.url,
                          })),
                        };

                        return (
                          <ContributorHoverCard
                            contributor={contributorStats}
                            showReviews={false}
                            showComments={true}
                            commentsCount={authoredDiscussions.reduce(
                              (sum, d) => sum + d.comment_count,
                              0
                            )}
                            useIssueIcons={false}
                            primaryLabel="discussions"
                            secondaryLabel="comments"
                          >
                            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                              {discussion.author_avatar_url && (
                                <AvatarImage
                                  src={discussion.author_avatar_url}
                                  alt={discussion.author_login || 'User'}
                                />
                              )}
                              <AvatarFallback>
                                {discussion.author_login?.charAt(0).toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                          </ContributorHoverCard>
                        );
                      })()}
                    </div>

                    {/* Discussion Content */}
                    <div className="flex-1 min-w-0">
                      {/* Repository & Category Badges */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {discussion.repositories && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={`https://github.com/${discussion.repositories.owner}/${discussion.repositories.name}/discussions`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2 py-1 border rounded-md text-xs hover:bg-muted/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <img
                                    src={`https://github.com/${discussion.repositories.owner}.png?size=20`}
                                    alt={discussion.repositories.owner}
                                    className="h-4 w-4 rounded"
                                  />
                                  <span>{discussion.repositories.name}</span>
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>
                                View all discussions in {discussion.repositories.full_name}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {discussion.category_name && (
                          <Badge variant="secondary" className="text-xs">
                            {discussion.category_emoji && (
                              <span className="mr-1" aria-hidden="true">
                                {convertGithubEmoji(discussion.category_emoji)}
                              </span>
                            )}
                            {discussion.category_name}
                          </Badge>
                        )}
                      </div>

                      {/* Title and Link */}
                      <h3
                        id={`discussion-title-${discussion.id}`}
                        className="font-semibold text-lg mb-1 flex items-start gap-2"
                      >
                        <a
                          href={discussion.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex-1"
                          aria-label={`${discussion.title} (opens in new tab)`}
                        >
                          {discussion.title}
                        </a>
                        <ExternalLink
                          className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                      </h3>

                      {/* AI Summary or Truncated Body */}
                      {discussion.summary ? (
                        <p className="text-sm text-muted-foreground mb-3">{discussion.summary}</p>
                      ) : (
                        discussion.body && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {discussion.body}
                          </p>
                        )
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>by {discussion.author_login || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div
                            className="flex items-center gap-1"
                            aria-label={`${discussion.upvote_count} upvotes`}
                          >
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            <span>{discussion.upvote_count}</span>
                          </div>
                          <div
                            className="flex items-center gap-1"
                            aria-label={`${discussion.comment_count} comments`}
                          >
                            <MessageSquare className="h-4 w-4" aria-hidden="true" />
                            <span>{discussion.comment_count}</span>
                          </div>
                          {discussion.is_answered && (
                            <div
                              className="flex items-center gap-1 text-green-600 dark:text-green-400"
                              aria-label="Discussion answered"
                            >
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              <span>Answered</span>
                            </div>
                          )}
                          {similarDiscussionsMap.has(discussion.id) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDiscussionForSimilar(discussion)}
                                    className="h-7 px-2 text-amber-500 hover:text-amber-600"
                                    aria-label="View similar discussions"
                                  >
                                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Similar discussions found</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {hasWorkspaceAccess && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRespondClick?.(discussion)}
                                    className={`h-7 px-2 ${
                                      discussion.responded_by && discussion.responded_at
                                        ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    disabled={
                                      !!(discussion.responded_by && discussion.responded_at) ||
                                      !onRespondClick
                                    }
                                    aria-label={
                                      discussion.responded_by && discussion.responded_at
                                        ? 'Already responded'
                                        : 'Mark as responded'
                                    }
                                  >
                                    <Reply className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {discussion.responded_by && discussion.responded_at
                                    ? 'Already responded'
                                    : 'Mark as responded'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="ml-auto">
                          <time dateTime={discussion.updated_at}>
                            {formatDistanceToNow(new Date(discussion.updated_at), {
                              addSuffix: true,
                            })}
                          </time>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredDiscussions.length)} of{' '}
                  {filteredDiscussions.length} discussions
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-muted-foreground">of</span>
                    <span className="text-sm font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    aria-label="Go to next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Blur overlay with upgrade prompt for users without workspace access */}
      {showUpgradePrompt && (
        <div className="absolute inset-0 backdrop-blur-sm bg-background/50 rounded-lg flex items-center justify-center z-10">
          <div className="max-w-md w-full mx-4">
            <PermissionUpgradeCTA
              message={
                isLoggedIn
                  ? UPGRADE_MESSAGES.WORKSPACE_DISCUSSIONS
                  : UPGRADE_MESSAGES.LOGIN_REQUIRED
              }
              variant="card"
              size="lg"
            />
          </div>
        </div>
      )}

      {/* Similar Discussions Dialog */}
      {selectedDiscussionForSimilar && (
        <Dialog
          open={!!selectedDiscussionForSimilar}
          onOpenChange={() => setSelectedDiscussionForSimilar(null)}
        >
          <DialogContent className="sm:max-w-[725px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Similar Discussions
              </DialogTitle>
              <DialogDescription>
                Discussions similar to: "{selectedDiscussionForSimilar.title.substring(0, 50)}
                {selectedDiscussionForSimilar.title.length > 50 ? '...' : ''}"
              </DialogDescription>
            </DialogHeader>
            <SimilarDiscussionsList
              discussionId={selectedDiscussionForSimilar.id}
              repositoryIds={repositories.map((r) => r.id)}
              onDiscussionClick={(discussion) => {
                // Open discussion in new tab
                window.open(discussion.url, '_blank');
                setSelectedDiscussionForSimilar(null);
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDiscussionForSimilar(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

// Component to display similar discussions
function SimilarDiscussionsList({
  discussionId,
  repositoryIds,
  onDiscussionClick,
}: {
  discussionId: string;
  repositoryIds: string[];
  onDiscussionClick?: (discussion: Discussion) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [similarDiscussions, setSimilarDiscussions] = useState<
    Array<{
      discussion_id: string;
      title: string;
      number: number;
      is_answered: boolean;
      url: string;
      similarity_score: number;
    }>
  >([]);

  // Create a stable dependency key for repository IDs
  const repositoryIdsKey = useMemo(() => repositoryIds.join(','), [repositoryIds]);

  useEffect(() => {
    const fetchSimilarDiscussions = async () => {
      setLoading(true);
      try {
        // First get the embedding for the target discussion
        const { data: discussionData, error: discussionError } = await supabase
          .from('discussions')
          .select('embedding')
          .eq('id', discussionId)
          .maybeSingle();

        if (discussionError || !discussionData?.embedding) {
          console.error('Failed to get discussion embedding:', discussionError);
          // No embedding available yet, show fallback
          const { data: fallbackData } = await supabase
            .from('discussions')
            .select('id, title, number, is_answered, url')
            .in('repository_id', repositoryIds)
            .neq('id', discussionId)
            .limit(5);

          if (fallbackData) {
            setSimilarDiscussions(
              fallbackData.map((d) => ({
                discussion_id: d.id,
                title: d.title,
                number: d.number,
                is_answered: d.is_answered,
                url: d.url,
                similarity_score: 0.5,
              }))
            );
          }
          return;
        }

        // Query for similar discussions using vector similarity
        const { data, error } = await supabase.rpc('find_similar_discussions_in_workspace', {
          query_embedding: discussionData.embedding,
          repo_ids: repositoryIds,
          match_count: 5,
          exclude_discussion_id: discussionId,
        });

        if (error) {
          console.error('Failed to fetch similar discussions:', error);
          // Fallback: Try to get any discussions from the same repositories
          const { data: fallbackData } = await supabase
            .from('discussions')
            .select('id, title, number, is_answered, url')
            .in('repository_id', repositoryIds)
            .neq('id', discussionId)
            .limit(5);

          if (fallbackData) {
            setSimilarDiscussions(
              fallbackData.map((d) => ({
                discussion_id: d.id,
                title: d.title,
                number: d.number,
                is_answered: d.is_answered,
                url: d.url,
                similarity_score: 0.5,
              }))
            );
          }
        } else if (data) {
          setSimilarDiscussions(data);
        }
      } catch (err) {
        console.error('Error fetching similar discussions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarDiscussions();
  }, [discussionId, repositoryIdsKey, repositoryIds]);

  if (loading) {
    return (
      <div className="py-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (similarDiscussions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>No similar discussions found yet.</p>
        <p className="text-sm mt-2">Embeddings are being computed in the background.</p>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-3 max-h-[400px] overflow-y-auto">
      {similarDiscussions.map((item) => (
        <div
          key={item.discussion_id}
          className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => {
            if (onDiscussionClick) {
              onDiscussionClick({
                id: item.discussion_id,
                title: item.title,
                number: item.number,
                is_answered: item.is_answered,
                url: item.url,
              } as Discussion);
            }
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {item.is_answered ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">#{item.number}</span>
                {item.similarity_score > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(item.similarity_score * 100)}% match
                  </Badge>
                )}
              </div>
              <p className="text-sm line-clamp-2">{item.title}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
