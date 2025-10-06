import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LastUpdated } from '@/components/ui/last-updated';
import { useDataTimestamp } from '@/hooks/use-data-timestamp';
import { supabase } from '@/lib/supabase';
import {
  MessageSquare,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronUp,
  RefreshCw,
} from '@/components/ui/icon';
import { formatDistanceToNow } from 'date-fns';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';

export interface Discussion {
  id: string;
  github_id: string;
  repository_id: string;
  number: number;
  title: string;
  body: string | null;
  category_id: string | null;
  category_name: string | null;
  category_description: string | null;
  category_emoji: string | null;
  author_id: string | null;
  author_login: string | null;
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
            ? repositories
                .filter((r) => selectedRepositories.includes(r.full_name))
                .map((r) => r.id)
            : repositories.map((r) => r.id);

        if (repoIds.length === 0) {
          setDiscussions([]);
          setLoading(false);
          return;
        }

        // Fetch discussions with repository data
        // Note: We use author_login directly from discussions table instead of joining
        // with contributors because author_id is a GitHub ID (bigint) not a contributor UUID
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
          setDiscussions((data || []) as Discussion[]);
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
  const filteredDiscussions = discussions
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
    });

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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search discussions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'newest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('newest')}
              >
                Newest
              </Button>
              <Button
                variant={sortBy === 'upvotes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('upvotes')}
              >
                Most Upvoted
              </Button>
              <Button
                variant={sortBy === 'comments' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('comments')}
              >
                Most Commented
              </Button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterBy === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('all')}
            >
              All
            </Button>
            <Button
              variant={filterBy === 'answered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('answered')}
            >
              Answered
            </Button>
            <Button
              variant={filterBy === 'unanswered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('unanswered')}
            >
              Unanswered
            </Button>

            {categories.length > 0 && (
              <>
                <div className="border-l mx-2" />
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setSelectedCategory(selectedCategory === category ? null : category)
                    }
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
          <div className="space-y-3">
            {filteredDiscussions.map((discussion) => (
              <div
                key={discussion.id}
                className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex gap-4">
                  {/* Author Avatar */}
                  <div className="flex-shrink-0">
                    <Avatar className="h-10 w-10">
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
                            <span className="mr-1">{discussion.category_emoji}</span>
                          )}
                          {discussion.category_name}
                        </Badge>
                      )}
                    </div>

                    {/* Title and Link */}
                    <h3 className="font-semibold text-lg mb-1 flex items-start gap-2">
                      <a
                        href={discussion.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex-1"
                      >
                        {discussion.title}
                      </a>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </h3>

                    {/* Preview Text */}
                    {discussion.body && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {discussion.body}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>by {discussion.author_login || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <ChevronUp className="h-4 w-4" />
                          <span>{discussion.upvote_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{discussion.comment_count}</span>
                        </div>
                        {discussion.is_answered && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Answered</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-auto">
                        {formatDistanceToNow(new Date(discussion.updated_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
    </Card>
  );
}
