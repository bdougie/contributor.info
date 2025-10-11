// Supabase Edge Function: codeowners-llm
// Uses OPENAI_API_KEY configured in Supabase project (Dashboard -> Edge Functions -> Secrets)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type ContributorStats = {
  username: string;
  contributions: number;
  files: string[];
  directories: string[]; // Sent from client as array for portability
};

interface RequestBody {
  owner: string;
  repo: string;
  contributors: ContributorStats[];
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('', {
        status: 200,
        headers: corsHeaders(),
      });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const { owner, repo, contributors }: RequestBody = await req.json();
    if (!owner || !repo || !Array.isArray(contributors)) {
      return json({ error: 'Missing owner, repo or contributors' }, 400);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return json({ error: 'OPENAI_API_KEY not configured in Supabase' }, 500);
    }

    const contribStr = contributors
      .slice(0, 50)
      .map((c) => `${c.username}(${c.contributions}) -> [${c.directories.slice(0, 8).join(', ')}]`) // brief
      .join('; ');

    const prompt = `You are generating CODEOWNERS suggestions for ${owner}/${repo}.
Based on contributor activity by directory, propose up to 10 patterns with @user owners.
Output only lines like: /path/ @owner1 @owner2 # reasoning (confidence: 80%)
Be concise, prefer stable directories.

Contributors by directories: ${contribStr}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at generating CODEOWNERS suggestions.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return json({ error: 'OpenAI error', details: text }, 502);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    console.error('Error in codeowners-llm function:', e);
    return json({ error: 'An unexpected error occurred' }, 500);
  }
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}
