import { supabase } from '../supabase';
import { trackDatabaseOperation } from '../simple-logging';

export interface IssueHealthMetrics {
  staleVsActiveRatio: {
    stale: number;
    active: number;
    percentage: number;
  };
  issueHalfLife: number; // median days from created to closed
  legitimateBugPercentage: number;
}

export interface IssueActivityPatterns {
  mostActiveTriager: {
    username: string;
    avatar_url: string;
    triages: number;
  } | null;
  firstResponders: {
    username: string;
    avatar_url: string;
    responses: number;
  }[];
  repeatReporters: {
    username: string;
    avatar_url: string;
    issues: number;
  }[];
}

export interface IssueMetrics {
  healthMetrics: IssueHealthMetrics;
  activityPatterns: IssueActivityPatterns;
  status: 'success' | 'no_data' | 'error';
  message?: string;
}

export interface IssueTrendData {
  metric: string;
  current: number | string;
  previous: number | string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  insight?: string;
  dailyIssues?: { date: string; count: number }[];
}

/**
 * Calculate issue health metrics for a repository
 */
export async function calculateIssueHealthMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<IssueHealthMetrics> {
  return trackDatabaseOperation('calculateIssueHealthMetrics', async () => {
    const days = parseInt(timeRange) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (!repoData) {
      return {
        staleVsActiveRatio: { stale: 0, active: 0, percentage: 0 },
        issueHalfLife: 0,
        legitimateBugPercentage: 0,
      };
    }

    // Calculate stale vs active issues based on last updated time
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [, { data: closedIssues }, { data: bugIssues }] = await Promise.all([
      // All open issues with comments_count info
      supabase
        .from('issues')
        .select('id, comments_count')
        .eq('repository_id', repoData.id)
        .eq('state', 'open'),

      // Closed issues for half-life calculation
      supabase
        .from('issues')
        .select('created_at, closed_at')
        .eq('repository_id', repoData.id)
        .eq('state', 'closed')
        .not('closed_at', 'is', null)
        .gte('closed_at', since.toISOString()),

      // Bug-labeled issues
      supabase
        .from('issues')
        .select('id, labels')
        .eq('repository_id', repoData.id)
        .gte('created_at', since.toISOString()),
    ]);

    // Get all open issues with creation dates for age-based staleness
    const { data: allIssuesForStaleCheck } = await supabase
      .from('issues')
      .select('id, github_id, number, state, created_at')
      .eq('repository_id', repoData.id)
      .eq('state', 'open');

    // Check for issue comments using the comments table
    const { data: allIssueComments } = await supabase
      .from('comments')
      .select(
        `
        issue_id,
        commenter:commenter_id(
          username,
          avatar_url
        )
      `
      )
      .not('issue_id', 'is', null)
      .eq('repository_id', repoData.id);

    // Create a set of issue numbers that have any non-bot comments
    // Note: issue_github_id in comments table actually refers to issue number, not github_id
    const issuesWithAnyComments = new Set<number>();
    (allIssueComments || []).forEach((comment) => {
      if (
        comment.issue_github_id &&
        comment.author_username &&
        !comment.author_username.includes('[bot]') &&
        comment.author_association !== 'OWNER' &&
        comment.author_association !== 'MEMBER'
      ) {
        issuesWithAnyComments.add(comment.issue_github_id);
      }
    });

    // Separate active from stale based on age and comment status
    // Stale = issues open for >7 days with no replies
    let activeCount = 0;
    let staleCount = 0;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (allIssuesForStaleCheck && allIssuesForStaleCheck.length > 0) {
      allIssuesForStaleCheck.forEach((issue) => {
        const issueAge = new Date(issue.created_at).getTime();
        const hasComments = issuesWithAnyComments.has(issue.id);

        // If issue is older than 7 days and has no comments, it's stale
        if (issueAge < sevenDaysAgo.getTime() && !hasComments) {
          staleCount++;
        } else {
          activeCount++;
        }
      });
    }

    // Counts are already calculated above
    const total = activeCount + staleCount;
    const stalePercentage = total > 0 ? (staleCount / total) * 100 : 0;

    // Calculate issue half-life (median time to resolution)
    let halfLife = 0;
    if (closedIssues && closedIssues.length > 0) {
      const resolutionTimes = closedIssues
        .map((issue) => {
          if (!issue.created_at || !issue.closed_at) return null;
          const created = new Date(issue.created_at);
          const closed = new Date(issue.closed_at);
          return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
        })
        .filter((time) => time !== null && time >= 0) // Filter out invalid/negative times
        .sort((a, b) => a! - b!);

      if (resolutionTimes.length > 0) {
        if (resolutionTimes.length % 2 === 0) {
          // Even length: average the two middle elements
          const mid1 = resolutionTimes[resolutionTimes.length / 2 - 1];
          const mid2 = resolutionTimes[resolutionTimes.length / 2];
          halfLife = Math.round(((mid1 || 0) + (mid2 || 0)) / 2);
        } else {
          // Odd length: take the middle element
          const medianIndex = Math.floor(resolutionTimes.length / 2);
          halfLife = Math.round(resolutionTimes[medianIndex] || 0);
        }
      }
    }

    // Calculate legitimate bug percentage
    let bugPercentage = 0;
    if (bugIssues && bugIssues.length > 0) {
      const bugCount = bugIssues.filter((issue) => {
        const labels = issue.labels as string[] | null;
        return labels?.some(
          (label) =>
            typeof label === 'string' &&
            ['bug', 'defect', 'error', 'issue'].some((bugLabel) =>
              label.toLowerCase().includes(bugLabel)
            )
        );
      }).length;

      bugPercentage = (bugCount / bugIssues.length) * 100;
    }

    return {
      staleVsActiveRatio: {
        stale: staleCount,
        active: activeCount,
        percentage: Math.round(stalePercentage),
      },
      issueHalfLife: halfLife,
      legitimateBugPercentage: Math.round(bugPercentage),
    };
  });
}

