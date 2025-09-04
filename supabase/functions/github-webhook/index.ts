import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { 
  detectPrivilegedEvent, 
  GitHubEvent,
  isBotAccount 
} from '../_shared/event-detection.ts'
import { 
  getContributorMetrics,
  calculateConfidenceScore,
  updateContributorRole 
} from '../_shared/confidence-scoring.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

// Process issue comment events for triager/first responder metrics
async function processIssueCommentEvent(supabase: any, event: GitHubEvent, owner: string, name: string) {
  try {
    // Get repository and issue from database
    const { data: repository } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', name)
      .maybeSingle()

    if (!repository) {
      console.log(`Repository ${owner}/${name} not found in database, skipping comment processing`)
      return
    }

    const { data: issue } = await supabase
      .from('issues')
      .select('id')
      .eq('github_id', event.payload.issue.id)
      .eq('repository_id', repository.id)
      .maybeSingle()

    if (!issue) {
      console.log(`Issue #${event.payload.issue.number} not found in database, skipping comment processing`)
      return
    }

    // Get or create commenter
    const commenter = event.payload.comment.user
    if (!commenter) return

    let commenterId: string | null = null
    const { data: existingContributor } = await supabase
      .from('contributors')
      .select('id')
      .eq('github_id', commenter.id)
      .maybeSingle()

    if (existingContributor) {
      commenterId = existingContributor.id
    } else {
      // Create new contributor
      const { data: newContributor } = await supabase
        .from('contributors')
        .insert({
          github_id: commenter.id,
          username: commenter.login,
          avatar_url: commenter.avatar_url,
          is_bot: commenter.type === 'Bot' || commenter.login.includes('[bot]'),
        })
        .select('id')
        .maybeSingle()

      commenterId = newContributor?.id || null
    }

    if (!commenterId) {
      console.error(`Failed to get or create commenter ${commenter.login}`)
      return
    }

    // Store the issue comment
    const { error } = await supabase
      .from('comments')
      .insert({
        github_id: event.payload.comment.id.toString(),
        repository_id: repository.id,
        issue_id: issue.id,
        commenter_id: commenterId,
        body: event.payload.comment.body,
        created_at: event.payload.comment.created_at,
        updated_at: event.payload.comment.updated_at,
        comment_type: 'issue_comment',
      })

    if (error && !error.message.includes('duplicate')) {
      console.error('Error storing issue comment:', error)
    } else {
      console.log(`Stored comment ${event.payload.comment.id} on issue #${event.payload.issue.number}`)
    }
  } catch (error) {
    console.error('Error processing issue comment event:', error)
  }
}


// Verify GitHub webhook signature
async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false

  const sigHashAlg = signature.startsWith('sha256=') ? signature.substring(7) : signature
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body)
  )
  
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return sigHashAlg === expectedSignature
}



serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookSecret = Deno.env.get('GITHUB_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // Verify signature
    const signature = req.headers.get('x-hub-signature-256')
    const body = await req.text()
    
    const isValid = await verifyWebhookSignature(body, signature, webhookSecret)
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(body) as GitHubEvent
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Store event in cache
    const [owner, name] = event.repo.name.split('/')
    const privilegedCheck = detectPrivilegedEvent(event)
    
    const { error: cacheError } = await supabase
      .from('github_events_cache')
      .insert({
        event_id: `${event.type}_${event.id}`,
        event_type: event.type,
        actor_login: event.actor.login,
        repository_owner: owner,
        repository_name: name,
        payload: event.payload,
        created_at: event.created_at,
        is_privileged: privilegedCheck.isPrivileged,
        processed: true,
        processed_at: new Date().toISOString(),
        processing_notes: privilegedCheck.detectionMethod
      })

    if (cacheError && !cacheError.message.includes('duplicate')) {
      console.error('Error caching event:', cacheError)
    }

    // TODO: Process issue comment events for triager/first responder metrics
    // Currently commented out as this webhook only works for contributor.info repo
    // For tracked repositories, issue comments should be captured via progressive capture system
    // See: https://github.com/bdougie/contributor.info/issues/263
    /*
    if (event.type === 'IssueCommentEvent' && 
        event.payload.action === 'created' &&
        !event.payload.issue?.pull_request) { // Only for actual issues, not PRs
      await processIssueCommentEvent(supabase, event, owner, name)
    }
    */

    // Update contributor role if privileged event
    if (privilegedCheck.isPrivileged && !isBotAccount(event.actor.login)) {
      // Get metrics and calculate confidence
      const metrics = await getContributorMetrics(supabase, event.actor.login, owner, name)
      if (metrics) {
        const confidenceScore = calculateConfidenceScore(metrics)
        await updateContributorRole(supabase, metrics, confidenceScore)
      }
    }

    // Update sync status
    await supabase
      .from('github_sync_status')
      .upsert({
        repository_owner: owner,
        repository_name: name,
        last_sync_at: new Date().toISOString(),
        last_event_at: event.created_at,
        sync_status: 'completed'
      }, {
        onConflict: 'repository_owner,repository_name'
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventType: event.type,
        isPrivileged: privilegedCheck.isPrivileged 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})