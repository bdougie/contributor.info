import { fetchPullRequests } from '../github';

export interface ActivityMetrics {
  totalPRs: number;
  openPRs: number;
  mergedThisWeek: number;
  averageMergeTime: number; // in hours
  averageMergeTimeTrend: "up" | "down" | "stable";
  topContributors: Array<{
    name: string;
    avatar: string;
    prCount: number;
  }>;
  velocity: {
    current: number;
    previous: number;
    change: number;
  };
}

/**
 * Calculate real PR activity metrics from GitHub data
 */
export async function calculatePrActivityMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<ActivityMetrics> {
  try {
    // Fetch PRs for the current time period
    const allPRs = await fetchPullRequests(owner, repo, timeRange);
    
    // Get current date and calculate time boundaries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    // Filter PRs by status and time period
    const openPRs = allPRs.filter(pr => pr.state === 'open');
    const mergedPRs = allPRs.filter(pr => pr.merged_at);
    
    // Calculate merged this week
    const mergedThisWeek = mergedPRs.filter(pr => {
      const mergedDate = new Date(pr.merged_at!);
      return mergedDate >= oneWeekAgo;
    });
    
    // Calculate merged last week (for velocity comparison)
    const mergedLastWeek = mergedPRs.filter(pr => {
      const mergedDate = new Date(pr.merged_at!);
      return mergedDate >= twoWeeksAgo && mergedDate < oneWeekAgo;
    });
    
    // Calculate average merge time
    let totalMergeTime = 0;
    let mergedCount = 0;
    const recentMergedPRs = mergedPRs.filter(pr => {
      const mergedDate = new Date(pr.merged_at!);
      return mergedDate >= twoWeeksAgo; // Last 2 weeks for better average
    });
    
    recentMergedPRs.forEach(pr => {
      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at!);
      const mergeTimeHours = (mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      totalMergeTime += mergeTimeHours;
      mergedCount++;
    });
    
    const averageMergeTime = mergedCount > 0 ? totalMergeTime / mergedCount : 0;
    
    // Calculate merge time trend (compare this week vs last week)
    const thisWeekMergeTimes: number[] = [];
    const lastWeekMergeTimes: number[] = [];
    
    mergedThisWeek.forEach(pr => {
      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at!);
      thisWeekMergeTimes.push((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    });
    
    mergedLastWeek.forEach(pr => {
      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at!);
      lastWeekMergeTimes.push((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    });
    
    const thisWeekAvg = thisWeekMergeTimes.length > 0 
      ? thisWeekMergeTimes.reduce((a, b) => a + b, 0) / thisWeekMergeTimes.length 
      : 0;
    const lastWeekAvg = lastWeekMergeTimes.length > 0 
      ? lastWeekMergeTimes.reduce((a, b) => a + b, 0) / lastWeekMergeTimes.length 
      : 0;
    
    let averageMergeTimeTrend: "up" | "down" | "stable" = "stable";
    if (thisWeekAvg > 0 && lastWeekAvg > 0) {
      const change = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
      if (change > 10) averageMergeTimeTrend = "up";
      else if (change < -10) averageMergeTimeTrend = "down";
    }
    
    // Calculate top contributors
    const contributorMap = new Map<string, { count: number; avatar: string }>();
    
    allPRs.forEach(pr => {
      const author = pr.user?.login || 'unknown';
      const avatar = pr.user?.avatar_url || '';
      const current = contributorMap.get(author) || { count: 0, avatar: '' };
      contributorMap.set(author, { 
        count: current.count + 1, 
        avatar: avatar || current.avatar // Keep first non-empty avatar found
      });
    });
    
    const topContributors = Array.from(contributorMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        avatar: data.avatar,
        prCount: data.count
      }));
    
    // Calculate velocity
    const currentVelocity = mergedThisWeek.length;
    const previousVelocity = mergedLastWeek.length;
    const velocityChange = previousVelocity > 0 
      ? Math.round(((currentVelocity - previousVelocity) / previousVelocity) * 100)
      : 0;
    
    return {
      totalPRs: allPRs.length,
      openPRs: openPRs.length,
      mergedThisWeek: mergedThisWeek.length,
      averageMergeTime,
      averageMergeTimeTrend,
      topContributors,
      velocity: {
        current: currentVelocity,
        previous: previousVelocity,
        change: velocityChange
      }
    };
    
  } catch (error) {
    // Return default metrics on error
    return {
      totalPRs: 0,
      openPRs: 0,
      mergedThisWeek: 0,
      averageMergeTime: 0,
      averageMergeTimeTrend: "stable",
      topContributors: [],
      velocity: {
        current: 0,
        previous: 0,
        change: 0
      }
    };
  }
}