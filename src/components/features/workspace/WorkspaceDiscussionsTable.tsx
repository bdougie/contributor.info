import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LastUpdated } from '@/components/ui/last-updated';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDataTimestamp } from '@/hooks/use-data-timestamp';
import { supabase } from '@/lib/supabase';
import {
  MessageSquare,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from '@/components/ui/icon';
import { Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';
import { convertGithubEmoji } from '@/lib/utils/github-emoji';

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
  timeRange?: string;
  onRefresh?: () => void;
  userRole?: string | null;
  isLoggedIn?: boolean;
}

export function WorkspaceDiscussionsTable({
  repositories,
  selectedRepositories,
  onRefresh,
  userRole,
  isLoggedIn = false,
}: WorkspaceDiscussionsTableProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedDiscussionForRespond, setSelectedDiscussionForRespond] =
    useState<Discussion | null>(null);
  const [respondLoading, setRespondLoading] = useState(false);

  // Handle marking discussion as responded
  const handleMarkAsResponded = async () => {
    if (!selectedDiscussionForRespond) return;

    setRespondLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error('User not authenticated');
        setRespondLoading(false);
        return;
      }

      const { error } = await supabase
        .from('discussions')
        .update({
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', selectedDiscussionForRespond.id);

      if (error) {
        console.error('Failed to mark discussion as responded:', error);
        // TODO: Show toast notification
      } else {
        // Update local state
        setSelectedDiscussionForRespond(null);
        // TODO: Show success toast
        // TODO: Refresh discussions list
      }
    } catch (err) {
      console.error('Error marking discussion as responded:', err);
    } finally {
      setRespondLoading(false);
    }
  };

  // Track data timestamps
  const { lastUpdated } = useDataTimestamp([discussions], {
    autoUpdate: true,
  });

  // Fetch discussions for workspace repositories
  useEffect(() => {
    async function fetchDiscussions() {
      if (!repositories || repositories.length === 0) {
        setDiscussions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Filter repositories based on selection
        const repoIds =
          selectedRepositories.length > 0
            ? repositories.filter((r) => selectedRepositories.includes(r.id)).map((r) => r.id)
            : repositories.map((r) => r.id);

        if (repoIds.length === 0) {
          setDiscussions([]);
          setLoading(false);
          return;
        }

        // Fetch discussions with repository data
        const { data, error: discussionsError } = await supabase
          .from('discussions')
          .select(
            `
            *,
            repositories (
              name,
              owner,
              full_name
            )
          `
          )
          .in('repository_id', repoIds)
          .order('updated_at', { ascending: false })
          .limit(200);

        if (discussionsError) {
          console.error('Failed to fetch discussions:', discussionsError);
          setError('Failed to load discussions');
        } else {
          // Fetch avatar URLs for all unique authors
          const uniqueAuthors = [
            ...new Set((data || []).map((d) => d.author_login).filter(Boolean)),
          ];

          if (uniqueAuthors.length > 0) {
            const { data: contributorsData } = await supabase
              .from('contributors')
              .select('username, avatar_url')
              .in('username', uniqueAuthors);

            // Create a map of username -> avatar_url
            const avatarMap = new Map(
              (contributorsData || []).map((c) => [c.username, c.avatar_url])
            );

            // Enrich discussions with avatar URLs
            const enrichedData = (data || []).map((discussion) => ({
              ...discussion,
              author_avatar_url: discussion.author_login
                ? avatarMap.get(discussion.author_login)
                : null,
            }));

            setDiscussions(enrichedData as Discussion[]);
          } else {
            setDiscussions((data || []) as Discussion[]);
          }
        }
      } catch (err) {
        console.error('Error fetching discussions:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchDiscussions();
  }, [repositories, selectedRepositories]);

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
            {onRefresh && (
              <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
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
                    {/* Author Avatar */}
                    <div className="flex-shrink-0">
                      <Avatar className="h-10 w-10">
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
                    </div>

                    {/* Discussion Content */}
                    <div className="flex-1 min-w-0">
                      {/* Repository & Category Badges */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {discussion.repositories && (
                          <Badge variant="outline" className="text-xs">
                            {discussion.repositories.full_name}
                          </Badge>
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
                          {hasWorkspaceAccess && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDiscussionForRespond(discussion)}
                                    className={`h-7 px-2 ${
                                      discussion.responded_by && discussion.responded_at
                                        ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    disabled={
                                      !!(discussion.responded_by && discussion.responded_at)
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

      {/* Respond Confirmation Dialog */}
      {selectedDiscussionForRespond && (
        <Dialog
          open={!!selectedDiscussionForRespond}
          onOpenChange={() => setSelectedDiscussionForRespond(null)}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Reply className="h-5 w-5" />
                Mark as Responded
              </DialogTitle>
              <DialogDescription>
                Confirm that you've responded to this discussion:
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex flex-col gap-2">
                <p className="font-medium">
                  #{selectedDiscussionForRespond.number}: {selectedDiscussionForRespond.title}
                </p>
                {selectedDiscussionForRespond.repositories && (
                  <p className="text-sm text-muted-foreground">
                    Repository: {selectedDiscussionForRespond.repositories.full_name}
                  </p>
                )}
                {selectedDiscussionForRespond.category_name && (
                  <p className="text-sm text-muted-foreground">
                    Category: {selectedDiscussionForRespond.category_emoji}{' '}
                    {selectedDiscussionForRespond.category_name}
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                This will mark the discussion as responded by you and track when you responded.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedDiscussionForRespond(null)}
                disabled={respondLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleMarkAsResponded} disabled={respondLoading}>
                {respondLoading ? 'Marking...' : 'Mark as Responded'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
    </Card>
  );
}
