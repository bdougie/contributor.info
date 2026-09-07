import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, Download, FileText, Loader2, MessageSquare } from '@/components/ui/icon';
import { useContributorReviews } from '@/hooks/useContributorReviews';
import {
  exportContributorReviewsToCSV,
  exportContributorReviewsToJSONL,
} from '@/lib/utils/csv-export';
import {
  DEFAULT_REVIEW_FILTERS,
  filterContributorReviews,
  reviewRepositories,
  reviewUrl,
  type ContributorReview,
  type ContributorReviewFilters,
  type ReviewState,
} from '@/lib/contributors/contributor-reviews';
import { cn } from '@/lib/utils';

export interface ContributorReviewsTabProps {
  contributorUsername: string | undefined;
  workspaceId: string | undefined;
  /** Fetch only while the tab is visible. */
  active: boolean;
}

const STATE_LABELS: Record<ReviewState, string> = {
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
  COMMENTED: 'Commented',
  DISMISSED: 'Dismissed',
  PENDING: 'Pending',
};

const STATE_CLASSES: Record<ReviewState, string> = {
  APPROVED: 'border-green-500/40 text-green-600 dark:text-green-400',
  CHANGES_REQUESTED: 'border-red-500/40 text-red-600 dark:text-red-400',
  COMMENTED: 'border-border text-muted-foreground',
  DISMISSED: 'border-border text-muted-foreground',
  PENDING: 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400',
};

const STATE_FILTER_OPTIONS: Array<{ value: ContributorReviewFilters['state']; label: string }> = [
  { value: 'all', label: 'All states' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'COMMENTED', label: 'Commented' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAgo(value: string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function ReviewRow({ review }: { review: ContributorReview }) {
  const title = `#${review.pull_request.number} ${review.pull_request.title}`;
  return (
    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={reviewUrl(review)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline line-clamp-2 text-sm block"
          >
            {title}
          </a>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
            <Badge
              variant={review.is_own_pr ? 'secondary' : 'outline'}
              className="text-[10px] h-4 px-1 font-normal"
            >
              {review.is_own_pr
                ? 'Own PR'
                : `PR by ${review.pull_request.author_login ?? 'unknown'}`}
            </Badge>
            <span className="truncate max-w-[200px]">{review.repository.full_name}</span>
            <span>•</span>
            <span title={new Date(review.submitted_at).toLocaleString()}>
              {formatDate(review.submitted_at)} · {formatAgo(review.submitted_at)}
            </span>
            {review.comments.length > 0 && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {review.comments.length}
                </span>
              </>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn('text-xs h-5 px-1.5 flex-shrink-0', STATE_CLASSES[review.state])}
        >
          {STATE_LABELS[review.state] ?? review.state}
        </Badge>
      </div>
      {review.body && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-line">
          {review.body}
        </p>
      )}
    </div>
  );
}

export function ContributorReviewsTab({
  contributorUsername,
  workspaceId,
  active,
}: ContributorReviewsTabProps) {
  const { reviews, counts, loading, error } = useContributorReviews({
    contributorUsername,
    workspaceId,
    enabled: active,
  });

  const [filters, setFilters] = useState<ContributorReviewFilters>(DEFAULT_REVIEW_FILTERS);
  const repositories = useMemo(() => reviewRepositories(reviews), [reviews]);
  const visible = useMemo(() => filterContributorReviews(reviews, filters), [reviews, filters]);
  const isFiltered = visible.length !== reviews.length;

  const canExport = Boolean(contributorUsername) && visible.length > 0 && !loading;

  const description = (() => {
    if (loading) return 'Loading review history…';
    if (counts.total === 0) return 'No reviews found in this workspace';
    const parts = [
      isFiltered
        ? `Showing ${visible.length} of ${counts.total} reviews`
        : `${counts.total} reviews`,
    ];
    if (counts.othersPullRequests) parts.push(`${counts.othersPullRequests} on others' PRs`);
    if (counts.ownPullRequests) parts.push(`${counts.ownPullRequests} on own PRs`);
    if (counts.approved) parts.push(`${counts.approved} approved`);
    if (counts.changesRequested) parts.push(`${counts.changesRequested} changes requested`);
    if (counts.inlineComments) parts.push(`${counts.inlineComments} inline comments`);
    return parts.join(' · ');
  })();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Reviews</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canExport}
              title={isFiltered ? 'Exports the filtered reviews' : undefined}
              onClick={() =>
                contributorUsername && exportContributorReviewsToCSV(contributorUsername, visible)
              }
            >
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canExport}
              title={isFiltered ? 'Exports the filtered reviews' : undefined}
              onClick={() =>
                contributorUsername && exportContributorReviewsToJSONL(contributorUsername, visible)
              }
            >
              <FileText className="h-4 w-4 mr-1.5" />
              JSONL
            </Button>
          </div>
        </div>
        {reviews.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Select
              value={filters.state}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, state: value as ContributorReviewFilters['state'] }))
              }
            >
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Filter by review state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.ownership}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  ownership: value as ContributorReviewFilters['ownership'],
                }))
              }
            >
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by PR author">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PRs</SelectItem>
                <SelectItem value="others">Others' PRs</SelectItem>
                <SelectItem value="own">Own PRs</SelectItem>
              </SelectContent>
            </Select>
            {repositories.length > 1 && (
              <Select
                value={filters.repository}
                onValueChange={(value) => setFilters((f) => ({ ...f, repository: value }))}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Filter by repository">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All repositories</SelectItem>
                  {repositories.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="reviews-feedback-only"
                checked={filters.feedbackOnly}
                onCheckedChange={(checked) => setFilters((f) => ({ ...f, feedbackOnly: checked }))}
              />
              <Label htmlFor="reviews-feedback-only" className="text-xs cursor-pointer">
                With feedback only
              </Label>
            </div>
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilters(DEFAULT_REVIEW_FILTERS)}
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 py-4">
          {(() => {
            if (error) {
              return (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                  <p className="mt-2 text-sm text-destructive">Failed to load reviews</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
              );
            }
            if (loading) {
              return (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading reviews…</span>
                </div>
              );
            }
            if (reviews.length === 0) {
              return (
                <div className="text-center py-8">
                  <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No reviews captured for this contributor yet
                  </p>
                </div>
              );
            }
            if (visible.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No reviews match these filters</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {visible.map((review) => (
                  <ReviewRow key={review.id} review={review} />
                ))}
              </div>
            );
          })()}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
