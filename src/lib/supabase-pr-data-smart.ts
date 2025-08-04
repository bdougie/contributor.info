import { supabase } from './supabase';
import type { PullRequest } from './types';
import { trackDatabaseOperation } from './simple-logging';
import { 
  createSuccessResult,
  createNoDataResult,
  createPendingDataResult,
  type DataResult 
} from './errors/repository-errors';
import { sendInngestEvent } from './inngest/client-safe';
import { toast } from 'sonner';

interface FetchOptions {
  timeRange?: string;
  triggerBackgroundSync?: boolean;
  showNotifications?: boolean;
}

/**
 * Smart database-first PR data fetcher
 * 
 * This replaces the problematic fetchPRDataWithFallback by:
 * 1. Always returning available data immediately (even if stale)
 * 2. Never attempting risky GitHub API calls for large repos
 * 3. Triggering background sync when data is missing/stale
 * 4. Providing clear status information to the UI
 * 
 * Philosophy: Show what we have, fetch what we need in background
 */
export async function fetchPRDataSmart(
  owner: string,
  repo: string,
  options: FetchOptions = {}
): Promise<DataResult<PullRequest[]>> {
  const {
    timeRange = '30',
    triggerBackgroundSync = true,
    showNotifications = false
  } = options;

  return trackDatabaseOperation(
    'fetchPRDataSmart',
    async () => {
      // Calculate date range
      const days = parseInt(timeRange) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Check if repository exists
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .select('id, owner, name, updated_at')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (repoError || !repoData) {
        // Repository not in database - it needs to be tracked first
        if (triggerBackgroundSync) {
          // Add to tracking (handled by useRepositoryDiscovery)
          if (showNotifications) {
            toast.info(`Setting up ${owner}/${repo}...`, {
              description: "We're gathering data for this repository. This usually takes 1-2 minutes.",
              duration: 6000
            });
          }
        }
        
        return createPendingDataResult(
          `${owner}/${repo}`,
          [],
          'This repository is being set up. Data will be available in 1-2 minutes.'
        );
      }

      // Fetch PRs from database
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
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500); // Reasonable limit for UI display

      if (dbError) {
        console.error('Database error fetching PRs:', dbError);
        return createNoDataResult(`${owner}/${repo}`, []);
      }

      // Transform data
      const transformedPRs: PullRequest[] = (dbPRs || []).map((dbPR: any) => ({
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

      // Check data freshness
      const isEmpty = transformedPRs.length === 0;
      
      // Check if repository data is stale (older than 6 hours)
      const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours
      const now = Date.now();
      const lastUpdateMs = repoData.updated_at ? new Date(repoData.updated_at).getTime() : 0;
      const isRepositoryStale = (now - lastUpdateMs) > STALE_THRESHOLD_MS;
      
      const isStale = isEmpty || isRepositoryStale;

      // Trigger background sync if needed
      if (triggerBackgroundSync && (isEmpty || isStale)) {
        try {
          await sendInngestEvent({
            name: 'capture/repository.sync',
            data: {
              owner,
              repo,
              priority: isEmpty ? 'high' : 'medium',
              source: 'smart-fetch-stale-data'
            }
          });

          if (showNotifications && isEmpty) {
            toast.info(`Getting familiar with ${owner}/${repo}...`, {
              description: "We're fetching the latest data. Check back in a minute!",
              duration: 5000
            });
          }
        } catch (error) {
          console.error('Failed to trigger background sync:', error);
        }
      }

      // Always return data if we have it
      if (transformedPRs.length > 0) {
        return createSuccessResult(transformedPRs, {
          isStale,
          lastUpdate: repoData.updated_at,
          dataCompleteness: calculateDataCompleteness(transformedPRs)
        });
      }

      // No data yet - return pending state
      return createPendingDataResult(
        `${owner}/${repo}`,
        [],
        isEmpty ? 'Data is being gathered. This usually takes 1-2 minutes.' : 'No recent pull requests found.'
      );
    },
    {
      operation: 'fetch',
      table: 'pull_requests',
      repository: `${owner}/${repo}`,
      strategy: 'smart-database-first'
    }
  );
}

/**
 * Calculate how complete the data is (reviews, comments, etc)
 */
function calculateDataCompleteness(prs: PullRequest[]): number {
  if (prs.length === 0) return 0;

  let totalScore = 0;
  let prCount = 0;

  for (const pr of prs.slice(0, 20)) { // Sample first 20 PRs
    let score = 0.5; // Base score for having PR data
    
    // Check for reviews
    if (pr.reviews && pr.reviews.length > 0) {
      score += 0.25;
    }
    
    // Check for comments
    if (pr.comments && pr.comments.length > 0) {
      score += 0.25;
    }
    
    totalScore += score;
    prCount++;
  }

  return Math.round((totalScore / prCount) * 100);
}

/**
 * Check if repository has any data at all
 */
export async function hasAnyPRData(owner: string, repo: string): Promise<boolean> {
  try {
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (!repoData) return false;

    const { count } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', repoData.id);

    return (count || 0) > 0;
  } catch (error) {
    return false;
  }
}