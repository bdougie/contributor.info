import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Download, FileText, Loader2, MessageSquare } from '@/components/ui/icon';
import { useContributorReviews } from '@/hooks/useContributorReviews';
import {
  exportContributorReviewsToCSV,
  exportContributorReviewsToJSONL,
} from '@/lib/utils/csv-export';
import type { ContributorReview, ReviewState } from '@/lib/contributors/contributor-reviews';
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ReviewRow({ review }: { review: ContributorReview }) {
  const title = `#${review.pull_request.number} ${review.pull_request.title}`;
  return (
    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {review.pull_request.html_url ? (
            <a
              href={review.pull_request.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline line-clamp-2 text-sm block"
            >
              {title}
            </a>
          ) : (
            <span className="font-medium line-clamp-2 text-sm block">{title}</span>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="truncate max-w-[200px]">{review.repository.full_name}</span>
            <span>•</span>
            <span>{formatDate(review.submitted_at)}</span>
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

  const canExport = Boolean(contributorUsername) && reviews.length > 0 && !loading;

  const description = (() => {
    if (loading) return 'Loading review history…';
    if (counts.total === 0) return 'No reviews found in this workspace';
    const parts = [`${counts.total} reviews`];
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
              onClick={() =>
                contributorUsername && exportContributorReviewsToCSV(contributorUsername, reviews)
              }
            >
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canExport}
              onClick={() =>
                contributorUsername && exportContributorReviewsToJSONL(contributorUsername, reviews)
              }
            >
              <FileText className="h-4 w-4 mr-1.5" />
              JSONL
            </Button>
          </div>
        </div>
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
            return (
              <div className="space-y-2">
                {reviews.map((review) => (
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
