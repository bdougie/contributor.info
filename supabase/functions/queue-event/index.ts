import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client with service role for idempotency key management
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Inngest configuration from environment
// Use the correct Inngest endpoint: https://inn.gs/e/{EVENT_KEY}
const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY');

interface QueueEventRequest {
  eventName: string;
  data: Record<string, unknown>;
}

interface IdempotencyResponse {
  eventId?: string;
  success?: boolean;
  error?: string;
  duplicate?: boolean;
  cached?: boolean;
}

interface IdempotencyRecord {
  key: string;
  request_hash: string;
  response: IdempotencyResponse | null;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  expires_at: string;
  endpoint: string;
  user_id?: string;
  metadata: Record<string, unknown>;
}

/**
 * Generate a secure SHA-256 hash of the request for comparison
 */
async function generateRequestHash(
  eventName: string,
  data: Record<string, unknown>,
): Promise<string> {
  const content = JSON.stringify({ eventName, data });
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Check and handle idempotency for the request
 */
async function handleIdempotency(
  key: string,
  eventName: string,
  data: Record<string, unknown>,
  userId?: string,
): Promise<{ isDuplicate: boolean; response?: IdempotencyResponse }> {
  try {
    // First, check if this idempotency key already exists
    const { data: existing, error: fetchError } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected for new requests
      console.error('Error checking idempotency key:', fetchError);
      throw fetchError;
    }

    if (existing) {
      // Key exists, check the status
      if (existing.status === 'completed') {
        // Return cached response
        console.log('Returning cached response for idempotency key: %s', key);
        return { isDuplicate: true, response: existing.response };
      } else if (existing.status === 'processing') {
        // Request is still being processed
        throw new Error('Request is still being processed. Please try again later.');
      } else if (existing.status === 'failed') {
        // Previous attempt failed, allow retry by deleting the old record
        const { error: deleteError } = await supabase
          .from('idempotency_keys')
          .delete()
          .eq('key', key);

        if (deleteError) {
          console.error('Error deleting failed idempotency key:', deleteError);
        }
      }
    }

    // Create new idempotency record with processing status
    const requestHash = await generateRequestHash(eventName, data);
    const { error: insertError } = await supabase.from('idempotency_keys').insert({
      key,
      request_hash: requestHash,
      status: 'processing',
      endpoint: 'queue-event',
      user_id: userId,
      metadata: { eventName },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      // If insert fails due to race condition (duplicate key), fetch the existing record
      if (insertError.code === '23505') {
        // Unique constraint violation
        const { data: raceRecord } = await supabase
          .from('idempotency_keys')
          .select('*')
          .eq('key', key)
          .maybeSingle();

        if (raceRecord && raceRecord.status === 'completed') {
          return { isDuplicate: true, response: raceRecord.response };
        }
      }
      console.error('Error inserting idempotency key:', insertError);
      // Continue processing even if idempotency storage fails
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Idempotency handling error:', error);
    // Continue processing even if idempotency check fails
    return { isDuplicate: false };
  }
}

/**
 * Update the idempotency record with the result
 */
async function updateIdempotencyRecord(
  key: string,
  status: 'completed' | 'failed',
  response?: IdempotencyResponse,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('idempotency_keys')
      .update({
        status,
        response: response || null,
      })
      .eq('key', key);

    if (error) {
      console.error('Error updating idempotency record:', error);
    }
  } catch (error) {
    console.error('Failed to update idempotency record:', error);
  }
}

/**
 * Send event to Inngest
 */
async function sendToInngest(
  eventName: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!INNGEST_EVENT_KEY) {
    throw new Error('INNGEST_EVENT_KEY is not configured');
  }

  const response = await fetch(`https://inn.gs/e/${INNGEST_EVENT_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: eventName,
      data: data,
      ts: Date.now(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send event to Inngest: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: QueueEventRequest = await req.json();
    const { eventName, data } = body;

    if (!eventName || !data) {
      return new Response(JSON.stringify({ error: 'Missing eventName or data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get idempotency key from headers
    const idempotencyKey = req.headers.get('X-Idempotency-Key');

    // Get user ID from JWT if present
    const authHeader = req.headers.get('Authorization');
    let userId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id;
      } catch (error) {
        console.log('Could not extract user ID from token:', error);
      }
    }

    // Track duplicate attempts for monitoring
    let isDuplicateRequest = false;

    // Handle idempotency if key is provided
    if (idempotencyKey) {
      const { isDuplicate, response } = await handleIdempotency(
        idempotencyKey,
        eventName,
        data,
        userId,
      );

      if (isDuplicate && response) {
        // Return cached response for duplicate request
        isDuplicateRequest = true;
        console.log('Duplicate request detected for key: %s', idempotencyKey);

        return new Response(
          JSON.stringify({
            ...response,
            duplicate: true,
            cached: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Send event to Inngest
    let result;
    let eventId;
    try {
      result = await sendToInngest(eventName, data);
      const resultTyped = result as { ids?: string[]; id?: string; eventId?: string };
      eventId = resultTyped.ids?.[0] || resultTyped.id || resultTyped.eventId;

      // Update idempotency record with success
      if (idempotencyKey) {
        await updateIdempotencyRecord(idempotencyKey, 'completed', {
          eventId,
          success: true,
        });
      }
    } catch (error) {
      console.error('Failed to send event to Inngest:', error);

      // Update idempotency record with failure
      if (idempotencyKey) {
        await updateIdempotencyRecord(idempotencyKey, 'failed', {
          error: error.message,
        });
      }

      return new Response(
        JSON.stringify({ error: 'Failed to queue event', message: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Log successful queueing (for monitoring)
    console.log('Event queued successfully: %s', eventName, {
      eventId,
      idempotencyKey,
      isDuplicate: isDuplicateRequest,
      userId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        eventId,
        duplicate: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error processing request:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
