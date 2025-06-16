import { fetchPullRequests } from '../github';

export interface HealthMetrics {
  score: number; // 0-100
  trend: "improving" | "declining" | "stable";
  lastChecked: Date;
  factors: {
    name: string;
    score: number;
    weight: number;
    status: "good" | "warning" | "critical";
    description: string;
  }[];
  recommendations: string[];
}

/**
 * Calculate repository health metrics from real GitHub data
 */
export async function calculateHealthMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<HealthMetrics> {
  try {
    const now = new Date();
    // Fetch data
    const pullRequests = await fetchPullRequests(owner, repo, timeRange);
    
    // Calculate various health factors
    const factors: HealthMetrics['factors'] = [];
    const recommendations: string[] = [];
    
    // 1. PR Merge Time Factor
    const mergedPRs = pullRequests.filter((pr: any) => pr.merged_at);
    let avgMergeTime = 0;
    
    if (mergedPRs.length > 0) {
      const mergeTimes = mergedPRs.map((pr: any) => {
        const created = new Date(pr.created_at);
        const merged = new Date(pr.merged_at!);
        return (merged.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      });
      avgMergeTime = mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length;
    }
    
    let mergeTimeScore = 100;
    let mergeTimeStatus: "good" | "warning" | "critical" = "good";
    
    if (avgMergeTime <= 24) {
      mergeTimeScore = 100;
      mergeTimeStatus = "good";
    } else if (avgMergeTime <= 72) {
      mergeTimeScore = 85;
      mergeTimeStatus = "good";
    } else if (avgMergeTime <= 168) { // 1 week
      mergeTimeScore = 70;
      mergeTimeStatus = "warning";
      recommendations.push("Consider streamlining PR review process to reduce merge times");
    } else {
      mergeTimeScore = 50;
      mergeTimeStatus = "critical";
      recommendations.push("PR merge times are very high - implement review SLAs");
    }
    
    factors.push({
      name: "PR Merge Time",
      score: mergeTimeScore,
      weight: 25,
      status: mergeTimeStatus,
      description: avgMergeTime > 0 
        ? `Average merge time is ${Math.round(avgMergeTime)} hours`
        : "No merged PRs to analyze"
    });
    
    // 2. Contributor Diversity Factor
    const uniqueContributors = new Set(pullRequests.map((pr: any) => pr.user?.login).filter(Boolean));
    const contributorCount = uniqueContributors.size;
    
    // Calculate bus factor (contributors who handle majority of work)
    const contributorPRCounts = new Map<string, number>();
    pullRequests.forEach((pr: any) => {
      const author = pr.user?.login;
      if (author) {
        contributorPRCounts.set(author, (contributorPRCounts.get(author) || 0) + 1);
      }
    });
    
    const sortedContributors = Array.from(contributorPRCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    let busFactorScore = 100;
    let busFactorStatus: "good" | "warning" | "critical" = "good";
    let busFactorCount = 0;
    
    if (sortedContributors.length > 0) {
      const totalPRs = pullRequests.length;
      let cumulativePRs = 0;
      
      for (const [, prCount] of sortedContributors) {
        cumulativePRs += prCount;
        busFactorCount++;
        if (cumulativePRs >= totalPRs * 0.5) break;
      }
      
      if (busFactorCount === 1) {
        busFactorScore = 40;
        busFactorStatus = "critical";
        recommendations.push("High bus factor risk - one person handles most work");
      } else if (busFactorCount === 2) {
        busFactorScore = 60;
        busFactorStatus = "warning";
        recommendations.push("Consider distributing work among more contributors");
      } else if (busFactorCount <= 3) {
        busFactorScore = 80;
        busFactorStatus = "warning";
      }
    }
    
    factors.push({
      name: "Contributor Diversity",
      score: busFactorScore,
      weight: 20,
      status: busFactorStatus,
      description: `${contributorCount} active contributors, ${busFactorCount} handle 50% of work`
    });
    
    // 3. Review Coverage Factor
    const prsWithReviews = pullRequests.filter((pr: any) => 
      pr.reviews && pr.reviews.length > 0
    ).length;
    
    const reviewCoverage = pullRequests.length > 0 
      ? (prsWithReviews / pullRequests.length) * 100 
      : 0;
    
    let reviewScore = Math.round(reviewCoverage);
    let reviewStatus: "good" | "warning" | "critical" = "good";
    
    if (reviewCoverage < 50) {
      reviewStatus = "critical";
      recommendations.push("Implement mandatory code reviews for all PRs");
    } else if (reviewCoverage < 80) {
      reviewStatus = "warning";
      recommendations.push("Increase code review coverage to improve quality");
    }
    
    factors.push({
      name: "Review Coverage",
      score: reviewScore,
      weight: 20,
      status: reviewStatus,
      description: `${Math.round(reviewCoverage)}% of PRs receive reviews`
    });
    
    // 4. Activity Level Factor
    const recentPRs = pullRequests.filter((pr: any) => {
      const created = new Date(pr.created_at);
      const daysAgo = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    });
    
    let activityScore = 100;
    let activityStatus: "good" | "warning" | "critical" = "good";
    
    if (recentPRs.length === 0) {
      activityScore = 30;
      activityStatus = "critical";
      recommendations.push("No activity in the past week - project may be stalled");
    } else if (recentPRs.length < 3) {
      activityScore = 70;
      activityStatus = "warning";
    }
    
    factors.push({
      name: "Activity Level",
      score: activityScore,
      weight: 20,
      status: activityStatus,
      description: `${recentPRs.length} PRs in the last 7 days`
    });
    
    // 5. Response Time Factor
    const openPRs = pullRequests.filter((pr: any) => pr.state === 'open');
    const oldOpenPRs = openPRs.filter((pr: any) => {
      const created = new Date(pr.created_at);
      const daysOpen = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return daysOpen > 7;
    });
    
    let responseScore = 100;
    let responseStatus: "good" | "warning" | "critical" = "good";
    
    if (openPRs.length > 0) {
      const stalePRPercentage = (oldOpenPRs.length / openPRs.length) * 100;
      
      if (stalePRPercentage > 50) {
        responseScore = 50;
        responseStatus = "critical";
        recommendations.push("Many PRs are stale - establish response time SLAs");
      } else if (stalePRPercentage > 25) {
        responseScore = 75;
        responseStatus = "warning";
      }
    }
    
    factors.push({
      name: "Response Time",
      score: responseScore,
      weight: 15,
      status: responseStatus,
      description: `${oldOpenPRs.length} PRs open for more than 7 days`
    });
    
    // Calculate overall score
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const weightedScore = factors.reduce((sum, factor) => 
      sum + (factor.score * factor.weight), 0
    );
    const overallScore = Math.round(weightedScore / totalWeight);
    
    // Determine trend (simplified - would need historical data for real trend)
    let trend: "improving" | "declining" | "stable" = "stable";
    if (overallScore >= 80) trend = "improving";
    else if (overallScore < 60) trend = "declining";
    
    // Add general recommendations based on score
    if (overallScore < 60) {
      recommendations.push("Overall health needs attention - focus on highest impact areas");
    } else if (overallScore >= 80 && recommendations.length === 0) {
      recommendations.push("Repository health is excellent - maintain current practices");
    }
    
    return {
      score: overallScore,
      trend,
      lastChecked: now,
      factors,
      recommendations: recommendations.slice(0, 3) // Limit to top 3 recommendations
    };
    
  } catch (error) {
    console.error('Error calculating health metrics:', error);
    
    // Return default metrics on error
    return {
      score: 0,
      trend: "stable",
      lastChecked: new Date(),
      factors: [],
      recommendations: ["Unable to calculate health metrics - check repository access"]
    };
  }
}