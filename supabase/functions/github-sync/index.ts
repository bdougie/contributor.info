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
  since?: string
): Promise<GitHubEvent[]> {
  const token = Deno.env.get('GITHUB_TOKEN')
  if (!token) {
    throw new Error('GitHub token not configured')
  }

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

  for (const event of events) {
    // Skip non-privileged event types early
    if (!privilegedEventTypes.includes(event.type)) continue

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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request body
    const body = await req.json().catch(() => ({}))
    const { repository, owner } = body

    let repositories: Repository[] = []

    if (repository && owner) {
      // Sync specific repository
      repositories = [{ owner, name: repository }]
    } else {
      // Sync all tracked repositories
      repositories = await getRepositoriesToSync(supabase)
    }

    const results = []

    for (const repo of repositories) {
      try {
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
            last_sync_at: new Date().toISOString()
          }, {
            onConflict: 'repository_owner,repository_name'
          })

        // Fetch events
        const events = await fetchGitHubEvents(
          repo.owner, 
          repo.name, 
          syncStatus?.last_event_at
        )

        // Process events
        await processEvents(supabase, events, repo.owner, repo.name)
        
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