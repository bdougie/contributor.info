import { supabase } from './supabase';
import { fetchPullRequests } from './github';
import type { PullRequest } from './types';

/**
 * Fetch PR data from Supabase database first, fallback to GitHub API
 * This reduces rate limiting by using cached database data when available
 */
export async function fetchPRDataWithFallback(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<PullRequest[]> {
  try {
    // Calculate date range
    const days = parseInt(timeRange) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    console.log(`[PR Data] Attempting to fetch ${owner}/${repo} data from database first...`);

    // First, try to get data from Supabase
    const { data: dbPRs, error: dbError } = await supabase
      .from('pull_requests')
      .select(`
        github_id,
        number,
        title,
        body,
        state,
        created_at,
        updated_at,
        closed_at,
        merged_at,
        merged,
        base_branch,
        head_branch,
        additions,
        deletions,
        changed_files,
        commits_count,
        html_url,
        repositories!inner(owner, name),
        contributors!pull_requests_author_id_fkey(
          username,
          display_name,
          avatar_url,
          github_id,
          is_bot
        )
      `)
      .eq('repositories.owner', owner)
      .eq('repositories.name', repo)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (dbError) {
      console.warn(`[PR Data] Database query failed: ${dbError.message}`);
    } else if (dbPRs && dbPRs.length > 0) {
      console.log(`[PR Data] Found ${dbPRs.length} PRs in database for ${owner}/${repo}`);
      
      // Transform database data to match GitHub API format
      const transformedPRs: PullRequest[] = dbPRs.map((dbPR: any) => ({
        id: dbPR.github_id,
        number: dbPR.number,
        title: dbPR.title,
        body: dbPR.body,
        state: dbPR.state,
        created_at: dbPR.created_at,
        updated_at: dbPR.updated_at,
        closed_at: dbPR.closed_at,
        merged_at: dbPR.merged_at,
        merged: dbPR.merged,
        user: {
          login: dbPR.contributors.username,
          id: dbPR.contributors.github_id,
          avatar_url: dbPR.contributors.avatar_url,
          type: dbPR.contributors.is_bot ? 'Bot' : 'User'
        },
        base: {
          ref: dbPR.base_branch
        },
        head: {
          ref: dbPR.head_branch
        },
        additions: dbPR.additions || 0,
        deletions: dbPR.deletions || 0,
        changed_files: dbPR.changed_files || 0,
        commits: dbPR.commits_count || 0,
        html_url: dbPR.html_url || `https://github.com/${owner}/${repo}/pull/${dbPR.number}`,
        repository_owner: owner,
        repository_name: repo,
        // Additional fields that might be needed
        reviews: [],
        comments: []
      }));

      // Check if data is recent enough (within last 6 hours)
      const latestPR = transformedPRs[0];
      if (latestPR) {
        const latestUpdate = new Date(latestPR.updated_at);
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        
        if (latestUpdate > sixHoursAgo) {
          console.log(`[PR Data] Using recent database data for ${owner}/${repo}`);
          return transformedPRs;
        } else {
          console.log(`[PR Data] Database data is stale (${latestUpdate.toISOString()}), falling back to GitHub API`);
        }
      } else {
        console.log(`[PR Data] No recent database data, falling back to GitHub API`);
      }
    } else {
      console.log(`[PR Data] No database data found for ${owner}/${repo}, falling back to GitHub API`);
    }
  } catch (error) {
    console.warn(`[PR Data] Database query error:`, error);
  }

  // Fallback to GitHub API
  console.log(`[PR Data] Fetching fresh data from GitHub API for ${owner}/${repo}...`);
  try {
    const githubPRs = await fetchPullRequests(owner, repo, timeRange);
    console.log(`[PR Data] Successfully fetched ${githubPRs.length} PRs from GitHub API`);
    return githubPRs;
  } catch (githubError) {
    console.error(`[PR Data] GitHub API also failed:`, githubError);
    
    // Last resort: return any database data we have, even if stale
    try {
      const { data: fallbackPRs } = await supabase
        .from('pull_requests')
        .select(`
          github_id,
          number,
          title,
          body,
          state,
          created_at,
          updated_at,
          closed_at,
          merged_at,
          merged,
          base_branch,
          head_branch,
          additions,
          deletions,
          changed_files,
          commits_count,
          html_url,
          repositories!inner(owner, name),
          contributors!pull_requests_author_id_fkey(
            username,
            display_name,
            avatar_url,
            github_id,
            is_bot
          )
        `)
        .eq('repositories.owner', owner)
        .eq('repositories.name', repo)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fallbackPRs && fallbackPRs.length > 0) {
        console.log(`[PR Data] Using stale database data as last resort: ${fallbackPRs.length} PRs`);
        // Transform the data (same as above)
        return fallbackPRs.map((dbPR: any) => ({
          id: dbPR.github_id,
          number: dbPR.number,
          title: dbPR.title,
          body: dbPR.body,
          state: dbPR.state,
          created_at: dbPR.created_at,
          updated_at: dbPR.updated_at,
          closed_at: dbPR.closed_at,
          merged_at: dbPR.merged_at,
          merged: dbPR.merged,
          user: {
            login: dbPR.contributors.username,
            id: dbPR.contributors.github_id,
            avatar_url: dbPR.contributors.avatar_url,
            type: dbPR.contributors.is_bot ? 'Bot' : 'User'
          },
          base: { ref: dbPR.base_branch },
          head: { ref: dbPR.head_branch },
          additions: dbPR.additions || 0,
          deletions: dbPR.deletions || 0,
          changed_files: dbPR.changed_files || 0,
          commits: dbPR.commits_count || 0,
          html_url: dbPR.html_url || `https://github.com/${owner}/${repo}/pull/${dbPR.number}`,
          repository_owner: owner,
          repository_name: repo,
          reviews: [],
          comments: []
        }));
      }
    } catch (fallbackError) {
      console.error(`[PR Data] Fallback database query also failed:`, fallbackError);
    }

    // If everything fails, throw the original GitHub error
    throw githubError;
  }
}

/**
 * Check if a repository has recent data in the database
 */
export async function hasRecentPRData(
  owner: string,
  repo: string,
  maxAgeHours: number = 6
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('pull_requests')
      .select('updated_at')
      .eq('repositories.owner', owner)
      .eq('repositories.name', repo)
      .gte('updated_at', cutoff.toISOString())
      .limit(1);

    return !error && data && data.length > 0;
  } catch (error) {
    console.warn(`[PR Data] Error checking for recent data:`, error);
    return false;
  }
}