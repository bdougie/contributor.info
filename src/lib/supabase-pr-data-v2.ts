import { supabase } from './supabase';
import { fetchPullRequests } from './github';
import type { PullRequest } from './types';
import { trackDatabaseOperation, trackRateLimit } from './simple-logging';
import { 
  createSuccessResult, 
  createNoDataResult,
  createPartialDataResult,
  type DataResult 
} from './errors/repository-errors';
import { getFetchStrategy, calculateFetchWindow, shouldUseCachedData } from './fetch-strategies';
import { RepositorySize } from './validation/database-schemas';
import { sendInngestEvent } from './inngest/client-safe';
import { trackFetchStart, trackFetchEnd } from './telemetry/fetch-performance';

interface TrackedRepositoryInfo {
  id: string;
  repository_id: string;
  size: RepositorySize | null;
  priority: 'high' | 'medium' | 'low' | null;
  size_calculated_at: string | null;
}

/**
 * Smart PR data fetching with size-based strategies
 * No hardcoded protection - all repositories are accessible with appropriate limits
 */
export async function fetchPRDataWithSmartStrategy(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<DataResult<PullRequest[]>> {
  
  
  const repoName = `${owner}/${repo}`;
  const fetchId = trackFetchStart(repoName);
  
  return trackDatabaseOperation(
    'fetchPRDataWithSmartStrategy',
    async () => {
      const requestedDays = parseInt(timeRange) || 30;
      
      try {
        // Step 1: Get repository info including size classification
        const { data: trackedRepo } = await supabase
          .from('tracked_repositories')
          .select('id, repository_id, size, priority, size_calculated_at')
          .eq('organization_name', owner)
          .eq('repository_name', repo)
          .maybeSingle() as { data: TrackedRepositoryInfo | null; error: any };

        // Get repository ID (fallback to repositories table if not tracked)
        let repositoryId: string | null = null;
        let repoSize: RepositorySize | null = null;
        
        if (trackedRepo) {
          repositoryId = trackedRepo.repository_id;
          repoSize = trackedRepo.size;
          
          // Trigger classification if not done yet
          if (!repoSize && trackedRepo.id) {
            sendInngestEvent({
              name: 'classify/repository.single',
              data: {
                repositoryId: trackedRepo.id,
                owner,
                repo
              }
            }).catch(err => console._error('Failed to enqueue classification job:', err)); // Fire and forget
          }
        } else {
          // Fallback to direct repository lookup
          const { data: repoData } = await supabase
            .from('repositories')
            .select('id')
            .eq('owner', owner)
            .eq('name', repo)
            .maybeSingle();
            
          if (repoData) {
            repositoryId = repoData.id;
          }
        }

        // Step 2: Get fetch strategy based on size
        const strategy = getFetchStrategy(repoSize);
        const { since, days: effectiveDays } = calculateFetchWindow(strategy, requestedDays);

        // Step 3: Try to get cached data first
        if (repositoryId) {
          
          const { data: dbPRs, error: _error: dbError } = await supabase
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
            .eq('repository_id', repositoryId)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(strategy.maxPRsCache);

          if (!dbError && dbPRs && dbPRs.length > 0) {
            const transformedPRs = transformDatabasePRs(dbPRs, owner, repo);
            
            // Check cache freshness
            const latestPR = transformedPRs[0];
            const cacheAge = latestPR ? new Date(latestPR.updated_at) : null;
            
            if (shouldUseCachedData(cacheAge, strategy)) {
              // Cache is fresh enough - return it
              const cacheAgeHours = cacheAge ? (Date.now() - cacheAge.getTime()) / (1000 * 60 * 60) : undefined;
              trackFetchEnd(fetchId, repoName, repoSize, 'cache', transformedPRs.length, true, false, cacheAgeHours);
              return createSuccessResult(transformedPRs);
            } else {
              // Cache is stale but we have some data
              
              // For large/XL repos with stale cache, trigger background update
              if (strategy.triggerCapture && trackedRepo?.id) {
                sendInngestEvent({
                  name: 'capture/repository.sync.graphql',
                  data: {
                    repositoryId: trackedRepo.id,
                    days: effectiveDays,
                    priority: strategy.capturePriority,
                    reason: 'stale_cache'
                  }
                }).catch(err => console._error('Failed to enqueue stale cache background sync:', err));
              }
              
              // Return partial data for XL repos to avoid rate limits
              if (repoSize === 'xl') {
                const cacheAgeHours = cacheAge ? (Date.now() - cacheAge.getTime()) / (1000 * 60 * 60) : undefined;
                trackFetchEnd(fetchId, repoName, repoSize, 'partial', transformedPRs.length, true, true, cacheAgeHours);
                return createPartialDataResult(
                  `${owner}/${repo}`,
                  transformedPRs,
                  'Using cached data to prevent rate limiting. Fresh data is being fetched in the background.'
                );
              }
            }
          }
        }

        // Step 4: Fetch live data based on strategy
        
        // For XL repos with no cache, fetch minimal data
        if (repoSize === 'xl') {
          const minimalPRs = await fetchPullRequests(
            owner, 
            repo, 
            Math.min(3, effectiveDays).toString(), // Max 3 days for XL repos without cache
            strategy.maxPRsLive
          );
          
          // Trigger full background capture
          if (strategy.triggerCapture && trackedRepo?.id) {
            sendInngestEvent({
              name: 'capture/repository.sync.graphql',
              data: {
                repositoryId: trackedRepo.id,
                days: requestedDays,
                priority: 'critical',
                reason: 'no_cache_xl_repo'
              }
            }).catch(err => console._error('Failed to enqueue background capture for XL repo:', err));
          }
          
          trackFetchEnd(fetchId, repoName, repoSize, 'partial', minimalPRs.length, false, true);
          return createPartialDataResult(
            `${owner}/${repo}`,
            minimalPRs,
            'Showing recent data only. Full history is being fetched in the background.'
          );
        }
        
        // For other repos, fetch based on strategy
        const githubPRs = await fetchPullRequests(
          owner, 
          repo, 
          effectiveDays.toString(),
          strategy.maxPRsLive
        );
        
        // Trigger background capture for more data if needed
        if (strategy.triggerCapture && trackedRepo?.id && effectiveDays < requestedDays) {
          sendInngestEvent({
            name: 'capture/repository.sync.graphql',
            data: {
              repositoryId: trackedRepo.id,
              days: requestedDays,
              priority: strategy.capturePriority,
              reason: 'partial_time_range'
            }
          }).catch(err => console._error('Failed to enqueue partial time range background capture:', err));
        }
        
        trackFetchEnd(fetchId, repoName, repoSize, 'live', githubPRs.length, false, strategy.triggerCapture && effectiveDays < requestedDays);
        return createSuccessResult(githubPRs);
        
      } catch (_error) {
        // Handle rate limiting
        if (error instanceof Error && 
            (_error.message.includes('rate limit') || error.message.includes('403'))) {
          trackRateLimit('github', `repos/${owner}/${repo}/pulls`);
          
          // Try emergency cache fallback
          try {
            const { data: emergencyRepo } = await supabase
              .from('repositories')
              .select('id')
              .eq('owner', owner)
              .eq('name', repo)
              .maybeSingle();

            if (emergencyRepo) {
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
                .eq('repository_id', emergencyRepo.id)
                .order('created_at', { ascending: false })
                .limit(100);

              if (emergencyData && emergencyData.length > 0) {
                const emergencyPRs = transformDatabasePRs(emergencyData, owner, repo);
                trackFetchEnd(fetchId, repoName, null, 'emergency', emergencyPRs.length, true, false);
                return createPartialDataResult(
                  `${owner}/${repo}`,
                  emergencyPRs,
                  'Rate limited. Showing cached data while waiting for API access.'
                );
              }
            }
          } catch (emergencyError) {
            console.error('Emergency cache fallback failed:', emergencyError);
          }
        }
        
        console.error('Data fetching error:', {
          repository: `${owner}/${repo}`,
          timeRange,
          error: error instanceof Error ? error.message : String(_error)
        });
        
        trackFetchEnd(fetchId, repoName, null, 'emergency', 0, false, false, undefined, error instanceof Error ? error.message : 'Unknown _error');
        return createNoDataResult(`${owner}/${repo}`, []);
      }
    },
    {
      operation: 'fetch',
      table: 'pull_requests',
      repository: `${owner}/${repo}`,
      timeRange: timeRange
    }
  );
}

/**
 * Transform database PR records to PullRequest format
 */
function transformDatabasePRs(
  dbPRs: unknown[], 
  owner: string, 
  repo: string
): PullRequest[] {
  return dbPRs.map((dbPR: unknown) => ({
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
    additions: dbPR.additions || 0,
    deletions: dbPR.deletions || 0,
    changed_files: dbPR.changed_files || 0,
    commits: dbPR.commits || 0,
    html_url: dbPR.html_url || `https://github.com/${owner}/${repo}/pull/${dbPR.number}`,
    repository_owner: owner,
    repository_name: repo,
    reviews: (dbPR.reviews || []).map((review: unknown) => ({
      id: review.github_id,
      state: review.state,
      body: review.body,
      submitted_at: review.submitted_at,
      user: {
        login: review.contributors?.username || 'unknown',
        avatar_url: review.contributors?.avatar_url || ''
      }
    })),
    comments: (dbPR.comments || []).map((comment: unknown) => ({
      id: comment.github_id,
      body: comment.body,
      created_at: comment.created_at,
      user: {
        login: comment.contributors?.username || 'unknown',
        avatar_url: comment.contributors?.avatar_url || ''
      }
    }))
  }));
}

/**
 * Export the new function as the default fetch function
 * This will gradually replace fetchPRDataWithFallback
 */
export { fetchPRDataWithSmartStrategy as fetchPRData };