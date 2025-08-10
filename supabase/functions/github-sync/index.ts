import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  detectPrivilegedEvent,
  GitHubEvent,
  detectMaintainerPatterns
} from '../_shared/event-detection.ts'
import { 
  batchUpdateConfidenceScores 
} from '../_shared/confidence-scoring.ts'
import { 
  processPRWithSpamDetection, 
  batchProcessPRsForSpam 
} from '../_shared/spam-detection-integration.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Repository {
  owner: string
  name: string
  last_sync_at?: string
}

// Fetch events from GitHub API
async function fetchGitHubEvents(
  owner: string, 
  repo: string, 
  since?: string,
  userToken?: string
): Promise<GitHubEvent[]> {
  console.log(`[GitHub Sync] Fetching events for ${owner}/${repo}`)
  console.log(`[GitHub Sync] User token provided: ${!!userToken}`)
  console.log(`[GitHub Sync] GITHUB_TOKEN env var exists: ${!!Deno.env.get('GITHUB_TOKEN')}`)
  
  // Use user token if provided, otherwise fall back to system token
  const token = userToken || Deno.env.get('GITHUB_TOKEN')
  if (!token) {
    console.error('[GitHub Sync] No GitHub token available - neither user token nor GITHUB_TOKEN env var')
    throw new Error('GitHub token not configured. Please log in with GitHub to analyze repositories.')
  }
  
  console.log(`[GitHub Sync] Using token type: ${userToken ? 'user' : 'system'}`)

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Contributor-Info-Bot'
  }

  const events: GitHubEvent[] = []
  let page = 1
  const perPage = 100

  while (page <= 3) { // Limit to 3 pages (300 events) per sync
    const url = `https://api.github.com/repos/${owner}/${repo}/events?per_page=${perPage}&page=${page}`
    
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error(`Repository ${owner}/${repo} not found`)
        return []
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const pageEvents = await response.json()
    
    if (pageEvents.length === 0) break

    // Filter events if we have a since timestamp
    const filteredEvents = since
      ? pageEvents.filter((e: GitHubEvent) => new Date(e.created_at) > new Date(since))
      : pageEvents

    events.push(...filteredEvents)

    // Check rate limit
    const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0')
    if (remaining < 100) {
      console.warn(`Low rate limit: ${remaining} requests remaining`)
      break
    }

    // If we got less than a full page, we're done
    if (pageEvents.length < perPage) break
    
    page++
  }

  return events
}

// Fetch pull requests directly from GitHub API
async function fetchAndProcessPullRequests(
  supabase: any,
  owner: string,
  repo: string,
  userToken?: string
) {
  const token = userToken || Deno.env.get('GITHUB_TOKEN')
  if (!token) {
    console.log('[GitHub Sync] No token available for fetching pull requests')
    return
  }

  try {
    // Get repository ID first
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle()

    if (!repoData) {
      console.error(`[GitHub Sync] Repository ${owner}/${repo} not found`)
      return
    }

    console.log(`[GitHub Sync] Fetching pull requests for ${owner}/${repo}`)

    // Fetch recent pull requests (last 30 days worth)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    let page = 1
    let hasMore = true
    let totalProcessed = 0

    while (hasMore && page <= 3) { // Limit to 3 pages
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${page}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })

      if (!response.ok) {
        console.error(`[GitHub Sync] Failed to fetch pull requests: ${response.status}`)
        break
      }

      const prs = await response.json()
      
      if (prs.length === 0) {
        hasMore = false
        break
      }

      // Filter to recent PRs
      const recentPRs = prs.filter(pr => new Date(pr.updated_at) >= thirtyDaysAgo)
      
      console.log(`[GitHub Sync] Processing ${recentPRs.length} recent PRs from page ${page}`)

      for (const pr of recentPRs) {
        await processPullRequestData(supabase, pr, repoData.id)
        totalProcessed++
      }

      // If we got less than a full page or no recent PRs, we're done
      if (prs.length < 100 || recentPRs.length === 0) {
        hasMore = false
      } else {
        page++
      }
    }

    console.log(`[GitHub Sync] Processed ${totalProcessed} pull requests for ${owner}/${repo}`)
  } catch (error) {
    console.error(`[GitHub Sync] Error fetching pull requests:`, error)
  }
}

