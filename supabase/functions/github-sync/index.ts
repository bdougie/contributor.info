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
      .single()

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
  const author = pr.user
  
  try {
    // First ensure the contributor exists
    const { data: contributor, error: contributorError } = await supabase
      .from('contributors')
      .upsert({
        github_id: author.id,
        username: author.login,
        display_name: author.login,
        avatar_url: author.avatar_url,
        profile_url: author.html_url,
        is_bot: author.type === 'Bot',
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (contributorError) {
      console.error(`[GitHub Sync] Error upserting contributor ${author.login}:`, contributorError)
      return
    }
    
    // Then create/update the pull request
    const { error: prError } = await supabase
      .from('pull_requests')
      .upsert({
        github_id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        repository_id: repositoryId,
        author_id: contributor.id,
        base_branch: pr.base?.ref || 'main',
        head_branch: pr.head?.ref || 'unknown',
        draft: pr.draft || false,
        merged: pr.merged || false,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        closed_at: pr.closed_at,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        html_url: pr.html_url
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
    
    if (prError) {
      console.error(`[GitHub Sync] Error upserting pull request #${pr.number}:`, prError)
    }
  } catch (error) {
    console.error(`[GitHub Sync] Error processing pull request #${pr.number}:`, error)
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
  const author = pr.user
  
  try {
    // First ensure the contributor exists
    const { data: contributor, error: contributorError } = await supabase
      .from('contributors')
      .upsert({
        github_id: author.id,
        username: author.login,
        display_name: author.login,
        avatar_url: author.avatar_url,
        profile_url: author.html_url,
        is_bot: author.type === 'Bot',
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (contributorError) {
      console.error(`[GitHub Sync] Error upserting contributor ${author.login}:`, contributorError)
      return
    }
    
    // Then create/update the pull request
    const { error: prError } = await supabase
      .from('pull_requests')
      .upsert({
        github_id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        repository_id: repositoryId,
        author_id: contributor.id,
        base_branch: pr.base?.ref || 'main',
        head_branch: pr.head?.ref || 'unknown',
        draft: pr.draft || false,
        merged: pr.merged || false,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        closed_at: pr.closed_at,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        html_url: pr.html_url
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
    
    if (prError) {
      console.error(`[GitHub Sync] Error upserting pull request #${pr.number}:`, prError)
    } else {
      console.log(`[GitHub Sync] Processed pull request #${pr.number} by ${author.login}`)
    }
  } catch (error) {
    console.error(`[GitHub Sync] Error processing pull request event:`, error)
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
    'PullRequestReviewEvent'
  ]
  
  console.log(`[GitHub Sync] Processing ${events.length} events for ${owner}/${repo}`)
  
  // First get the repository ID
  const { data: repoData } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .single()
  
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
      .single()

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
                .single()
              
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
          .single()

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
        
        // Update confidence scores for all contributors
        await batchUpdateConfidenceScores(supabase, repo.owner, repo.name)

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