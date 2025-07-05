import { supabase } from './supabase';
import { fetchPullRequests } from './github';
import type { PullRequest } from './types';
import { trackDatabaseOperation, trackRateLimit } from './sentry/data-tracking';

/**
 * Fetch PR data from Supabase database first, fallback to GitHub API
 * This reduces rate limiting by using cached database data when available
 */
export async function fetchPRDataWithFallback(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<PullRequest[]> {
  
  let fallbackUsed = false;
  let cacheHit = false;
  
  return trackDatabaseOperation(
    'fetchPRDataWithFallback',
    async () => {
      // ALWAYS check database first and prefer it over API to avoid rate limiting
      
      try {
        // Calculate date range
        const days = parseInt(timeRange) || 30;
        const since = new Date();
        since.setDate(since.getDate() - days);


    // First, get the repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      // Fall through to GitHub API
      fallbackUsed = true;
    } else {
      cacheHit = true;
      // Now fetch PRs for this repository with contributor data
      const { data: dbPRs, error: dbError } = await supabase
        .from('pull_requests')
        .select(`
          id,
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
          commits,
          html_url,
          repository_id,
          author_id,
          contributors!fk_pull_requests_author(
            github_id,
            username,
            avatar_url,
            is_bot
          )
        `)
        .eq('repository_id', repoData.id)
        .order('created_at', { ascending: false })
        .limit(300); // Get up to 300 PRs from database

    if (dbError) {
    } else if (dbPRs && dbPRs.length > 0) {
      
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
          login: dbPR.contributors?.username || 'unknown',
          id: dbPR.contributors?.github_id || 0,
          avatar_url: dbPR.contributors?.avatar_url || '',
          type: dbPR.contributors?.is_bot ? 'Bot' : 'User'
        },
        base: {
          ref: dbPR.base_branch
        },
        head: {
          ref: dbPR.head_branch
        },
        additions: dbPR.additions || 0, // Note: may be 0 due to missing cached data
        deletions: dbPR.deletions || 0, // Note: may be 0 due to missing cached data
        changed_files: dbPR.changed_files || 0, // Note: may be 0 due to missing cached data
        commits: dbPR.commits || 0,
        html_url: dbPR.html_url || `https://github.com/${owner}/${repo}/pull/${dbPR.number}`,
        repository_owner: owner,
        repository_name: repo,
        reviews: [], // TODO: Fetch reviews separately if needed
        comments: [] // TODO: Fetch comments separately if needed
      }));

      // Filter by timeRange if needed
      const filteredPRs = transformedPRs.filter(pr => {
        const prDate = new Date(pr.created_at);
        return prDate >= since;
      });

      
      // During widespread rate limiting, use ANY database data we have
      // Only skip database data if it's completely empty or extremely old (30+ days)
      const latestPR = transformedPRs[0];
      if (latestPR) {
        const latestUpdate = new Date(latestPR.updated_at);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (latestUpdate > thirtyDaysAgo) {
          return filteredPRs.length > 0 ? filteredPRs : transformedPRs.slice(0, 100); // Return filtered or recent 100
        } else {
        }
      }

      // Store the database data for potential fallback
      if (transformedPRs.length > 0) {
        // We have database data - use it instead of risking API calls during rate limiting
        return filteredPRs.length > 0 ? filteredPRs : transformedPRs.slice(0, 100);
      }
    } else {
    }
    }
  } catch (error) {
  }

  // Fallback to GitHub API
  try {
    fallbackUsed = true;
    const githubPRs = await fetchPullRequests(owner, repo, timeRange);
    return githubPRs;
  } catch (githubError) {
    // Track rate limiting specifically
    if (githubError instanceof Error && 
        (githubError.message.includes('rate limit') || githubError.message.includes('403'))) {
      trackRateLimit('github', `repos/${owner}/${repo}/pulls`);
    }
    
    // As absolute last resort, try to get ANY data from database, even very old
    try {
      // Get repository ID again for emergency fallback
      const { data: emergencyRepoData } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (emergencyRepoData) {
        const { data: emergencyData } = await supabase
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
            commits,
            html_url,
            author_id,
            contributors!fk_pull_requests_author(
              github_id,
              username,
              avatar_url,
              is_bot
            )
          `)
          .eq('repository_id', emergencyRepoData.id)
          .order('created_at', { ascending: false })
          .limit(100);

      if (emergencyData && emergencyData.length > 0) {
        return emergencyData.map((dbPR: any) => ({
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
            login: dbPR.contributors?.username || 'unknown',
            id: dbPR.contributors?.github_id || 0,
            avatar_url: dbPR.contributors?.avatar_url || '',
            type: dbPR.contributors?.is_bot ? 'Bot' : 'User'
          },
          base: { ref: dbPR.base_branch },
          head: { ref: dbPR.head_branch },
          additions: dbPR.additions || 0, // Note: may be 0 due to missing cached data
          deletions: dbPR.deletions || 0, // Note: may be 0 due to missing cached data
          changed_files: dbPR.changed_files || 0, // Note: may be 0 due to missing cached data
          commits: dbPR.commits || 0,
          html_url: dbPR.html_url || `https://github.com/${owner}/${repo}/pull/${dbPR.number}`,
          repository_owner: owner,
          repository_name: repo,
          reviews: [],
          comments: []
        }));
      }
      }
    } catch (emergencyError) {
    }
    
    // If everything fails, throw the original GitHub error
    throw githubError;
  }
    },
    {
      operation: 'fetch',
      table: 'pull_requests',
      repository: `${owner}/${repo}`,
      fallbackUsed,
      cacheHit
    }
  );
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
    return false;
  }
}