import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import { Configuration, OpenAIApi } from 'npm:openai@4.28.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PullRequest {
  title: string;
  description?: string;
  state: string;
  created_at: string;
  merged_at?: string;
  number: number;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const { pullRequests, type } = await req.json();

    // Initialize OpenAI
    const openai = new OpenAIApi(
      new Configuration({
        apiKey: openaiKey,
      })
    );

    // Filter PRs based on type (open or merged)
    const filteredPRs = pullRequests.filter((pr: PullRequest) => 
      type === 'open' ? pr.state === 'open' : pr.merged_at !== null
    );

    if (filteredPRs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: `No ${type} pull requests found to analyze.`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create PR summaries for context
    const prSummaries = filteredPRs.map((pr: PullRequest) => `
      #${pr.number}: ${pr.title}
      ${pr.description ? `Description: ${pr.description}\n` : ''}
      State: ${pr.state}
      Created: ${new Date(pr.created_at).toLocaleDateString()}
      ${pr.merged_at ? `Merged: ${new Date(pr.merged_at).toLocaleDateString()}` : ''}
      URL: ${pr.url}
    `).join('\n\n');

    // Generate insights using GPT-4
    const prompt = type === 'open' 
      ? `Analyze these open pull requests and provide insights about features in progress. Focus on identifying themes, potential impacts, and development patterns. Format the response in markdown:\n\n${prSummaries}`
      : `Analyze these recently merged pull requests and summarize the completed features and improvements. Focus on identifying themes, impacts, and development patterns. Format the response in markdown:\n\n${prSummaries}`;

    const completion = await openai.createChatCompletion({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer and technical analyst. Provide clear, concise insights about pull requests in markdown format. Focus on technical impact, patterns, and business value.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const insights = completion.data.choices[0].message?.content || 'No insights generated.';

    return new Response(
      JSON.stringify({ insights }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});