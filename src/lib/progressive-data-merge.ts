import type { PullRequest } from './types';

/**
 * Merge new PR data with existing cached data progressively
 * Handles deduplication and maintains chronological order
 */
export function mergeProgressivePRData(
  cachedData: PullRequest[],
  newData: PullRequest[],
  options: {
    maxTotal?: number;
    preferNewer?: boolean;
  } = {}
): PullRequest[] {
  const { maxTotal = 500, preferNewer = true } = options;
  
  // Create a map for deduplication by PR number
  const prMap = new Map<number, PullRequest>();
  
  // Add cached data first
  cachedData.forEach(pr => {
    prMap.set(pr.number, pr);
  });
  
  // Merge new data, preferring newer data if specified
  newData.forEach(pr => {
    if (preferNewer || !prMap.has(pr.number)) {
      prMap.set(pr.number, pr);
    }
  });
  
  // Convert back to array and sort by created date (newest first)
  let merged = Array.from(prMap.values()).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });
  
  // Limit total if specified
  if (maxTotal && merged.length > maxTotal) {
    merged = merged.slice(0, maxTotal);
  }
  
  return merged;
}

/**
 * Calculate data completeness metrics for PR data
 */
export function calculateDataCompleteness(prs: PullRequest[]): {
  totalPRs: number;
  withReviews: number;
  withComments: number;
  withDetails: number;
  completenessScore: number; // 0-100
} {
  if (prs.length === 0) {
    return {
      totalPRs: 0,
      withReviews: 0,
      withComments: 0,
      withDetails: 0,
      completenessScore: 0
    };
  }
  
  let withReviews = 0;
  let withComments = 0;
  let withDetails = 0;
  
  prs.forEach(pr => {
    if (pr.reviews && pr.reviews.length > 0) withReviews++;
    if (pr.comments && pr.comments.length > 0) withComments++;
    if (pr.additions > 0 || pr.deletions > 0 || (pr.changed_files && pr.changed_files > 0)) withDetails++;
  });
  
  // Calculate completeness score
  const reviewScore = (withReviews / prs.length) * 33.33;
  const commentScore = (withComments / prs.length) * 33.33;
  const detailScore = (withDetails / prs.length) * 33.34;
  
  const completenessScore = Math.round(reviewScore + commentScore + detailScore);
  
  return {
    totalPRs: prs.length,
    withReviews,
    withComments,
    withDetails,
    completenessScore
  };
}

/**
 * Identify gaps in PR data that need to be filled
 */
export function identifyDataGaps(
  prs: PullRequest[],
  requestedDays: number
): {
  oldestPR: Date | null;
  newestPR: Date | null;
  daysCovered: number;
  hasGaps: boolean;
  missingDays: number;
  recommendation: 'complete' | 'fetch_older' | 'fetch_newer' | 'fetch_details';
} {
  if (prs.length === 0) {
    return {
      oldestPR: null,
      newestPR: null,
      daysCovered: 0,
      hasGaps: true,
      missingDays: requestedDays,
      recommendation: 'fetch_newer'
    };
  }
  
  // Find date range
  const dates = prs.map(pr => new Date(pr.created_at).getTime());
  const oldestPR = new Date(Math.min(...dates));
  const newestPR = new Date(Math.max(...dates));
  
  // Calculate days covered
  const daysCovered = Math.ceil((newestPR.getTime() - oldestPR.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check for completeness
  const { completenessScore } = calculateDataCompleteness(prs);
  
  // Determine recommendation
  let recommendation: 'complete' | 'fetch_older' | 'fetch_newer' | 'fetch_details';
  
  if (daysCovered >= requestedDays && completenessScore >= 80) {
    recommendation = 'complete';
  } else if (completenessScore < 50) {
    recommendation = 'fetch_details';
  } else if (daysCovered < requestedDays) {
    // Check if we're missing recent or old data
    const now = new Date();
    const daysSinceNewest = Math.ceil((now.getTime() - newestPR.getTime()) / (1000 * 60 * 60 * 24));
    
    recommendation = daysSinceNewest > 1 ? 'fetch_newer' : 'fetch_older';
  } else {
    recommendation = 'complete';
  }
  
  return {
    oldestPR,
    newestPR,
    daysCovered,
    hasGaps: daysCovered < requestedDays || completenessScore < 80,
    missingDays: Math.max(0, requestedDays - daysCovered),
    recommendation
  };
}