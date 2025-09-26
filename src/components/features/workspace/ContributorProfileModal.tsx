import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
  Calendar,
  Globe,
  Users,
  Github,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Plus,
  Loader2,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { humanizeNumber } from '@/lib/utils';
import { useContributorActivity } from '@/hooks/useContributorActivity';
import type { Contributor } from './ContributorsList';
import type { ContributorGroup } from './ContributorsTable';
import type { ContributorNote } from './ContributorNotesDialog';

export interface Activity {
  id: string;
  type: 'pr' | 'issue' | 'review' | 'comment' | 'commit';
  title: string;
  repository: string;
  url: string;
  created_at: string;
  state?: 'open' | 'closed' | 'merged';
}

export interface ContributorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributor: Contributor | null;
  groups: ContributorGroup[];
  contributorGroups: string[]; // groupIds for this contributor
  notes: ContributorNote[];
  workspaceId?: string;
  onManageGroups?: () => void;
  onAddNote?: () => void;
  isFiltered?: boolean; // Whether this group is being used for filtering
}

function getRelativeTime(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'today';
  if (diffInDays === 1) return 'yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'pr':
      return <GitPullRequest className="h-4 w-4" />;
    case 'issue':
      return <AlertCircle className="h-4 w-4" />;
    case 'review':
      return <MessageSquare className="h-4 w-4" />;
    case 'comment':
      return <MessageSquare className="h-4 w-4" />;
    case 'commit':
      return <GitCommit className="h-4 w-4" />;
  }
}

function getActivityColor(type: Activity['type'], state?: Activity['state']) {
  if (state === 'merged') return 'text-purple-600';
  if (state === 'closed') return 'text-red-600';
  if (state === 'open') return 'text-green-600';

  switch (type) {
    case 'pr':
      return 'text-blue-600';
    case 'issue':
      return 'text-orange-600';
    default:
      return 'text-muted-foreground';
  }
}

