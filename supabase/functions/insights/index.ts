import { createClient } from 'npm:@supabase/supabase-js@2.39.1';
import { corsHeaders } from '../_shared/cors.ts';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface PullRequest {
  title: string;
  state: string;
  created_at: string;
  merged_at: string | null;
  number: number;
  html_url: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pullRequests } = await req.json();

    if (!openaiApiKey) {
      throw new Error('OpenAI API key is not configured. Please check your environment variables.');
    }

    if (!Array.isArray(pullRequests) || pullRequests.length === 0) {
      throw new Error('No pull requests provided for analysis');
    }

    // Separate open and merged PRs
    const openPRs = pullRequests.filter((pr: PullRequest) => pr.state === 'open');
    const mergedPRs = pullRequests.filter((pr: PullRequest) => pr.merged_at !== null);

    // Format PRs for the prompt
    const formatPRList = (prs: PullRequest[]) => {
      return prs.map(pr => `#${pr.number}: ${pr.title} (${pr.html_url})`).join('\n');
    };

    const prompt = `Analyze these GitHub Pull Requests and provide insights:

Open Pull Requests:
${formatPRList(openPRs)}

Recently Merged Pull Requests:
${formatPRList(mergedPRs.slice(0, 5))}

Provide a markdown-formatted analysis that includes:
1. Summary of features in progress (from open PRs)
2. Summary of recently completed work (from merged PRs)
3. Identify any patterns or trends
4. Highlight any potential areas of focus

Format the response in clear markdown sections.`;

    // Call OpenAI API with improved error handling
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert software development analyst. Analyze GitHub pull requests and provide clear, actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || response.statusText;
      throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI API');
    }

    const insights = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ insights }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Edge function error:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Failed to connect to OpenAI API. Please check your network connection and API key configuration.';
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message // Include original error for debugging
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});