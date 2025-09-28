import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface PurgeResult {
  purged: {
    file_contributors: number;
    file_embeddings: number;
  };
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString();

    console.log('Purging file data older than %s', cutoffDateStr);

    // Purge old file contributors data
    const {
      data: contributorsData,
      error: contributorsError,
      count: contributorsCount,
    } = await supabase
      .from('file_contributors')
      .delete()
      .lt('last_commit_at', cutoffDateStr)
      .select('id', { count: 'exact', head: true });

    if (contributorsError) {
      console.error('Error purging file contributors:', contributorsError);
      throw contributorsError;
    }

    // Purge old file embeddings data
    const {
      data: embeddingsData,
      error: embeddingsError,
      count: embeddingsCount,
    } = await supabase
      .from('file_embeddings')
      .delete()
      .lt('last_indexed_at', cutoffDateStr)
      .select('id', { count: 'exact', head: true });

    if (embeddingsError) {
      console.error('Error purging file embeddings:', embeddingsError);
      throw embeddingsError;
    }

    // Also clean up orphaned PR insights older than 30 days
    const { error: insightsError } = await supabase
      .from('pr_insights')
      .delete()
      .lt('generated_at', cutoffDateStr);

    if (insightsError) {
      console.error('Error purging PR insights:', insightsError);
      // Don't throw, this is less critical
    }

    const result: PurgeResult = {
      purged: {
        file_contributors: contributorsCount || 0,
        file_embeddings: embeddingsCount || 0,
      },
    };

    console.log('Purge complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in purge function:', error);

    const errorResult: PurgeResult = {
      purged: {
        file_contributors: 0,
        file_embeddings: 0,
      },
      error: error.message || 'Unknown error occurred',
    };

    return new Response(JSON.stringify(errorResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