/**
 * Calculate issue activity patterns for a repository
 * Now supports both PR and issue comments for comprehensive triager metrics
 */
export async function calculateIssueActivityPatterns(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<IssueActivityPatterns> {
  return trackDatabaseOperation('calculateIssueActivityPatterns', async () => {
    const days = parseInt(timeRange) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (!repoData) {
      return {
        mostActiveTriager: null,
        firstResponders: [],
        repeatReporters: [],
      };
    }

    // Get issues, issue comments, and PR comments for comprehensive analysis
    const [{ data: issues }, { data: issueComments }, { data: prComments }] = await Promise.all([
      supabase
        .from('issues')
        .select(
          `
          id,
          github_id,
          number,
          author_id,
          created_at,
          contributors!issues_author_id_fkey (
            id,
            username,
            avatar_url
          )
        `
        )
        .eq('repository_id', repoData.id)
        .gte('created_at', since.toISOString()),

      // Get actual issue comments using the comments table
      supabase
        .from('comments')
        .select(
          `
          id,
          issue_id,
          created_at,
          commenter:commenter_id(
            username,
            avatar_url
          )
        `
        )
        .not('issue_id', 'is', null)
        .eq('repository_id', repoData.id)
        .gte('created_at', since.toISOString()),

      // Also get PR comments for comprehensive triager rankings
      supabase
        .from('comments')
        .select(
          `
          id,
          pull_request_id,
          commenter_id,
          created_at,
          comment_type,
          contributors (
            id,
            username,
            avatar_url,
            is_bot
          )
        `
        )
        .eq('repository_id', repoData.id)
        .not('pull_request_id', 'is', null)
        .gte('created_at', since.toISOString()),
    ]);

    // Debug logging
    console.log(`[DEBUG] Issue comments found: ${issueComments?.length || 0}`);
    console.log(`[DEBUG] PR comments found: ${prComments?.length || 0}`);
    if (issueComments && issueComments.length > 0) {
      console.log(`[DEBUG] Sample issue comment:`, issueComments[0]);
    }

    // Calculate most active triager (most comments across both PRs and issues)
    const triagerStats = new Map<string, { username: string; avatar_url: string; count: number }>();

    // Process issue comments from comments table
    (issueComments || []).forEach((comment) => {
      // Filter out Bot authors
      if (comment.commenter?.username && !comment.commenter.username.includes('[bot]')) {
        const key = comment.commenter.username;
        const existing = triagerStats.get(key);
        if (existing) {
          existing.count++;
        } else {
          triagerStats.set(key, {
            username: comment.commenter.username,
            avatar_url: comment.commenter.avatar_url || '',
            count: 1,
          });
        }
      }
    });

    // Process PR comments from comments table
    (prComments || []).forEach((comment) => {
      const contributor = comment.contributors as unknown as {
        id: string;
        username: string;
        avatar_url: string;
        is_bot: boolean;
      };
      if (contributor && !contributor.is_bot) {
        // Exclude bots from triager stats
        const key = contributor.username;
        const existing = triagerStats.get(key);
        if (existing) {
          existing.count++;
        } else {
          triagerStats.set(key, {
            username: contributor.username,
            avatar_url: contributor.avatar_url || '',
            count: 1,
          });
        }
      }
    });

    console.log(`[DEBUG] Triager stats size: ${triagerStats.size}`);
    console.log(`[DEBUG] Triager stats:`, Array.from(triagerStats.entries()).slice(0, 3));

    const mostActiveTriager =
      Array.from(triagerStats.values()).sort((a, b) => b.count - a.count)[0] || null;

    console.log(`[DEBUG] Most active triager:`, mostActiveTriager);

    // Calculate first responders - users who are first to comment on issues (excluding issue authors)
    const firstResponderStats = new Map<
      string,
      { username: string; avatar_url: string; count: number }
    >();

    // Group issue comments by issue ID to find first responders
    const commentsByIssue = new Map<
      string,
      Array<{
        id: string;
        issue_id: string;
        created_at: string;
        commenter: {
          username: string;
          avatar_url: string;
        };
      }>
    >();

    (issueComments || []).forEach((comment) => {
      if (comment.issue_id) {
        if (!commentsByIssue.has(comment.issue_id)) {
          commentsByIssue.set(comment.issue_id, []);
        }
        commentsByIssue.get(comment.issue_id)!.push(comment);
      }
    });

    console.log(`[DEBUG] Comments grouped by ${commentsByIssue.size} issues`);

    // Find first responder for each issue
    commentsByIssue.forEach((comments, issueId) => {
      // Sort comments by creation time to find first response
      const sortedComments = comments.sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return aTime - bTime;
      });

      // Find the issue to get its author by matching issue ID
      const issue = issues?.find((i) => i.id === issueId);
      if (!issue) return;

      const issueAuthor = issue.contributors as unknown as { username: string };

      // Find first comment from someone other than the issue author (exclude bots too)
      const firstResponse = sortedComments.find((comment) => {
        return (
          comment.commenter?.username &&
          !comment.commenter.username.includes('[bot]') &&
          comment.commenter.username !== issueAuthor?.username
        );
      });

      if (firstResponse && firstResponse.commenter?.username) {
        const username = firstResponse.commenter.username;
        const existing = firstResponderStats.get(username);
        if (existing) {
          existing.count++;
        } else {
          firstResponderStats.set(username, {
            username: firstResponse.commenter.username,
            avatar_url: firstResponse.commenter.avatar_url || '',
            count: 1,
          });
        }
      }
    });

    console.log(`[DEBUG] First responder stats size: ${firstResponderStats.size}`);

    const firstResponders = Array.from(firstResponderStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((responder) => ({
        username: responder.username,
        avatar_url: responder.avatar_url,
        responses: responder.count,
      }));

    // Calculate repeat reporters (users who create the most issues)
    const reporterStats = new Map<
      string,
      { username: string; avatar_url: string; count: number }
    >();

    issues?.forEach((issue) => {
      const contributor = issue.contributors as unknown as {
        id: string;
        username: string;
        avatar_url: string;
      };
      if (contributor) {
        const key = contributor.username;
        const existing = reporterStats.get(key);
        if (existing) {
          existing.count++;
        } else {
          reporterStats.set(key, {
            username: contributor.username,
            avatar_url: contributor.avatar_url || '',
            count: 1,
          });
        }
      }
    });

    const repeatReporters = Array.from(reporterStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((reporter) => ({
        username: reporter.username,
        avatar_url: reporter.avatar_url,
        issues: reporter.count,
      }));

    return {
      mostActiveTriager: mostActiveTriager
        ? {
            username: mostActiveTriager.username,
            avatar_url: mostActiveTriager.avatar_url,
            triages: mostActiveTriager.count,
          }
        : null,
      firstResponders,
      repeatReporters,
    };
  });
}

/**
 * Calculate comprehensive issue metrics for a repository
 */
export async function calculateIssueMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<IssueMetrics> {
  try {
    const [healthMetrics, activityPatterns] = await Promise.all([
      calculateIssueHealthMetrics(owner, repo, timeRange),
      calculateIssueActivityPatterns(owner, repo, timeRange),
    ]);

    return {
      healthMetrics,
      activityPatterns,
      status: 'success',
    };
  } catch (error) {
    console.error('Failed to calculate issue metrics:', error);
    return {
      healthMetrics: {
        staleVsActiveRatio: { stale: 0, active: 0, percentage: 0 },
        issueHalfLife: 0,
        legitimateBugPercentage: 0,
      },
      activityPatterns: {
        mostActiveTriager: null,
        firstResponders: [],
        repeatReporters: [],
      },
      status: 'error',
      message: 'Failed to load issue metrics',
    };
  }
}

/**
 * Calculate how long it would take to close all open issues based on current resolution rate
 */
async function calculateTimeToCloseBacklog(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<number> {
  return trackDatabaseOperation('calculateTimeToCloseBacklog', async () => {
    const days = parseInt(timeRange) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (!repoData) {
      return 0;
    }

    const [{ data: closedIssues }, { data: openIssues }] = await Promise.all([
      // Get issues closed in the time period to calculate resolution rate
      supabase
        .from('issues')
        .select('id, closed_at')
        .eq('repository_id', repoData.id)
        .eq('state', 'closed')
        .not('closed_at', 'is', null)
        .gte('closed_at', since.toISOString()),

      // Get total open issues count
      supabase.from('issues').select('id').eq('repository_id', repoData.id).eq('state', 'open'),
    ]);

    const totalOpenIssues = openIssues?.length || 0;
    const issuesClosedInPeriod = closedIssues?.length || 0;

    // If no open issues, backlog is already clear
    if (totalOpenIssues === 0) {
      return 0;
    }

    // If no issues were closed in the period, backlog will never clear
    if (issuesClosedInPeriod === 0) {
      return Infinity;
    }

    // Calculate resolution rate (issues closed per day)
    const resolutionRate = issuesClosedInPeriod / days;

    // Calculate days to clear backlog at current resolution rate
    const daysToCloseBacklog = totalOpenIssues / resolutionRate;

    return daysToCloseBacklog;
  });
}

/**
 * Get daily issue counts for calendar visualization
 */
export async function getDailyIssueVolume(
  owner: string,
  repo: string,
  days: number = 14
): Promise<{ date: string; count: number }[]> {
  return trackDatabaseOperation('getDailyIssueVolume', async () => {
    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (!repoData) {
      return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get issues created in the last N days
    const { data: issues } = await supabase
      .from('issues')
      .select('created_at')
      .eq('repository_id', repoData.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (!issues) {
      return [];
    }

    // Group by date
    const dailyCounts = new Map<string, number>();

    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts.set(dateStr, 0);
    }

    // Count issues per day
    issues.forEach((issue) => {
      const dateStr = issue.created_at.split('T')[0];
      const currentCount = dailyCounts.get(dateStr) || 0;
      dailyCounts.set(dateStr, currentCount + 1);
    });

    // Convert to array format
    return Array.from(dailyCounts.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  });
}

/**
 * Calculate issue trend data for comparison across time periods
 */
export async function calculateIssueTrendMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<IssueTrendData[]> {
  return trackDatabaseOperation('calculateIssueTrendMetrics', async () => {
    const days = parseInt(timeRange) || 30;
    const currentPeriod = new Date();
    currentPeriod.setDate(currentPeriod.getDate() - days);

    const previousPeriod = new Date();
    previousPeriod.setDate(previousPeriod.getDate() - days * 2);

    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (!repoData) {
      return [];
    }

    // No additional metrics needed for trends calculation

    const trends: IssueTrendData[] = [];

    // Time to Clear Backlog - Calculate how long to close all open issues
    const [currentBacklogTime, previousBacklogTime] = await Promise.all([
      calculateTimeToCloseBacklog(owner, repo, timeRange),
      calculateTimeToCloseBacklog(owner, repo, (days * 2).toString()),
    ]);

    // Calculate change, handling infinity cases
    let backlogTimeChange = 0;
    if (isFinite(previousBacklogTime) && isFinite(currentBacklogTime) && previousBacklogTime > 0) {
      backlogTimeChange = Math.round(
        ((currentBacklogTime - previousBacklogTime) / previousBacklogTime) * 100
      );
    } else if (!isFinite(currentBacklogTime) && isFinite(previousBacklogTime)) {
      backlogTimeChange = 100; // Went from finite to infinite = 100% increase
    } else if (isFinite(currentBacklogTime) && !isFinite(previousBacklogTime)) {
      backlogTimeChange = -100; // Went from infinite to finite = 100% decrease
    }

    // Format the backlog time into a readable format
    const formatBacklogTime = (days: number) => {
      if (days === 0) return 0;
      if (!isFinite(days) || days > 36500) return '99+'; // More than 100 years = show as 99+
      if (days < 30) return Math.round(days);
      if (days < 365) return Math.round(days / 30);
      return Math.round(days / 365);
    };

    const getBacklogUnit = (days: number) => {
      if (days === 0) return 'days';
      if (!isFinite(days) || days > 36500) return 'years'; // Show years for 99+
      if (days < 30) return 'days';
      if (days < 365) return 'months';
      return 'years';
    };

    const currentFormatted = formatBacklogTime(currentBacklogTime);
    const previousFormatted = formatBacklogTime(previousBacklogTime);

    // Generate insight based on the current state
    let insight = 'At current resolution rate';
    if (!isFinite(currentBacklogTime)) {
      insight = 'No issues resolved recently';
    } else if (currentBacklogTime === 0) {
      insight = 'No open issues';
    } else if (backlogTimeChange < 0) {
      insight = 'Resolution rate improving';
    } else if (backlogTimeChange > 0) {
      insight = 'Resolution rate slowing';
    }

    trends.push({
      metric: 'Time to Resolution',
      current: currentFormatted,
      previous: previousFormatted,
      change: backlogTimeChange,
      trend: (() => {
        if (backlogTimeChange > 0) return 'up';
        if (backlogTimeChange < 0) return 'down';
        return 'stable';
      })() as 'up' | 'down' | 'stable',
      unit: getBacklogUnit(currentBacklogTime),
      insight,
    });

    // Issue Volume Trend - Calculate new issues per week with daily breakdown
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);

    const previousWeekStart = new Date();
    previousWeekStart.setDate(previousWeekStart.getDate() - 14);

    // Get daily issue counts for calendar visualization
    const dailyIssues = await getDailyIssueVolume(owner, repo, 14);

    // Calculate current and previous week totals from daily data
    const currentWeekCount = dailyIssues
      .filter((d) => new Date(d.date) >= currentWeekStart)
      .reduce((sum, d) => sum + d.count, 0);

    const previousWeekCount = dailyIssues
      .filter((d) => {
        const date = new Date(d.date);
        return date >= previousWeekStart && date < currentWeekStart;
      })
      .reduce((sum, d) => sum + d.count, 0);

    const calculateVolumeChange = () => {
      if (previousWeekCount > 0) {
        return Math.round(((currentWeekCount - previousWeekCount) / previousWeekCount) * 100);
      }
      return currentWeekCount > 0 ? 100 : 0;
    };
    const volumeChange = calculateVolumeChange();

    trends.push({
      metric: 'Issue Volume',
      current: currentWeekCount,
      previous: previousWeekCount,
      change: volumeChange,
      trend: (() => {
        if (volumeChange > 0) return 'up';
        if (volumeChange < 0) return 'down';
        return 'stable';
      })() as 'up' | 'down' | 'stable',
      unit: '/week',
      insight: (() => {
        if (volumeChange > 0) {
          return `${volumeChange}% more issues this week`;
        }
        if (volumeChange < 0) {
          return `${Math.abs(volumeChange)}% fewer issues this week`;
        }
        return 'Issue volume stable';
      })(),
      // Add daily data for calendar visualization
      dailyIssues: dailyIssues,
    });

    return trends;
  });
}
