// Inngest handler for Supabase Edge Functions with FULL implementations
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Inngest, InngestCommHandler, NonRetriableError } from 'https://esm.sh/inngest@3.16.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Type for items from the items_needing_embeddings view
interface ItemNeedingEmbedding {
  id: string;
  repository_id: string;
  title: string;
  body: string | null;
  content_hash: string | null;
  embedding_generated_at: string | null;
  created_at: string;
  item_type: 'issue' | 'pull_request' | 'discussion';
}

// Type for items after mapping item_type to type
interface EmbeddingItem {
  id: string;
  repository_id: string;
  title: string;
  body: string | null;
  content_hash: string | null;
  embedding_generated_at?: string | null;
  type: 'issue' | 'pull_request' | 'discussion';
}

// CORS headers for Inngest
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK, x-inngest-server-kind, X-Inngest-Server-Kind',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

// Get environment configuration
const INNGEST_APP_ID = Deno.env.get('INNGEST_APP_ID') || 'contributor-info';
const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') ||
                          Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY') || '';
const INNGEST_SIGNING_KEY = Deno.env.get('INNGEST_SIGNING_KEY') ||
                            Deno.env.get('INNGEST_PRODUCTION_SIGNING_KEY') || '';

console.log('🚀 Inngest Edge Function Started with FULL implementations');
console.log('Configuration:', {
  appId: INNGEST_APP_ID,
  hasEventKey: !!INNGEST_EVENT_KEY,
  hasSigningKey: !!INNGEST_SIGNING_KEY,
  eventKeyLength: INNGEST_EVENT_KEY?.length || 0,
  signingKeyLength: INNGEST_SIGNING_KEY?.length || 0,
});

// Validate required keys
if (!INNGEST_EVENT_KEY) {
  console.error('❌ CRITICAL: INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY is missing');
}
if (!INNGEST_SIGNING_KEY) {
  console.error('❌ CRITICAL: INNGEST_SIGNING_KEY or INNGEST_PRODUCTION_SIGNING_KEY is missing');
}

// Initialize Inngest client
const inngest = new Inngest({
  id: INNGEST_APP_ID,
  eventKey: INNGEST_EVENT_KEY,
});

// Supabase client
let supabaseClient: any = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