export function ContributorProfileModal({
  open,
  onOpenChange,
  contributor,
  groups,
  contributorGroups,
  notes,
  workspaceId,
  onManageGroups,
  onAddNote,
}: ContributorProfileModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch contributor activity
  const {
    activities,
    loading: activityLoading,
    error: activityError,
    hasMore,
    loadMore
  } = useContributorActivity({
    contributorUsername: contributor?.username,
    workspaceId,
    pageSize: 20,
  });

  if (!contributor) return null;

  const trend = contributor.stats.contribution_trend;
  let TrendIcon = Minus;
  let trendColor = 'text-muted-foreground';

  if (trend > 0) {
    TrendIcon = TrendingUp;
    trendColor = 'text-green-600';
  } else if (trend < 0) {
    TrendIcon = TrendingDown;
    trendColor = 'text-red-600';
  }

  const assignedGroups = groups.filter((g) => contributorGroups.includes(g.id));

  // Calculate contribution breakdown percentages
  const totalContributions = contributor.stats.total_contributions;
  const prPercentage =
    totalContributions > 0
      ? (contributor.contributions.pull_requests / totalContributions) * 100
      : 0;
  const issuePercentage =
    totalContributions > 0 ? (contributor.contributions.issues / totalContributions) * 100 : 0;
  const reviewPercentage =
    totalContributions > 0 ? (contributor.contributions.reviews / totalContributions) * 100 : 0;
  const commentPercentage =
    totalContributions > 0 ? (contributor.contributions.comments / totalContributions) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <img
                src={contributor.avatar_url}
                alt={contributor.username}
                className="h-16 w-16 rounded-full"
              />
              <div>
                <DialogTitle className="text-xl">
                  {contributor.name || contributor.username}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">@{contributor.username}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {assignedGroups.map((group) => (
                    <Badge key={group.id} variant="secondary" className="text-xs">
                      {group.name}
                    </Badge>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onManageGroups}
                    className="h-6 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add to Group
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://github.com/${contributor.username}`, '_blank')}
              >
                <Github className="h-4 w-4 mr-1" />
                GitHub Profile
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Bio Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contributor.bio && <p className="text-sm">{contributor.bio}</p>}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {contributor.company && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {contributor.company}
                    </div>
                  )}
                  {contributor.location && (
                    <div className="flex items-center gap-1">
                      <Globe className="h-4 w-4" />
                      {contributor.location}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Last active {getRelativeTime(contributor.stats.last_active)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contribution Summary</CardTitle>
                <CardDescription>
                  Total contributions: {humanizeNumber(contributor.stats.total_contributions)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <GitPullRequest className="h-8 w-8 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-semibold">
                      {humanizeNumber(contributor.contributions.pull_requests)}
                    </div>
                    <div className="text-xs text-muted-foreground">Pull Requests</div>
                  </div>
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-semibold">
                      {humanizeNumber(contributor.contributions.issues)}
                    </div>
                    <div className="text-xs text-muted-foreground">Issues</div>
                  </div>
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-semibold">
                      {humanizeNumber(contributor.contributions.reviews)}
                    </div>
                    <div className="text-xs text-muted-foreground">Reviews</div>
                  </div>
                  <div className="text-center">
                    <GitCommit className="h-8 w-8 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-semibold">
                      {humanizeNumber(contributor.contributions.commits)}
                    </div>
                    <div className="text-xs text-muted-foreground">Commits</div>
                  </div>
                </div>

                {/* Trend */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t">
                  <TrendIcon className={cn('h-5 w-5', trendColor)} />
                  <span className={cn('font-medium', trendColor)}>
                    {trend > 0 ? '+' : ''}
                    {trend}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs. previous period</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest contributions across repositories</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea
                  className="h-[400px] px-6 py-4"
                  ref={scrollAreaRef}
                  onScrollCapture={(e) => {
                    const target = e.currentTarget;
                    const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

                    // Load more when user scrolls to 80% of content
                    if (scrollPercentage > 0.8 && hasMore && !activityLoading) {
                      loadMore();
                    }
                  }}
                >
                  {(() => {
                    if (activityError) {
                      return (
                        <div className="text-center py-8">
                          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                          <p className="mt-2 text-sm text-destructive">Failed to load activity</p>
                          <p className="text-xs text-muted-foreground mt-1">{activityError}</p>
                        </div>
                      );
                    }
                    if (activities.length > 0 || activityLoading) {
                      return (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div
                            className={cn('mt-1', getActivityColor(activity.type, activity.state))}
                          >
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <a
                              href={activity.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline line-clamp-2 text-sm block"
                            >
                              {activity.title}
                            </a>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span className="truncate max-w-[150px]">{activity.repository}</span>
                              <span className="flex-shrink-0">•</span>
                              <span className="flex-shrink-0">{getRelativeTime(activity.created_at)}</span>
                              {activity.state && (
                                <>
                                  <span className="flex-shrink-0">•</span>
                                  <Badge variant="outline" className="text-xs capitalize h-5 px-1 flex-shrink-0">
                                    {activity.state}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {activityLoading && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading more activity...</span>
                        </div>
                      )}

                      {!activityLoading && hasMore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadMore}
                          className="w-full"
                        >
                          Load More
                        </Button>
                      )}

                      {!hasMore && activities.length > 0 && (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No more activity to load
                        </div>
                      )}
                    </div>
                      );
                    }
                    return (
                      <div className="text-center py-8">
                        <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">No recent activity</p>
                      </div>
                    );
                  })()}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Notes</CardTitle>
                    <CardDescription>
                      Context and information about this contributor
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={onAddNote}>
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Add Note
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px] px-6 py-4">
                  {notes.length > 0 ? (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="p-3 border rounded-lg space-y-2 overflow-hidden">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium truncate">
                              {note.created_by.display_name || note.created_by.email}
                            </span>
                            <span className="flex-shrink-0">•</span>
                            <span className="flex-shrink-0">{getRelativeTime(note.created_at)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                      <Button variant="outline" size="sm" onClick={onAddNote} className="mt-4">
                        Add First Note
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detailed Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contribution Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Contribution Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-20">PRs</span>
                      <Progress value={prPercentage} className="flex-1" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {Math.round(prPercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-20">Issues</span>
                      <Progress value={issuePercentage} className="flex-1" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {Math.round(issuePercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-20">Reviews</span>
                      <Progress value={reviewPercentage} className="flex-1" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {Math.round(reviewPercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-20">Comments</span>
                      <Progress value={commentPercentage} className="flex-1" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {Math.round(commentPercentage)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Repository Stats */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Repository Engagement</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <div className="text-2xl font-semibold">
                        {contributor.stats.repositories_contributed}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Repositories Contributed To
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="text-2xl font-semibold">
                        {Math.round(
                          contributor.stats.total_contributions /
                            Math.max(1, contributor.stats.repositories_contributed)
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg. Contributions per Repo
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
