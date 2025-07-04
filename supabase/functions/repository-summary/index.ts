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
    .map(pr => `${pr.number}-${pr.merged_at || pr.created_at}`)
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

// Generate AI summary using OpenAI
async function generateAISummary(repo: Repository, pullRequests: PullRequest[]): Promise<string> {
  const recentMergedPRs = pullRequests
    .filter(pr => pr.merged_at !== null)
    .slice(0, 10); // Last 10 merged PRs
  
  const recentOpenPRs = pullRequests
    .filter(pr => pr.state === 'open')
    .slice(0, 5); // Current open PRs
  
  const formatPRList = (prs: PullRequest[]) => {
    return prs.map(pr => {
      const prInfo = `#${pr.number}: ${pr.title}`;
      return pr.body ? `${prInfo}\n  ${pr.body.substring(0, 200)}...` : prInfo;
    }).join('\n');
  };
  
  const prompt = `Analyze this GitHub repository and provide a concise summary:

Repository: ${repo.full_name}
Description: ${repo.description || 'No description provided'}
Language: ${repo.language || 'Not specified'}
Stars: ${repo.stargazers_count} | Forks: ${repo.forks_count}

Recent Merged Pull Requests:
${formatPRList(recentMergedPRs)}

Current Open Pull Requests:
${formatPRList(recentOpenPRs)}

Provide a 2-3 sentence summary that captures:
1. What this repository does (based on name, description, and recent activity)
2. Recent development activity and key improvements
3. Current focus areas based on open PRs

Keep it concise and informative for potential contributors.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use cost-effective model for summaries
        messages: [
          {
            role: 'system',
            content: 'You are a technical writer who creates concise, informative repository summaries for developers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300, // Keep summaries concise
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
        'Authorization': `Bearer ${openaiApiKey}`,
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
      throw new Error('OpenAI API key is not configured');
    }
    
    const { repository, pullRequests, forceRegeneration = false } = await req.json();
    
    if (!repository || !repository.id) {
      throw new Error('Repository data is required');
    }
    
    console.log(`Processing summary for ${repository.full_name}`);
    
    // Create activity hash
    const activityHash = createActivityHash(pullRequests || []);
    
    // Check if regeneration is needed
    if (!forceRegeneration && !needsRegeneration(repository, activityHash)) {
      console.log('Using cached summary');
      return new Response(
        JSON.stringify({
          summary: repository.ai_summary,
          cached: true,
          generated_at: repository.summary_generated_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Generating new AI summary');
    
    // Generate new summary and embedding
    const summary = await generateAISummary(repository, pullRequests || []);
    const embedding = await generateEmbedding(summary);
    
    // Update repository with new summary
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { error } = await supabase
      .from('repositories')
      .update({
        ai_summary: summary,
        embedding: `[${embedding.join(',')}]`, // Convert to PostgreSQL array format
        summary_generated_at: new Date().toISOString(),
        recent_activity_hash: activityHash
      })
      .eq('id', repository.id);
    
    if (error) {
      console.error('Database update error:', error);
      throw new Error('Failed to update repository summary');
    }
    
    console.log('Successfully generated and stored AI summary');
    
    return new Response(
      JSON.stringify({
        summary,
        cached: false,
        generated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Repository summary error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to generate repository summary'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});