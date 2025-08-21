// Supabase Edge Function for GraphQL-based repository sync
// More efficient than REST API for bulk operations
// Supports up to 150 seconds execution time on paid plans

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Deno.serve is the new way to create edge functions
Deno.serve(async (req) => {
  return await handleRequest(req)
})

interface SyncRequest {
  owner: string;
  name: string;
  fullSync?: boolean;
  daysLimit?: number;
  cursor?: string; // GraphQL cursor for pagination
}

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql';
const MAX_PRS_PER_QUERY = 100;
const DEFAULT_DAYS_LIMIT = 30;

// GraphQL query for fetching pull requests with all details in one request
const PULL_REQUESTS_QUERY = `
  query GetPullRequests($owner: String!, $name: String!, $cursor: String, $since: DateTime) {
    repository(owner: $owner, name: $name) {
      id
      databaseId
      pullRequests(first: 100, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
        nodes {
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
              bio
              company
              location
              websiteUrl
              followers {
                totalCount
              }
              following {
                totalCount
              }
              repositories {
                totalCount
              }
              createdAt
            }
            ... on Bot {
              id
              databaseId
              login
              avatarUrl
              createdAt
            }
          }
          reviews(first: 50) {
            totalCount
            nodes {
              id
              databaseId
              state
              body
              submittedAt
              author {
                ... on User {
                  id
                  databaseId
                  login
                  avatarUrl
                }
              }
            }
          }
          comments(first: 50) {
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
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();
  
  try {
    // Parse request
    const { owner, name, fullSync = false, daysLimit = DEFAULT_DAYS_LIMIT, cursor } = 
      await req.json() as SyncRequest;
    
    // Validate input parameters
    if (!owner || !name) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          details: 'Both owner and name are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (!githubToken) {
      throw new Error('GitHub token not configured')
    }
    
    // Verify repository exists and is tracked
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, github_id, full_name, is_tracked')
      .eq('owner', owner)
      .eq('name', name)
      .single()
    
    if (repoError || !repoData) {
      return new Response(
        JSON.stringify({ error: 'Repository not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!repoData.is_tracked) {
      return new Response(
        JSON.stringify({ error: 'Repository not tracked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Calculate since date for incremental sync
    const since = fullSync ? null : new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch pull requests via GraphQL
    let hasNextPage = true;
    let currentCursor = cursor;
    let totalProcessed = 0;
    let totalErrors = 0;
    const allPullRequests = [];
    
    while (hasNextPage) {
      // Check execution time (leave 10s buffer)
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const timeout = parseInt(Deno.env.get('SUPABASE_FUNCTION_TIMEOUT') || '50', 10);
      const maxExecutionTime = timeout - 10; // Leave 10s buffer for cleanup
      
      if (elapsedSeconds > maxExecutionTime) {
        // Save progress for resume
        await supabase
          .from('sync_progress')
          .upsert({
            repository_id: repoData.id,
            last_cursor: currentCursor,
            last_sync_at: new Date().toISOString(),
            prs_processed: totalProcessed,
            status: 'partial'
          }, { onConflict: 'repository_id' })
        
        return new Response(
          JSON.stringify({
            success: true,
            partial: true,
            processed: totalProcessed,
            resumeCursor: currentCursor,
            message: 'Partial sync completed. Resume with cursor.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Execute GraphQL query
      const response = await fetch(GITHUB_GRAPHQL_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: PULL_REQUESTS_QUERY,
          variables: { owner, name, cursor: currentCursor, since }
        })
      })
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
      }
      
      const repository = result.data.repository;
      const pullRequests = repository.pullRequests;
      
      // Check rate limit
      const rateLimit = result.data.rateLimit;
      if (rateLimit.remaining < 10) {
        console.warn('Low rate limit remaining:', rateLimit.remaining)
      }
      
      // Process pull requests
      for (const pr of pullRequests.nodes) {
        if (!pr) continue;
        
        try {
          // Check if PR is within date range for incremental sync
          if (!fullSync && since) {
            const prDate = new Date(pr.updatedAt);
            if (prDate < new Date(since)) {
              hasNextPage = false; // Stop fetching older PRs
              break;
            }
          }
          
          // Ensure author exists
          let authorId = null;
          if (pr.author) {
            const isBot = !pr.author.email; // Bots don't have email in GraphQL
            authorId = await ensureContributorGraphQL(supabase, pr.author, isBot);
          }
          
          // Upsert pull request
          const { error: prError } = await supabase
            .from('pull_requests')
            .upsert({
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
              last_synced_at: new Date().toISOString()
            }, {
              onConflict: 'github_id',
              ignoreDuplicates: false
            })
          
          if (prError) {
            console.error(`Error upserting PR #${pr.number}:`, prError)
            totalErrors++;
            continue;
          }
          
          // Process reviews if present
          if (pr.reviews?.nodes?.length > 0) {
            for (const review of pr.reviews.nodes) {
              if (!review || !review.author) continue;
              
              const reviewerId = await ensureContributorGraphQL(supabase, review.author, false);
              
              if (reviewerId) {
                await supabase
                  .from('reviews')
                  .upsert({
                    github_id: review.databaseId,
                    pull_request_id: pr.databaseId,
                    author_id: reviewerId,
                    state: review.state,
                    body: review.body,
                    submitted_at: review.submittedAt,
                    last_updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'github_id',
                    ignoreDuplicates: false
                  })
              }
            }
          }
          
          // Process comments if present
          if (pr.comments?.nodes?.length > 0) {
            for (const comment of pr.comments.nodes) {
              if (!comment || !comment.author) continue;
              
              const commenterId = await ensureContributorGraphQL(supabase, comment.author, false);
              
              if (commenterId) {
                await supabase
                  .from('comments')
                  .upsert({
                    github_id: comment.databaseId,
                    pull_request_id: pr.databaseId,
                    commenter_id: commenterId,
                    body: comment.body,
                    comment_type: 'issue',
                    created_at: comment.createdAt,
                    updated_at: comment.createdAt
                  }, {
                    onConflict: 'github_id',
                    ignoreDuplicates: false
                  })
              }
            }
          }
          
          totalProcessed++;
          allPullRequests.push(pr);
          
        } catch (error) {
          console.error(`Error processing PR #${pr.number}:`, error)
          totalErrors++;
        }
      }
      
      // Check for next page
      hasNextPage = pullRequests.pageInfo.hasNextPage && (fullSync || !since || hasNextPage);
      currentCursor = pullRequests.pageInfo.endCursor;
    }
    
    // Update repository last sync time
    await supabase
      .from('repositories')
      .update({ 
        last_synced_at: new Date().toISOString(),
        sync_status: 'completed',
        total_pull_requests: allPullRequests.length
      })
      .eq('id', repoData.id)
    
    // Clear sync progress if completed
    await supabase
      .from('sync_progress')
      .delete()
      .eq('repository_id', repoData.id)
    
    return new Response(
      JSON.stringify({
        success: true,
        repository: `${owner}/${name}`,
        processed: totalProcessed,
        errors: totalErrors,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        syncType: fullSync ? 'full' : 'incremental',
        method: 'graphql'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('GraphQL sync error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Sync failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Helper function for GraphQL contributor data
async function ensureContributorGraphQL(supabase: any, author: any, isBot: boolean): Promise<string | null> {
  if (!author || !author.databaseId) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert({
      github_id: author.databaseId,
      username: author.login,
      display_name: author.name || null,
      email: author.email || null,
      avatar_url: author.avatarUrl || null,
      profile_url: `https://github.com/${author.login}`,
      bio: author.bio || null,
      company: author.company || null,
      location: author.location || null,
      blog: author.websiteUrl || null,
      followers: author.followers?.totalCount || 0,
      following: author.following?.totalCount || 0,
      public_repos: author.repositories?.totalCount || 0,
      github_created_at: author.createdAt || new Date().toISOString(),
      is_bot: isBot || author.login.includes('[bot]'),
      is_active: true,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    }, {
      onConflict: 'github_id',
      ignoreDuplicates: false
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error upserting contributor:', error);
    return null;
  }

  return data?.id || null;
}