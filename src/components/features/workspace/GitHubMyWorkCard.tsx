import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, GitPullRequest, AlertCircle, MessageSquare } from '@/components/ui/icon';
import { OrganizationAvatar } from '@/components/ui/organization-avatar';
import { useGitHubWorkspaceWork } from '@/hooks/use-github-workspace-work';
import {
  workCategoryLabels,
  type GitHubWorkCategory,
  type GitHubWorkItem,
} from '@/lib/workspace/github-my-work';

type WorkFilter = GitHubWorkCategory | 'all' | 'priority';

function matchesFilter(item: GitHubWorkItem, filter: WorkFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'priority')
    return (
      item.categories.includes('awaiting_reply') || item.categories.includes('review_requested')
    );
  return item.categories.includes(filter);
}

export function GitHubMyWorkCard({
  workspaceId,
  repositories,
  repositoryAvatars = {},
}: {
  workspaceId: string;
  repositories: string[];
  repositoryAvatars?: Record<string, string | undefined>;
}) {
  const work = useGitHubWorkspaceWork(workspaceId, repositories);
  const [category, setCategory] = useState<WorkFilter>('priority');
  const [page, setPage] = useState(1);
  let emptyMessage = 'No matching open work in these repositories.';
  if (category === 'priority') {
    emptyMessage = 'No pending replies or review requests. Your other work is in All work.';
  }
  if (repositories.length === 0) emptyMessage = 'Add a repository to see your work.';
  const filtered = work.items.filter((item) => matchesFilter(item, category));
  if (category === 'priority') {
    filtered.sort(
      (a, b) =>
        Number(b.categories.includes('awaiting_reply')) -
          Number(a.categories.includes('awaiting_reply')) ||
        Date.parse(b.replies?.[0]?.createdAt || b.updatedAt) -
          Date.parse(a.replies?.[0]?.createdAt || a.updatedAt)
    );
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const filters = [
    { value: 'priority' as const, label: 'Priority' },
    { value: 'all' as const, label: 'All work' },
    ...Object.entries(workCategoryLabels).map(([value, label]) => ({
      value: value as GitHubWorkCategory,
      label,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>My Work</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={work.refreshing || !work.signedIn || repositories.length === 0}
            onClick={work.refresh}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${work.refreshing ? 'animate-spin' : ''}`} />
            {work.refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
        <CardDescription>
          Your PRs, team review requests, assigned issues, and conversations awaiting your reply.
          <span className="block mt-1">
            Live from GitHub, scoped to the repositories below. Discussions remain in their
            workspace tab.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!work.signedIn && !work.loading && (
          <p className="text-sm text-muted-foreground">Sign in to view your workspace work.</p>
        )}
        {work.errors.length > 0 && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            {work.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
            {work.hasCachedResults && (
              <p>Showing earlier GitHub results for the failed refresh. They may be outdated.</p>
            )}
          </div>
        )}
        {work.incomplete && (
          <p role="status" className="text-sm text-muted-foreground">
            Some results or conversation history are incomplete. Reply checks cover up to 100 open
            items, 50 review threads per PR, and the latest 50 comments per conversation. Narrow the
            repository filter to see more work.
          </p>
        )}
        <div role="group" aria-label="Filter your work" className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={category === filter.value ? 'secondary' : 'ghost'}
              aria-pressed={category === filter.value}
              onClick={() => {
                setCategory(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
              <span className="ml-2 text-muted-foreground">
                {work.items.filter((item) => matchesFilter(item, filter.value)).length}
              </span>
            </Button>
          ))}
        </div>
        {category === 'priority' && (
          <p className="text-xs text-muted-foreground">
            Suggested replies first, then review requests. Newest conversations first within each
            group.
          </p>
        )}
        {category === 'awaiting_reply' && (
          <p className="text-xs text-muted-foreground">
            Suggested follow-ups: another person spoke last on work you own or are assigned to, in a
            conversation you joined, or directly mentioned you. Bots and resolved review threads are
            excluded; not every comment needs an answer.
          </p>
        )}
        {work.loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading current work from GitHub...
          </p>
        )}
        {!work.loading && work.signedIn && visible.length === 0 && work.errors.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id} className="rounded-lg border bg-muted/10 p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <OrganizationAvatar
                  src={
                    repositoryAvatars[item.repository] ||
                    `https://avatars.githubusercontent.com/${item.repository.split('/')[0]}`
                  }
                  alt={`${item.repository.split('/')[0]} logo`}
                  size={32}
                  lazy={false}
                  className="border bg-background"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.type === 'pr' ? (
                      <GitPullRequest
                        aria-label="Pull request"
                        className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                      />
                    ) : (
                      <AlertCircle
                        aria-label="Issue"
                        className="h-3.5 w-3.5 shrink-0 text-orange-500"
                      />
                    )}
                    <span className="break-all">
                      {item.repository} #{item.number}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-words text-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {item.title}
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.categories.map((reason) => (
                      <Badge key={reason} variant="secondary">
                        {workCategoryLabels[reason]}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      By {item.author} - Updated{' '}
                      {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
              {!!item.replies?.length && (
                <div className="mt-3 space-y-2 border-t pt-3 sm:ml-11">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {item.replies.length}{' '}
                    {item.replies.length === 1 ? 'conversation' : 'conversations'} to follow up
                  </p>
                  {item.replies.map((reply) => (
                    <a
                      key={reply.url}
                      href={reply.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md border-l-2 border-primary/50 bg-muted/40 px-3 py-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-medium">{reply.author}</span>
                        <span className="text-muted-foreground">
                          {reply.kind === 'review' ? 'Review comment' : 'Comment'} -{' '}
                          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                        </span>
                        <span className="ml-auto font-medium text-primary">View &amp; reply</span>
                      </div>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                        {reply.body || 'View comment on GitHub'}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
