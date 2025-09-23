import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronUp,
  GitPullRequest,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { PullRequest } from '../WorkspacePullRequestsTable';

interface AuthorStatus {
  username: string;
  avatar_url: string;
  totalOpenPRs: number; // Total open PRs including drafts
  openPRs: number;
  draftPRs: number;
  blockedPRs: number; // PRs with changes requested
  approvedPRs: number; // PRs with at least one approval
  pendingPRs: number; // PRs with no reviews yet
  isBot: boolean;
}

interface PRAuthorStatusChartProps {
  pullRequests: PullRequest[];
  onAuthorClick?: (author: string) => void;
  className?: string;
  maxVisible?: number;
  title?: string;
  repositories?: Array<{ owner: string; name: string }>;
}

type StatusFilter = 'all' | 'blocked' | 'approved' | 'pending';

export function PRAuthorStatusChart({
  pullRequests,
  onAuthorClick,
  className,
  maxVisible = 10,
  title = 'Pull Request Author Status',
  repositories,
}: PRAuthorStatusChartProps) {
  const [excludeBots, setExcludeBots] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Calculate author status distribution
  const authorStatusData = useMemo(() => {
    const statusMap = new Map<string, AuthorStatus>();

    // Only process open PRs and drafts
    const openAndDraftPRs = pullRequests.filter(
      (pr) => pr.state === 'open' || pr.state === 'draft'
    );

    openAndDraftPRs.forEach((pr) => {
      const authorUsername = pr.author.username;
      const authorAvatar = pr.author.avatar_url;
      const isBotUser = isBot({ username: authorUsername });

      // Get existing or create new author status
      let authorStatus = statusMap.get(authorUsername);
      if (!authorStatus) {
        authorStatus = {
          username: authorUsername,
          avatar_url: authorAvatar,
          totalOpenPRs: 0,
          openPRs: 0,
          draftPRs: 0,
          blockedPRs: 0,
          approvedPRs: 0,
          pendingPRs: 0,
          isBot: isBotUser,
        };
        statusMap.set(authorUsername, authorStatus);
      }

      // Update counts based on PR state
      authorStatus.totalOpenPRs++;

      if (pr.state === 'draft') {
        authorStatus.draftPRs++;
      } else if (pr.state === 'open') {
        authorStatus.openPRs++;

        // Check review status for open PRs
        if (pr.reviewers && pr.reviewers.length > 0) {
          const hasApproval = pr.reviewers.some((r) => r.approved || r.state === 'APPROVED');
          const hasChangesRequested = pr.reviewers.some((r) => r.state === 'CHANGES_REQUESTED');

          if (hasChangesRequested) {
            authorStatus.blockedPRs++;
          } else if (hasApproval) {
            authorStatus.approvedPRs++;
          } else {
            authorStatus.pendingPRs++;
          }
        } else {
          // No reviewers yet
          authorStatus.pendingPRs++;
        }
      }
    });

    // Convert to array and filter
    let authorsArray = Array.from(statusMap.values());

    if (excludeBots) {
      authorsArray = authorsArray.filter((author) => !author.isBot);
    }

    // Filter by status if not 'all'
    if (statusFilter !== 'all') {
      authorsArray = authorsArray.filter((author) => {
        switch (statusFilter) {
          case 'blocked':
            return author.blockedPRs > 0;
          case 'approved':
            return author.approvedPRs > 0;
          case 'pending':
            return author.pendingPRs > 0;
          default:
            return true;
        }
      });
    }

    // Sort by approved PRs first, then blocked PRs, then by total open PRs
    return authorsArray.sort((a, b) => {
      // Approved PRs first (highest priority)
      if (a.approvedPRs !== b.approvedPRs) {
        return b.approvedPRs - a.approvedPRs;
      }
      // Then blocked PRs (needs attention)
      if (a.blockedPRs !== b.blockedPRs) {
        return b.blockedPRs - a.blockedPRs;
      }
      // Finally by total open PRs
      if (a.totalOpenPRs !== b.totalOpenPRs) {
        return b.totalOpenPRs - a.totalOpenPRs;
      }
      return 0;
    });
  }, [pullRequests, excludeBots, statusFilter]);

  const visibleAuthors = isExpanded ? authorStatusData : authorStatusData.slice(0, maxVisible);
  const hasMore = authorStatusData.length > maxVisible;

  // Find max count for bar width calculation
  const maxCount = Math.max(...authorStatusData.map((a) => a.totalOpenPRs), 1);

  const handleAuthorClick = (author: AuthorStatus) => {
    if (!onAuthorClick) return;
    onAuthorClick(author.username);
  };

  // Calculate totals for summary
  const totals = useMemo(() => {
    return authorStatusData.reduce(
      (acc, author) => ({
        totalOpen: acc.totalOpen + author.openPRs,
        totalDraft: acc.totalDraft + author.draftPRs,
        totalBlocked: acc.totalBlocked + author.blockedPRs,
        totalApproved: acc.totalApproved + author.approvedPRs,
        totalPending: acc.totalPending + author.pendingPRs,
      }),
      {
        totalOpen: 0,
        totalDraft: 0,
        totalBlocked: 0,
        totalApproved: 0,
        totalPending: 0,
      }
    );
  }, [authorStatusData]);

  // Helper to get GitHub URL for author's PRs
  const getGitHubAuthorUrl = (author: AuthorStatus) => {
    const encodedUsername = encodeURIComponent(author.username);

    // Single repository search
    if (repositories && repositories.length === 1) {
      const repo = repositories[0];
      return `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
        repo.name
      )}/pulls?q=is%3Apr+author%3A${encodedUsername}`;
    }

    // Multiple repositories or no repository info - search all PRs
    return `https://github.com/pulls?q=is%3Apr+author%3A${encodedUsername}`;
  };

  if (authorStatusData.length === 0) {
    return null;
  }

  // Helper function to get filter label
  const getFilterLabel = () => {
    switch (statusFilter) {
      case 'blocked':
        return 'Blocked PRs';
      case 'approved':
        return 'Approved PRs';
      case 'pending':
        return 'Pending Review';
      default:
        return 'All PRs';
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3 w-3 mr-2" />
                {getFilterLabel()}
                <ChevronDown className="h-3 w-3 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setStatusFilter('all')}
                className={cn(statusFilter === 'all' && 'bg-accent')}
              >
                All PRs
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('blocked')}
                className={cn(statusFilter === 'blocked' && 'bg-accent')}
              >
                <AlertCircle className="h-3 w-3 mr-2 text-red-500" />
                Blocked (Changes Requested)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('approved')}
                className={cn(statusFilter === 'approved' && 'bg-accent')}
              >
                <CheckCircle2 className="h-3 w-3 mr-2 text-green-500" />
                Approved
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('pending')}
                className={cn(statusFilter === 'pending' && 'bg-accent')}
              >
                <Clock className="h-3 w-3 mr-2 text-yellow-500" />
                Pending Review
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleAuthors.map((author) => {
            const githubUrl = getGitHubAuthorUrl(author);

            return (
              <div
                key={author.username}
                className="group cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleAuthorClick(author)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    title={`View PRs authored by ${author.username}`}
                  >
                    <img
                      src={author.avatar_url || `https://github.com/${author.username}.png`}
                      alt={author.username}
                      className="h-8 w-8 rounded-full hover:ring-2 hover:ring-primary transition-all"
                      onError={(e) => {
                        e.currentTarget.src = `https://github.com/${author.username}.png`;
                      }}
                    />
                  </a>

                  {/* Username and stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{author.username}</span>
                      {author.isBot && (
                        <Badge variant="secondary" className="text-xs">
                          Bot
                        </Badge>
                      )}
                      {/* Status indicators with counts */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {author.blockedPRs > 0 && (
                          <>
                            <span title="Changes requested (blocked)">
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            </span>
                            <span>{author.blockedPRs}</span>
                          </>
                        )}
                        {author.approvedPRs > 0 && (
                          <>
                            {author.blockedPRs > 0 && <span>/</span>}
                            <span title="Approved PRs">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            </span>
                            <span>{author.approvedPRs}</span>
                          </>
                        )}
                        {author.pendingPRs > 0 && (
                          <>
                            {(author.blockedPRs > 0 || author.approvedPRs > 0) && <span>/</span>}
                            <span title="Pending review">
                              <Clock className="h-3 w-3 text-yellow-500" />
                            </span>
                            <span>{author.pendingPRs}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stacked progress bar for open PRs */}
                    <div className="relative">
                      <div className="h-6 bg-muted rounded-md overflow-hidden">
                        <div className="flex h-full">
                          {/* Blocked PRs (changes requested) */}
                          {author.blockedPRs > 0 && (
                            <div
                              className="bg-red-500 dark:bg-red-600 transition-all duration-500 ease-out"
                              style={{
                                width: `${(author.blockedPRs / maxCount) * 100}%`,
                              }}
                              title={`${author.blockedPRs} blocked (changes requested)`}
                            />
                          )}
                          {/* Pending review PRs */}
                          {author.pendingPRs > 0 && (
                            <div
                              className="bg-yellow-500 dark:bg-yellow-600 transition-all duration-500 ease-out"
                              style={{ width: `${(author.pendingPRs / maxCount) * 100}%` }}
                              title={`${author.pendingPRs} pending review`}
                            />
                          )}
                          {/* Approved PRs */}
                          {author.approvedPRs > 0 && (
                            <div
                              className="bg-green-500 dark:bg-green-600 transition-all duration-500 ease-out"
                              style={{ width: `${(author.approvedPRs / maxCount) * 100}%` }}
                              title={`${author.approvedPRs} approved`}
                            />
                          )}
                          {/* Draft PRs */}
                          {author.draftPRs > 0 && (
                            <div
                              className="bg-gray-500 dark:bg-gray-600 transition-all duration-500 ease-out"
                              style={{ width: `${(author.draftPRs / maxCount) * 100}%` }}
                              title={`${author.draftPRs} draft`}
                            />
                          )}
                        </div>
                      </div>
                      {/* Count overlay */}
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            // Use contrasting color when bar is more than 80% width
                            author.totalOpenPRs / maxCount > 0.8 ? 'text-white' : 'text-foreground'
                          )}
                        >
                          {author.totalOpenPRs}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show more/less button */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show {authorStatusData.length - maxVisible} More
                </>
              )}
            </Button>
          )}
        </div>

        {/* Summary stats and controls */}
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total authors: {authorStatusData.length}</span>
            <div className="flex gap-2 flex-wrap">
              {totals.totalBlocked > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {totals.totalBlocked} blocked
                </span>
              )}
              {totals.totalApproved > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  {totals.totalApproved} approved
                </span>
              )}
              {totals.totalPending > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {totals.totalPending} pending
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="exclude-bots-pr-author"
                checked={excludeBots}
                onCheckedChange={setExcludeBots}
              />
              <Label htmlFor="exclude-bots-pr-author" className="text-sm text-muted-foreground">
                Exclude Bots
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
