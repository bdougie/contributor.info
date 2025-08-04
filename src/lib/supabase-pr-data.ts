import { supabase } from './supabase';
import type { PullRequest } from './types';
import { trackDatabaseOperation, trackRateLimit } from './simple-logging';
import { 
  createLargeRepositoryResult, 
  createSuccessResult, 
  createNoDataResult,
  createPendingDataResult,
  type DataResult 
} from './errors/repository-errors';
// Removed Sentry import - using simple logging instead

/**
 * Fetch PR data from Supabase database first, fallback to GitHub API
 * This reduces rate limiting by using cached database data when available
 * Returns a DataResult with status information for proper error handling
 */
export async function fetchPRDataWithFallback(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<DataResult<PullRequest[]>> {
  
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
          contributors:author_id(
            github_id,
            username,
            avatar_url,
            is_bot
          ),
          reviews(
            id,
            github_id,
            state,
            body,
            submitted_at,
            contributors:reviewer_id(
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
            contributors:commenter_id(
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
          type: (dbPR.contributors?.is_bot ? 'Bot' : 'User') as 'Bot' | 'User'
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
          body: review.body,
          submitted_at: review.submitted_at,
          user: {
            login: review.contributors?.username || 'unknown',
            avatar_url: review.contributors?.avatar_url || ''
          }
        })),
        comments: (dbPR.comments || []).map((comment: any) => ({
          id: comment.github_id,
          body: comment.body,
          created_at: comment.created_at,
          user: {
            login: comment.contributors?.username || 'unknown',
            avatar_url: comment.contributors?.avatar_url || ''
          }
        }))
      }));

      // Log data quality for debugging
      if (process.env.NODE_ENV === 'development') {
        const totalReviews = transformedPRs.reduce((total, pr) => total + (pr.reviews?.length || 0), 0);
        const totalComments = transformedPRs.reduce((total, pr) => total + (pr.comments?.length || 0), 0);
        console.log(`🔍 [DB] Fetched ${transformedPRs.length} PRs with ${totalReviews} reviews and ${totalComments} comments for ${owner}/${repo}`);
        
        if (transformedPRs.length > 5 && totalReviews === 0 && totalComments === 0) {
          console.warn(`⚠️ [DB] Repository ${owner}/${repo} has ${transformedPRs.length} PRs but no reviews/comments data. Consider running progressive data capture.`);
        }
      }

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
          const dataToReturn = filteredPRs.length > 0 ? filteredPRs : transformedPRs.slice(0, 100);
          return createSuccessResult(dataToReturn);
        } else {
        }
      }

      // Store the database data for potential fallback
      if (transformedPRs.length > 0) {
        // We have database data - use it instead of risking API calls during rate limiting
        const dataToReturn = filteredPRs.length > 0 ? filteredPRs : transformedPRs.slice(0, 100);
        return createSuccessResult(dataToReturn);
      }
    } else {
    }
    }
  } catch (error) {
  }

  // Fallback to GitHub API - STRICTLY LIMITED to prevent resource exhaustion
  // Only fetch basic repository info, never attempt to fetch all PRs for unknown repos
  try {
    // List of known large repositories that should NEVER use API fallback
    const protectedRepos = [
      'kubernetes/kubernetes', 
      'microsoft/vscode', 
      'pytorch/pytorch',
      'tensorflow/tensorflow',
      'apache/spark',
      'elastic/elasticsearch',
      'facebook/react',
      'angular/angular',
      'nodejs/node',
      'torvalds/linux'
    ];
    const repoName = `${owner}/${repo}`;
    
    // Never attempt API fallback for known large repositories
    if (protectedRepos.some(repo => repoName.toLowerCase().includes(repo.toLowerCase()))) {
      // Check if we have cached data before applying protection
      try {
        const { data: repoData, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .single();

        if (!repoError && repoData) {
          const { data: cachedPRs, error: cacheError } = await supabase
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
              contributors:author_id(
                github_id,
                username,
                avatar_url,
                is_bot
              )
            `)
            .eq('repository_id', repoData.id)
            .order('created_at', { ascending: false })
            .limit(200);

          if (!cacheError && cachedPRs && cachedPRs.length > 0) {
            // We have cached data - apply protection and return it
            const transformedPRs: PullRequest[] = cachedPRs.map((dbPR: any) => ({
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
                type: (dbPR.contributors?.is_bot ? 'Bot' : 'User') as 'Bot' | 'User'
              },
              base: { ref: dbPR.base_branch },
              head: { ref: dbPR.head_branch },
              additions: dbPR.additions || 0,
              deletions: dbPR.deletions || 0,
              changed_files: dbPR.changed_files || 0,
              commits: dbPR.commits || 0,
              html_url: dbPR.html_url || `https://github.com/${owner}/${repo}/pull/${dbPR.number}`,
              repository_owner: owner,
              repository_name: repo,
              reviews: [],
              comments: []
            }));

            const days = parseInt(timeRange) || 30;
            const since = new Date();
            since.setDate(since.getDate() - days);
            
            const filteredPRs = transformedPRs.filter(pr => {
              const prDate = new Date(pr.created_at);
              return prDate >= since;
            });

            return createLargeRepositoryResult(repoName, filteredPRs);
          }
        }
      } catch (cacheError) {
        // Silent fallback - continue to API if cache fails
      }
      
      // No cached data available - continue to normal API flow below
      // This prevents showing empty arrays when we could get fresh data
    }
    
    // NEW APPROACH: Never fetch all PRs via API for untracked repositories
    // This prevents timeouts and rate limit issues
    // Instead, return a pending state and let background processing handle it
    
    console.log(`Repository ${owner}/${repo} not in database. Skipping API fallback to prevent timeouts.`);
    
    // Trigger background sync instead of risky API call
    try {
      const { inngest } = await import('./inngest/client');
      await inngest.send({
        name: 'capture/repository.sync',
        data: {
          owner,
          repo,
          priority: 'high',
          source: 'missing-repo-fallback'
        }
      });
    } catch (error) {
      console.error('Failed to trigger background sync:', error);
    }
    
    return createPendingDataResult(
      repoName,
      [],
      'This repository needs to be set up first. We\'re working on it - check back in 1-2 minutes!'
    );
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
            contributors:author_id(
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
        const emergencyPRs = emergencyData.map((dbPR: any) => ({
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
            type: (dbPR.contributors?.is_bot ? 'Bot' : 'User') as 'Bot' | 'User'
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
        
        return createSuccessResult(emergencyPRs);
      }
      }
    } catch (emergencyError) {
    }
    
    // If everything fails, return no data result instead of throwing
    console.error('All data fetching methods failed:', githubError);
    
    // Simple error logging without analytics
    console.error('Complete data fetching failure:', {
      repository: `${owner}/${repo}`,
      timeRange,
      fallbackUsed,
      cacheHit,
      originalError: (githubError instanceof Error ? githubError.message : String(githubError)) || 'Unknown error'
    });
    
    return createNoDataResult(`${owner}/${repo}`, []);
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

// Re-export the new smart strategy function
export { fetchPRDataWithSmartStrategy } from './supabase-pr-data-v2';