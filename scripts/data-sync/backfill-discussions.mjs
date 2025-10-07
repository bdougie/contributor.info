#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { graphql } from '@octokit/graphql';
import { parseArgs } from 'util';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'repository-id': { type: 'string' },
    'repository-name': { type: 'string' },
    'max-items': { type: 'string', default: '100' },
  },
});

const repositoryId = values['repository-id'];
const repositoryName = values['repository-name'];
const maxItems = parseInt(values['max-items'] || '100', 10);

if (!repositoryId || !repositoryName) {
  console.error('Missing required arguments: --repository-id and --repository-name');
  console.error(
    'Usage: node backfill-discussions.mjs --repository-id=<uuid> --repository-name=owner/repo'
  );
  process.exit(1);
}

// Initialize clients
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;
const githubToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client for summaries
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

if (!openai) {
  console.log('⚠️  No OPENAI_API_KEY found - summaries will not be generated');
}

// Use authenticated GraphQL if token is available, otherwise use public API for public repos
const graphqlClient = githubToken
  ? graphql.defaults({
      headers: {
        authorization: `token ${githubToken}`,
      },
    })
  : graphql;

if (!githubToken) {
  console.log('⚠️  No GITHUB_TOKEN found - using public API (works for public repositories only)');
}

// Parse owner and repo from repository name
const [owner, repo] = repositoryName.split('/');
if (!owner || !repo) {
  console.error('Invalid repository-name format. Expected: owner/repo');
  process.exit(1);
}

console.log(`Backfilling discussions for ${owner}/${repo} (${repositoryId})`);

/**
 * Generate AI summary for a discussion
 */
async function generateDiscussionSummary(discussion) {
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
  } catch (error) {
    console.error(`Failed to generate summary for discussion ${discussion.number}:`, error.message);
    return null;
  }
}

async function fetchDiscussions() {
  let hasNextPage = true;
  let cursor = null;
  let discussionsFetched = 0;
  const discussionsToInsert = [];

  while (hasNextPage && discussionsFetched < maxItems) {
    try {
      const response = await graphqlClient(
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
          owner,
          repo,
          cursor,
        }
      );

      const discussions = response.repository.discussions.nodes;
      const pageInfo = response.repository.discussions.pageInfo;

      console.log(`Fetched ${discussions.length} discussions from GitHub`);

      for (const discussion of discussions) {
        const discussionData = {
          id: discussion.id, // GraphQL node ID (string)
          github_id: discussion.number, // Use discussion number as numeric ID
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
        };

        // Generate AI summary
        const summary = await generateDiscussionSummary(discussion);
        if (summary) {
          discussionData.summary = summary;
        }

        discussionsToInsert.push(discussionData);

        // Rate limit summary generation
        if (openai) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      discussionsFetched += discussions.length;
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      console.log(`Progress: ${discussionsFetched}/${maxItems} discussions fetched`);
    } catch (error) {
      console.error('Error fetching discussions from GitHub:', error.message);
      if (error.errors) {
        console.error('GraphQL errors:', JSON.stringify(error.errors, null, 2));
      }
      break;
    }
  }

  return discussionsToInsert;
}

async function upsertDiscussionAuthors(discussions) {
  // Extract unique discussion authors
  const authors = discussions
    .filter((d) => d.author_login && d.author_id)
    .reduce((acc, discussion) => {
      const key = discussion.author_login;
      if (!acc.has(key)) {
        acc.set(key, {
          username: discussion.author_login,
          github_id: discussion.author_id,
          avatar_url: `https://avatars.githubusercontent.com/u/${discussion.author_id}`,
          first_seen_at: discussion.created_at,
        });
      }
      return acc;
    }, new Map());

  if (authors.size === 0) {
    console.log('No discussion authors to upsert');
    return;
  }

  console.log(`Upserting ${authors.size} discussion authors as contributors...`);

  const authorsArray = Array.from(authors.values());
  const { error } = await supabase.from('contributors').upsert(authorsArray, {
    onConflict: 'username',
    ignoreDuplicates: false,
  });

  if (error) {
    console.error('Error upserting discussion authors:', error);
    throw error;
  }

  console.log(`Successfully upserted ${authors.size} discussion authors`);
}

async function insertDiscussions(discussions) {
  if (discussions.length === 0) {
    console.log('No discussions to insert');
    return;
  }

  console.log(`Inserting ${discussions.length} discussions into database...`);

  const { data, error } = await supabase.from('discussions').upsert(discussions, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });

  if (error) {
    console.error('Error inserting discussions:', error);
    throw error;
  }

  console.log(`Successfully inserted/updated ${discussions.length} discussions`);
  return data;
}

async function main() {
  try {
    const discussions = await fetchDiscussions();
    await upsertDiscussionAuthors(discussions);
    await insertDiscussions(discussions);

    console.log('\n✅ Backfill completed successfully!');
    console.log(`Total discussions processed: ${discussions.length}`);
  } catch (error) {
    console.error('\n❌ Backfill failed:', error.message);
    process.exit(1);
  }
}

main();
