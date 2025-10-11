// Test function to verify OpenAI API key configuration
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check environment variables
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const viteOpenaiKey = Deno.env.get('VITE_OPENAI_API_KEY');

    const result = {
      OPENAI_API_KEY: {
        exists: !!openaiKey,
        startsWithSk: openaiKey?.startsWith('sk-') || false,
        length: openaiKey?.length || 0,
        preview: openaiKey ? `${openaiKey.substring(0, 10)}...` : 'NOT_FOUND',
      },
      VITE_OPENAI_API_KEY: {
        exists: !!viteOpenaiKey,
        startsWithSk: viteOpenaiKey?.startsWith('sk-') || false,
        length: viteOpenaiKey?.length || 0,
        preview: viteOpenaiKey ? `${viteOpenaiKey.substring(0, 10)}...` : 'NOT_FOUND',
      },
      availableEnvVars: Object.keys(Deno.env.toObject()).filter((k) =>
        k.includes('OPENAI') || k.includes('API_KEY')
      ),
    };

    // Test the API if key exists
    if (openaiKey || viteOpenaiKey) {
      const apiKey = openaiKey || viteOpenaiKey;

      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: 'Test embedding generation',
          }),
        });

        result.apiTest = {
          status: response.status,
          success: response.ok,
          error: !response.ok ? await response.text() : null,
        };

        if (response.ok) {
          const data = await response.json();
          result.apiTest.embeddingLength = data.data[0]?.embedding?.length;
        }
      } catch (error) {
        result.apiTest = {
          error: error.message,
        };
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
