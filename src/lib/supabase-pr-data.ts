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
  console.log(`[PR Data] Starting fallback fetch for ${owner}/${repo}`);
  
  // ALWAYS check database first and prefer it over API to avoid rate limiting
  try {
    // First, get the repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      console.log(`[PR Data] Repository not found in database: ${owner}/${repo}`);
      // Fall through to GitHub API
    } else {
      // Now fetch PRs for this repository with contributor data, reviews, and comments
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
          contributors!pull_requests_contributor_id_fkey(
            github_id,
            username,
            avatar_url,
            is_bot
          ),
          reviews(
            id,
            github_id,
            state,
            submitted_at,
            reviewer:contributors!reviews_reviewer_id_fkey(
              github_id,
              username,
              avatar_url,
              is_bot
            )
          ),
          comments(
            id,
            github_id,
            body,
            created_at,
            comment_type,
            commenter:contributors!comments_commenter_id_fkey(
              github_id,
              username,
              avatar_url,
              is_bot
            )
          )
        `)
        .eq('repository_id', repoData.id)
        .order('created_at', { ascending: false })
        .limit(300); // Get up to 300 PRs from database

    if (dbError) {
      console.error(`[PR Data] Database query failed:`, dbError);
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
        reviews: (dbPR.reviews || []).map((review: any) => ({
          id: review.github_id,
          state: review.state,
          user: {
            login: review.reviewer?.username || 'unknown',
            avatar_url: review.reviewer?.avatar_url || ''
          },
          submitted_at: review.submitted_at
        })),
        comments: (dbPR.comments || []).map((comment: any) => ({
          id: comment.github_id,
          user: {
            login: comment.commenter?.username || 'unknown',
            avatar_url: comment.commenter?.avatar_url || ''
          },
          created_at: comment.created_at,
          body: comment.body
        }))
      }));

      // Filter by timeRange if needed
      const days = parseInt(timeRange) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const filteredPRs = transformedPRs.filter(pr => {
        const prDate = new Date(pr.created_at);
        return prDate >= since;
      });

      console.log(`[PR Data] Filtered to ${filteredPRs.length} PRs within ${days} days for ${owner}/${repo}`);
      
      // Check for data quality issues
      const prsWithFileChanges = transformedPRs.filter(pr => pr.additions > 0 || pr.deletions > 0).length;
      if (prsWithFileChanges === 0 && transformedPRs.length > 0) {
        console.warn(`[PR Data] Data quality issue: ${transformedPRs.length} PRs found but none have file change data (additions/deletions)`);
      }
      
      // During widespread rate limiting, use ANY database data we have
      // Only skip database data if it's completely empty or extremely old (30+ days)
      const latestPR = transformedPRs[0];
      if (latestPR) {
        const latestUpdate = new Date(latestPR.updated_at);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (latestUpdate > thirtyDaysAgo) {
          console.log(`[PR Data] Using database data for ${owner}/${repo} (updated: ${latestUpdate.toISOString()}, age: ${Math.round((Date.now() - latestUpdate.getTime()) / (1000 * 60 * 60 * 24))} days)`);
          return filteredPRs.length > 0 ? filteredPRs : transformedPRs.slice(0, 100); // Return filtered or recent 100
        } else {
          console.log(`[PR Data] Database data is very old (${latestUpdate.toISOString()}), will attempt GitHub API as last resort`);
        }
      }

      // Store the database data for potential fallback
      if (transformedPRs.length > 0) {
        // We have database data - use it instead of risking API calls during rate limiting
        console.log(`[PR Data] Using available database data to avoid potential rate limiting for ${owner}/${repo}`);
        return filteredPRs.length > 0 ? filteredPRs : transformedPRs.slice(0, 100);
      }
    } else {
      console.log(`[PR Data] No database data found for ${owner}/${repo}`);
    }
    }
  } catch (error) {
    console.warn(`[PR Data] Database query error:`, error);
  }

  // If we reach here, we have no database data - only then try GitHub API
  console.log(`[PR Data] No database data available, attempting GitHub API for ${owner}/${repo} (high risk of rate limiting)`);
  
  try {
    const githubPRs = await fetchPullRequests(owner, repo, timeRange);
    console.log(`[PR Data] Successfully fetched ${githubPRs.length} PRs from GitHub API`);
    return githubPRs;
  } catch (githubError) {
    console.error(`[PR Data] GitHub API failed (likely rate limited):`, githubError);
    
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
            contributors!pull_requests_contributor_id_fkey(
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
        console.log(`[PR Data] Using emergency fallback database data: ${emergencyData.length} PRs`);
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
      console.error(`[PR Data] Emergency fallback also failed:`, emergencyError);
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