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

    const [{ data: allOpenIssues }, { data: closedIssues }, { data: bugIssues }] =
      await Promise.all([
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

    // Separate active from stale based on comment count
    // Stale = issues with 0 non-bot comments (using comments_count which should exclude bot comments)
    let activeCount = 0;
    let staleCount = 0;

    if (allOpenIssues && allOpenIssues.length > 0) {
      allOpenIssues.forEach((issue) => {
        if (issue.comments_count === 0) {
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
          halfLife = Math.round((mid1 + mid2) / 2);
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
 * Note: Currently uses PR comment data since issue comments don't have direct issue_id relationship
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

    // Get issue and PR comment data (treating PR comments as triage activity)
    const [{ data: issues }, { data: comments }] = await Promise.all([
      supabase
        .from('issues')
        .select(
          `
          id,
          author_id,
          created_at,
          contributors!issues_author_id_fkey (
            username,
            avatar_url
          )
        `
        )
        .eq('repository_id', repoData.id)
        .gte('created_at', since.toISOString()),

      // Get issue comments for this repository (treating as triage activity)
      supabase
        .from('comments')
        .select(
          `
          id,
          commenter_id,
          created_at,
          comment_type,
          contributors!fk_comments_commenter (
            username,
            avatar_url
          )
        `
        )
        .eq('repository_id', repoData.id)
        .eq('comment_type', 'issue_comment')
        .gte('created_at', since.toISOString()),
    ]);

    // Use comments directly (already filtered for this repository and issue comments)
    const repoComments = comments || [];

    // Calculate most active triager (most comments across PRs/issues)
    const triagerStats = new Map<string, { username: string; avatar_url: string; count: number }>();

    repoComments.forEach((comment) => {
      const contributor = comment.contributors?.[0];
      if (contributor) {
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

    const mostActiveTriager =
      Array.from(triagerStats.values()).sort((a, b) => b.count - a.count)[0] || null;

    // For issue comments, we'll use a simplified approach for first responders
    // This would need more sophisticated logic to match comments to specific issues
    const firstResponderStats = new Map<
      string,
      { username: string; avatar_url: string; count: number }
    >();

    // For now, treat frequent commenters as potential first responders
    // This is a simplified approach - proper implementation would need issue comment threading
    repoComments.forEach((comment) => {
      const contributor = comment.contributors?.[0];
      if (contributor?.username) {
        const username = contributor.username;
        const existing = firstResponderStats.get(username);
        if (existing) {
          existing.count += 1;
        } else {
          firstResponderStats.set(username, {
            username: contributor.username,
            avatar_url: contributor.avatar_url || '',
            count: 1,
          });
        }
      }
    });

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
      const contributor = issue.contributors?.[0];
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

    // Issue Volume Trend - Calculate new issues per week
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);

    const previousWeekStart = new Date();
    previousWeekStart.setDate(previousWeekStart.getDate() - 14);

    // Get issue counts for current and previous weeks
    const [currentWeekIssues, previousWeekIssues] = await Promise.all([
      supabase
        .from('issues')
        .select('id')
        .eq('repository_id', repoData.id)
        .gte('created_at', currentWeekStart.toISOString()),

      supabase
        .from('issues')
        .select('id')
        .eq('repository_id', repoData.id)
        .gte('created_at', previousWeekStart.toISOString())
        .lt('created_at', currentWeekStart.toISOString()),
    ]);

    const currentWeekCount = currentWeekIssues?.data?.length || 0;
    const previousWeekCount = previousWeekIssues?.data?.length || 0;

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
    });

    return trends;
  });
}
