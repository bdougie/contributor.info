import { createClient } from 'npm:@supabase/supabase-js@2.39.1';
import { corsHeaders } from '../_shared/cors.ts';

// Use OPENAI_API_KEY instead of VITE_ prefixed key for edge functions
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
    console.log('Function started - Processing request');

    // Log request method and headers for debugging
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const { pullRequests } = body;

    // Validate OpenAI API key with more specific error message
    if (!openaiApiKey) {
      console.error('OpenAI API key missing');
      throw new Error('OpenAI API key is not configured in the edge function environment. Please add OPENAI_API_KEY to your Supabase project settings.');
    }

    // Validate pull requests data
    if (!Array.isArray(pullRequests)) {
      console.error('Invalid pull requests data - not an array');
      throw new Error('Pull requests data must be an array');
    }

    if (pullRequests.length === 0) {
      console.error('No pull requests provided');
      throw new Error('No pull requests available for analysis');
    }

    console.log(`Processing ${pullRequests.length} pull requests`);

    // Separate open and merged PRs
    const openPRs = pullRequests.filter((pr: PullRequest) => pr.state === 'open');
    const mergedPRs = pullRequests.filter((pr: PullRequest) => pr.merged_at !== null);

    console.log(`Found ${openPRs.length} open PRs and ${mergedPRs.length} merged PRs`);

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

    console.log('Sending request to OpenAI API');

    try {
      // Call OpenAI API with improved error handling and timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log('OpenAI API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('OpenAI API error:', errorData);
        
        // Provide more specific error messages based on status codes
        let errorMessage = 'An error occurred while calling the OpenAI API';
        if (response.status === 401) {
          errorMessage = 'Invalid OpenAI API key. Please check your API key configuration.';
        } else if (response.status === 429) {
          errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
        } else if (response.status >= 500) {
          errorMessage = 'OpenAI API service is currently unavailable. Please try again later.';
        }
        
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }

      const data = await response.json();
      console.log('OpenAI API response received');
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('Invalid response format from OpenAI API:', data);
        throw new Error('Invalid response format from OpenAI API');
      }

      const insights = data.choices[0].message.content;
      console.log('Function completed successfully');

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
      if (error.name === 'AbortError') {
        throw new Error('OpenAI API request timed out after 30 seconds');
      }
      throw error;
    }
  } catch (error) {
    console.error('Edge function error:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    let status = 500;

    if (error.message.includes('API key')) {
      status = 401;
    } else if (error.message.includes('rate limit')) {
      status = 429;
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message
      }),
      {
        status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});