import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  detectPrivilegedEvent,
  GitHubEvent
} from '../_shared/event-detection.ts'
import { 
  batchUpdateConfidenceScores 
} from '../_shared/confidence-scoring.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackfillRequest {
  repository_owner: string
  repository_name: string
  days_back?: number
  event_types?: string[]
}

// Fetch all events for a repository (up to GitHub's 90-day limit)
async function fetchAllRepositoryEvents(
  owner: string,
  repo: string,
  daysBack: number = 30
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

  const allEvents: GitHubEvent[] = []
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - Math.min(daysBack, 90)) // GitHub limits to 90 days

  let page = 1
  let hasMore = true
  const perPage = 100

  console.log(`Fetching events for ${owner}/${repo} from last ${daysBack} days`)

  while (hasMore && page <= 10) { // Limit to 10 pages (1000 events) per backfill
    const url = `https://api.github.com/repos/${owner}/${repo}/events?per_page=${perPage}&page=${page}`
    
    try {
      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        if (response.status === 404) {
          console.error(`Repository ${owner}/${repo} not found`)
          break
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const events = await response.json()
      
      if (events.length === 0) {
        hasMore = false
        break
      }

      // Filter events by date
      const filteredEvents = events.filter((event: GitHubEvent) => {
        const eventDate = new Date(event.created_at)
        return eventDate >= cutoffDate
      })

      allEvents.push(...filteredEvents)

      // Check if we've gone past our cutoff date
      const lastEventDate = new Date(events[events.length - 1].created_at)
      if (lastEventDate < cutoffDate) {
        hasMore = false
      }

      // Check rate limit
      const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0')
      if (remaining < 50) {
        console.warn(`Low rate limit: ${remaining} requests remaining`)
        hasMore = false
      }

      // If we got less than a full page, we're done
      if (events.length < perPage) {
        hasMore = false
      }

      page++
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error)
      throw error
    }
  }

  console.log(`Fetched ${allEvents.length} events for ${owner}/${repo}`)
  return allEvents
}

// Process and store events
async function processBackfillEvents(
  supabase: any,
  events: GitHubEvent[],
  owner: string,
  repo: string,
  eventTypes?: string[]
) {
  let processed = 0
  let privilegedCount = 0
  const errors: string[] = []

  for (const event of events) {
    // Filter by event type if specified
    if (eventTypes && eventTypes.length > 0 && !eventTypes.includes(event.type)) {
      continue
    }

    try {
      const eventId = `${event.type}_${event.id}`
      
      // Check if event already exists
      const { data: existing } = await supabase
        .from('github_events_cache')
        .select('id')
        .eq('event_id', eventId)
        .single()

      if (existing) {
        continue // Skip duplicates
      }

      // Detect privileged events
      const privilegedCheck = detectPrivilegedEvent(event)

      // Store event
      const { error } = await supabase
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

      if (error) {
        errors.push(`Failed to insert event ${eventId}: ${error.message}`)
        continue
      }

      processed++
      if (privilegedCheck.isPrivileged) {
        privilegedCount++
      }
    } catch (error) {
      errors.push(`Error processing event: ${error.message}`)
    }
  }

  return {
    processed,
    privilegedCount,
    errors
  }
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
    const body: BackfillRequest = await req.json()
    const { repository_owner, repository_name, days_back = 30, event_types } = body

    if (!repository_owner || !repository_name) {
      return new Response(
        JSON.stringify({ error: 'repository_owner and repository_name are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Starting backfill for ${repository_owner}/${repository_name}`)

    // Update sync status
    await supabase
      .from('github_sync_status')
      .upsert({
        repository_owner,
        repository_name,
        sync_status: 'in_progress',
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'repository_owner,repository_name'
      })

    // Fetch all events
    const events = await fetchAllRepositoryEvents(
      repository_owner,
      repository_name,
      days_back
    )

    // Process events
    const result = await processBackfillEvents(
      supabase,
      events,
      repository_owner,
      repository_name,
      event_types
    )

    // Update all confidence scores
    console.log('Updating confidence scores...')
    await batchUpdateConfidenceScores(supabase, repository_owner, repository_name)

    // Update sync status
    await supabase
      .from('github_sync_status')
      .upsert({
        repository_owner,
        repository_name,
        sync_status: 'completed',
        last_sync_at: new Date().toISOString(),
        events_processed: result.processed,
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null
      }, {
        onConflict: 'repository_owner,repository_name'
      })

    // Get final statistics
    const { data: roleStats } = await supabase
      .from('contributor_roles')
      .select('role')
      .eq('repository_owner', repository_owner)
      .eq('repository_name', repository_name)

    const roleCounts = roleStats?.reduce((acc: any, curr: any) => {
      acc[curr.role] = (acc[curr.role] || 0) + 1
      return acc
    }, {}) || {}

    return new Response(
      JSON.stringify({ 
        success: true,
        repository: `${repository_owner}/${repository_name}`,
        events_fetched: events.length,
        events_processed: result.processed,
        privileged_events: result.privilegedCount,
        days_back,
        role_distribution: roleCounts,
        errors: result.errors.length > 0 ? result.errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Backfill error:', error)
    
    // Try to update sync status with error
    try {
      const { repository_owner, repository_name } = await req.json()
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase
        .from('github_sync_status')
        .upsert({
          repository_owner,
          repository_name,
          sync_status: 'failed',
          error_message: error.message
        }, {
          onConflict: 'repository_owner,repository_name'
        })
    } catch (e) {
      // Ignore errors updating status
    }

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