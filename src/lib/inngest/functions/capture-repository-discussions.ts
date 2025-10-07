import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { graphql } from '@octokit/graphql';
import { NonRetriableError } from 'inngest';
import { SyncLogger } from '../sync-logger';
import OpenAI from 'openai';

// GitHub Discussion from GraphQL API
interface GitHubDiscussion {
  id: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  locked: boolean;
  author: {
    login: string;
    databaseId?: number;
  } | null;
  category: {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
  } | null;
  answer: {
    id: string;
    createdAt: string;
    author: {
      login: string;
    } | null;
  } | null;
  upvoteCount: number;
  comments: {
    totalCount: number;
  };
}

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

/**
 * Generate AI summary for a discussion
 */
async function generateDiscussionSummary(discussion: GitHubDiscussion): Promise<string | null> {
  if (!openai) {
    return null;
  }

  try {
    const bodyPreview = discussion.body?.substring(0, 500) || '';
    const prompt = `Summarize this GitHub discussion in 1-2 concise sentences (max 150 chars). Focus on the MAIN QUESTION or TOPIC and KEY POINTS. Use plain text only.

Title: ${discussion.title}
Body: ${bodyPreview}

Summary:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(
      'Failed to generate summary for discussion %s: %s',
      discussion.number,
      err.message
    );
    return null;
  }
}

/**
 * Captures all discussions in a repository
 * This function discovers discussions and stores them with AI-generated summaries
 */
export const captureRepositoryDiscussions = inngest.createFunction(
  {
    id: 'capture-repository-discussions',
    name: 'Capture Repository Discussions',
    concurrency: {
      limit: 2,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 20,
      period: '1m',
    },
  },
  { event: 'capture/repository.discussions' },
  async ({ event, step }) => {
    const { repositoryId, maxItems = 100 } = event.data;
    const syncLogger = new SyncLogger();
    let apiCallsUsed = 0;

    // Step 0: Initialize sync log
    await step.run('init-sync-log', async () => {
      return await syncLogger.start('repository_discussions', repositoryId, {
        maxItems,
        source: 'inngest',
        purpose: 'discussion_sync',
      });
    });

    // Step 1: Get repository details
    const repository = await step.run('get-repository', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, has_discussions')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new NonRetriableError(`Repository not found: ${repositoryId}`);
      }

      // Skip if repository doesn't have discussions enabled
      if (!data.has_discussions) {
        throw new NonRetriableError(
          `Repository ${data.owner}/${data.name} does not have discussions enabled`
        );
      }

      return data;
    });

    // Step 2: Fetch discussions using GraphQL
    const discussionsData = await step.run('fetch-discussions', async () => {
      const githubToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;

      const graphqlClient = githubToken
        ? graphql.defaults({
            headers: {
              authorization: `token ${githubToken}`,
            },
          })
        : graphql;

      const discussions: GitHubDiscussion[] = [];
      let hasNextPage = true;
      let cursor: string | null = null;

      try {
        console.log('Fetching discussions for %s/%s', repository.owner, repository.name);

        while (hasNextPage && discussions.length < maxItems) {
          apiCallsUsed++;

          type GraphQLResponse = {
            repository: {
              discussions: {
                pageInfo: {
                  hasNextPage: boolean;
                  endCursor: string;
                };
                nodes: GitHubDiscussion[];
              };
            };
          };

          const response: GraphQLResponse = await graphqlClient<GraphQLResponse>(
            `
            query($owner: String!, $repo: String!, $cursor: String) {
              repository(owner: $owner, name: $repo) {
                discussions(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    number
                    title
                    body
                    url
                    createdAt
                    updatedAt
                    locked
                    author {
                      login
                      ... on User {
                        databaseId
                      }
                    }
                    category {
                      id
                      name
                      description
                      emoji
                    }
                    answer {
                      id
                      createdAt
                      author {
                        login
                      }
                    }
                    upvoteCount
                    comments {
                      totalCount
                    }
                  }
                }
              }
            }
            `,
            {
              owner: repository.owner,
              repo: repository.name,
              cursor,
            }
          );

          const pageDiscussions: GitHubDiscussion[] = response.repository.discussions.nodes;
          const pageInfo: { hasNextPage: boolean; endCursor: string } =
            response.repository.discussions.pageInfo;

          discussions.push(...pageDiscussions);
          hasNextPage = pageInfo.hasNextPage;
          cursor = pageInfo.endCursor;

          console.log(
            'Fetched %d discussions (%d total so far)',
            pageDiscussions.length,
            discussions.length
          );
        }

        await syncLogger.update({
          github_api_calls_used: apiCallsUsed,
          metadata: {
            discussionsFetched: discussions.length,
            maxItems,
          },
        });

        return discussions;
      } catch (error: unknown) {
        const err = error as { message?: string; errors?: unknown[] };
        console.error(
          'Error fetching discussions for %s/%s: %s',
          repository.owner,
          repository.name,
          err.message
        );
        if (err.errors) {
          console.error('GraphQL errors: %s', JSON.stringify(err.errors, null, 2));
        }
        throw error;
      }
    });

    // Step 3: Upsert discussion authors as contributors
    await step.run('upsert-discussion-authors', async () => {
      if (discussionsData.length === 0) return;

      // Extract unique discussion authors
      const authors = discussionsData
        .filter((d) => d.author?.login && d.author?.databaseId)
        .reduce((acc, discussion) => {
          const key = discussion.author!.login;
          if (!acc.has(key)) {
            acc.set(key, {
              username: discussion.author!.login,
              github_id: discussion.author!.databaseId,
              avatar_url: `https://avatars.githubusercontent.com/u/${discussion.author!.databaseId}`,
              first_seen_at: discussion.createdAt,
            });
          }
          return acc;
        }, new Map());

      if (authors.size === 0) {
        console.log('No discussion authors to upsert');
        return;
      }

      console.log('Upserting %d discussion authors as contributors...', authors.size);

      const authorsArray = Array.from(authors.values());
      const { error } = await supabase.from('contributors').upsert(authorsArray, {
        onConflict: 'username',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error('Error upserting discussion authors: %s', error.message);
        throw error;
      }

      console.log('Successfully upserted %d discussion authors', authors.size);
    });

    // Step 4: Store discussions with AI summaries
    const processedCount = await step.run('process-discussions', async () => {
      if (discussionsData.length === 0) {
        return 0;
      }

      const discussionsToInsert = [];

      for (const discussion of discussionsData) {
        // Generate AI summary
        const summary = await generateDiscussionSummary(discussion);

        // Rate limit summary generation
        if (openai) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        discussionsToInsert.push({
          id: discussion.id,
          github_id: discussion.number,
          repository_id: repositoryId,
          number: discussion.number,
          title: discussion.title,
          body: discussion.body,
          url: discussion.url,
          created_at: discussion.createdAt,
          updated_at: discussion.updatedAt,
          locked: discussion.locked,
          author_login: discussion.author?.login || null,
          author_id: discussion.author?.databaseId || null,
          category_id: discussion.category?.id || null,
          category_name: discussion.category?.name || null,
          category_description: discussion.category?.description || null,
          category_emoji: discussion.category?.emoji || null,
          is_answered: !!discussion.answer,
          answer_id: discussion.answer?.id || null,
          answer_chosen_at: discussion.answer?.createdAt || null,
          answer_chosen_by: discussion.answer?.author?.login || null,
          upvote_count: discussion.upvoteCount || 0,
          comment_count: discussion.comments.totalCount || 0,
          summary: summary || null,
        });
      }

      const { error } = await supabase.from('discussions').upsert(discussionsToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error('Error inserting discussions: %s', error.message);
        throw error;
      }

      console.log('Successfully inserted/updated %d discussions', discussionsToInsert.length);
      return discussionsToInsert.length;
    });

    // Complete sync log
    await step.run('complete-sync-log', async () => {
      await syncLogger.complete({
        records_processed: discussionsData.length,
        records_inserted: processedCount,
        github_api_calls_used: apiCallsUsed,
        metadata: {
          discussionsFetched: discussionsData.length,
          discussionsStored: processedCount,
          summariesGenerated: openai ? processedCount : 0,
        },
      });
    });

    return {
      success: true,
      repositoryId,
      discussionsProcessed: discussionsData.length,
      discussionsStored: processedCount,
    };
  }
);
