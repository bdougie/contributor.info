import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: {
    login: string;
    avatar_url: string;
  };
  requested_reviewers: Array<{
    login: string;
    avatar_url: string;
  }>;
  requested_teams: Array<{
    name: string;
  }>;
  reviews?: Array<{
    user: {
      login: string;
      avatar_url: string;
    };
    state: string;
    submitted_at: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { owner, repo, workspace_id } = await req.json();

    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Missing owner or repo parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get GitHub token from environment or user's stored token
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch open PRs from GitHub
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!githubResponse.ok) {
      throw new Error(`GitHub API error: ${githubResponse.status}`);
    }

    const prs: GitHubPR[] = await githubResponse.json();

    // Process each PR
    const results = await Promise.all(prs.map(async (pr) => {
      try {
        // Fetch detailed PR data with reviews
        const detailResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
          {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );

        let reviews = [];
        if (detailResponse.ok) {
          reviews = await detailResponse.json();
        }

        // Transform data for our schema
        const transformedPR = {
          github_id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state === 'open' ? 'open' : 'closed',
          draft: pr.draft || false,
          repository_owner: owner,
          repository_name: repo,
          author: {
            username: pr.user.login,
            avatar_url: pr.user.avatar_url,
          },
          // Combine requested reviewers (both users and teams)
          requested_reviewers: [
            ...pr.requested_reviewers.map(r => ({
              username: r.login,
              avatar_url: r.avatar_url,
            })),
            ...pr.requested_teams.map(t => ({
              username: `team:${t.name}`,
              avatar_url: '', // Teams don't have avatars
            })),
          ],
          // Process actual reviews
          reviewers: reviews.map((review: any) => ({
            username: review.user.login,
            avatar_url: review.user.avatar_url,
            approved: review.state === 'APPROVED',
            state: review.state,
            submitted_at: review.submitted_at,
          })),
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
        };

        return { success: true, pr: transformedPR };
      } catch (error) {
        console.error(`Error processing PR #${pr.number}:`, error);
        return { success: false, pr: pr.number, error: error.message };
      }
    }));

    // Store the results in a temporary table or return them
    // For now, return the data for the client to process
    const successCount = results.filter(r => r.success).length;
    const prsWithReviewers = results
      .filter(r => r.success)
      .map(r => r.pr);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${successCount} PRs`,
        prs: prsWithReviewers,
        errors: results.filter(r => !r.success),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-pr-reviewers function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});