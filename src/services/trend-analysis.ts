/**
 * Contribution Trend Analysis Service
 * Analyzes contributor velocity and topic shifts over time
 */

import { supabase } from '@/lib/supabase';
import type {
  VelocityMetrics,
  TopicShift,
  TrendAnalysis,
} from '@/lib/llm/contributor-enrichment-types';

/**
 * Contribution count data for a time period
 */
interface ContributionCounts {
  pullRequests: number;
  issues: number;
  reviews: number;
  comments: number;
  discussions: number;
  total: number;
}

/**
 * Calculate contribution counts for a specific time window
 */
async function getContributionCounts(
  contributorId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<ContributionCounts> {
  // Get workspace repositories
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) {
    return {
      pullRequests: 0,
      issues: 0,
      reviews: 0,
      comments: 0,
      discussions: 0,
      total: 0,
    };
  }

  // Fetch counts in parallel
  const [prCount, issueCount, reviewCount, commentCount, discussionCount] = await Promise.all([
    // Pull requests
    supabase
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', contributorId)
      .in('repository_id', repoIds)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString()),

    // Issues
    supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', contributorId)
      .in('repository_id', repoIds)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString()),

    // Reviews
    supabase
      .from('reviews')
      .select('id, pull_requests!inner(repository_id)', { count: 'exact', head: true })
      .eq('reviewer_id', contributorId)
      .in('pull_requests.repository_id', repoIds)
      .gte('submitted_at', startDate.toISOString())
      .lt('submitted_at', endDate.toISOString()),

    // Comments (on issues)
    supabase
      .from('comments')
      .select('id, issues!inner(repository_id)', { count: 'exact', head: true })
      .eq('commenter_id', contributorId)
      .not('issue_id', 'is', null)
      .in('issues.repository_id', repoIds)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString()),

    // Discussions (authored + commented)
    Promise.all([
      supabase
        .from('discussions')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', contributorId)
        .in('repository_id', repoIds)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString()),
      supabase
        .from('discussion_comments')
        .select('id, discussions!inner(repository_id)', { count: 'exact', head: true })
        .eq('author_id', contributorId)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString()),
    ]),
  ]);

  const counts = {
    pullRequests: prCount.count || 0,
    issues: issueCount.count || 0,
    reviews: reviewCount.count || 0,
    comments: commentCount.count || 0,
    discussions: (discussionCount[0].count || 0) + (discussionCount[1].count || 0),
    total: 0,
  };

  counts.total =
    counts.pullRequests + counts.issues + counts.reviews + counts.comments + counts.discussions;

  return counts;
}

/**
 * Calculate velocity metrics for a contributor
 */
export async function calculateVelocityMetrics(
  contributorId: string,
  workspaceId: string
): Promise<VelocityMetrics> {
  const now = new Date();

  // Calculate date boundaries
  const current7dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previous7dStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const current30dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previous30dStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Fetch all time windows in parallel
  const [current7d, previous7d, current30d, previous30d] = await Promise.all([
    getContributionCounts(contributorId, workspaceId, current7dStart, now),
    getContributionCounts(contributorId, workspaceId, previous7dStart, current7dStart),
    getContributionCounts(contributorId, workspaceId, current30dStart, now),
    getContributionCounts(contributorId, workspaceId, previous30dStart, current30dStart),
  ]);

  // Calculate percentage change (30-day window for trend)
  const changePercent =
    previous30d.total > 0 ? ((current30d.total - previous30d.total) / previous30d.total) * 100 : 0;

  // Determine trend
  let trend: 'accelerating' | 'steady' | 'declining';
  if (Math.abs(changePercent) < 10) {
    trend = 'steady';
  } else if (changePercent > 0) {
    trend = 'accelerating';
  } else {
    trend = 'declining';
  }

  return {
    current7d: current7d.total,
    previous7d: previous7d.total,
    current30d: current30d.total,
    previous30d: previous30d.total,
    trend,
    changePercent,
  };
}

/**
 * Detect topic shifts by comparing historical topic distributions
 */
