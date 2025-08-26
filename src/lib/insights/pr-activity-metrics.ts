import { fetchPRDataWithFallback } from '../supabase-pr-data';

export interface ActivityMetrics {
  totalPRs: number;
  openPRs: number;
  mergedThisWeek: number;
  averageMergeTime: number; // in hours
  averageMergeTimeTrend: 'up' | 'down' | 'stable';
  totalReviews: number;
  totalComments: number;
  topContributors: Array<{
    name: string;
    avatar: string;
    prCount: number;
    reviewCount: number;
    commentCount: number;
  }>;
  velocity: {
    current: number;
    previous: number;
    change: number;
  };
  // Status information for proper error handling
  status:
    | 'success'
    | 'large_repository_protected'
    | 'no_data'
    | 'error'
    | 'partial_data'
    | 'pending';
  message?: string;
  repositoryName?: string;
}

/**
 * Calculate real PR activity metrics from GitHub data
 */
export async function calculatePrActivityMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30',
): Promise<ActivityMetrics> {
  try {
    // Fetch PRs for the current time period
    const prDataResult = await fetchPRDataWithFallback(owner, repo, timeRange);
    const allPRs = prDataResult.data;

    // Get current date and calculate time boundaries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Filter PRs by status and time period
    const openPRs = allPRs.filter((pr) => pr.state === 'open');
    const mergedPRs = allPRs.filter((pr) => pr.merged_at);

    // Calculate merged this week
    const mergedThisWeek = mergedPRs.filter((pr) => {
      const mergedDate = new Date(pr.merged_at!);
      return mergedDate >= oneWeekAgo;
    });

    // Calculate merged last week (for velocity comparison)
    const mergedLastWeek = mergedPRs.filter((pr) => {
      const mergedDate = new Date(pr.merged_at!);
      return mergedDate >= twoWeeksAgo && mergedDate < oneWeekAgo;
    });

    // Calculate average merge time
    let totalMergeTime = 0;
    let mergedCount = 0;
    const recentMergedPRs = mergedPRs.filter((pr) => {
      const mergedDate = new Date(pr.merged_at!);
      return mergedDate >= twoWeeksAgo; // Last 2 weeks for better average
    });

    recentMergedPRs.forEach((pr) => {
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

    mergedThisWeek.forEach((pr) => {
      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at!);
      thisWeekMergeTimes.push((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    });

    mergedLastWeek.forEach((pr) => {
      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at!);
      lastWeekMergeTimes.push((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    });

    const thisWeekAvg =
      thisWeekMergeTimes.length > 0
        ? thisWeekMergeTimes.reduce((a, b) => a + b, 0) / thisWeekMergeTimes.length
        : 0;
    const lastWeekAvg =
      lastWeekMergeTimes.length > 0
        ? lastWeekMergeTimes.reduce((a, b) => a + b, 0) / lastWeekMergeTimes.length
        : 0;

    let averageMergeTimeTrend: 'up' | 'down' | 'stable' = 'stable';
    if (thisWeekAvg > 0 && lastWeekAvg > 0) {
      const change = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
      if (change > 10) averageMergeTimeTrend = 'up';
      else if (change < -10) averageMergeTimeTrend = 'down';
    }

    // Calculate total reviews and comments
    const totalReviews = allPRs.reduce((total, pr) => total + (pr.reviews?.length || 0), 0);
    const totalComments = allPRs.reduce((total, pr) => total + (pr.comments?.length || 0), 0);

    // Calculate top contributors with review and comment activity
    const contributorMap = new Map<
      string,
      { prCount: number; reviewCount: number; commentCount: number; avatar: string }
    >();

    allPRs.forEach((pr) => {
      const author = pr.user?.login || 'unknown';
      const avatar = pr.user?.avatar_url || '';
      const current = contributorMap.get(author) || {
        prCount: 0,
        reviewCount: 0,
        commentCount: 0,
        avatar: '',
      };

      // Count PRs authored
      contributorMap.set(author, {
        prCount: current.prCount + 1,
        reviewCount: current.reviewCount,
        commentCount: current.commentCount,
        avatar: avatar || current.avatar, // Keep first non-empty avatar found
      });

      // Count reviews given by this person
      if (pr.reviews) {
        pr.reviews.forEach((review) => {
          const reviewer = review.user?.login || 'unknown';
          const reviewerAvatar = review.user?.avatar_url || '';
          const reviewerCurrent = contributorMap.get(reviewer) || {
            prCount: 0,
            reviewCount: 0,
            commentCount: 0,
            avatar: '',
          };
          contributorMap.set(reviewer, {
            prCount: reviewerCurrent.prCount,
            reviewCount: reviewerCurrent.reviewCount + 1,
            commentCount: reviewerCurrent.commentCount,
            avatar: reviewerAvatar || reviewerCurrent.avatar,
          });
        });
      }

      // Count comments made by this person
      if (pr.comments) {
        pr.comments.forEach((comment) => {
          const commenter = comment.user?.login || 'unknown';
          const commenterAvatar = comment.user?.avatar_url || '';
          const commenterCurrent = contributorMap.get(commenter) || {
            prCount: 0,
            reviewCount: 0,
            commentCount: 0,
            avatar: '',
          };
          contributorMap.set(commenter, {
            prCount: commenterCurrent.prCount,
            reviewCount: commenterCurrent.reviewCount,
            commentCount: commenterCurrent.commentCount + 1,
            avatar: commenterAvatar || commenterCurrent.avatar,
          });
        });
      }
    });

    const topContributors = Array.from(contributorMap.entries())
      .sort((a, b) => {
        // Sort by total activity (PRs + reviews + comments)
        const totalA = a[1].prCount + a[1].reviewCount + a[1].commentCount;
        const totalB = b[1].prCount + b[1].reviewCount + b[1].commentCount;
        return totalB - totalA;
      })
      .slice(0, 5)
      .map(([name, _data]) => ({
        name,
        avatar: data.avatar,
        prCount: data.prCount,
        reviewCount: data.reviewCount,
        commentCount: data.commentCount,
      }));

    // Calculate velocity
    const currentVelocity = mergedThisWeek.length;
    const previousVelocity = mergedLastWeek.length;
    const velocityChange =
      previousVelocity > 0
        ? Math.round(((currentVelocity - previousVelocity) / previousVelocity) * 100)
        : 0;

    return {
      totalPRs: allPRs.length,
      openPRs: openPRs.length,
      mergedThisWeek: mergedThisWeek.length,
      averageMergeTime,
      averageMergeTimeTrend,
      totalReviews,
      totalComments,
      topContributors,
      velocity: {
        current: currentVelocity,
        previous: previousVelocity,
        change: velocityChange,
      },
      // Include status information from data fetching
      status: prDataResult.status,
      message: prDataResult.message,
      repositoryName: prDataResult.repositoryName,
    };
  } catch () {
    console.error('Error calculating PR activity metrics:', _error);
    // Return default metrics on error
    return {
      totalPRs: 0,
      openPRs: 0,
      mergedThisWeek: 0,
      averageMergeTime: 0,
      averageMergeTimeTrend: 'stable',
      totalReviews: 0,
      totalComments: 0,
      topContributors: [],
      velocity: {
        current: 0,
        previous: 0,
        change: 0,
      },
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while calculating metrics',
      repositoryName: `${owner}/${repo}`,
    };
  }
}
