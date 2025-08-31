import type { Database } from '@/types/database';

export interface RisingStarContributor {
  login: string;
  avatar_url: string;
  github_id: number;
  commits: number;
  pullRequests: number;
  issues: number;
  totalActivity: number;
  velocityScore: number;
  growthRate: number;
  firstContributionDate: string;
  lastContributionDate: string;
  contributionSpan: number;
  isNewContributor: boolean;
  isRisingStar: boolean;
}

export interface RisingStarsData {
  id: string;
  data: Array<{
    x: number;
    y: number;
    size: number;
    contributor: RisingStarContributor;
  }>;
}

type DatabaseContributor = Database['public']['Tables']['contributors']['Row'];
type DatabasePR = Database['public']['Tables']['pull_requests']['Row'];

interface ContributorMetrics {
  contributor: DatabaseContributor;
  pullRequests: DatabasePR[];
  commitCount: number;
  issueCount: number;
}

export function calculateRisingStars(
  metrics: ContributorMetrics[],
  options: {
    timeWindowDays?: number;
    minActivity?: number;
    newContributorDays?: number;
  } = {}
): RisingStarsData[] {
  const { timeWindowDays = 30, minActivity = 3, newContributorDays = 90 } = options;

  const now = new Date();
  const windowStart = new Date(now.getTime() - timeWindowDays * 24 * 60 * 60 * 1000);
  const newContributorThreshold = new Date(
    now.getTime() - newContributorDays * 24 * 60 * 60 * 1000
  );

  const processedContributors: RisingStarContributor[] = metrics
    .map(({ contributor, pullRequests, commitCount, issueCount }) => {
      // Filter PRs within the time window
      const recentPRs = pullRequests.filter((pr) => new Date(pr.created_at) >= windowStart);

      // Calculate activity metrics
      const prCount = recentPRs.length;
      const totalActivity = prCount + commitCount + issueCount;

      // Skip if below minimum activity threshold
      if (totalActivity < minActivity) {
        return null;
      }

      // Calculate first and last contribution dates
      const contributionDates = pullRequests
        .map((pr) => new Date(pr.created_at))
        .sort((a, b) => a.getTime() - b.getTime());

      const firstContribution = contributionDates[0] || new Date();
      const lastContribution = contributionDates[contributionDates.length - 1] || new Date();
      const contributionSpan = Math.ceil(
        (lastContribution.getTime() - firstContribution.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate velocity (activity per week)
      const weeksActive = Math.max(contributionSpan / 7, 1);
      const velocityScore = totalActivity / weeksActive;

      // Calculate growth rate (compare recent vs earlier activity)
      const midPoint = new Date(windowStart.getTime() + (timeWindowDays * 24 * 60 * 60 * 1000) / 2);
      const earlierPRs = recentPRs.filter((pr) => new Date(pr.created_at) < midPoint).length;
      const laterPRs = recentPRs.filter((pr) => new Date(pr.created_at) >= midPoint).length;
      const growthRate =
        earlierPRs > 0 ? ((laterPRs - earlierPRs) / earlierPRs) * 100 : laterPRs * 100;

      // Determine if new contributor or rising star
      const isNewContributor = firstContribution >= newContributorThreshold;
      const isRisingStar = growthRate > 50 || (isNewContributor && totalActivity > minActivity * 2);

      return {
        login: contributor.username,
        avatar_url: contributor.avatar_url,
        github_id: contributor.github_id,
        commits: commitCount,
        pullRequests: prCount,
        issues: issueCount,
        totalActivity,
        velocityScore,
        growthRate,
        firstContributionDate: firstContribution.toISOString(),
        lastContributionDate: lastContribution.toISOString(),
        contributionSpan,
        isNewContributor,
        isRisingStar,
      };
    })
    .filter((c): c is RisingStarContributor => c !== null);

  // Sort by velocity score to identify top performers
  const sortedContributors = processedContributors.sort(
    (a, b) => b.velocityScore - a.velocityScore
  );

  // Transform to chart data format
  const chartData: RisingStarsData[] = [
    {
      id: 'rising-stars',
      data: sortedContributors.map((contributor) => ({
        x: contributor.commits,
        y: contributor.pullRequests + contributor.issues,
        size: Math.min(Math.max(contributor.velocityScore * 10, 10), 100), // Scale size between 10-100
        contributor,
      })),
    },
  ];

  return chartData;
}

export function getTopRisingStars(
  data: RisingStarsData[],
  limit: number = 10
): RisingStarContributor[] {
  const allContributors = data.flatMap((series) => series.data.map((point) => point.contributor));

  return allContributors
    .filter((c) => c.isRisingStar)
    .sort((a, b) => b.velocityScore - a.velocityScore)
    .slice(0, limit);
}

export function getNewContributors(
  data: RisingStarsData[],
  limit: number = 10
): RisingStarContributor[] {
  const allContributors = data.flatMap((series) => series.data.map((point) => point.contributor));

  return allContributors
    .filter((c) => c.isNewContributor)
    .sort((a, b) => b.totalActivity - a.totalActivity)
    .slice(0, limit);
}
