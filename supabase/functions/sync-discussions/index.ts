import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/database.ts';
import {
  corsPreflightResponse,
  errorResponse,
  legacySuccessResponse,
  validationError,
  unauthorizedError,
} from '../_shared/responses.ts';

// GraphQL query to fetch discussions
const DISCUSSIONS_QUERY = `
  query($owner: String!, $name: String!, $first: Int!) {
    repository(owner: $owner, name: $name) {
      id
      discussions(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          number
          databaseId
          title
          body
          url
          createdAt
          updatedAt
          answerChosenAt
          isAnswered
          category {
            name
          }
          comments {
            totalCount
          }
          author {
            login
            avatarUrl
            ... on User {
              databaseId
            }
          }
        }
      }
    }
  }
`;

interface Discussion {
  number: number;
  databaseId: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  answerChosenAt: string | null;
  isAnswered: boolean;
  category: {
    name: string;
  };
  comments: {
    totalCount: number;
  };
  author: {
    login: string;
    avatarUrl: string;
    databaseId?: number;
  };
}

interface GraphQLResponse {
  data?: {
    repository: {
      id: string;
      discussions: {
        nodes: Discussion[];
      };
    };
  };
  errors?: Array<{ message: string }>;
}

async function fetchDiscussionsFromGitHub(
  owner: string,
  repo: string,
  maxItems: number,
  githubToken: string
): Promise<Discussion[]> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${githubToken}`,
    },
    body: JSON.stringify({
      query: DISCUSSIONS_QUERY,
      variables: {
        owner,
        name: repo,
        first: Math.min(maxItems, 100), // GitHub has max 100 per query
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const result: GraphQLResponse = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
  }

  return result.data?.repository.discussions.nodes || [];
}

interface ContributorRecord {
  id: string;
  username: string;
}

async function ensureContributor(
  supabase: ReturnType<typeof createSupabaseClient>,
  username: string,
  avatarUrl: string,
  githubId?: number
): Promise<string | null> {
  if (!githubId) {
    console.log('Skipping contributor %s (no github_id)', username);
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        username,
        avatar_url: avatarUrl,
        github_id: githubId,
      },
      {
        onConflict: 'github_id',
      }
    )
    .select('id')
    .maybeSingle<ContributorRecord>();

  if (error) {
    console.error('Failed to upsert contributor %s: %s', username, error.message);
    return null;
  }

  return data?.id ?? null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  if (req.method !== 'POST') {
    return validationError('Invalid method', 'Only POST requests are allowed');
  }

  try {
    const body = await req.json();
    const { owner, repo, workspace_id, max_items = 100 } = body;

    // Validate required fields
    if (!owner || !repo) {
      return validationError('Missing required fields', 'owner and repo parameters are required');
    }

    console.log('Syncing discussions for %s/%s (max: %d)', owner, repo, max_items);

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      return unauthorizedError('GitHub token not configured');
    }

    // Get repository ID
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (repoError || !repository) {
      console.error('Repository not found: %s/%s', owner, repo);
      return errorResponse(
        'Repository not found',
        404,
        'Repository not found in database',
        'REPOSITORY_NOT_FOUND'
      );
    }

    // Fetch discussions from GitHub
    const discussions = await fetchDiscussionsFromGitHub(owner, repo, max_items, githubToken);

    console.log('Fetched %d discussions from GitHub', discussions.length);

    // Process and store discussions
    let successCount = 0;
    let errorCount = 0;

    for (const discussion of discussions) {
      try {
        // Ensure author exists in contributors table
        const authorId = await ensureContributor(
          supabase,
          discussion.author.login,
          discussion.author.avatarUrl,
          discussion.author.databaseId
        );

        if (!authorId) {
          console.log('Skipping discussion #%d (no author ID)', discussion.number);
          errorCount++;
          continue;
        }

        // Upsert discussion
        const { error: discussionError } = await supabase.from('discussions').upsert(
          {
            github_id: discussion.databaseId.toString(),
            repository_id: repository.id,
            number: discussion.number,
            title: discussion.title,
            body: discussion.body,
            author_login: discussion.author.login,
            author_id: authorId,
            category: discussion.category.name,
            created_at: discussion.createdAt,
            updated_at: discussion.updatedAt,
            answer_chosen_at: discussion.answerChosenAt,
            is_answered: discussion.isAnswered,
            comments_count: discussion.comments.totalCount,
            html_url: discussion.url,
            synced_at: new Date().toISOString(),
          },
          {
            onConflict: 'github_id',
          }
        );

        if (discussionError) {
          console.error('Failed to upsert discussion #%d: %s', discussion.number, discussionError.message);
          errorCount++;
        } else {
          console.log('Successfully synced discussion #%d', discussion.number);
          successCount++;
        }
      } catch (error) {
        console.error('Error processing discussion #%d: %s', discussion.number, error);
        errorCount++;
      }
    }

    console.log(
      'Sync complete: %d succeeded, %d failed out of %d total',
      successCount,
      errorCount,
      discussions.length
    );

    return legacySuccessResponse(
      {
        summary: {
          total: discussions.length,
          successful: successCount,
          failed: errorCount,
        },
        workspace_id,
      },
      `Synced ${successCount} discussions`
    );
  } catch (error) {
    console.error('Sync error:', error);
    return errorResponse(
      'Sync discussions failed',
      500,
      error instanceof Error ? error.message : 'Unknown error occurred',
      'SYNC_FAILED'
    );
  }
});
