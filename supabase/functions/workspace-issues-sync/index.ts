// Workspace Issues Sync Function
// Fetches issues for repositories that belong to workspaces
// Only syncs issues created/updated in the last 24 hours (configurable)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface WorkspaceIssuesSyncRequest {
  workspaceId?: string
  hoursBack?: number
  limit?: number
  dryRun?: boolean
}

interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  created_at: string
  updated_at: string
  closed_at: string | null
  user: {
    id: number
    login: string
    avatar_url: string
    type: string
  }
  labels: Array<{
    id: number
    name: string
    color: string
    description: string | null
  }>
  assignees: Array<{
    id: number
    login: string
    avatar_url: string
  }>
  milestone: {
    id: number
    number: number
    title: string
    state: string
  } | null
  comments: number
  pull_request?: {
    url: string
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { 
      workspaceId, 
      hoursBack = 24, 
      limit = 10,
      dryRun = false 
    } = await req.json() as WorkspaceIssuesSyncRequest

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const githubToken = Deno.env.get('GITHUB_TOKEN')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get workspace repositories that need issues sync
    let query = supabase
      .from('workspace_tracked_repositories')
      .select(`
        workspace_id,
        tracked_repository_id,
        priority_score,
        last_sync_at,
        sync_frequency_hours,
        sync_attempts,
        workspaces!inner(
          name,
          tier
        ),
        tracked_repositories!inner(
          repository_id,
          repositories!inner(
            id,
            full_name,
            owner,
            name,
            has_issues
          )
        )
      `)
      .eq('fetch_issues', true)
      .lte('next_sync_at', new Date().toISOString())
      .order('priority_score', { ascending: false })
      .limit(limit)

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data: workspaceRepos, error: reposError } = await query

    if (reposError) {
      throw new Error(`Failed to fetch workspace repositories: ${reposError.message}`)
    }

    if (!workspaceRepos || workspaceRepos.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No workspace repositories need issues sync',
          synced: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log("Found %s repositories to sync issues for", workspaceRepos.length)

    // Calculate the time window for issues
    const sinceDate = new Date()
    sinceDate.setHours(sinceDate.getHours() - hoursBack)
    const since = sinceDate.toISOString()

    const results = []
    let totalIssuesSynced = 0
    let totalApiCalls = 0

    // Process each repository
    for (const repo of workspaceRepos) {
      const repository = repo.tracked_repositories?.repositories
      if (!repository || !repository.has_issues) {
        console.log("Skipping %s: issues disabled", repository?.full_name || 'unknown')
        continue
      }

      const { owner, name, id: repositoryId } = repository
      const workspaceName = repo.workspaces?.name || 'Unknown'
      const tier = repo.workspaces?.tier || 'free'

      console.log("Syncing issues for %s/${name} (workspace: ${workspaceName}, tier: ${tier})", owner)

      try {
        // Fetch issues from GitHub API with pagination support
        let allIssues: GitHubIssue[] = []
        let page = 1
        const maxPages = 5 // Limit to 5 pages (500 issues) to avoid timeout
        
        while (page <= maxPages) {
          const issuesUrl = `https://api.github.com/repos/${owner}/${name}/issues?state=all&since=${since}&per_page=100&sort=updated&direction=desc&page=${page}`
          
          const response = await fetch(issuesUrl, {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'contributor-info-workspace-sync'
            }
          })

          totalApiCalls++

          if (!response.ok) {
            console.error(`GitHub API error for ${owner}/${name}: ${response.status}`)
            if (page === 1) {
              // Only fail completely if first page fails
              results.push({
                repository: `${owner}/${name}`,
                success: false,
                error: `GitHub API returned ${response.status}`
              })
              break
            } else {
              // If subsequent pages fail, continue with what we have
              console.warn(`Failed to fetch page ${page}, continuing with ${allIssues.length} issues`)
              break
            }
          }

          const pageIssues = await response.json() as GitHubIssue[]
          
          if (pageIssues.length === 0) {
            break // No more issues
          }
          
          allIssues = allIssues.concat(pageIssues)
          
          // Check if we've reached the last page
          const linkHeader = response.headers.get('link')
          if (!linkHeader || !linkHeader.includes('rel="next"')) {
            break
          }
          
          page++
        }
        
        if (allIssues.length === 0 && page === 1) {
          continue // Skip if we couldn't fetch any issues
        }
        
        // Filter out pull requests (they have a pull_request field)
        const actualIssues = allIssues.filter(issue => !issue.pull_request)
        
        console.log("Found %s issues for ${owner}/${name}", actualIssues.length)

        if (actualIssues.length === 0) {
          results.push({
            repository: `${owner}/${name}`,
            success: true,
            issuesFound: 0,
            issuesSynced: 0
          })
          continue
        }

        if (dryRun) {
          results.push({
            repository: `${owner}/${name}`,
            success: true,
            issuesFound: actualIssues.length,
            issuesSynced: 0,
            dryRun: true
          })
          continue
        }

        // Process and store issues
        let syncedCount = 0
        for (const issue of actualIssues) {
          // Ensure author exists
          const authorId = await ensureContributorExists(supabase, issue.user)

          // Prepare issue data
          const issueData = {
            github_id: issue.id,
            repository_id: repositoryId,
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author_id: authorId,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
            labels: issue.labels,
            assignees: issue.assignees.map(a => ({
              id: a.id,
              login: a.login,
              avatar_url: a.avatar_url
            })),
            milestone: issue.milestone,
            comments_count: issue.comments,
            is_pull_request: false
          }

          // Upsert issue
          const { error: issueError } = await supabase
            .from('issues')
            .upsert(issueData, {
              onConflict: 'github_id',
              ignoreDuplicates: false
            })

          if (issueError) {
            console.error(`Failed to upsert issue #${issue.number}:`, issueError)
          } else {
            syncedCount++
          }
        }

        totalIssuesSynced += syncedCount

        // Update sync status for this repository
        const syncFrequencyHours = repo.sync_frequency_hours || 24 // Default to 24 hours if not set
        const { error: updateError } = await supabase
          .from('workspace_tracked_repositories')
          .update({
            last_sync_at: new Date().toISOString(),
            next_sync_at: new Date(Date.now() + syncFrequencyHours * 60 * 60 * 1000).toISOString(),
            last_sync_status: 'success',
            total_issues_fetched: syncedCount
          })
          .eq('workspace_id', repo.workspace_id)
          .eq('tracked_repository_id', repo.tracked_repository_id)

        if (updateError) {
          console.error(`Failed to update sync status:`, updateError)
        }

        results.push({
          repository: `${owner}/${name}`,
          workspace: workspaceName,
          tier,
          success: true,
          issuesFound: actualIssues.length,
          issuesSynced: syncedCount
        })

      } catch (error) {
        console.error(`Error syncing issues for ${owner}/${name}:`, error)
        
        // Update sync status with error
        const currentAttempts = repo.sync_attempts || 0
        await supabase
          .from('workspace_tracked_repositories')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'failed',
            last_sync_error: error.message,
            sync_attempts: currentAttempts + 1
          })
          .eq('workspace_id', repo.workspace_id)
          .eq('tracked_repository_id', repo.tracked_repository_id)

        results.push({
          repository: `${owner}/${name}`,
          success: false,
          error: error.message
        })
      }
    }

    // Update daily activity metrics if issues were synced
    if (totalIssuesSynced > 0 && !dryRun) {
      await updateDailyMetrics(supabase, results)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalIssuesSynced} issues from ${results.length} repositories`,
        totalApiCalls,
        hoursBack,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in workspace issues sync:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Helper function to ensure contributor exists
async function ensureContributorExists(supabase: any, githubUser: any): Promise<string | null> {
  if (!githubUser || !githubUser.id) {
    return null
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert({
      github_id: githubUser.id,
      username: githubUser.login,
      avatar_url: githubUser.avatar_url,
      profile_url: `https://github.com/${githubUser.login}`,
      is_bot: githubUser.type === 'Bot',
      is_active: true,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString()
    }, {
      onConflict: 'github_id',
      ignoreDuplicates: false
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error upserting contributor:', error)
    return null
  }

  return data.id
}

// Helper function to update daily activity metrics
async function updateDailyMetrics(supabase: any, results: any[]) {
  const today = new Date().toISOString().split('T')[0]
  
  for (const result of results) {
    if (!result.success || result.issuesSynced === 0) continue

    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('full_name', result.repository)
      .single()

    if (repo) {
      // Update or insert daily metrics
      await supabase
        .from('daily_activity_metrics')
        .upsert({
          repository_id: repo.id,
          date: today,
          issues_opened: result.issuesSynced, // Simplified - would need more logic for accurate counts
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'repository_id,date'
        })
    }
  }
}