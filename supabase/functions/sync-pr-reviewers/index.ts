import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/database.ts';
import {
  corsPreflightResponse,
  errorResponse,
  legacySuccessResponse,
  unauthorizedError,
  validationError,
} from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

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
    return corsPreflightResponse();
  }

  try {
    const {
      owner,
      repo,
      workspace_id,
      include_closed,
      max_closed_days = 30,
      update_database = true,
    } = await req.json();

    if (!owner || !repo) {
      return validationError('Missing required fields', 'owner and repo parameters are required');
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Get GitHub token from environment or user's stored token
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      return unauthorizedError('GitHub token not configured');
    }

    // Fetch both open and closed PRs from GitHub
    const allPRs: GitHubPR[] = [];

    // Always fetch open PRs
    const openResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!openResponse.ok) {
      throw new Error(`GitHub API error fetching open PRs: ${openResponse.status}`);
    }

    const openPRs: GitHubPR[] = await openResponse.json();
    allPRs.push(...openPRs);

    // Optionally fetch closed PRs
    if (include_closed) {
      const since = new Date();
      since.setDate(since.getDate() - max_closed_days);

      const closedResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=100&since=${since.toISOString()}`,
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (closedResponse.ok) {
        const closedPRs: GitHubPR[] = await closedResponse.json();
        // Filter to only include recently closed PRs
        const recentClosedPRs = closedPRs.filter((pr) => {
          if (!pr.closed_at && !pr.merged_at) return false;
          const closedDate = new Date(pr.closed_at || pr.merged_at || '');
          return closedDate >= since;
        });
        allPRs.push(...recentClosedPRs);
      }
    }

    // Process each PR
    const results = await Promise.all(
      allPRs.map(async (pr) => {
        try {
          // Fetch detailed PR data with reviews
          const detailResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
            {
              headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            },
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
              ...pr.requested_reviewers.map((r) => ({
                username: r.login,
                avatar_url: r.avatar_url,
              })),
              ...pr.requested_teams.map((t) => ({
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
      }),
    );

    // Get successful results
    const successfulResults = results.filter((r) => r.success);
    const prsWithReviewers = successfulResults.map((r) => r.pr);

    // Update database if requested
    if (update_database && prsWithReviewers.length > 0) {
      // Get repository ID first
      const { data: repoData } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (repoData) {
        // Get or create contributors for all PR authors
        const uniqueAuthors = [...new Set(prsWithReviewers.map((pr) => pr.author.username))];
        const authorMap = new Map<string, string>();

        // Batch fetch all existing contributors
        const { data: existingContributors } = await supabase
          .from('contributors')
          .select('id, username')
          .in('username', uniqueAuthors);

        // Map existing contributors
        if (existingContributors) {
          existingContributors.forEach((contributor) => {
            authorMap.set(contributor.username, contributor.id);
          });
        }

        // Identify missing contributors
        const missingAuthors = uniqueAuthors.filter((username) => !authorMap.has(username));

        // Batch create missing contributors
        if (missingAuthors.length > 0) {
          const newContributors = missingAuthors.map((username) => {
            const pr = prsWithReviewers.find((p) => p.author.username === username);
            return {
              username: username,
              avatar_url: pr?.author.avatar_url || '',
              github_id: null, // We don't have the GitHub ID from the basic PR data
              contributions_count: 0,
              followers_count: 0,
              following_count: 0,
              public_repos_count: 0,
              public_gists_count: 0,
            };
          });

          const { data: createdContributors } = await supabase
            .from('contributors')
            .insert(newContributors)
            .select('id, username');

          // Map newly created contributors
          if (createdContributors) {
            createdContributors.forEach((contributor) => {
              authorMap.set(contributor.username, contributor.id);
            });
          }
        }

        // Prepare batch upsert data with author_id
        // Filter out PRs where we couldn't find or create the author
        const upsertData = prsWithReviewers
          .filter((pr) => authorMap.has(pr.author.username))
          .map((pr) => ({
            github_id: pr.github_id,
            repository_id: repoData.id,
            author_id: authorMap.get(pr.author.username)!,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            closed_at: pr.closed_at,
            merged_at: pr.merged_at,
            // Store reviewer data as JSON
            reviewer_data: {
              requested_reviewers: pr.requested_reviewers,
              reviewers: pr.reviewers,
            },
            last_synced_at: new Date().toISOString(),
          }));

        // Perform single batch upsert instead of looping
        await supabase.from('pull_requests').upsert(upsertData, {
          onConflict: 'github_id',
        });
      }
    }

    // Count open vs closed (fix: use pr.draft boolean field, not pr.state === 'draft')
    const openCount = prsWithReviewers.filter((pr) => pr.state === 'open').length;
    const draftCount = prsWithReviewers.filter((pr) => pr.draft).length;
    const closedCount = prsWithReviewers.filter((pr) => pr.state === 'closed').length;

    return legacySuccessResponse(
      {
        prs: prsWithReviewers,
        openCount,
        closedCount,
        errors: results.filter((r) => !r.success),
      },
      `Synced ${prsWithReviewers.length} PRs (${openCount} open, ${closedCount} closed)`,
    );
  } catch (error) {
    console.error('Error in sync-pr-reviewers function:', error);
    return errorResponse('Sync PR reviewers failed', 500, error.message, 'SYNC_FAILED');
  }
});
