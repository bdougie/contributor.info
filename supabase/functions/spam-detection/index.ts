import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SpamDetectionService } from '../../../src/lib/spam/SpamDetectionService.ts'
import { PullRequestData } from '../../../src/lib/spam/types.ts'
import { batchProcessPRsForSpam } from '../_shared/spam-detection-integration.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SpamDetectionRequest {
  // Single PR detection
  pr_id?: string;
  
  // Batch detection
  repository_id?: string;
  repository_owner?: string;
  repository_name?: string;
  analyze_all?: boolean; // Analyze all repositories
  
  // Options
  limit?: number;
  force_recheck?: boolean; // Re-analyze PRs that already have spam scores
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[Spam Detection] Received spam detection request')

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request body
    const body: SpamDetectionRequest = await req.json().catch(() => ({}))
    const { pr_id, repository_id, repository_owner, repository_name, analyze_all = false, limit = 100, force_recheck = false } = body
    
    console.log('[Spam Detection] Request:', { 
      pr_id, 
      repository_id,
      repository_owner,
      repository_name,
      analyze_all,
      limit,
      force_recheck
    })

    const spamService = new SpamDetectionService();

    // Single PR detection
    if (pr_id) {
      console.log("[Spam Detection] Analyzing single PR: %s", pr_id)
      
      // Fetch PR data with all necessary joins
      const { data: pr, error: prError } = await supabase
        .from('pull_requests')
        .select(`
          id,
          github_id,
          number,
          title,
          body,
          additions,
          deletions,
          changed_files,
          created_at,
          html_url,
          spam_score,
          author:contributors!fk_pull_requests_author(
            id,
            github_id,
            username,
            created_at,
            first_seen_at
          ),
          repository:repositories(
            full_name
          )
        `)
        .eq('id', pr_id)
        .maybeSingle()
      
      if (prError || !pr) {
        throw new Error(`Pull request not found: ${pr_id}`)
      }
      
      // Skip if already has spam score and not forcing recheck
      if (pr.spam_score !== null && !force_recheck) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'PR already has spam score',
            spam_score: pr.spam_score
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
      
      // Convert to spam detection format
      const prData: PullRequestData = {
        id: pr.id,
        title: pr.title,
        body: pr.body || '',
        number: pr.number,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        created_at: pr.created_at,
        html_url: pr.html_url,
        author: {
          id: pr.author.github_id,
          login: pr.author.username,
          created_at: pr.author.created_at || pr.author.first_seen_at,
        },
        repository: {
          full_name: pr.repository.full_name,
        },
      };
      
      // Run spam detection
      const spamResult = await spamService.detectSpam(prData);
      
      // Update PR with spam detection results
      const { error: updateError } = await supabase
        .from('pull_requests')
        .update({
          spam_score: spamResult.spam_score,
          spam_flags: spamResult.flags,
          is_spam: spamResult.is_spam,
          spam_detected_at: spamResult.detected_at
        })
        .eq('id', pr.id);
      
      if (updateError) {
        throw new Error(`Failed to update PR: ${updateError.message}`)
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          pr_id: pr.id,
          pr_number: pr.number,
          spam_result: spamResult
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Analyze all repositories
    if (analyze_all) {
      console.log('[Spam Detection] Analyzing all repositories')
      
      // Get all repositories with PRs
      const { data: repositories, error: reposError } = await supabase
        .from('repositories')
        .select('id, full_name')
        .order('full_name')
      
      if (reposError) {
        throw new Error(`Failed to fetch repositories: ${reposError.message}`)
      }
      
      if (!repositories || repositories.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'No repositories found',
            processed: 0,
            errors: 0
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
      
      let totalProcessed = 0;
      let totalErrors = 0;
      const results = [];
      
      // Process each repository
      for (const repo of repositories) {
        try {
          console.log("[Spam Detection] Processing repository: %s", repo.full_name)
          
          // If force_recheck is true, clear existing spam scores first
          if (force_recheck) {
            console.log("[Spam Detection] Force recheck enabled for %s, clearing existing spam scores", repo.full_name)
            const { error: clearError } = await supabase
              .from('pull_requests')
              .update({
                spam_score: null,
                spam_flags: null,
                is_spam: null,
                spam_detected_at: null
              })
              .eq('repository_id', repo.id)
            
            if (clearError) {
              console.warn(`[Spam Detection] Error clearing spam scores for ${repo.full_name}:`, clearError)
            }
          }
          
          // Run batch processing for this repository
          const { processed, errors } = await batchProcessPRsForSpam(supabase, repo.id, limit)
          
          totalProcessed += processed;
          totalErrors += errors;
          
          results.push({
            repository_id: repo.id,
            repository_name: repo.full_name,
            processed,
            errors
          });
          
          console.log("[Spam Detection] Completed %s: ${processed} processed, ${errors} errors", repo.full_name)
          
        } catch (repoError) {
          console.error(`[Spam Detection] Error processing repository ${repo.full_name}:`, repoError)
          totalErrors++;
          results.push({
            repository_id: repo.id,
            repository_name: repo.full_name,
            processed: 0,
            errors: 1,
            error: repoError.message
          });
        }
      }
      
      // Get overall statistics
      const { data: overallStats, error: statsError } = await supabase
        .from('pull_requests')
        .select('spam_score, is_spam')
        .not('spam_score', 'is', null)
      
      let avgScore = 0;
      let spamCount = 0;
      
      if (overallStats && overallStats.length > 0) {
        avgScore = overallStats.reduce((sum, pr) => sum + pr.spam_score, 0) / overallStats.length;
        spamCount = overallStats.filter(pr => pr.is_spam).length;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          analyze_all: true,
          total_repositories: repositories.length,
          total_processed: totalProcessed,
          total_errors: totalErrors,
          results,
          overall_stats: {
            total_analyzed: overallStats?.length || 0,
            spam_count: spamCount,
            spam_percentage: overallStats?.length ? (spamCount / overallStats.length) * 100 : 0,
            avg_spam_score: Math.round(avgScore * 10) / 10
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Batch detection for repository
    if (repository_id || (repository_owner && repository_name)) {
      let repoId = repository_id;
      
      // If we have owner/name but not ID, look it up
      if (!repoId && repository_owner && repository_name) {
        const { data: repo, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', repository_owner)
          .eq('name', repository_name)
          .maybeSingle()
        
        if (repoError || !repo) {
          throw new Error(`Repository not found: ${repository_owner}/${repository_name}`)
        }
        
        repoId = repo.id;
      }
      
      console.log("[Spam Detection] Running batch detection for repository: %s", repoId)
      
      // If force_recheck is true, clear existing spam scores first
      if (force_recheck) {
        console.log('[Spam Detection] Force recheck enabled, clearing existing spam scores')
        const { error: clearError } = await supabase
          .from('pull_requests')
          .update({
            spam_score: null,
            spam_flags: null,
            is_spam: null,
            spam_detected_at: null
          })
          .eq('repository_id', repoId)
        
        if (clearError) {
          console.warn('[Spam Detection] Error clearing spam scores:', clearError)
        }
      }
      
      // Run batch processing
      const { processed, errors } = await batchProcessPRsForSpam(supabase, repoId, limit)
      
      // Get summary statistics
      const { data: stats, error: statsError } = await supabase
        .from('pull_requests')
        .select('spam_score, is_spam')
        .eq('repository_id', repoId)
        .not('spam_score', 'is', null)
      
      let avgScore = 0;
      let spamCount = 0;
      
      if (stats && stats.length > 0) {
        avgScore = stats.reduce((sum, pr) => sum + pr.spam_score, 0) / stats.length;
        spamCount = stats.filter(pr => pr.is_spam).length;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          repository_id: repoId,
          processed,
          errors,
          stats: {
            total_analyzed: stats?.length || 0,
            spam_count: spamCount,
            spam_percentage: stats?.length ? (spamCount / stats.length) * 100 : 0,
            avg_spam_score: Math.round(avgScore * 10) / 10
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // No valid parameters provided
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Invalid request. Provide either pr_id, repository details, or analyze_all=true.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('[Spam Detection] Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})