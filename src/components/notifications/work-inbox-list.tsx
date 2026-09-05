import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { OrganizationAvatar } from '@/components/ui/organization-avatar';
import { Check, GitPullRequest, MessageSquare } from '@/components/ui/icon';
import type { WorkInboxItem } from '@/lib/notifications/work-inbox';
import { cn } from '@/lib/utils';

export function WorkInboxList({
  items,
  loading,
  eligible,
  onRead,
}: {
  items: WorkInboxItem[];
  loading: boolean;
  eligible: boolean;
  onRead: (item: WorkInboxItem) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const markRead = async (item: WorkInboxItem) => {
    setSaving(item.id);
    setError(null);
    try {
      await onRead(item);
    } catch {
      setError('Could not mark this item as read. Try again.');
    } finally {
      setSaving(null);
    }
  };
  if (loading)
    return (
      <p role="status" className="px-4 py-8 text-sm text-muted-foreground">
        Checking your workspace work...
      </p>
    );
  if (!eligible)
    return (
      <div className="px-5 py-8 space-y-2">
        <p className="text-sm font-medium">A work inbox for your workspaces</p>
        <p className="text-sm text-muted-foreground">
          Create or join a workspace to get personal replies and review requests here.
        </p>
      </div>
    );
  if (!items.length)
    return (
      <div className="px-5 py-8 space-y-2">
        <p className="text-sm font-medium">Nothing needs attention right now</p>
        <p className="text-sm text-muted-foreground">
          New replies and review requests from your workspace repositories will appear here.
        </p>
      </div>
    );
  return (
    <div>
      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="divide-y">
        {items.map((item) => {
          const repo = item.repository.full_name;
          const owner = repo.split('/')[0];
          // GitHub names are case-insensitive, so compare against the canonical URL casing.
          const url = item.url.toLowerCase();
          const base = `https://github.com/${repo.toLowerCase()}`;
          const safeUrl = url.startsWith(`${base}/pull/`) || url.startsWith(`${base}/issues/`);
          return (
            <li
              key={item.id}
              className={cn('flex min-w-0 gap-3 p-4', !item.is_read && 'bg-primary/5')}
            >
              <OrganizationAvatar
                src={`https://avatars.githubusercontent.com/${owner}`}
                alt={`${owner} logo`}
                size={32}
                lazy={false}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.category === 'awaiting_reply' ? (
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <GitPullRequest className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>
                    {item.category === 'awaiting_reply'
                      ? 'Awaiting your reply'
                      : 'Review requested'}
                  </span>
                  {!item.is_read && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                </div>
                {safeUrl ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      void markRead(item);
                    }}
                    className="block break-words text-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="break-words text-sm font-medium">{item.title}</p>
                )}
                <p className="break-all text-xs text-muted-foreground">{repo}</p>
                {item.preview && (
                  <p className="line-clamp-2 break-words border-l-2 border-primary/40 pl-2 text-sm text-muted-foreground">
                    <span className="font-medium">{item.actor}: </span>
                    {item.preview}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true })}
                  </span>
                  {!item.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={saving === item.id}
                      onClick={() => {
                        void markRead(item);
                      }}
                    >
                      <Check className="mr-1 h-3 w-3" /> Mark read
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length === 30 && (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Showing the first 30 items, unread first. Your workspace Priority tab has more work.
        </p>
      )}
    </div>
  );
}
