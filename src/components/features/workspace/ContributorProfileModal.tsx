import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useContributorSummary } from '@/hooks/use-contributor-summary';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import type { PullRequest, RecentIssue, RecentActivity } from '@/lib/types';
import type { ContributorActivity } from '@/hooks/useContributorActivity';
import {
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
  Calendar,
  Globe,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Plus,
  Loader2,
  Settings,
  Check,
  X,
  RefreshCw,
} from '@/components/ui/icon';
import { GroupManagementCTA } from '@/components/ui/permission-upgrade-cta';
import { useWorkspacePermissions } from '@/hooks/useWorkspacePermissions';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { humanizeNumber } from '@/lib/utils';
import { useContributorActivity } from '@/hooks/useContributorActivity';
import {
  sanitizeLinkedInUrl,
  sanitizeDiscordUrl,
  canSafelyOpenUrl,
  getSafeHref,
  isValidLinkedInUrl,
  isValidDiscordUrl,
} from '@/lib/validation/url-validation';
import { fetchAndCacheUserProfile } from '@/services/github-profile';
import type { Contributor } from './ContributorsList';
import type { ContributorGroup } from './ContributorsTable';
import type { ContributorNote } from './ContributorNotesDialog';
import type { WorkspaceRole, WorkspaceTier } from '@/types/workspace';