export async function detectTopicShifts(
  contributorId: string,
  workspaceId: string
): Promise<TopicShift[]> {
  const shifts: TopicShift[] = [];

  // Fetch historical analytics snapshots
  const { data: snapshots } = await supabase
    .from('contributor_analytics')
    .select('primary_topics, snapshot_date')
    .eq('contributor_id', contributorId)
    .eq('workspace_id', workspaceId)
    .order('snapshot_date', { ascending: false })
    .limit(8); // Last 8 snapshots for trend analysis

  if (!snapshots || snapshots.length < 2) {
    return shifts; // Not enough data for shift detection
  }

  // Compare recent topics (last 7 days) with previous period (8-14 days ago)
  const recent = snapshots.slice(0, 1)[0]; // Most recent
  const previousWeek = snapshots.slice(6, 7)[0]; // ~7 days ago

  if (recent && previousWeek) {
    const recentTopics = new Set((recent.primary_topics as string[]) || []);
    const previousTopics = new Set((previousWeek.primary_topics as string[]) || []);

    const topicsAdded = [...recentTopics].filter((t) => !previousTopics.has(t));
    const topicsRemoved = [...previousTopics].filter((t) => !recentTopics.has(t));

    if (topicsAdded.length > 0 || topicsRemoved.length > 0) {
      // Calculate significance based on change magnitude
      const totalChange = topicsAdded.length + topicsRemoved.length;
      const significance = totalChange >= 3 ? 'major' : 'minor';
      const confidence = Math.min(totalChange / 5, 1); // More changes = higher confidence

      shifts.push({
        from: topicsRemoved,
        to: topicsAdded,
        timeframe: '7d',
        significance,
        confidence,
      });
    }
  }

  // Compare 30-day trends
  const recentMonth = snapshots.slice(0, 4); // Last ~30 days
  const previousMonth = snapshots.slice(4, 8); // ~30-60 days ago

  const recentMonthTopics = new Set(
    recentMonth.flatMap((s) => (s.primary_topics as string[]) || [])
  );
  const previousMonthTopics = new Set(
    previousMonth.flatMap((s) => (s.primary_topics as string[]) || [])
  );

  const monthTopicsAdded = [...recentMonthTopics].filter((t) => !previousMonthTopics.has(t));
  const monthTopicsRemoved = [...previousMonthTopics].filter((t) => !recentMonthTopics.has(t));

  if (monthTopicsAdded.length > 0 || monthTopicsRemoved.length > 0) {
    const totalChange = monthTopicsAdded.length + monthTopicsRemoved.length;
    const significance = totalChange >= 3 ? 'major' : 'minor';
    const confidence = Math.min(totalChange / 5, 1);

    shifts.push({
      from: monthTopicsRemoved,
      to: monthTopicsAdded,
      timeframe: '30d',
      significance,
      confidence,
    });
  }

  return shifts;
}

/**
 * Predict future focus areas based on recent activity patterns
 */
async function predictFutureFocus(
  contributorId: string,
  workspaceId: string,
  currentTopics: string[]
): Promise<string[]> {
  // Fetch recent activity titles to identify emerging themes
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) {
    return currentTopics.slice(0, 3); // Fallback to current topics
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch recent contributions
  const [recentPRs, recentIssues, recentDiscussions] = await Promise.all([
    supabase
      .from('pull_requests')
      .select('title')
      .eq('author_id', contributorId)
      .in('repository_id', repoIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('issues')
      .select('title')
      .eq('author_id', contributorId)
      .in('repository_id', repoIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('discussions')
      .select('title')
      .eq('author_id', contributorId)
      .in('repository_id', repoIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  // Combine titles
  const titles = [
    ...(recentPRs.data?.map((p) => p.title) || []),
    ...(recentIssues.data?.map((i) => i.title) || []),
    ...(recentDiscussions.data?.map((d) => d.title) || []),
  ];

  if (titles.length === 0) {
    return currentTopics.slice(0, 3); // Fallback to current topics
  }

  // Simple keyword extraction from recent titles
  // In a more sophisticated implementation, this would use embeddings
  const keywords = new Map<string, number>();
  titles.forEach((title) => {
    const words = title.toLowerCase().split(/\W+/);
    words.forEach((word: string) => {
      if (word.length > 3) {
        // Skip short words
        keywords.set(word, (keywords.get(word) || 0) + 1);
      }
    });
  });

  // Sort by frequency and take top 3
  const topKeywords = Array.from(keywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return topKeywords;
}

/**
 * Generate comprehensive trend analysis for a contributor
 */
export async function analyzeTrends(
  contributorId: string,
  workspaceId: string,
  currentTopics: string[] = []
): Promise<TrendAnalysis> {
  // Fetch all trend data in parallel
  const [velocityData, topicShifts, predictedFocus] = await Promise.all([
    calculateVelocityMetrics(contributorId, workspaceId),
    detectTopicShifts(contributorId, workspaceId),
    predictFutureFocus(contributorId, workspaceId, currentTopics),
  ]);

  // Determine engagement pattern without nesting ternaries
  let engagementPattern: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (velocityData.trend === 'accelerating') {
    engagementPattern = 'increasing';
  } else if (velocityData.trend === 'declining') {
    engagementPattern = 'decreasing';
  }

  // Calculate confidence based on data availability
  const hasVelocityData = velocityData.current30d > 0;
  const hasTopicShifts = topicShifts.length > 0;
  const confidenceScore = (hasVelocityData ? 0.5 : 0) + (hasTopicShifts ? 0.5 : 0);

  return {
    velocityTrend: velocityData.trend,
    velocityData,
    topicShifts,
    engagementPattern,
    predictedFocus,
    confidenceScore,
  };
}
