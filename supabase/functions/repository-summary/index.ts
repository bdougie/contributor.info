import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
  body?: string;
}

interface Repository {
  id: string;
  full_name: string;
  description?: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
  recent_activity_hash?: string;
  summary_generated_at?: string;
}

// Create hash of recent activity for caching
function createActivityHash(pullRequests: PullRequest[]): string {
  const activityData = pullRequests
    .slice(0, 10) // Consider only the 10 most recent PRs
    .map((pr) => `${pr.number}-${pr.merged_at || pr.created_at}`)
    .join('|');

  return btoa(activityData); // Simple base64 encoding for hash
}

// Check if summary needs regeneration (14 days old or activity changed)
function needsRegeneration(repo: Repository, activityHash: string): boolean {
  if (!repo.summary_generated_at || !repo.recent_activity_hash) {
    return true;
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const generatedAt = new Date(repo.summary_generated_at);

  return generatedAt < fourteenDaysAgo || repo.recent_activity_hash !== activityHash;
}

// Humanize numbers (e.g., 27357 -> 27.4k)
function humanizeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

// Generate AI summary using OpenAI
async function generateAISummary(repo: Repository, pullRequests: PullRequest[]): Promise<string> {
  const recentMergedPRs = pullRequests.filter((pr) => pr.merged_at !== null).slice(0, 10); // Last 10 merged PRs

  const recentOpenPRs = pullRequests.filter((pr) => pr.state === 'open').slice(0, 5); // Current open PRs

  const formatPRList = (prs: PullRequest[]) => {
    return prs
      .map((pr) => {
        const prInfo = `#${pr.number}: ${pr.title}`;
        return pr.body ? `${prInfo}\n  ${pr.body.substring(0, 200)}...` : prInfo;
      })
      .join('\n');
  };

  const prompt = `Analyze this GitHub repository and provide a concise summary:

Repository: ${repo.full_name}
Description: ${repo.description || 'No description provided'}
Language: ${repo.language || 'Not specified'}
Stars: ${humanizeNumber(repo.stargazers_count)} | Forks: ${humanizeNumber(repo.forks_count)}

Recent Merged Pull Requests:
${formatPRList(recentMergedPRs)}

Current Open Pull Requests:
${formatPRList(recentOpenPRs)}

Provide a summary in 2-3 paragraphs using markdown formatting:

1. First paragraph (2-3 sentences): What this repository does, its main purpose, and key features based on the name, description, and overall activity patterns. When mentioning metrics, use the humanized format provided (e.g., "27.4k stars" not "27357 stars").

2. Second paragraph (1-2 sentences): Recent development activity, highlighting notable improvements or changes from the merged PRs.

3. Third paragraph (1-2 sentences): Start with "Current open pull requests suggest" and describe the current development focus areas based on open PRs.

Use inline code markdown (backticks) for repository names, technical terms, and feature names.
Keep it concise and informative for potential contributors.
Always use humanized numbers (1.2k, 5.7M) rather than full numbers when referring to metrics.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use cost-effective model for summaries
        messages: [
          {
            role: 'system',
            content:
              'You are a technical writer who creates concise, informative repository summaries for developers. Always format your response with proper markdown, using paragraphs for better readability. Use inline code formatting (backticks) for technical terms, repository names, and feature names.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 400, // Allow for better formatting with paragraphs
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Generate embedding using OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // Cost-effective embedding model
        input: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`OpenAI Embeddings API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Repository summary function started');

    if (!openaiApiKey) {
      console.error('OpenAI API key is not configured in environment');
      throw new Error('OpenAI API key is not configured');
    }

    const { repository, pullRequests, forceRegeneration = false } = await req.json();

    if (!repository || !repository.id) {
      throw new Error('Repository data is required');
    }

    console.log('Processing summary for %s', repository.full_name);

    // Create activity hash
    const activityHash = createActivityHash(pullRequests || []);

    // Check if regeneration is needed
    if (!forceRegeneration && !needsRegeneration(repository, activityHash)) {
      console.log('Using cached summary');
      return new Response(
        JSON.stringify({
          summary: repository.ai_summary,
          cached: true,
          generated_at: repository.summary_generated_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating new AI summary');

    // Generate new summary and embedding
    let summary: string;
    let embedding: number[] | null = null;

    try {
      summary = await generateAISummary(repository, pullRequests || []);
      console.log('AI summary generated successfully');
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      throw new Error(`AI summary generation failed: ${error.message}`);
    }

    try {
      embedding = await generateEmbedding(summary);
      console.log('Embedding generated successfully');
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Continue without embedding - it's not critical
      embedding = null;
    }

    // Update repository with new summary
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase environment variables not configured');
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const updateData: any = {
      ai_summary: summary,
      summary_generated_at: new Date().toISOString(),
      recent_activity_hash: activityHash,
    };

    // Only include embedding if it was generated successfully
    if (embedding) {
      updateData.embedding = `[${embedding.join(',')}]`; // Convert to PostgreSQL array format
    }

    const { error } = await supabase
      .from('repositories')
      .update(updateData)
      .eq('id', repository.id);

    if (error) {
      console.error('Database update error:', error);
      console.error('Update data:', updateData);
      throw new Error(`Failed to update repository summary: ${error.message}`);
    }

    console.log('Successfully generated and stored AI summary');

    return new Response(
      JSON.stringify({
        summary,
        cached: false,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Repository summary error:', error);
    console.error('Error stack:', error.stack);

    // Provide more detailed error information
    const errorDetails = {
      error: error.message,
      details: 'Failed to generate repository summary',
      timestamp: new Date().toISOString(),
      environment: {
        hasOpenAIKey: !!openaiApiKey,
        hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        hasSupabaseKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      },
    };

    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
