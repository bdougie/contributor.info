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