// Process a single pull request from GitHub API
async function processPullRequestData(
  supabase: any,
  pr: any,
  repositoryId: string
) {
  try {
    // Fetch detailed PR data to get additions, deletions, and changed_files
    // The /pulls endpoint doesn't include these stats, we need the individual PR endpoint
    const github_token = Deno.env.get('GITHUB_TOKEN')
    if (!github_token) {
      console.error('[GitHub Sync] GITHUB_TOKEN not found')
      return
    }
    
    const detailedResponse = await fetch(`https://api.github.com/repos/${pr.base.repo.owner.login}/${pr.base.repo.name}/pulls/${pr.number}`, {
      headers: {
        'Authorization': `token ${github_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    
    if (detailedResponse.ok) {
      const detailedPR = await detailedResponse.json()
      // Merge the detailed stats into the original PR object
      pr.additions = detailedPR.additions || 0
      pr.deletions = detailedPR.deletions || 0
      pr.changed_files = detailedPR.changed_files || 0
      pr.commits = detailedPR.commits || 0
      
      console.log(`[GitHub Sync] Enhanced PR #${pr.number} with stats: +${pr.additions}/-${pr.deletions}, ${pr.changed_files} files`)
    } else {
      console.warn(`[GitHub Sync] Failed to fetch detailed PR data for #${pr.number}: ${detailedResponse.status}`)
      // Set defaults if we can't fetch detailed data
      pr.additions = 0
      pr.deletions = 0
      pr.changed_files = 0
      pr.commits = 0
    }
  } catch (error) {
    console.error(`[GitHub Sync] Error fetching detailed PR data for #${pr.number}:`, error)
    // Set defaults on error
    pr.additions = 0
    pr.deletions = 0
    pr.changed_files = 0
    pr.commits = 0
  }
  
  // Use the spam detection version (will use singleton internally)
  const result = await processPRWithSpamDetection(supabase, pr, repositoryId);
  
  if (!result.success) {
    console.error(`[GitHub Sync] Error processing pull request #${pr.number}:`, result.error);
  }
}

// Process a single PullRequestEvent to create/update pull request records
async function processPullRequestEvent(
  supabase: any,
  event: GitHubEvent,
  repositoryId: string,
  owner: string,
  repo: string
) {
  const pr = event.payload.pull_request
  
  try {
    // Fetch detailed PR data to get additions, deletions, and changed_files
    // Event payloads don't include these stats, we need the individual PR endpoint
    const github_token = Deno.env.get('GITHUB_TOKEN')
    if (github_token) {
      const detailedResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`, {
        headers: {
          'Authorization': `token ${github_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      if (detailedResponse.ok) {
        const detailedPR = await detailedResponse.json()
        // Merge the detailed stats into the original PR object
        pr.additions = detailedPR.additions || 0
        pr.deletions = detailedPR.deletions || 0
        pr.changed_files = detailedPR.changed_files || 0
        pr.commits = detailedPR.commits || 0
        
        console.log(`[GitHub Sync] Enhanced PR event #${pr.number} with stats: +${pr.additions}/-${pr.deletions}, ${pr.changed_files} files`)
      } else {
        console.warn(`[GitHub Sync] Failed to fetch detailed PR data for event #${pr.number}: ${detailedResponse.status}`)
        // Set defaults if we can't fetch detailed data
        pr.additions = 0
        pr.deletions = 0
        pr.changed_files = 0
        pr.commits = 0
      }
    }
  } catch (error) {
    console.error(`[GitHub Sync] Error fetching detailed PR data for event #${pr.number}:`, error)
    // Set defaults on error
    pr.additions = 0
    pr.deletions = 0
    pr.changed_files = 0
    pr.commits = 0
  }
  
  // Use the spam detection version (will use singleton internally)
  const result = await processPRWithSpamDetection(supabase, pr, repositoryId);
  
  if (!result.success) {
    console.error(`[GitHub Sync] Error processing pull request event:`, result.error);
  } else {
    console.log(`[GitHub Sync] Processed pull request #${pr.number} by ${pr.user.login} - Spam Score: ${result.spamResult?.spam_score}`);
  }
}

// Process events and update roles
async function processEvents(
  supabase: any, 
  events: GitHubEvent[], 
  owner: string, 
  repo: string
) {
  const privilegedEventTypes = [
    'PullRequestEvent',
    'PushEvent',
    'ReleaseEvent',
    'IssuesEvent',
    'PullRequestReviewEvent',
    'WatchEvent',                 // Star events - for contributor confidence
    'ForkEvent',                  // Fork events - for contributor confidence
    'IssueCommentEvent',          // Issue comments - for engagement confidence
    'PullRequestReviewCommentEvent', // PR review comments - for engagement confidence
    'CommitCommentEvent'          // Commit comments - for engagement confidence
  ]
  
  console.log(`[GitHub Sync] Processing ${events.length} events for ${owner}/${repo}`)
  
  // First get the repository ID
  const { data: repoData } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle()
  
  if (!repoData) {
    console.error(`[GitHub Sync] Repository ${owner}/${repo} not found in database`)
    return
  }
  
  const repositoryId = repoData.id

  for (const event of events) {
    // Skip non-privileged event types early
    if (!privilegedEventTypes.includes(event.type)) continue
    
    // Process PullRequestEvent to create/update pull request records
    if (event.type === 'PullRequestEvent' && event.payload?.pull_request) {
      await processPullRequestEvent(supabase, event, repositoryId, owner, repo)
    }

    // Check if event already exists
    const eventId = `${event.type}_${event.id}`
    const { data: existing } = await supabase
      .from('github_events_cache')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existing) continue // Skip duplicates

    // Use shared detection logic
    const privilegedCheck = detectPrivilegedEvent(event)

    // Store event
    await supabase
      .from('github_events_cache')
      .insert({
        event_id: eventId,
        event_type: event.type,
        actor_login: event.actor.login,
        repository_owner: owner,
        repository_name: repo,
        payload: event.payload,
        created_at: event.created_at,
        is_privileged: privilegedCheck.isPrivileged,
        processed: true,
        processed_at: new Date().toISOString(),
        processing_notes: privilegedCheck.detectionMethod || null
      })
  }
}


// Get repositories to sync
async function getRepositoriesToSync(supabase: any): Promise<Repository[]> {
  // For now, we'll sync all tracked repositories
  // In the future, this could be filtered by sync schedule
  const { data, error } = await supabase
    .from('tracked_repositories')
    .select('owner:organization_name, name:repository_name')
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching repositories:', error)
    return []
  }

  return data || []
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[GitHub Sync] Received sync request')

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request body
    const body = await req.json().catch(() => ({}))
    const { repository, owner, github_token } = body
    
    console.log('[GitHub Sync] Request body:', { 
      repository, 
      owner, 
      hasGithubToken: !!github_token 
    })

    let repositories: Repository[] = []

    if (repository && owner) {
      // Sync specific repository
      console.log(`[GitHub Sync] Syncing specific repository: ${owner}/${repository}`)
      repositories = [{ owner, name: repository }]
    } else {
      // Sync all tracked repositories
      console.log('[GitHub Sync] Syncing all tracked repositories')
      repositories = await getRepositoriesToSync(supabase)
    }

    const results = []

    for (const repo of repositories) {
      try {
        console.log(`[GitHub Sync] Processing repository: ${repo.owner}/${repo.name}`)
        
        // First, fetch repository details from GitHub
        const token = github_token || Deno.env.get('GITHUB_TOKEN')
        if (token) {
          try {
            const repoResponse = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            })
            
            if (repoResponse.ok) {
              const githubRepo = await repoResponse.json()
              
              // Upsert repository with all required fields
              const { data: repoData, error: repoError } = await supabase
                .from('repositories')
                .upsert({
                  github_id: githubRepo.id,
                  full_name: githubRepo.full_name,
                  owner: githubRepo.owner.login,
                  name: githubRepo.name,
                  description: githubRepo.description,
                  homepage: githubRepo.homepage,
                  language: githubRepo.language,
                  stargazers_count: githubRepo.stargazers_count,
                  watchers_count: githubRepo.watchers_count,
                  forks_count: githubRepo.forks_count,
                  open_issues_count: githubRepo.open_issues_count,
                  size: githubRepo.size,
                  default_branch: githubRepo.default_branch,
                  is_fork: githubRepo.fork,
                  is_private: githubRepo.private,
                  is_archived: githubRepo.archived,
                  github_created_at: githubRepo.created_at,
                  github_updated_at: githubRepo.updated_at,
                  github_pushed_at: githubRepo.pushed_at,
                  last_updated_at: new Date().toISOString(),
                  is_active: true
                }, {
                  onConflict: 'github_id',
                  ignoreDuplicates: false
                })
                .select()
                .maybeSingle()
              
              if (repoError) {
                console.error(`[GitHub Sync] Error upserting repository: ${repoError.message}`)
              } else {
                console.log(`[GitHub Sync] Repository upserted successfully: ${repoData?.id}`)
              }
            } else {
              console.error(`[GitHub Sync] Failed to fetch repository details: ${repoResponse.status}`)
            }
          } catch (error) {
            console.error(`[GitHub Sync] Error fetching repository details: ${error.message}`)
          }
        }
        
        // Get last sync time
        const { data: syncStatus } = await supabase
          .from('github_sync_status')
          .select('last_event_at')
          .eq('repository_owner', repo.owner)
          .eq('repository_name', repo.name)
          .maybeSingle()

        // Update sync status to in_progress
        await supabase
          .from('github_sync_status')
          .upsert({
            repository_owner: repo.owner,
            repository_name: repo.name,
            sync_status: 'in_progress',
            last_sync_at: new Date().toISOString(),
            error_message: null  // Clear any previous error
          }, {
            onConflict: 'repository_owner,repository_name'
          })

        // Fetch events
        const events = await fetchGitHubEvents(
          repo.owner, 
          repo.name, 
          syncStatus?.last_event_at,
          github_token
        )

        // Process events
        await processEvents(supabase, events, repo.owner, repo.name)
        
        // Fetch and process pull requests directly from GitHub API
        await fetchAndProcessPullRequests(supabase, repo.owner, repo.name, github_token)
        
        // Batch process existing PRs for spam detection (for PRs that might not have spam scores)
        const { data: repoData } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', repo.owner)
          .eq('name', repo.name)
          .maybeSingle()
          
        if (repoData) {
          console.log(`[GitHub Sync] Running batch spam detection for existing PRs in ${repo.owner}/${repo.name}`)
          const { processed, errors } = await batchProcessPRsForSpam(supabase, repoData.id, 50) // Process 50 at a time
          console.log(`[GitHub Sync] Spam detection complete: ${processed} processed, ${errors} errors`)
        }
        
        // Update confidence scores for all contributors
        await batchUpdateConfidenceScores(supabase, repo.owner, repo.name)
        
        // Invalidate confidence cache since we have new data
        await invalidateRepositoryConfidenceCache(supabase, repo.owner, repo.name)

        // Update sync status
        const lastEventAt = events.length > 0 
          ? events[0].created_at 
          : syncStatus?.last_event_at

        await supabase
          .from('github_sync_status')
          .upsert({
            repository_owner: repo.owner,
            repository_name: repo.name,
            sync_status: 'completed',
            last_sync_at: new Date().toISOString(),
            last_event_at: lastEventAt,
            events_processed: events.length
          }, {
            onConflict: 'repository_owner,repository_name'
          })

        results.push({
          repository: `${repo.owner}/${repo.name}`,
          events_processed: events.length,
          status: 'success'
        })

      } catch (error) {
        console.error(`Error syncing ${repo.owner}/${repo.name}:`, error)
        
        // Update sync status with error
        await supabase
          .from('github_sync_status')
          .upsert({
            repository_owner: repo.owner,
            repository_name: repo.name,
            sync_status: 'failed',
            error_message: error.message
          }, {
            onConflict: 'repository_owner,repository_name'
          })

        results.push({
          repository: `${repo.owner}/${repo.name}`,
          status: 'error',
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        repositories_synced: results.length,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Invalidate confidence cache when new data is synced
async function invalidateRepositoryConfidenceCache(
  supabase: any,
  owner: string,
  repo: string
) {
  try {
    const { error } = await supabase
      .from('repository_confidence_cache')
      .delete()
      .eq('repository_owner', owner)
      .eq('repository_name', repo)
    
    if (error) {
      console.warn(`[GitHub Sync] Error invalidating confidence cache for ${owner}/${repo}:`, error)
    } else {
      console.log(`[GitHub Sync] Invalidated confidence cache for ${owner}/${repo}`)
    }
  } catch (error) {
    console.warn('[GitHub Sync] Error invalidating confidence cache:', error)
  }
}