export interface Activity {
  id: string;
  type: 'pr' | 'issue' | 'review' | 'comment' | 'commit' | 'discussion';
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
  // Permission context
  userRole?: WorkspaceRole;
  workspaceTier?: WorkspaceTier;
  isLoggedIn?: boolean;
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
    case 'discussion':
      return <MessageSquare className="h-4 w-4" />;
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
    case 'discussion':
      return 'text-indigo-600';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Map ContributorActivity to PullRequest format for AI summaries
 */
function mapActivityToPullRequest(activity: ContributorActivity): PullRequest | null {
  if (activity.type !== 'pr' || !activity.pr_number || !activity.repository_full_name) {
    return null;
  }

  const [owner = '', name = ''] = activity.repository_full_name.split('/');

  return {
    id: parseInt(activity.id) || 0,
    number: activity.pr_number,
    title: activity.title,
    state: activity.state === 'merged' ? 'closed' : (activity.state as 'open' | 'closed'),
    created_at: activity.created_at,
    updated_at: activity.created_at,
    merged_at: activity.state === 'merged' ? activity.created_at : null,
    closed_at: activity.state === 'closed' ? activity.created_at : null,
    additions: 0, // Not available in activity data
    deletions: 0, // Not available in activity data
    repository_owner: owner,
    repository_name: name,
    user: {
      id: 0,
      login: '',
      avatar_url: '',
    },
  };
}

/**
 * Map ContributorActivity to RecentIssue format for AI summaries
 */
function mapActivityToIssue(activity: ContributorActivity): RecentIssue | null {
  if (activity.type !== 'issue' || !activity.issue_number || !activity.repository_full_name) {
    return null;
  }

  const [owner = '', name = ''] = activity.repository_full_name.split('/');

  return {
    id: activity.id,
    number: activity.issue_number,
    title: activity.title,
    state: activity.state as 'open' | 'closed',
    created_at: activity.created_at,
    updated_at: activity.created_at,
    closed_at: activity.state === 'closed' ? activity.created_at : undefined,
    repository_owner: owner,
    repository_name: name,
    comments_count: 0, // Not available in activity data
    html_url: activity.url,
  };
}

/**
 * Map ContributorActivity to RecentActivity format for AI summaries
 */
function mapToRecentActivity(activity: ContributorActivity): RecentActivity {
  return {
    id: activity.id,
    type: activity.type,
    title: activity.title,
    created_at: activity.created_at,
    status: activity.state,
    repository: activity.repository,
    url: activity.url,
  };
}

/**
 * Map ContributorActivity to DiscussionParticipation format for AI summaries
 */
function mapActivityToDiscussion(
  activity: ContributorActivity
): import('@/lib/llm/contributor-summary-types').DiscussionParticipation | null {
  if (activity.type !== 'discussion') {
    return null;
  }

  return {
    title: activity.title,
    category: activity.discussion_category,
    commentCount: activity.discussion_comment_count || 0,
    isAuthor: activity.is_discussion_author || false,
    isAnswered: activity.is_answered,
    created_at: activity.created_at,
  };
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
  userRole,
  workspaceTier,
  isLoggedIn = false,
}: ContributorProfileModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const [profileData, setProfileData] = useState<{
    company: string | null;
    location: string | null;
    bio: string | null;
    websiteUrl: string | null;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Permission checks
  const permissions = useWorkspacePermissions({
    userRole,
    workspaceTier,
    isLoggedIn,
  });

  // Fetch contributor activity
  const {
    activities,
    loading: activityLoading,
    error: activityError,
    hasMore,
    loadMore,
  } = useContributorActivity({
    contributorUsername: contributor?.username,
    workspaceId,
    pageSize: 20,
  });

  // Map activities to PR/issue structures for AI summary (memoized to prevent infinite loops)
  const contributorSummaryData = useMemo(() => {
    const username = contributor?.username;
    const avatarUrl = contributor?.avatar_url;
    const prCount = contributor?.contributions?.pull_requests;

    // Always return username, even if no activities (hook will use fallback)
    if (!username) {
      return { login: '', avatar_url: '', pullRequests: 0, percentage: 0 };
    }

    // If no activities, return basic data with username (hook generates fallback)
    if (!activities || activities.length === 0) {
      return {
        login: username,
        avatar_url: avatarUrl || '',
        pullRequests: prCount || 0,
        percentage: 0,
        recentPRs: [],
        recentIssues: [],
        recentActivities: [],
      };
    }

    // Use single iteration with early termination for performance
    const result = activities.reduce(
      (acc, activity, index) => {
        // Early termination - we only need max 10 of each type
        if (
          acc.recentPRs.length >= 10 &&
          acc.recentIssues.length >= 10 &&
          acc.recentDiscussions.length >= 10 &&
          index >= 10
        ) {
          return acc;
        }

        // Always add to recent activities (up to 10)
        if (index < 10) {
          acc.recentActivities.push(mapToRecentActivity(activity));
        }

        // Try to map to PR if we need more PRs
        if (acc.recentPRs.length < 10) {
          const pr = mapActivityToPullRequest(activity);
          if (pr) {
            acc.recentPRs.push(pr);
          }
        }

        // Try to map to issue if we need more issues
        if (acc.recentIssues.length < 10) {
          const issue = mapActivityToIssue(activity);
          if (issue) {
            acc.recentIssues.push(issue);
          }
        }

        // Try to map to discussion if we need more discussions
        if (acc.recentDiscussions.length < 10) {
          const discussion = mapActivityToDiscussion(activity);
          if (discussion) {
            acc.recentDiscussions.push(discussion);
          }
        }

        return acc;
      },
      {
        recentPRs: [] as PullRequest[],
        recentIssues: [] as RecentIssue[],
        recentActivities: [] as RecentActivity[],
        recentDiscussions:
          [] as import('@/lib/llm/contributor-summary-types').DiscussionParticipation[],
      }
    );

    return {
      login: username,
      avatar_url: avatarUrl || '',
      pullRequests: prCount || 0,
      percentage: 0,
      recentPRs: result.recentPRs,
      recentIssues: result.recentIssues,
      recentActivities: result.recentActivities,
      recentDiscussions: result.recentDiscussions,
    };
  }, [
    contributor?.username,
    contributor?.avatar_url,
    contributor?.contributions?.pull_requests,
    activities,
  ]);

  // Generate AI summary with properly structured data
  const {
    summary,
    loading: summaryLoading,
    requiresAuth,
  } = useContributorSummary(contributorSummaryData);
  const { login: handleAuthLogin } = useGitHubAuth();

  // Fetch profile data when modal opens
  const fetchProfileData = useCallback(async () => {
    if (!contributor?.username || !open) return;
    
    // Check if we already have profile data from the database
    if (contributor.company || contributor.location || contributor.bio) {
      setProfileData({
        company: contributor.company || null,
        location: contributor.location || null,
        bio: contributor.bio || null,
        websiteUrl: null, // Not stored in contributor object yet
      });
      return;
    }

    setLoadingProfile(true);
    try {
      const profile = await fetchAndCacheUserProfile(contributor.username);
      if (profile) {
        setProfileData({
          company: profile.company,
          location: profile.location,
          bio: profile.bio,
          websiteUrl: profile.websiteUrl,
        });
        // Update the contributor object for immediate display
        contributor.company = profile.company ?? undefined;
        contributor.location = profile.location ?? undefined;
        contributor.bio = profile.bio ?? undefined;
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [contributor, open]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

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
      <DialogContent className="max-w-[100vw] max-h-[100vh] md:max-w-3xl md:max-h-[80vh] md:rounded-lg rounded-none flex flex-col p-0">
        <div className="flex-shrink-0 p-6 pb-0">
          <DialogHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={contributor.avatar_url}
                  alt={contributor.username}
                  className="h-16 w-16 rounded-full flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl truncate">
                    {contributor.name || contributor.username}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground truncate">@{contributor.username}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {assignedGroups.map((group) => (
                      <Badge key={group.id} variant="secondary" className="text-xs">
                        {group.name}
                      </Badge>
                    ))}
                    {permissions.canAssignContributorsToGroups ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onManageGroups}
                        className="h-6 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add to Group
                      </Button>
                    ) : (
                      <GroupManagementCTA
                        message={permissions.getGroupAssignmentMessage()}
                        variant="inline"
                        size="sm"
                        showAction={false}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`https://github.com/${contributor.username}`, '_blank')
                  }
                  className="flex-1 min-w-[120px] sm:flex-none"
                >
                  GitHub Profile
                </Button>
                {contributor.linkedin_url && canSafelyOpenUrl(contributor.linkedin_url) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const sanitized = sanitizeLinkedInUrl(contributor.linkedin_url);
                      if (sanitized) {
                        window.open(sanitized, '_blank');
                      }
                    }}
                    className="flex-1 min-w-[120px] sm:flex-none"
                  >
                    LinkedIn
                  </Button>
                )}
                {contributor.discord_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (contributor.discord_url!.startsWith('discord:')) {
                        // Discord username, copy to clipboard
                        navigator.clipboard.writeText(
                          contributor.discord_url!.replace('discord:', '')
                        );
                        // You might want to add a toast notification here
                      } else {
                        const sanitized = sanitizeDiscordUrl(contributor.discord_url);
                        if (sanitized && canSafelyOpenUrl(sanitized)) {
                          window.open(sanitized, '_blank');
                        }
                      }
                    }}
                    className="flex-1 min-w-[120px] sm:flex-none"
                  >
                    Discord
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
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
                  {loadingProfile ? (
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    </div>
                  ) : (
                    <>
                      {(profileData?.bio || contributor.bio) && (
                        <p className="text-sm">{profileData?.bio || contributor.bio}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {(profileData?.company || contributor.company) && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {profileData?.company || contributor.company}
                          </div>
                        )}
                        {(profileData?.location || contributor.location) && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            {profileData?.location || contributor.location}
                          </div>
                        )}
                        {profileData?.websiteUrl && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            <a
                              href={profileData.websiteUrl.startsWith('http') ? profileData.websiteUrl : `https://${profileData.websiteUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {profileData.websiteUrl.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Last active {getRelativeTime(contributor.stats.last_active)}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contribution Summary</CardTitle>
                  <CardDescription>
                    Total contributions: {humanizeNumber(contributor.stats.total_contributions)}
                  </CardDescription>

                  {/* AI-Generated Activity Summary */}
                  {(summary || summaryLoading || requiresAuth) && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      {summaryLoading && (
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-muted animate-pulse rounded" />
                          <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
                        </div>
                      )}
                      {summary && !summaryLoading && !requiresAuth && (
                        <p className="text-sm text-muted-foreground italic leading-relaxed">
                          {summary}
                        </p>
                      )}
                      {requiresAuth && !summaryLoading && (
                        <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">AI-powered insights available</p>
                            <p className="text-xs text-muted-foreground">
                              Login to see contributor summaries
                            </p>
                          </div>
                          <Button onClick={handleAuthLogin} size="sm" variant="default">
                            Login
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
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

              {/* Social Links Section */}
              <SocialLinksCard contributor={contributor} isLoggedIn={isLoggedIn} />
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
                      const scrollPercentage =
                        (target.scrollTop + target.clientHeight) / target.scrollHeight;

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
                                  className={cn(
                                    'mt-1',
                                    getActivityColor(activity.type, activity.state)
                                  )}
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
                                    <span className="truncate max-w-[150px]">
                                      {activity.repository}
                                    </span>
                                    <span className="flex-shrink-0">•</span>
                                    <span className="flex-shrink-0">
                                      {getRelativeTime(activity.created_at)}
                                    </span>
                                    {activity.state && (
                                      <>
                                        <span className="flex-shrink-0">•</span>
                                        <Badge
                                          variant="outline"
                                          className="text-xs capitalize h-5 px-1 flex-shrink-0"
                                        >
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
                                <span className="ml-2 text-sm text-muted-foreground">
                                  Loading more activity...
                                </span>
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
                    {permissions.canAssignContributorsToGroups && (
                      <Button size="sm" onClick={onAddNote}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Add Note
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {permissions.canViewNotes ? (
                    <ScrollArea className="h-[400px] px-6 py-4">
                      {notes.length > 0 ? (
                        <div className="space-y-3">
                          {notes.map((note) => (
                            <div
                              key={note.id}
                              className="p-3 border rounded-lg space-y-2 overflow-hidden"
                            >
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium truncate">
                                  {note.created_by.display_name || note.created_by.email}
                                </span>
                                <span className="flex-shrink-0">•</span>
                                <span className="flex-shrink-0">
                                  {getRelativeTime(note.created_at)}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap break-words">{note.note}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                          {permissions.canAssignContributorsToGroups && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onAddNote}
                              className="mt-4"
                            >
                              Add First Note
                            </Button>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  ) : (
                    <div className="px-6 py-8">
                      <GroupManagementCTA
                        message={permissions.getGroupAssignmentMessage()}
                        variant="card"
                        size="md"
                        showAction={true}
                        onAction={!isLoggedIn ? login : undefined}
                      />
                    </div>
                  )}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Social Links Card Component
function SocialLinksCard({
  contributor,
  isLoggedIn,
}: {
  contributor: Contributor;
  isLoggedIn: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [discordUrl, setDiscordUrl] = useState(contributor.discord_url || '');
  const [linkedinUrl, setLinkedinUrl] = useState(contributor.linkedin_url || '');

  useEffect(() => {
    setDiscordUrl(contributor.discord_url || '');
    setLinkedinUrl(contributor.linkedin_url || '');
  }, [contributor]);

  const handleFetchFromGitHub = async () => {
    // Check if user is logged in
    if (!isLoggedIn) {
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: '🔐 Login required',
        description:
          'Please sign in with GitHub to fetch social links. This uses your GitHub token to avoid rate limits.',
        variant: 'default',
      });
      return;
    }

    setIsFetching(true);
    try {
      const { fetchAndUpdateSocialLinks } = await import('@/services/social-enrichment');
      const socialLinks = await fetchAndUpdateSocialLinks(contributor.id, contributor.username);

      if (socialLinks.discord_url || socialLinks.linkedin_url) {
        // Update local state
        setDiscordUrl(socialLinks.discord_url || '');
        setLinkedinUrl(socialLinks.linkedin_url || '');

        // Update the contributor object to persist across modal interactions
        contributor.discord_url = socialLinks.discord_url;
        contributor.linkedin_url = socialLinks.linkedin_url;

        // Show success toast with specific details
        const { toast } = await import('@/hooks/use-toast');

        const foundLinks = [];
        if (socialLinks.linkedin_url) foundLinks.push('LinkedIn');
        if (socialLinks.discord_url) foundLinks.push('Discord');

        toast({
          title: '✅ Social links fetched and saved',
          description: `Found ${foundLinks.join(' and ')} link${foundLinks.length > 1 ? 's' : ''} from @${contributor.username}'s GitHub profile and saved to database`,
        });
      } else {
        // Show info message when no links found
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: 'ℹ️ No social links found',
          description: `No Discord or LinkedIn links were found in @${contributor.username}'s GitHub profile. They may not have added any social accounts to their GitHub profile yet.`,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Failed to fetch social links:', error);
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Failed to fetch social links',
        description: 'Please check the console for details',
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate and sanitize URLs before saving
      const validatedDiscordUrl = discordUrl ? sanitizeDiscordUrl(discordUrl) : null;
      const validatedLinkedInUrl = linkedinUrl ? sanitizeLinkedInUrl(linkedinUrl) : null;

      // Show error if URLs are invalid
      if (discordUrl && !validatedDiscordUrl) {
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: 'Invalid Discord URL',
          description: 'Please enter a valid Discord URL or username (discord:username)',
          variant: 'destructive',
        });
        return;
      }

      if (linkedinUrl && !validatedLinkedInUrl) {
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: 'Invalid LinkedIn URL',
          description: 'Please enter a valid LinkedIn profile URL',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('contributors')
        .update({
          discord_url: validatedDiscordUrl,
          linkedin_url: validatedLinkedInUrl,
        })
        .eq('id', contributor.id);

      if (error) throw error;

      // Update the contributor object with validated URLs
      contributor.discord_url = validatedDiscordUrl;
      contributor.linkedin_url = validatedLinkedInUrl;

      setIsEditing(false);

      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Social links updated',
        description: 'Your social links have been saved successfully',
      });
    } catch (error) {
      console.error('Failed to save social links:', error);
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Error updating social links',
        description: 'Failed to save social links. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setDiscordUrl(contributor.discord_url || '');
    setLinkedinUrl(contributor.linkedin_url || '');
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Social Links</CardTitle>
            {/* Display clickable links when available - use state values for real-time updates */}
            {(contributor.username || linkedinUrl || discordUrl) && (
              <div className="flex gap-2">
                {contributor.username && (
                  <a
                    href={`https://github.com/${contributor.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 flex items-center gap-1"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                  </a>
                )}
                {linkedinUrl && isValidLinkedInUrl(linkedinUrl) && (
                  <a
                    href={getSafeHref(linkedinUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                {discordUrl && isValidDiscordUrl(discordUrl) && (
                  <a
                    href={
                      discordUrl.startsWith('discord:')
                        ? `https://discord.com/users/${discordUrl.replace('discord:', '')}`
                        : getSafeHref(discordUrl)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                    </svg>
                    Discord
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-row gap-2">
            {!isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchFromGitHub}
                  disabled={isFetching}
                  title={
                    !isLoggedIn
                      ? 'Sign in to fetch social links'
                      : 'Fetch social links from GitHub profile'
                  }
                  className="h-8"
                >
                  {(() => {
                    if (isFetching) {
                      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
                    }
                    if (!isLoggedIn) {
                      return <>🔐</>;
                    }
                    return <RefreshCw className="h-3.5 w-3.5" />;
                  })()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8"
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel} className="h-8">
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleSave} className="h-8">
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="discord-url">Discord</Label>
              <Input
                id="discord-url"
                type="text"
                placeholder="Discord invite link or username#1234"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin-url">LinkedIn</Label>
              <Input
                id="linkedin-url"
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Discord:</span>
              <span className="font-mono">{contributor.discord_url || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">LinkedIn:</span>
              <span className="font-mono">
                {contributor.linkedin_url
                  ? contributor.linkedin_url.replace('https://linkedin.com/in/', '')
                  : 'Not set'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
