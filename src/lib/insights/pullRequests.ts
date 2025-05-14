import { fetchPullRequests } from '../github';
import type { PullRequest } from '../types';

export interface PRAnalysisResult {
  totalPRs: number;
  averageTimeToMerge: number; // in hours
  prMergeTimesByAuthor: Record<string, number[]>; // author -> hours to merge
  prsByAuthor: Record<string, number>; // author -> count
  // Add any other metrics you find useful
}

/**
 * Analyzes pull requests for a repository and returns metrics
 */
export async function analyzePullRequests(
  owner: string,
  repo: string,
  dateRange?: { startDate?: Date; endDate?: Date },
  timeRange: string = '90' // Default to 90 days of data
): Promise<PRAnalysisResult> {
  // Fetch pull requests using the existing github.ts functionality
  const pullRequests = await fetchPullRequests(owner, repo, timeRange);

  // Filter PRs by date range if provided
  let filteredPRs = pullRequests;
  if (dateRange) {
    filteredPRs = pullRequests.filter(pr => {
      const createdAt = new Date(pr.created_at);
      if (dateRange.startDate && createdAt < dateRange.startDate) return false;
      if (dateRange.endDate && createdAt > dateRange.endDate) return false;
      return true;
    });
  }

  // Calculate metrics
  const totalPRs = filteredPRs.length;
  const prMergeTimesByAuthor: Record<string, number[]> = {};
  const prsByAuthor: Record<string, number> = {};
  
  let totalMergeTime = 0;
  let mergedPRCount = 0;

  filteredPRs.forEach(pr => {
    const author = pr.user?.login || 'unknown';
    
    // Count PRs by author
    prsByAuthor[author] = (prsByAuthor[author] || 0) + 1;
    
    // Calculate merge time for merged PRs
    if (pr.merged_at) {
      const createTime = new Date(pr.created_at).getTime();
      const mergeTime = new Date(pr.merged_at).getTime();
      const hoursToMerge = (mergeTime - createTime) / (1000 * 60 * 60);
      
      // Add to author's merge times
      if (!prMergeTimesByAuthor[author]) prMergeTimesByAuthor[author] = [];
      prMergeTimesByAuthor[author].push(hoursToMerge);
      
      // Update totals
      totalMergeTime += hoursToMerge;
      mergedPRCount++;
    }
  });

  const averageTimeToMerge = mergedPRCount > 0 ? totalMergeTime / mergedPRCount : 0;

  return {
    totalPRs,
    averageTimeToMerge,
    prMergeTimesByAuthor,
    prsByAuthor,
  };
}