import { PullRequestActivity } from '../src/types/github';
import { getCachedGitHubActivity, cacheGitHubActivity } from './supabase';

/**
 * Fetch pull request activities from GitHub for a given repository.
 * First checks the Supabase cache, then falls back to the GitHub API if needed.
 * 
 * @param repo - The repository name (e.g., "owner/repo").
 * @returns A promise resolving to an array of pull request activities.
 */
export async function fetchPullRequestActivities(repo?: string): Promise<PullRequestActivity[]> {
  if (!repo) {
    throw new Error('Repository name is required');
  }

  // Try to get data from cache first
  const cachedData = await getCachedGitHubActivity(repo);
  if (cachedData) {
    console.log(`Using cached GitHub activity data for ${repo}`);
    return cachedData;
  }

  // If cache miss or stale, fetch from GitHub API
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls`);

  if (!response.ok) {
    throw new Error(`Failed to fetch pull request activities: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Store the fresh data in cache
  await cacheGitHubActivity(repo, data);
  
  return data;
}