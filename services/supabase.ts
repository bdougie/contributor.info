import { supabase } from '../src/services/supabase-client';
import { PullRequestActivity } from '../src/types/github';

/**
 * Get cached GitHub activity data for a repository
 * @param repo - Repository name in owner/repo format
 * @returns Cached activity data or null if not found
 */
export async function getCachedGitHubActivity(repo: string): Promise<PullRequestActivity[] | null> {
  const { data, error } = await supabase
    .from('github_activities')
    .select('activity_data, updated_at')
    .eq('repo', repo)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Check if the cache is fresh (less than 30 minutes old)
  const cacheTime = new Date(data.updated_at);
  const now = new Date();
  const cacheAgeMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);
  
  if (cacheAgeMinutes > 30) {
    return null; // Cache is stale
  }
  
  return data.activity_data as PullRequestActivity[];
}

/**
 * Store GitHub activity data in cache
 * @param repo - Repository name in owner/repo format
 * @param activities - Activity data to cache
 */
export async function cacheGitHubActivity(repo: string, activities: PullRequestActivity[]): Promise<void> {
  const { error } = await supabase
    .from('github_activities')
    .upsert(
      { 
        repo, 
        activity_data: activities,
        updated_at: new Date().toISOString()
      },
      { 
        onConflict: 'repo',
        ignoreDuplicates: false
      }
    );
  
  if (error) {
    console.error('Error caching GitHub activity data:', error);
  }
}