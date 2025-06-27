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

/**
 * Calculate repository contributor confidence using enhanced algorithm
 * Combines star/fork conversion with engagement quality metrics
 */
export async function calculateRepositoryConfidence(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<number> {
  try {
    const daysBack = parseInt(timeRange);
    
    // Import supabase here to avoid circular dependencies
    const { supabase } = await import('../supabase');

    // Get repository info
    const { data: repoData } = await supabase
      .from('repositories')
      .select('stargazers_count, forks_count, id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (!repoData) {
      console.warn(`Repository ${owner}/${repo} not found in database`);
      console.warn(`This repository needs to be tracked or synced first to calculate confidence`);
      return 0;
    }

    console.log(`[Confidence] Calculating for ${owner}/${repo}:`, {
      repoId: repoData.id,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      timeRange: daysBack
    });

    // Calculate multiple confidence factors
    const [
      starForkConfidence,
      engagementConfidence,
      retentionConfidence,
      qualityConfidence
    ] = await Promise.all([
      calculateStarForkConfidence(supabase, owner, repo, repoData.id, daysBack),
      calculateEngagementConfidence(supabase, owner, repo, repoData.id, daysBack),
      calculateRetentionConfidence(supabase, owner, repo, repoData.id, daysBack),
      calculateQualityConfidence(supabase, owner, repo, repoData.id, daysBack)
    ]);

    // Weighted combination of confidence factors
    const weights = {
      starFork: 0.35,    // Primary OpenSauced metric
      engagement: 0.25,  // Issue/comment to contribution rate
      retention: 0.25,   // Contributor return rate
      quality: 0.15      // PR success rate
    };

    const overallConfidence = (
      (starForkConfidence * weights.starFork) +
      (engagementConfidence * weights.engagement) +
      (retentionConfidence * weights.retention) +
      (qualityConfidence * weights.quality)
    );

    // Apply repository size and maturity adjustments
    const adjustedConfidence = applyRepositoryAdjustments(
      overallConfidence,
      repoData.stargazers_count,
      repoData.forks_count,
      daysBack
    );

    return Math.min(100, Math.round(adjustedConfidence));

  } catch (error) {
    console.error('Error calculating repository confidence:', error);
    // Return fallback based on available data
    return await calculateBasicFallback(owner, repo, timeRange);
  }
}

/**
 * Core star/fork to contribution conversion rate (OpenSauced algorithm)
 */
async function calculateStarForkConfidence(
  supabase: any,
  owner: string,
  repo: string,
  repositoryId: string,
  daysBack: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  // Get star/fork events
  const { data: starForkEvents } = await supabase
    .from('github_events_cache')
    .select('actor_login, event_type, created_at')
    .eq('repository_owner', owner)
    .eq('repository_name', repo)
    .in('event_type', ['WatchEvent', 'ForkEvent'])
    .gte('created_at', cutoffDate.toISOString());

  // Get contributors
  const { data: contributorData } = await supabase
    .from('pull_requests')
    .select('contributors!inner(username)')
    .eq('repository_id', repositoryId)
    .gte('created_at', cutoffDate.toISOString());

  const contributors = new Set(
    contributorData?.map((c: any) => c.contributors?.username).filter(Boolean) || []
  );

  console.log(`[Confidence] Star/Fork data for ${owner}/${repo}:`, {
    starForkEvents: starForkEvents?.length || 0,
    contributors: contributors.size,
    cutoffDate: cutoffDate.toISOString()
  });

  if (!starForkEvents?.length) {
    console.log(`[Confidence] No star/fork events found for ${owner}/${repo} - may need GitHub sync`);
    return 0; // No star/fork event data available
  }

  // Separate and weight differently
  const stargazers = new Set(
    starForkEvents.filter((e: any) => e.event_type === 'WatchEvent').map((e: any) => e.actor_login)
  );
  const forkers = new Set(
    starForkEvents.filter((e: any) => e.event_type === 'ForkEvent').map((e: any) => e.actor_login)
  );

  const stargazersWhoContributed = Array.from(stargazers).filter(u => contributors.has(u)).length;
  const forkersWhoContributed = Array.from(forkers).filter(u => contributors.has(u)).length;

  // Weighted calculation (forks = stronger intent)
  const totalWeighted = (stargazers.size * 0.3) + (forkers.size * 0.7);
  const contributedWeighted = (stargazersWhoContributed * 0.3) + (forkersWhoContributed * 0.7);

  return totalWeighted > 0 ? (contributedWeighted / totalWeighted) * 100 : 0;
}

/**
 * Issue/comment engagement to contribution conversion rate
 */
async function calculateEngagementConfidence(
  supabase: any,
  owner: string,
  repo: string,
  repositoryId: string,
  daysBack: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Get engagement events (issues, all comment types, reviews)
  const { data: engagementEvents } = await supabase
    .from('github_events_cache')
    .select('actor_login, event_type')
    .eq('repository_owner', owner)
    .eq('repository_name', repo)
    .in('event_type', [
      'IssuesEvent', 
      'IssueCommentEvent', 
      'PullRequestReviewEvent', 
      'PullRequestReviewCommentEvent',
      'CommitCommentEvent'
    ])
    .gte('created_at', cutoffDate.toISOString());

  // Get PR contributors
  const { data: prContributors } = await supabase
    .from('pull_requests')
    .select('contributors!inner(username)')
    .eq('repository_id', repositoryId)
    .gte('created_at', cutoffDate.toISOString());

  const contributors = new Set(
    prContributors?.map((c: any) => c.contributors?.username).filter(Boolean) || []
  );

  const engagers = new Set(engagementEvents?.map((e: any) => e.actor_login).filter(Boolean) || []);
  const engagersWhoContributed = Array.from(engagers).filter(u => contributors.has(u)).length;

  return engagers.size > 0 ? (engagersWhoContributed / engagers.size) * 100 : 0;
}

/**
 * Contributor retention rate over time windows
 */
async function calculateRetentionConfidence(
  supabase: any,
  _owner: string,
  _repo: string,
  repositoryId: string,
  daysBack: number
): Promise<number> {
  // Look at contributors from previous period vs current period
  const currentPeriodStart = new Date();
  currentPeriodStart.setDate(currentPeriodStart.getDate() - daysBack);
  
  const previousPeriodStart = new Date();
  previousPeriodStart.setDate(previousPeriodStart.getDate() - (daysBack * 2));

  // Get contributors from both periods
  const [currentContributors, previousContributors] = await Promise.all([
    supabase
      .from('pull_requests')
      .select('contributors!inner(username)')
      .eq('repository_id', repositoryId)
      .gte('created_at', currentPeriodStart.toISOString()),
    
    supabase
      .from('pull_requests')
      .select('contributors!inner(username)')
      .eq('repository_id', repositoryId)
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', currentPeriodStart.toISOString())
  ]);

  const currentSet = new Set(
    currentContributors.data?.map((c: any) => c.contributors?.username).filter(Boolean) || []
  );
  const previousSet = new Set(
    previousContributors.data?.map((c: any) => c.contributors?.username).filter(Boolean) || []
  );

  // Calculate retention rate
  const returningContributors = Array.from(previousSet).filter(u => currentSet.has(u)).length;
  
  return previousSet.size > 0 ? (returningContributors / previousSet.size) * 100 : 50; // Default neutral
}

/**
 * PR success rate and contribution quality
 */
async function calculateQualityConfidence(
  supabase: any,
  _owner: string,
  _repo: string,
  repositoryId: string,
  daysBack: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Get PR data with merge status
  const { data: pullRequests } = await supabase
    .from('pull_requests')
    .select('state, merged_at')
    .eq('repository_id', repositoryId)
    .gte('created_at', cutoffDate.toISOString());

  if (!pullRequests?.length) {
    return 50; // Neutral score if no PR data
  }

  const mergedPRs = pullRequests.filter((pr: any) => pr.merged_at !== null).length;
  const totalPRs = pullRequests.length;

  // PR success rate as quality indicator
  return (mergedPRs / totalPRs) * 100;
}

/**
 * Apply repository size and maturity adjustments
 */
function applyRepositoryAdjustments(
  confidence: number,
  starCount: number,
  forkCount: number,
  daysBack: number
): number {
  let adjusted = confidence;

  // Large repository adjustment (lower expectations)
  const totalEngagement = starCount + (forkCount * 2);
  if (totalEngagement > 10000) {
    adjusted *= 0.7; // Very large repos have naturally lower conversion
  } else if (totalEngagement > 1000) {
    adjusted *= 0.85; // Large repos
  }

  // Time window adjustment (longer windows should have higher confidence)
  if (daysBack < 30) {
    adjusted *= 0.8; // Short windows are less reliable
  } else if (daysBack > 90) {
    adjusted *= 1.1; // Longer windows are more stable
  }

  return adjusted;
}

/**
 * Basic fallback when detailed event data is unavailable
 */
async function calculateBasicFallback(
  owner: string,
  repo: string,
  timeRange: string
): Promise<number> {
  try {
    const { supabase } = await import('../supabase');
    const daysBack = parseInt(timeRange);

    const { data: repoData } = await supabase
      .from('repositories')
      .select('stargazers_count, forks_count, id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (!repoData) return 0;

    // Get recent contributor count
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: recentContributors } = await supabase
      .from('pull_requests')
      .select('author_id')
      .eq('repository_id', repoData.id)
      .gte('created_at', cutoffDate.toISOString());

    const uniqueContributors = new Set(recentContributors?.map(c => c.author_id) || []).size;
    
    return calculateFallbackConfidence(
      repoData.stargazers_count,
      repoData.forks_count,
      uniqueContributors,
      daysBack
    );
  } catch (error) {
    console.error('Basic fallback failed:', error);
    return 0;
  }
}

/**
 * Fallback confidence calculation when detailed event data is not available
 */
function calculateFallbackConfidence(
  starCount: number,
  forkCount: number,
  contributorCount: number,
  daysBack: number
): number {
  // Estimate engagement based on repository metrics
  const totalEngagement = starCount + (forkCount * 2); // Weight forks higher
  
  if (totalEngagement === 0) {
    return 0;
  }

  // Apply time-based scaling (newer repos have less confidence data)
  const timeMultiplier = Math.min(1, daysBack / 30);
  
  // Estimate confidence based on contributor ratio
  const baseConfidence = (contributorCount / totalEngagement) * 100 * timeMultiplier;
  
  // Apply realistic caps based on repository size
  let cappedConfidence = baseConfidence;
  if (totalEngagement > 1000) {
    cappedConfidence = Math.min(baseConfidence, 40); // Large repos rarely exceed 40%
  } else if (totalEngagement > 100) {
    cappedConfidence = Math.min(baseConfidence, 60); // Medium repos
  }
  
  return Math.min(100, Math.round(cappedConfidence));
}