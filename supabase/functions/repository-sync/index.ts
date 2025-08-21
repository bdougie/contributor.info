// Supabase Edge Function for long-running repository sync operations
// Supports up to 150 seconds execution time on paid plans (50s on free tier)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Deno.serve is the new way to create edge functions
Deno.serve(async (req) => {
  // Function will be wrapped here
  return await handleRequest(req)
})

interface SyncRequest {
  owner: string;
  name: string;
  fullSync?: boolean;
  daysLimit?: number;
  prLimit?: number;
  resumeFrom?: string; // Cursor for resuming partial syncs
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    type?: string;
  };
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
}

// Constants
const MAX_PRS_PER_SYNC = 100;
const DEFAULT_DAYS_LIMIT = 30;
const GITHUB_API_BASE = 'https://api.github.com';

async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();
  
  try {
    // Parse request
    const { owner, name, fullSync = false, daysLimit = DEFAULT_DAYS_LIMIT, prLimit = MAX_PRS_PER_SYNC, resumeFrom } = 
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
    
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (!githubToken) {
      throw new Error('GitHub token not configured')
    }
    
    // Step 1: Verify repository exists and is tracked
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, github_id, full_name, is_tracked')
      .eq('owner', owner)
      .eq('name', name)
      .single()
    
    if (repoError || !repoData) {
      return new Response(
        JSON.stringify({ 
          error: 'Repository not found', 
          details: `${owner}/${name} is not tracked` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    if (!repoData.is_tracked) {
      return new Response(
        JSON.stringify({ 
          error: 'Repository not tracked', 
          details: 'Please track the repository first' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Step 2: Calculate date range for sync
    const cutoffDate = fullSync 
      ? new Date(0) // Beginning of time for full sync
      : new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);
    
    // Step 3: Fetch pull requests from GitHub
    const pullRequests: GitHubPullRequest[] = [];
    let page = 1;
    let hasMore = true;
    let cursor = resumeFrom;
    
    // If resuming, we need to find where we left off
    const resumeDate = resumeFrom ? new Date(resumeFrom) : null;
    
    while (hasMore && pullRequests.length < prLimit) {
      // Check execution time to avoid timeout (leave 10s buffer)
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const timeout = parseInt(Deno.env.get('SUPABASE_FUNCTION_TIMEOUT') || '50', 10);
      const maxExecutionTime = timeout - 10; // Leave 10s buffer for cleanup
      
      if (elapsedSeconds > maxExecutionTime) {
        // Save progress and return partial results
        await supabase
          .from('sync_progress')
          .upsert({
            repository_id: repoData.id,
            last_cursor: cursor,
            last_sync_at: new Date().toISOString(),
            prs_processed: pullRequests.length,
            status: 'partial'
          }, { onConflict: 'repository_id' })
        
        return new Response(
          JSON.stringify({
            success: true,
            partial: true,
            processed: pullRequests.length,
            resumeFrom: cursor,
            message: 'Partial sync completed due to time limit. Call again with resumeFrom cursor to continue.'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${name}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'contributor-info-sync'
          }
        }
      )
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }
      
      const prs = await response.json() as GitHubPullRequest[];
      
      if (prs.length === 0) {
        hasMore = false;
        break;
      }
      
      // Filter by date and resume cursor
      let reachedResumePoint = false;
      const filteredPrs = prs.filter(pr => {
        const prDate = new Date(pr.updated_at);
        
        // If resuming, skip PRs until we get past the ones we already processed
        if (resumeDate) {
          // Since PRs are sorted by updated_at DESC, we skip newer PRs until we reach the resume point
          if (prDate > resumeDate) {
            return false; // Skip PRs newer than resume point (already processed)
          } else if (prDate.getTime() === resumeDate.getTime()) {
            reachedResumePoint = true;
            return false; // Skip the PR at the exact resume point (already processed)
          }
        }
        
        return prDate >= cutoffDate;
      });
      
      pullRequests.push(...filteredPrs);
      
      // Check if we should stop fetching
      if (reachedResumePoint) {
        // We've reached the resume point, all older PRs are already processed
        hasMore = false;
      } else if (!fullSync && filteredPrs.length < prs.length) {
        // We've gone past the cutoff date
        hasMore = false;
      } else if (prs.length < 100) {
        // No more pages available
        hasMore = false;
      } else {
        page++;
        cursor = prs[prs.length - 1].updated_at; // Save cursor for resume
      }
    }
    
    // Step 4: Process and store pull requests
    let processed = 0;
    let errors = 0;
    
    for (const pr of pullRequests) {
      try {
        // Ensure contributor exists
        const contributorId = await ensureContributor(supabase, pr.user);
        
        if (!contributorId) {
          errors++;
          continue;
        }
        
        // Upsert pull request
        const { error: prError } = await supabase
          .from('pull_requests')
          .upsert({
            github_id: pr.id,
            repository_id: repoData.id,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            closed_at: pr.closed_at,
            merged_at: pr.merged_at,
            merged: pr.merged_at !== null,
            merge_commit_sha: pr.merge_commit_sha,
            base_branch: pr.base.ref,
            head_branch: pr.head.ref,
            additions: pr.additions || 0,
            deletions: pr.deletions || 0,
            changed_files: pr.changed_files || 0,
            commits: pr.commits || 0,
            author_id: contributorId,
            html_url: `https://github.com/${owner}/${name}/pull/${pr.number}`,
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'github_id',
            ignoreDuplicates: false
          })
        
        if (prError) {
          console.error(`Error upserting PR #${pr.number}:`, prError)
          errors++;
        } else {
          processed++;
        }
      } catch (error) {
        console.error(`Error processing PR #${pr.number}:`, error)
        errors++;
      }
    }
    
    // Step 5: Update repository last sync time
    await supabase
      .from('repositories')
      .update({ 
        last_synced_at: new Date().toISOString(),
        sync_status: 'completed'
      })
      .eq('id', repoData.id)
    
    // Clear sync progress if this was a complete sync (not partial)
    // Only clear if we processed everything and didn't hit the time limit
    await supabase
      .from('sync_progress')
      .delete()
      .eq('repository_id', repoData.id)
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        repository: `${owner}/${name}`,
        processed,
        errors,
        totalFound: pullRequests.length,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        syncType: fullSync ? 'full' : 'incremental',
        dateRange: fullSync ? 'all' : `last ${daysLimit} days`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Sync error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Sync failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Helper function to ensure contributor exists
async function ensureContributor(supabase: any, githubUser: any): Promise<string | null> {
  if (!githubUser || !githubUser.id) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert({
      github_id: githubUser.id,
      username: githubUser.login,
      display_name: githubUser.name || null,
      email: githubUser.email || null,
      avatar_url: githubUser.avatar_url || null,
      profile_url: `https://github.com/${githubUser.login}`,
      is_bot: githubUser.type === 'Bot' || githubUser.login.includes('[bot]'),
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