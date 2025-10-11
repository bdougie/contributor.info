import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const inngestApiUrl = Deno.env.get('INNGEST_API_URL') || 'https://inn.gs/e';
    const inngestEventKey = Deno.env.get('INNGEST_EVENT_KEY');

    if (!inngestEventKey || inngestEventKey === 'local_development_only') {
      return new Response(
        JSON.stringify({
          error: 'Inngest event key not configured',
          note: 'Function will run automatically every 15 minutes via cron',
        }),
        { status: 500 },
      );
    }

    // Send event to Inngest
    const response = await fetch(`${inngestApiUrl}/${inngestEventKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'embeddings/compute.requested',
        data: {},
        ts: Date.now(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inngest API error: ${response.status} - ${text}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Embeddings computation triggered',
        inngest_response: result,
        check_status: 'SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 1;',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});
