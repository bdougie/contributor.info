// Supabase Edge Function for batch processing PR details
// Handles large batches of PRs that would timeout on Netlify
// Supports up to 150 seconds execution time on paid plans

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Normalizes GitHub review state to database format
 * GitHub API returns uppercase from GraphQL (e.g., 'APPROVED', 'CHANGES_REQUESTED')
 * But may also return other values that need validation
 */
function normalizeReviewState(githubState: string): string {
  const normalized = githubState.toUpperCase();
  const validStates = ['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'];

  if (!validStates.includes(normalized)) {
    console.warn('Unknown review state: %s, defaulting to COMMENTED', githubState);
    return 'COMMENTED';
  }

  return normalized;
}

// Deno.serve is the new way to create edge functions
Deno.serve(async (req) => {
  return await handleRequest(req);
});

interface BatchRequest {
  repository: string; // owner/name format
  prNumbers?: number[]; // Specific PRs to process
  startNumber?: number; // Process PRs from this number
  endNumber?: number; // Process PRs up to this number
  updateReviews?: boolean; // Also fetch reviews
  updateComments?: boolean; // Also fetch comments
}

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql';

// GraphQL query for batch fetching PR details with reviews and comments
// Query for a single PR - we'll batch these
const SINGLE_PR_QUERY = `
  query GetPRDetail($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
          id
          databaseId
          number
          title
          body
          state
          createdAt
          updatedAt
          closedAt
          mergedAt
          merged
          additions
          deletions
          changedFiles
          commits {
            totalCount
          }
          baseRefName
          headRefName
          mergeCommit {
            oid
          }
          author {
            ... on User {
              id
              databaseId
              login
              name
              email
              avatarUrl
            }
            ... on Bot {
              id
              databaseId
              login
              avatarUrl
            }
          }
          reviews(first: 100) {
            totalCount
            nodes {
              id
              databaseId
              state
              body
              submittedAt
              author {
                ... on User {
                  databaseId
                  login
                  avatarUrl
                }
              }
            }
          }
          comments(first: 100) {
            totalCount
            nodes {
              id
              databaseId
              body
              createdAt
              author {
                login
                avatarUrl
              }
            }
          }
          reviewComments: timelineItems(first: 100, itemTypes: [PULL_REQUEST_REVIEW_COMMENT]) {
            nodes {
              ... on PullRequestReviewComment {
                id
                databaseId
                body
                createdAt
                author {
                  login
                  avatarUrl
                }
              }
            }
          }
        }
      }
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse request
    const {
      repository,
      prNumbers,
      startNumber,
      endNumber,
      updateReviews = true,
      updateComments = true,
    } = (await req.json()) as BatchRequest;

    if (!repository) {
      return new Response(JSON.stringify({ error: 'Repository is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [owner, name] = repository.split('/');
    if (!owner || !name) {
      return new Response(JSON.stringify({ error: 'Invalid repository format. Use owner/name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    // Verify repository exists
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('owner', owner)
      .eq('name', name)
      .single();

    if (repoError || !repoData) {
      return new Response(JSON.stringify({ error: 'Repository not found in database' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine which PRs to process
    let numbersToProcess: number[] = [];

    if (prNumbers && prNumbers.length > 0) {
      numbersToProcess = prNumbers;
    } else if (startNumber && endNumber) {
      // Generate range
      for (let i = startNumber; i <= endNumber && numbersToProcess.length < 100; i++) {
        numbersToProcess.push(i);
      }
    } else {
      // Get recent PR numbers from database
      const { data: recentPRs } = await supabase
        .from('pull_requests')
        .select('number')
        .eq('repository_id', repoData.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (recentPRs && recentPRs.length > 0) {
        numbersToProcess = recentPRs.map((pr) => pr.number);
      } else {
        return new Response(
          JSON.stringify({
            error: 'No PRs to process. Specify prNumbers or range.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Process in batches of 20 (GraphQL query limit)
    const batchSize = 20;
    let totalProcessed = 0;
    let totalErrors = 0;
    const results = [];

    for (let i = 0; i < numbersToProcess.length; i += batchSize) {
      // Check execution time
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const timeout = parseInt(Deno.env.get('SUPABASE_FUNCTION_TIMEOUT') || '50', 10);
      const maxExecutionTime = timeout - 10; // Leave 10s buffer for cleanup

      if (elapsedSeconds > maxExecutionTime) {
        // Save progress
        await supabase.from('batch_progress').upsert(
          {
            repository_id: repoData.id,
            last_pr_number: numbersToProcess[i - 1],
            processed_count: totalProcessed,
            total_count: numbersToProcess.length,
            status: 'partial',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'repository_id' }
        );

        return new Response(
          JSON.stringify({
            success: true,
            partial: true,
            processed: totalProcessed,
            remaining: numbersToProcess.length - i,
            message: 'Partial batch completed due to time limit.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const batch = numbersToProcess.slice(i, i + batchSize);

      // Process each PR individually (GitHub GraphQL doesn't support batch PR queries)
      for (const prNumber of batch) {
        // Execute GraphQL query for single PR
        const response = await fetch(GITHUB_GRAPHQL_API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: SINGLE_PR_QUERY,
            variables: { owner, name, number: prNumber },
          }),
        });

        if (!response.ok) {
          console.error(`GitHub API error for PR #${prNumber}:`, response.status);
          totalErrors++;
          continue;
        }

        const result = await response.json();

        if (result.errors) {
          console.error(`GraphQL errors for PR #${prNumber}:`, result.errors);
          totalErrors++;
          continue;
        }

        // Check rate limit
        const rateLimit = result.data.rateLimit;
        if (rateLimit.remaining < 5) {
          console.warn('Very low rate limit:', rateLimit.remaining);
          // Could implement rate limit pause here
        }

        // Process the PR
        const pr = result.data.repository.pullRequest;

        if (!pr) {
          console.warn(`PR #${prNumber} not found`);
          totalErrors++;
          continue;
        }

        try {
          // Ensure author exists
          let authorId = null;
          if (pr.author) {
            const isBot = !pr.author.email;
            authorId = await ensureContributor(supabase, pr.author, isBot);
          }

          // Upsert pull request details
          const { error: prError } = await supabase.from('pull_requests').upsert(
            {
              github_id: pr.databaseId,
              repository_id: repoData.id,
              number: pr.number,
              title: pr.title,
              body: pr.body,
              state: pr.state,
              created_at: pr.createdAt,
              updated_at: pr.updatedAt,
              closed_at: pr.closedAt,
              merged_at: pr.mergedAt,
              merged: pr.merged,
              merge_commit_sha: pr.mergeCommit?.oid,
              base_branch: pr.baseRefName,
              head_branch: pr.headRefName,
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
              changed_files: pr.changedFiles || 0,
              commits: pr.commits?.totalCount || 0,
              author_id: authorId,
              html_url: `https://github.com/${owner}/${name}/pull/${pr.number}`,
              last_synced_at: new Date().toISOString(),
            },
            {
              onConflict: 'github_id',
              ignoreDuplicates: false,
            }
          );

          if (prError) {
            console.error(`Error upserting PR #${pr.number}:`, prError);
            totalErrors++;
            continue;
          }

          // Process reviews if requested
          if (updateReviews && pr.reviews?.nodes?.length > 0) {
            for (const review of pr.reviews.nodes) {
              if (!review?.author) continue;

              const reviewerId = await ensureContributor(supabase, review.author, false);

              if (reviewerId) {
                await supabase.from('reviews').upsert(
                  {
                    github_id: review.databaseId,
                    pull_request_id: pr.databaseId,
                    author_id: reviewerId,
                    state: normalizeReviewState(review.state),
                    body: review.body,
                    submitted_at: review.submittedAt,
                    last_updated_at: new Date().toISOString(),
                  },
                  {
                    onConflict: 'github_id',
                    ignoreDuplicates: false,
                  }
                );
              }
            }
          }

          // Process comments if requested
          if (updateComments) {
            // Issue comments
            if (pr.comments?.nodes?.length > 0) {
              for (const comment of pr.comments.nodes) {
                if (!comment?.author) continue;

                const commenterId = await ensureContributor(
                  supabase,
                  {
                    login: comment.author.login,
                    avatarUrl: comment.author.avatarUrl,
                  },
                  false
                );

                if (commenterId) {
                  await supabase.from('comments').upsert(
                    {
                      github_id: comment.databaseId,
                      pull_request_id: pr.databaseId,
                      commenter_id: commenterId,
                      body: comment.body,
                      comment_type: 'issue',
                      created_at: comment.createdAt,
                      updated_at: comment.createdAt,
                    },
                    {
                      onConflict: 'github_id',
                      ignoreDuplicates: false,
                    }
                  );
                }
              }
            }

            // Review comments
            if (pr.reviewComments?.nodes?.length > 0) {
              for (const comment of pr.reviewComments.nodes) {
                if (!comment?.author) continue;

                const commenterId = await ensureContributor(
                  supabase,
                  {
                    login: comment.author.login,
                    avatarUrl: comment.author.avatarUrl,
                  },
                  false
                );

                if (commenterId) {
                  await supabase.from('comments').upsert(
                    {
                      github_id: comment.databaseId,
                      pull_request_id: pr.databaseId,
                      commenter_id: commenterId,
                      body: comment.body,
                      comment_type: 'review',
                      created_at: comment.createdAt,
                      updated_at: comment.createdAt,
                    },
                    {
                      onConflict: 'github_id',
                      ignoreDuplicates: false,
                    }
                  );
                }
              }
            }
          }

          totalProcessed++;
          results.push({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            reviews: pr.reviews?.totalCount || 0,
            comments: (pr.comments?.totalCount || 0) + (pr.reviewComments?.nodes?.length || 0),
          });
        } catch (error) {
          console.error(`Error processing PR #${pr.number}:`, error);
          totalErrors++;
        }
      }
    }

    // Clear batch progress if completed
    await supabase.from('batch_progress').delete().eq('repository_id', repoData.id);

    return new Response(
      JSON.stringify({
        success: true,
        repository: repository,
        processed: totalProcessed,
        errors: totalErrors,
        total: numbersToProcess.length,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        results: results.slice(0, 10), // Return sample of results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Batch processing error:', error);

    return new Response(
      JSON.stringify({
        error: 'Batch processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Simple hash function to generate deterministic IDs from usernames
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Ensure positive number and add offset to avoid conflicts with real GitHub IDs
  return Math.abs(hash) + 1000000000;
}

// Helper function to ensure contributor exists
async function ensureContributor(
  supabase: any,
  author: any,
  isBot: boolean
): Promise<string | null> {
  if (!author) return null;

  // If no databaseId, use a deterministic hash based on username
  // This prevents collisions while ensuring consistency
  const githubId = author.databaseId || hashCode(author.login);

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: githubId,
        username: author.login,
        display_name: author.name || null,
        email: author.email || null,
        avatar_url: author.avatarUrl || author.avatar_url || null,
        profile_url: `https://github.com/${author.login}`,
        is_bot: isBot || author.login?.includes('[bot]'),
        is_active: true,
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error upserting contributor:', error);
    return null;
  }

  return data?.id || null;
}
