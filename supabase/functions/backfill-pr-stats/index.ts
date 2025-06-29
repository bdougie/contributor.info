// Backfill PR Statistics
// This function fetches missing additions, deletions, and changed_files for existing PRs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PRToUpdate {
  id: string;
  github_id: number;
  number: number;
  repository_owner: string;
  repository_name: string;
  html_url: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    
    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get query parameters
    const url = new URL(req.url)
    const batchSize = parseInt(url.searchParams.get('batch_size') || '50')
    const maxBatches = parseInt(url.searchParams.get('max_batches') || '10')
    
    console.log(`[Backfill] Starting with batch_size=${batchSize}, max_batches=${maxBatches}`)

    let totalProcessed = 0
    let totalErrors = 0
    let batchCount = 0

    while (batchCount < maxBatches) {
      // Get PRs that need stats (additions=0, deletions=0, changed_files=0)
      const { data: prsToUpdate, error: fetchError } = await supabase
        .from('pull_requests')
        .select(`
          id,
          github_id,
          number,
          repositories!repository_id(owner, name)
        `)
        .eq('additions', 0)
        .eq('deletions', 0)
        .eq('changed_files', 0)
        .limit(batchSize)

      if (fetchError) {
        console.error('[Backfill] Error fetching PRs:', fetchError)
        break
      }

      if (!prsToUpdate || prsToUpdate.length === 0) {
        console.log('[Backfill] No more PRs to update')
        break
      }

      console.log(`[Backfill] Processing batch ${batchCount + 1}: ${prsToUpdate.length} PRs`)

      // Process each PR in the batch
      for (const pr of prsToUpdate) {
        try {
          const repo = pr.repositories as any
          if (!repo?.owner || !repo?.name) {
            console.warn(`[Backfill] Skipping PR ${pr.number} - missing repository info`)
            console.log(`[Backfill] PR data:`, JSON.stringify(pr, null, 2))
            totalErrors++
            continue
          }

          // Fetch detailed PR data from GitHub
          const response = await fetch(
            `https://api.github.com/repos/${repo.owner}/${repo.name}/pulls/${pr.number}`,
            {
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          )

          if (!response.ok) {
            if (response.status === 404) {
              console.warn(`[Backfill] PR ${repo.owner}/${repo.name}#${pr.number} not found (deleted?)`)
            } else if (response.status === 403) {
              console.warn(`[Backfill] Rate limited or forbidden for ${repo.owner}/${repo.name}#${pr.number}`)
              // Break out of batch to avoid hitting rate limits harder
              break
            } else {
              console.error(`[Backfill] Failed to fetch ${repo.owner}/${repo.name}#${pr.number}: ${response.status}`)
            }
            totalErrors++
            continue
          }

          const detailedPR = await response.json()

          // Update the PR with detailed stats
          const { error: updateError } = await supabase
            .from('pull_requests')
            .update({
              additions: detailedPR.additions || 0,
              deletions: detailedPR.deletions || 0,
              changed_files: detailedPR.changed_files || 0,
              commits: detailedPR.commits || 0
            })
            .eq('id', pr.id)

          if (updateError) {
            console.error(`[Backfill] Error updating PR ${pr.number}:`, updateError)
            totalErrors++
          } else {
            console.log(`[Backfill] Updated PR ${repo.owner}/${repo.name}#${pr.number}: +${detailedPR.additions}/-${detailedPR.deletions}, ${detailedPR.changed_files} files`)
            totalProcessed++
          }

          // Small delay to be respectful to GitHub API
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`[Backfill] Error processing PR ${pr.number}:`, error)
          totalErrors++
        }
      }

      batchCount++
      console.log(`[Backfill] Completed batch ${batchCount}/${maxBatches}`)

      // Short delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const result = {
      success: true,
      batches_processed: batchCount,
      prs_updated: totalProcessed,
      errors: totalErrors,
      message: `Successfully processed ${totalProcessed} PRs with ${totalErrors} errors across ${batchCount} batches`
    }

    console.log('[Backfill] Final result:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('[Backfill] Unexpected error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})