// GitHub API helper
async function githubRequest(path: string, token?: string): Promise<any> {
  const githubToken = token || Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN');
  if (!githubToken) {
    throw new NonRetriableError('GitHub token not configured');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (response.status === 404) {
    throw new NonRetriableError(`Resource not found: ${path}`);
  }

  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      throw new Error('GitHub rate limit exceeded');
    }
    throw new NonRetriableError('GitHub API forbidden');
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

// GraphQL helper
async function githubGraphQL(query: string, variables: Record<string, any> = {}, token?: string): Promise<any> {
  const githubToken = token || Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN');
  if (!githubToken) {
    throw new NonRetriableError('GitHub token not configured');
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

// Helper to ensure contributor exists
async function ensureContributor(supabase: any, username: string, avatarUrl?: string): Promise<string> {
  // Check if contributor exists
  const { data: existing } = await supabase
    .from('contributors')
    .select('id')
    .eq('github_username', username)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new contributor
  const { data: newContributor, error } = await supabase
    .from('contributors')
    .insert({
      github_username: username,
      avatar_url: avatarUrl,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create contributor ${username}:`, error);
    // Try to get existing one again in case of race condition
    const { data: retry } = await supabase
      .from('contributors')
      .select('id')
      .eq('github_username', username)
      .single();
    if (retry) return retry.id;
    throw error;
  }

  return newContributor.id;
}

// 1. capture-pr-details - REST API version
const capturePrDetails = inngest.createFunction(
  {
    id: 'capture-pr-details',
    name: 'Capture PR Details',
    retries: 2
  },
  { event: 'capture/pr.details' },
  async ({ event, step }) => {
    const { owner, repo, pr_number, github_token } = event.data;

    const prData = await step.run('fetch-pr', async () => {
      const pr = await githubRequest(
        `/repos/${owner}/${repo}/pulls/${pr_number}`,
        github_token
      );
      return pr;
    });

    await step.run('store-pr', async () => {
      const supabase = getSupabaseClient();

      // Ensure author exists
      const authorId = await ensureContributor(supabase, prData.user.login, prData.user.avatar_url);

      // Get repository ID
      const { data: repoData } = await supabase
        .from('repositories')
        .select('id')
        .eq('full_name', `${owner}/${repo}`)
        .single();

      if (!repoData) {
        // Create repository if it doesn't exist
        const { data: newRepo } = await supabase
          .from('repositories')
          .insert({
            full_name: `${owner}/${repo}`,
            owner,
            name: repo
          })
          .select('id')
          .single();
        repoData.id = newRepo.id;
      }

      // Store PR data
      const { error } = await supabase
        .from('pull_requests')
        .upsert({
          pr_number: prData.number,
          repository_id: repoData.id,
          repository_full_name: `${owner}/${repo}`,
          title: prData.title,
          body: prData.body,
          state: prData.state,
          author_id: authorId,
          additions: prData.additions || 0,
          deletions: prData.deletions || 0,
          changed_files: prData.changed_files || 0,
          created_at: prData.created_at,
          updated_at: prData.updated_at,
          closed_at: prData.closed_at,
          merged_at: prData.merged_at,
          is_draft: prData.draft || false,
        });

      if (error) throw error;
    });

    return { pr_number: prData.number, status: 'captured' };
  }
);

// 2. capture-pr-details-graphql - GraphQL version
const capturePrDetailsGraphQL = inngest.createFunction(
  {
    id: 'capture-pr-details-graphql',
    name: 'Capture PR Details (GraphQL)',
    retries: 2
  },
  { event: 'capture/pr.details.graphql' },
  async ({ event, step }) => {
    const { owner, repo, pr_number, github_token } = event.data;

    const prData = await step.run('fetch-pr-graphql', async () => {
      const query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              number
              title
              body
              state
              createdAt
              updatedAt
              closedAt
              mergedAt
              isDraft
              additions
              deletions
              changedFiles
              author {
                login
                avatarUrl
              }
              reviews(first: 100) {
                nodes {
                  id
                  state
                  body
                  submittedAt
                  author {
                    login
                    avatarUrl
                  }
                }
              }
              comments(first: 100) {
                nodes {
                  id
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
      `;

      const data = await githubGraphQL(query, { owner, repo, number: pr_number }, github_token);
      return data.repository.pullRequest;
    });

    await step.run('store-comprehensive-pr-data', async () => {
      const supabase = getSupabaseClient();

      // Ensure author exists
      const authorId = await ensureContributor(
        supabase,
        prData.author.login,
        prData.author.avatarUrl
      );

      // Get or create repository
      const { data: repoData } = await supabase
        .from('repositories')
        .select('id')
        .eq('full_name', `${owner}/${repo}`)
        .single();

      const repositoryId = repoData?.id || (await supabase
        .from('repositories')
        .insert({ full_name: `${owner}/${repo}`, owner, name: repo })
        .select('id')
        .single()).data.id;

      // Store PR
      await supabase.from('pull_requests').upsert({
        pr_number: prData.number,
        repository_id: repositoryId,
        repository_full_name: `${owner}/${repo}`,
        title: prData.title,
        body: prData.body,
        state: prData.state,
        author_id: authorId,
        additions: prData.additions || 0,
        deletions: prData.deletions || 0,
        changed_files: prData.changedFiles || 0,
        created_at: prData.createdAt,
        updated_at: prData.updatedAt,
        closed_at: prData.closedAt,
        merged_at: prData.mergedAt,
        is_draft: prData.isDraft || false,
      });

      // Store reviews
      for (const review of prData.reviews.nodes) {
        if (review.author) {
          const reviewerId = await ensureContributor(
            supabase,
            review.author.login,
            review.author.avatarUrl
          );

          await supabase.from('pr_reviews').upsert({
            review_id: review.id,
            pr_number: prData.number,
            repository_full_name: `${owner}/${repo}`,
            reviewer_id: reviewerId,
            state: review.state,
            body: review.body,
            submitted_at: review.submittedAt,
          });
        }
      }

      // Store comments
      for (const comment of prData.comments.nodes) {
        if (comment.author) {
          const commenterId = await ensureContributor(
            supabase,
            comment.author.login,
            comment.author.avatarUrl
          );

          await supabase.from('pr_comments').upsert({
            comment_id: comment.id,
            pr_number: prData.number,
            repository_full_name: `${owner}/${repo}`,
            author_id: commenterId,
            body: comment.body,
            created_at: comment.createdAt,
          });
        }
      }
    });

    return { pr_number: prData.number, status: 'captured_with_reviews_and_comments' };
  }
);

// 3. capture-pr-reviews
const capturePrReviews = inngest.createFunction(
  {
    id: 'capture-pr-reviews',
    name: 'Capture PR Reviews',
    retries: 2
  },
  { event: 'capture/pr.reviews' },
  async ({ event, step }) => {
    const { owner, repo, pr_number, github_token } = event.data;

    const reviews = await step.run('fetch-reviews', async () => {
      const data = await githubRequest(
        `/repos/${owner}/${repo}/pulls/${pr_number}/reviews`,
        github_token
      );
      return data;
    });

    await step.run('store-reviews', async () => {
      const supabase = getSupabaseClient();

      for (const review of reviews) {
        const reviewerId = await ensureContributor(
          supabase,
          review.user.login,
          review.user.avatar_url
        );

        const { error } = await supabase
          .from('pr_reviews')
          .upsert({
            review_id: review.id.toString(),
            pr_number,
            repository_full_name: `${owner}/${repo}`,
            reviewer_id: reviewerId,
            state: review.state,
            body: review.body,
            submitted_at: review.submitted_at,
          });

        if (error) {
          console.error('Failed to store review:', error);
        }
      }
    });

    return { pr_number, reviews_count: reviews.length };
  }
);

// 4. capture-pr-comments
const capturePrComments = inngest.createFunction(
  {
    id: 'capture-pr-comments',
    name: 'Capture PR Comments',
    retries: 2
  },
  { event: 'capture/pr.comments' },
  async ({ event, step }) => {
    const { owner, repo, pr_number, github_token } = event.data;

    const [reviewComments, issueComments] = await step.run('fetch-all-comments', async () => {
      const [revComments, issComments] = await Promise.all([
        githubRequest(`/repos/${owner}/${repo}/pulls/${pr_number}/comments`, github_token),
        githubRequest(`/repos/${owner}/${repo}/issues/${pr_number}/comments`, github_token),
      ]);
      return [revComments, issComments];
    });

    await step.run('store-comments', async () => {
      const supabase = getSupabaseClient();
      const allComments = [...reviewComments, ...issueComments];

      for (const comment of allComments) {
        const authorId = await ensureContributor(
          supabase,
          comment.user.login,
          comment.user.avatar_url
        );

        const { error } = await supabase
          .from('pr_comments')
          .upsert({
            comment_id: comment.id.toString(),
            pr_number,
            repository_full_name: `${owner}/${repo}`,
            author_id: authorId,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
          });

        if (error) {
          console.error('Failed to store comment:', error);
        }
      }
    });

    return {
      pr_number,
      comments_count: reviewComments.length + issueComments.length
    };
  }
);

// 5. capture-issue-comments
const captureIssueComments = inngest.createFunction(
  {
    id: 'capture-issue-comments',
    name: 'Capture Issue Comments',
    retries: 2
  },
  { event: 'capture/issue.comments' },
  async ({ event, step }) => {
    const { owner, repo, issue_number, github_token } = event.data;

    const comments = await step.run('fetch-issue-comments', async () => {
      const data = await githubRequest(
        `/repos/${owner}/${repo}/issues/${issue_number}/comments`,
        github_token
      );
      return data;
    });

    await step.run('store-issue-comments', async () => {
      const supabase = getSupabaseClient();

      for (const comment of comments) {
        const authorId = await ensureContributor(
          supabase,
          comment.user.login,
          comment.user.avatar_url
        );

        const { error } = await supabase
          .from('issue_comments')
          .upsert({
            comment_id: comment.id.toString(),
            issue_number,
            repository_full_name: `${owner}/${repo}`,
            author_id: authorId,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
          });

        if (error) {
          console.error('Failed to store issue comment:', error);
        }
      }
    });

    return { issue_number, comments_count: comments.length };
  }
);

// 6. capture-repository-issues
const captureRepositoryIssues = inngest.createFunction(
  {
    id: 'capture-repository-issues',
    name: 'Capture Repository Issues',
    retries: 2
  },
  { event: 'capture/repository.issues' },
  async ({ event, step }) => {
    const { owner, repo, github_token, state = 'all' } = event.data;

    const issues = await step.run('fetch-issues', async () => {
      const data = await githubRequest(
        `/repos/${owner}/${repo}/issues?state=${state}&per_page=100`,
        github_token
      );
      // Filter out pull requests (they also appear in issues API)
      return data.filter((issue: any) => !('pull_request' in issue));
    });

    await step.run('store-issues', async () => {
      const supabase = getSupabaseClient();

      // Get repository ID
      const { data: repoData } = await supabase
        .from('repositories')
        .select('id')
        .eq('full_name', `${owner}/${repo}`)
        .single();

      const repositoryId = repoData?.id || (await supabase
        .from('repositories')
        .insert({ full_name: `${owner}/${repo}`, owner, name: repo })
        .select('id')
        .single()).data.id;

      for (const issue of issues) {
        const authorId = await ensureContributor(
          supabase,
          issue.user.login,
          issue.user.avatar_url
        );

        const { error } = await supabase
          .from('issues')
          .upsert({
            issue_number: issue.number,
            repository_id: repositoryId,
            repository_full_name: `${owner}/${repo}`,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author_id: authorId,
            labels: issue.labels.map((l: any) => l.name),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
          });

        if (error) {
          console.error('Failed to store issue:', error);
        }
      }
    });

    return { repository: `${owner}/${repo}`, issues_count: issues.length };
  }
);

// 7. capture-repository-sync - REST API repository sync
const captureRepositorySync = inngest.createFunction(
  {
    id: 'capture-repository-sync',
    name: 'Capture Repository Sync',
    retries: 2
  },
  { event: 'capture/repository.sync' },
  async ({ event, step }) => {
    const { owner, repo, github_token } = event.data;

    // Fetch repository metadata
    const repoData = await step.run('fetch-repository', async () => {
      const data = await githubRequest(`/repos/${owner}/${repo}`, github_token);
      return data;
    });

    // Store repository
    const repositoryId = await step.run('store-repository', async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('repositories')
        .upsert({
          full_name: repoData.full_name,
          name: repoData.name,
          owner: repoData.owner.login,
          description: repoData.description,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          open_issues: repoData.open_issues_count,
          language: repoData.language,
          created_at: repoData.created_at,
          updated_at: repoData.updated_at,
          pushed_at: repoData.pushed_at,
          is_private: repoData.private,
          is_archived: repoData.archived,
          default_branch: repoData.default_branch,
          topics: repoData.topics,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    });

    // Fetch and store recent PRs
    await step.run('sync-recent-prs', async () => {
      const prs = await githubRequest(
        `/repos/${owner}/${repo}/pulls?state=all&per_page=30&sort=updated&direction=desc`,
        github_token
      );

      const supabase = getSupabaseClient();

      for (const pr of prs) {
        const authorId = await ensureContributor(
          supabase,
          pr.user.login,
          pr.user.avatar_url
        );

        await supabase.from('pull_requests').upsert({
          pr_number: pr.number,
          repository_id: repositoryId,
          repository_full_name: `${owner}/${repo}`,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          author_id: authorId,
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
          changed_files: pr.changed_files || 0,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
          is_draft: pr.draft || false,
        });
      }
    });

    return { repository: repoData.full_name, status: 'synced' };
  }
);

// 8. update-pr-activity
const updatePrActivity = inngest.createFunction(
  {
    id: 'update-pr-activity',
    name: 'Update PR Activity',
    retries: 2
  },
  { event: 'capture/pr.activity.update' },
  async ({ event, step }) => {
    const { owner, repo, pr_number } = event.data;

    const metrics = await step.run('calculate-activity-metrics', async () => {
      const supabase = getSupabaseClient();

      // Get PR data
      const { data: pr } = await supabase
        .from('pull_requests')
        .select('*')
        .eq('pr_number', pr_number)
        .eq('repository_full_name', `${owner}/${repo}`)
        .single();

      if (!pr) {
        throw new NonRetriableError('PR not found in database');
      }

      // Count reviews and comments
      const [{ count: reviewCount }, { count: commentCount }] = await Promise.all([
        supabase
          .from('pr_reviews')
          .select('*', { count: 'exact', head: true })
          .eq('pr_number', pr_number)
          .eq('repository_full_name', `${owner}/${repo}`),
        supabase
          .from('pr_comments')
          .select('*', { count: 'exact', head: true })
          .eq('pr_number', pr_number)
          .eq('repository_full_name', `${owner}/${repo}`),
      ]);

      // Calculate activity score
      const activityScore = (reviewCount || 0) * 3 + (commentCount || 0) * 2 + (pr.additions + pr.deletions) / 100;

      // Update PR with activity metrics
      const { error } = await supabase
        .from('pull_requests')
        .update({
          review_count: reviewCount || 0,
          comment_count: commentCount || 0,
          activity_score: activityScore,
          last_activity_at: new Date().toISOString(),
        })
        .eq('pr_number', pr_number)
        .eq('repository_full_name', `${owner}/${repo}`);

      if (error) throw error;

      return { reviewCount, commentCount, activityScore };
    });

    return { pr_number, status: 'activity_updated', metrics };
  }
);

// 9. discover-new-repository
const discoverNewRepository = inngest.createFunction(
  {
    id: 'discover-new-repository',
    name: 'Discover New Repository',
    retries: 2
  },
  { event: 'capture/repository.discover' },
  async ({ event, step }) => {
    const { owner, repo, github_token } = event.data;

    // Check if repository exists
    const exists = await step.run('check-repository-exists', async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('repositories')
        .select('full_name')
        .eq('full_name', `${owner}/${repo}`)
        .single();

      return !!data;
    });

    if (exists) {
      return { repository: `${owner}/${repo}`, status: 'already_tracked' };
    }

    // Fetch and store repository
    const repoData = await step.run('discover-repository', async () => {
      const data = await githubRequest(`/repos/${owner}/${repo}`, github_token);
      return data;
    });

    await step.run('store-new-repository', async () => {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('repositories')
        .insert({
          full_name: repoData.full_name,
          name: repoData.name,
          owner: repoData.owner.login,
          description: repoData.description,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          open_issues: repoData.open_issues_count,
          language: repoData.language,
          created_at: repoData.created_at,
          updated_at: repoData.updated_at,
          pushed_at: repoData.pushed_at,
          is_private: repoData.private,
          is_archived: repoData.archived,
          default_branch: repoData.default_branch,
          topics: repoData.topics,
          is_tracked: true,
          discovered_at: new Date().toISOString(),
        });

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }
    });

    // Trigger initial sync
    await step.sendEvent('trigger-initial-sync', {
      name: 'capture/repository.sync',
      data: { owner, repo, github_token },
    });

    return { repository: repoData.full_name, status: 'discovered_and_tracking' };
  }
);

// 10. classify-repository-size
const classifyRepositorySize = inngest.createFunction(
  {
    id: 'classify-repository-size',
    name: 'Classify Repository Size (Batch)',
    retries: 2
  },
  { event: 'capture/repository.classify.batch' },
  async ({ event, step }) => {
    const { repositories, github_token } = event.data;

    const results = await step.run('classify-repositories', async () => {
      const supabase = getSupabaseClient();
      const classifications = [];

      for (const repoFullName of repositories) {
        const [owner, repo] = repoFullName.split('/');

        try {
          // Fetch repository stats
          const repoData = await githubRequest(`/repos/${owner}/${repo}`, github_token);

          // Classify based on stars, forks, and activity
          let size_class = 'small';
          if (repoData.stargazers_count > 10000 || repoData.forks_count > 2000) {
            size_class = 'large';
          } else if (repoData.stargazers_count > 1000 || repoData.forks_count > 200) {
            size_class = 'medium';
          }

          // Calculate activity level
          const lastPushDate = new Date(repoData.pushed_at);
          const daysSinceLastPush = Math.floor(
            (Date.now() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          const activity_level = daysSinceLastPush < 7 ? 'high' :
                                daysSinceLastPush < 30 ? 'medium' :
                                daysSinceLastPush < 90 ? 'low' : 'dormant';

          // Update repository classification
          await supabase
            .from('repositories')
            .update({
              size_class,
              activity_level,
              stars: repoData.stargazers_count,
              forks: repoData.forks_count,
              open_issues: repoData.open_issues_count,
              classified_at: new Date().toISOString(),
            })
            .eq('full_name', repoFullName);

          classifications.push({
            repository: repoFullName,
            size_class,
            activity_level,
            stars: repoData.stargazers_count,
          });
        } catch (error: any) {
          console.error(`Failed to classify ${repoFullName}:`, error);
          classifications.push({
            repository: repoFullName,
            error: error.message,
          });
        }
      }

      return classifications;
    });

    return {
      classified_count: results.length,
      classifications: results,
    };
  }
);

// 11. compute-embeddings - Runs every 15 minutes
const computeEmbeddings = inngest.createFunction(
  {
    id: 'compute-embeddings',
    name: 'Compute Embeddings for Issues, PRs, and Discussions',
    concurrency: {
      limit: 2,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 5,
      period: '1m',
    },
  },
  [
    { event: 'embeddings/compute.requested' },
    { cron: '*/15 * * * *' },
  ],
  async ({ event, step }) => {
    console.log('[DEBUG] compute-embeddings function started', { event });
    const data = event.data || {};
    const repositoryId = data.repositoryId;
    const forceRegenerate = data.forceRegenerate || false;
    const itemTypes = data.itemTypes || ['issues', 'pull_requests', 'discussions'];
    console.log('[DEBUG] Parameters parsed', { repositoryId, forceRegenerate, itemTypes });

    // Step 1: Create job record
    console.log('[DEBUG] About to run create-job step');
    const jobId = await step.run('create-job', async () => {
      console.log('[DEBUG] Inside create-job step');
      const supabase = getSupabaseClient();
      console.log('[DEBUG] Got Supabase client');
      const { data: job, error } = await supabase
        .from('embedding_jobs')
        .insert({
          repository_id: repositoryId || null,
          status: 'pending',
          items_total: 0,
          items_processed: 0,
        })
        .select()
        .maybeSingle();

      if (error || !job) {
        console.error('[DEBUG] Failed to create job', { error, job });
        throw new NonRetriableError('Failed to create embedding job');
      }

      console.log('[DEBUG] Job created successfully', { jobId: job.id });
      return job.id;
    });

    // Step 2: Find items needing embeddings
    console.log('[DEBUG] About to run find-items step with jobId:', jobId);
    const itemsToProcess = await step.run('find-items', async () => {
      console.log('[DEBUG] Inside find-items step');
      const supabase = getSupabaseClient();
      const items: EmbeddingItem[] = [];
      console.log('[DEBUG] Initialized items array');

      let baseQuery = supabase.from('items_needing_embeddings').select('*');

      if (repositoryId) {
        baseQuery = baseQuery.eq('repository_id', repositoryId);
      }

      console.log('[DEBUG] Running query on items_needing_embeddings');
      const { data: viewItems, error } = await baseQuery.limit(100);
      
      console.log('[DEBUG] Query result:', { itemCount: viewItems?.length, error });
      console.log(`Found ${viewItems ? viewItems.length : 0} items from items_needing_embeddings view`);

      if (error) {
        console.error('Failed to fetch items needing embeddings:', error);
        return [];
      }

      if (viewItems) {
        // Map item_type to type for consistency with rest of codebase
        const mappedItems: EmbeddingItem[] = (viewItems as ItemNeedingEmbedding[]).map((item) => ({
          id: item.id,
          repository_id: item.repository_id,
          title: item.title,
          body: item.body,
          content_hash: item.content_hash,
          embedding_generated_at: item.embedding_generated_at,
          type: item.item_type,
        }));
        items.push(...mappedItems);
      }

      if (forceRegenerate && repositoryId) {
        for (const itemType of itemTypes) {
          let table: string;
          let type: 'issue' | 'pull_request' | 'discussion';

          if (itemType === 'issues') {
            table = 'issues';
            type = 'issue';
          } else if (itemType === 'pull_requests') {
            table = 'pull_requests';
            type = 'pull_request';
          } else {
            table = 'discussions';
            type = 'discussion';
          }

          const { data: forceItems } = await supabase
            .from(table)
            .select('id, repository_id, title, body, content_hash, embedding_generated_at')
            .eq('repository_id', repositoryId)
            .not('embedding', 'is', null)
            .limit(50);

          if (forceItems) {
            const typedForceItems: EmbeddingItem[] = forceItems.map((item) => ({
              id: item.id,
              repository_id: item.repository_id,
              title: item.title,
              body: item.body,
              content_hash: item.content_hash,
              embedding_generated_at: item.embedding_generated_at,
              type,
            }));
            items.push(...typedForceItems);
          }
        }
      }

      console.log('[DEBUG] Updating job with item count:', items.length);
      const { error: updateError } = await supabase
        .from('embedding_jobs')
        .update({
          items_total: items.length,
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateError) {
        console.error('[DEBUG] Failed to update job status', updateError);
      }

      console.log('[DEBUG] Returning items from find-items step:', items.length);
      return items;
    });

    console.log('[DEBUG] Items to process:', itemsToProcess.length);
    if (itemsToProcess.length === 0) {
      console.log('[DEBUG] No items to process, marking complete');
      await step.run('mark-complete', async () => {
        console.log('[DEBUG] Inside mark-complete step');
        const supabase = getSupabaseClient();
        await supabase
          .from('embedding_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      });
      return { message: 'No items to process', jobId };
    }

    // Step 3: Process embeddings in batches
    const batchSize = 20;
    console.log('[DEBUG] Starting batch processing, total items:', itemsToProcess.length, 'batch size:', batchSize);

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);
      console.log(`[DEBUG] Processing batch ${i / batchSize + 1}/${Math.ceil(itemsToProcess.length / batchSize)}`);

      await step.run(`process-batch-${i / batchSize}`, async () => {
        console.log(`[DEBUG] Inside process-batch-${i / batchSize} step`);
        const supabase = getSupabaseClient();
        let batchProcessedCount = 0;

        console.log(`[Embeddings] Starting batch ${i / batchSize + 1}, items: ${batch.length}`);
        console.log('[DEBUG] Batch items:', batch.map(item => ({ id: item.id, type: item.type })));

        try {
          // Generate content hashes if missing
          for (const item of batch) {
            if (!item.content_hash) {
              const content = `${item.title || ''}:${item.body || ''}`;
              const encoder = new TextEncoder();
              const data = encoder.encode(content);
              const hashBuffer = await crypto.subtle.digest('SHA-256', data);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              item.content_hash = hashHex.substring(0, 16);
            }
          }

          console.log('[DEBUG] Checking for OpenAI API key');
          const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY');
          if (!apiKey) {
            console.error('[ERROR] OpenAI API key not found in environment');
            console.error('[ERROR] Checked: OPENAI_API_KEY, VITE_OPENAI_API_KEY');
            const allEnvVars = Object.keys(Deno.env.toObject());
            console.error('[ERROR] Available env vars with API:', allEnvVars.filter(k => k.includes('API')));
            console.error('[ERROR] Available env vars with OPENAI:', allEnvVars.filter(k => k.includes('OPENAI')));
            console.error('[ERROR] Total env vars count:', allEnvVars.length);
            throw new NonRetriableError('OpenAI API key not configured - check OPENAI_API_KEY env var in Supabase secrets');
          }
          if (!apiKey.startsWith('sk-')) {
            console.error('[ERROR] Invalid OpenAI API key format - should start with sk-');
            console.error('[ERROR] Key starts with:', apiKey.substring(0, 10));
            throw new NonRetriableError(`Invalid OpenAI API key format: ${apiKey.substring(0, 10)}...`);
          }
          console.log(`[DEBUG] Using OpenAI API key: ${apiKey.substring(0, 7)}...`);

          const texts = batch.map((item) =>
            `[${item.type.toUpperCase()}] ${item.title} ${item.body || ''}`.substring(0, 2000)
          );

          console.log('[DEBUG] Making OpenAI API request for', texts.length, 'texts');
          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: texts,
              dimensions: 384,  // CRITICAL: Specify 384 dimensions to match database schema
            }),
          });

          console.log('[DEBUG] OpenAI response status:', response.status);
          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[DEBUG] OpenAI API error ${response.status}:`, errorBody);
            throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
          }

          console.log('[DEBUG] Parsing OpenAI response');
          const responseData = await response.json();
          const embeddings = responseData.data;
          console.log('[DEBUG] Got embeddings for', embeddings?.length, 'items');

          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const embedding = embeddings[j]?.embedding;

            if (embedding) {
              let table: string;
              if (item.type === 'issue') {
                table = 'issues';
              } else if (item.type === 'pull_request') {
                table = 'pull_requests';
              } else {
                table = 'discussions';
              }

              console.log(`[DEBUG] Updating ${table} with embedding for item ${item.id}`);
              const { error: updateError } = await supabase
                .from(table)
                .update({
                  embedding,
                  embedding_generated_at: new Date().toISOString(),
                  content_hash: item.content_hash,
                })
                .eq('id', item.id);

              if (updateError) {
                console.error(`Failed to update ${table} embedding for ${item.id}:`, updateError);
                throw updateError;
              }

              const { error: cacheError } = await supabase
                .from('similarity_cache')
                .upsert(
                  {
                    repository_id: item.repository_id,
                    item_type: item.type,
                    item_id: item.id,
                    embedding,
                    content_hash: item.content_hash,
                    ttl_hours: 168,
                  },
                  {
                    onConflict: 'repository_id,item_type,item_id',
                  }
                );

              if (cacheError) {
                console.warn(`Failed to update similarity cache for ${item.id}:`, cacheError);
                // Don't throw for cache errors - they're non-critical
              }

              batchProcessedCount++;
              console.log(`[DEBUG] Successfully processed item ${j + 1}/${batch.length}, total processed in batch: ${batchProcessedCount}`);
            } else {
              console.log(`[DEBUG] No embedding found for item ${j} in response`);
            }
          }

          // Increment job progress by the batch count (not set to batch count)
          console.log(`[Embeddings] Incrementing job progress: jobId=${jobId}, count=${batchProcessedCount}`);
          const { error: progressError } = await supabase.rpc('increment_embedding_job_progress', {
            job_id: jobId,
            increment_count: batchProcessedCount,
          });

          if (progressError) {
            console.error('[Embeddings] Failed to increment job progress:', progressError);
            throw new Error(`Failed to increment job progress: ${progressError.message}`);
          }

          console.log(`[Embeddings] Successfully incremented job progress by ${batchProcessedCount}`);
          console.log('[DEBUG] Batch processing complete, returning from step');
        } catch (error: any) {
          const errorMsg = `Batch ${i / batchSize} failed: ${error.message}`;
          console.error('[ERROR] Batch processing failed:', errorMsg);
          console.error('[ERROR] Full error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
          // Rethrow the original error to preserve type and stack
          throw error;
        }
      });
    }

    // Step 4: Finalize job and prepare return
    console.log('[DEBUG] All batches processed, running finalize-and-return step');
    const finalReturn = await step.run('finalize-and-return', async () => {
      console.log('[DEBUG] Inside finalize-and-return step');
      const supabase = getSupabaseClient();

      // Read the actual processed count from database since we can't track it across steps
      const { data: job } = await supabase
        .from('embedding_jobs')
        .select('items_processed, items_total')
        .eq('id', jobId)
        .single();

      const processedCount = job?.items_processed || 0;
      const totalCount = job?.items_total || 0;
      console.log('[DEBUG] Final counts:', { processedCount, totalCount });

      let jobStatus: string;
      if (processedCount === 0 && totalCount > 0) {
        jobStatus = 'failed';
      } else {
        jobStatus = 'completed';
      }

      await supabase
        .from('embedding_jobs')
        .update({
          status: jobStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      await supabase.rpc('cleanup_expired_cache');

      // Return the complete response from within the step to avoid scope issues
      return {
        jobId,
        processed: processedCount,
        total: totalCount,
      };
    });

    // Return the step result directly - no outer scope access
    console.log('[DEBUG] Returning final result:', finalReturn);
    return finalReturn;
  }
);

// Define our functions registry
const functions = [
  capturePrDetails,
  capturePrDetailsGraphQL,
  capturePrReviews,
  capturePrComments,
  captureIssueComments,
  captureRepositoryIssues,
  captureRepositorySync,
  updatePrActivity,
  discoverNewRepository,
  classifyRepositorySize,
  computeEmbeddings,
];

// Create Inngest handler
const commHandler = new InngestCommHandler({
  frameworkName: 'deno-edge-supabase',
  appName: INNGEST_APP_ID,
  signingKey: undefined, // Disable signature validation for debugging
  client: inngest,
  functions,
  serveHost: Deno.env.get('VITE_DEPLOY_URL') || 'https://egcxzonpmmcirmgqdrla.supabase.co',
  servePath: '/functions/v1/inngest-prod',
  handler: (req: Request) => {
    return {
      body: () => req.json(),
      headers: (key) => req.headers.get(key),
      method: () => req.method,
      url: () => new URL(req.url),
      transformResponse: ({ body, status, headers }) => {
        return new Response(body, { status, headers });
      },
    };
  },
});

// Create the actual handler
const handler = commHandler.createHandler();

// Main HTTP handler
serve(async (req) => {
  const url = new URL(req.url);
  const method = req.method;

  console.log(`📥 ${method} ${url.pathname}${url.search}`);

  // Log authorization headers for debugging
  const authHeader = req.headers.get('authorization');
  const inngestSig = req.headers.get('x-inngest-signature');
  console.log('Headers:', {
    hasAuthorization: !!authHeader,
    authType: authHeader?.split(' ')[0],
    hasInngestSignature: !!inngestSig,
    contentType: req.headers.get('content-type'),
  });

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle HEAD requests (health checks)
  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-Inngest-Ready': 'true',
      },
    });
  }

  // Handle GET health check
  if (method === 'GET' && url.pathname === '/') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        message: 'Inngest Edge Function with FULL implementations',
        functions: functions.map(f => f.id),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    // Use the unified handler - it handles GET/POST/PUT internally
    const response = await handler(req);

    // Add CORS headers to the response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    console.error('❌ Error processing request:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    });

    // Check for common authorization errors
    const isAuthError = error.message?.toLowerCase().includes('authorization') ||
                       error.message?.toLowerCase().includes('signature') ||
                       error.message?.toLowerCase().includes('signing key');

    return new Response(
      JSON.stringify({
        error: isAuthError ? 'Authorization Error' : 'Failed to process request',
        message: error.message,
        hint: isAuthError
          ? 'Check that INNGEST_SIGNING_KEY is correctly set in Supabase secrets'
          : 'Check function logs for details',
        timestamp: new Date().toISOString(),
        stack: Deno.env.get('VITE_ENV') === 'local' ? error.stack : undefined,
      }),
      {
        status: isAuthError ? 401 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});