import { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Icon, RefreshCw } from '@/components/ui/icon';
import { NotificationsList } from './notifications-list';
import { WorkInboxList } from './work-inbox-list';
import { useNotifications } from '@/hooks/use-notifications';
import { useWorkInbox } from '@/hooks/use-work-inbox';
import { cn } from '@/lib/utils';

interface NotificationDropdownProps {
  className?: string;
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('work');
  const activityTab = useRef<HTMLButtonElement>(null);
  const activity = useNotifications({ limit: 20 });
  const work = useWorkInbox();
  // Work is already zero without a workspace, so the bell reflects both sections.
  const unread = work.unreadCount + activity.unreadCount;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        // Land on the section that has something unread, preferring work.
        if (nextOpen)
          setSection(work.unreadCount === 0 && activity.unreadCount > 0 ? 'activity' : 'work');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('relative', className)}
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
          title="Open inbox"
        >
          <Icon name="bell" size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-[min(440px,calc(100vw-24px))] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0"
      >
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Inbox</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Replies and reviews across your workspaces.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            aria-label="Refresh inbox"
            disabled={work.refreshing || !work.signedIn}
            onClick={work.refresh}
          >
            <RefreshCw className={cn('h-4 w-4', work.refreshing && 'animate-spin')} />
          </Button>
        </div>
        <Tabs value={section} onValueChange={setSection}>
          <TabsList aria-label="Inbox sections" className="mx-4 grid h-auto grid-cols-2">
            <TabsTrigger value="work" className="min-h-9 gap-2 px-2 text-xs">
              Needs attention{' '}
              <span className="tabular-nums text-muted-foreground">{work.unreadCount}</span>
            </TabsTrigger>
            <TabsTrigger ref={activityTab} value="activity" className="min-h-9 gap-2 px-2 text-xs">
              Activity{' '}
              <span className="tabular-nums text-muted-foreground">{activity.unreadCount}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="work" className="mb-0 mt-3">
            {work.errors.length > 0 && (
              <div role="alert" className="space-y-1 border-t px-4 py-3 text-xs text-destructive">
                {[...new Set(work.errors)].map((error) => (
                  <p key={error}>{error}</p>
                ))}
                {work.items.length > 0 && <p>Showing saved work. It may be outdated.</p>}
              </div>
            )}
            {work.incomplete && (
              <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
                Some conversation history is incomplete. Missing results will not clear existing
                work.
              </p>
            )}
            <div className="max-h-[min(440px,55vh)] overflow-y-auto border-t">
              {work.unavailable && !work.items.length && work.errors.length === 0 ? (
                <div className="flex flex-col items-center bg-gradient-to-b from-muted/30 to-transparent px-6 py-8 text-center">
                  <div
                    aria-hidden="true"
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border bg-background text-muted-foreground shadow-sm"
                  >
                    <Icon name="mail" size={22} />
                  </div>
                  <div role="status" className="max-w-72 space-y-2">
                    <h3 className="text-sm font-medium">Workspace inbox coming soon</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Replies and review requests will appear here. Tracking updates are still
                      available in Activity.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 min-h-10"
                    onClick={() => {
                      setSection('activity');
                      activityTab.current?.focus();
                    }}
                  >
                    View activity
                  </Button>
                </div>
              ) : (
                (work.errors.length === 0 || work.items.length > 0) && (
                  <WorkInboxList
                    key={work.signedIn ? 'signed-in' : 'signed-out'}
                    items={work.items}
                    loading={work.loading}
                    eligible={work.eligible}
                    onRead={work.markAsRead}
                  />
                )
              )}
            </div>
          </TabsContent>
          <TabsContent value="activity" className="mb-0 mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
              <p className="text-xs text-muted-foreground">Tracking, syncs, and invitations</p>
              <div className="flex gap-1">
                {activity.unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      void activity.markAllAsRead();
                    }}
                  >
                    Mark all read
                  </Button>
                )}
                {activity.notifications.some((item) => item.read) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      void activity.deleteAllRead();
                    }}
                  >
                    Clear read
                  </Button>
                )}
              </div>
            </div>
            {activity.error && (
              <p role="alert" className="px-4 py-2 text-xs text-destructive">
                {activity.error}
              </p>
            )}
            <div className="max-h-[min(440px,55vh)] overflow-y-auto">
              <NotificationsList
                notifications={activity.notifications}
                loading={activity.loading}
                onMarkAsRead={activity.markAsRead}
                onDelete={activity.deleteNotification}
              />
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
