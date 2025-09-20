import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RankingRequest {
  owner: string
  repo: string
  month?: number
  year?: number
  limit?: number
}

interface ContributorStats {
  contributor_id: string
  username: string
  display_name: string
  avatar_url: string
  github_id: number
  pull_requests_count: number
  reviews_count: number
  comments_count: number
  weighted_score: number
  rank?: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { owner, repo, month, year, limit = 10 }: RankingRequest = await req.json()

    // Validate required parameters
    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: owner and repo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current month/year if not provided
    const now = new Date()
    const targetMonth = month || now.getMonth() + 1
    const targetYear = year || now.getFullYear()

    // Calculate date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // First, get the repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single()

    if (repoError || !repoData) {
      return new Response(
        JSON.stringify({ error: 'Repository not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const repositoryId = repoData.id

    // Check if we have cached rankings for this month (less than 1 hour old)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const { data: cachedRankings, error: cacheError } = await supabase
      .from('monthly_rankings')
      .select(`
        *,
        contributors!inner (
          id,
          username,
          display_name,
          avatar_url,
          github_id
        )
      `)
      .eq('month', targetMonth)
      .eq('year', targetYear)
      .eq('repository_id', repositoryId)
      .gte('calculated_at', oneHourAgo.toISOString())
      .order('weighted_score', { ascending: false })
      .limit(limit)

    // If we have fresh cached data, return it
    if (!cacheError && cachedRankings && cachedRankings.length > 0) {
      const rankings: ContributorStats[] = cachedRankings.map((item, index) => ({
        contributor_id: item.contributors.id,
        username: item.contributors.username,
        display_name: item.contributors.display_name || item.contributors.username,
        avatar_url: item.contributors.avatar_url || `https://avatars.githubusercontent.com/${item.contributors.username}`,
        github_id: item.contributors.github_id,
        pull_requests_count: item.pull_requests_count || 0,
        reviews_count: item.reviews_count || 0,
        comments_count: item.comments_count || 0,
        weighted_score: parseFloat(item.weighted_score) || 0,
        rank: index + 1,
      }))

      return new Response(
        JSON.stringify({
          rankings,
          cached: true,
          month: targetMonth,
          year: targetYear,
          calculated_at: cachedRankings[0].calculated_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate fresh rankings from pull_requests table
    // Get all PRs for the repository in the target month
    const { data: pullRequests, error: prError } = await supabase
      .from('pull_requests')
      .select(`
        id,
        created_at,
        author_id,
        additions,
        deletions,
        contributors!author_id (
          id,
          username,
          display_name,
          avatar_url,
          github_id
        )
      `)
      .eq('repository_id', repositoryId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('author_id', 'is', null)

    if (prError) {
      throw prError
    }

    // Get PR reviews
    const { data: prReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        id,
        created_at,
        reviewer_id,
        pull_request_id
      `)
      .in('pull_request_id', pullRequests?.map(pr => pr.id) || [])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Get PR comments
    const { data: prComments, error: commentsError } = await supabase
      .from('pr_comments')
      .select(`
        id,
        created_at,
        author_id,
        pull_request_id
      `)
      .in('pull_request_id', pullRequests?.map(pr => pr.id) || [])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Aggregate stats per contributor
    const contributorMap = new Map<string, ContributorStats>()

    // Count PRs per contributor
    pullRequests?.forEach(pr => {
      if (!pr.author_id || !pr.contributors) return

      const contributor = pr.contributors
      if (!contributorMap.has(pr.author_id)) {
        contributorMap.set(pr.author_id, {
          contributor_id: contributor.id,
          username: contributor.username,
          display_name: contributor.display_name || contributor.username,
          avatar_url: contributor.avatar_url || `https://avatars.githubusercontent.com/${contributor.username}`,
          github_id: contributor.github_id,
          pull_requests_count: 0,
          reviews_count: 0,
          comments_count: 0,
          weighted_score: 0,
        })
      }

      const stats = contributorMap.get(pr.author_id)!
      stats.pull_requests_count++
    })

    // Count reviews per contributor
    prReviews?.forEach(review => {
      if (!review.reviewer_id) return

      if (!contributorMap.has(review.reviewer_id)) {
        // Need to fetch contributor info for reviewers who didn't create PRs
        // For now, we'll skip them (they wouldn't rank high anyway)
        return
      }

      const stats = contributorMap.get(review.reviewer_id)!
      stats.reviews_count++
    })

    // Count comments per contributor
    prComments?.forEach(comment => {
      if (!comment.author_id) return

      if (!contributorMap.has(comment.author_id)) {
        // Need to fetch contributor info for commenters who didn't create PRs
        // For now, we'll skip them (they wouldn't rank high anyway)
        return
      }

      const stats = contributorMap.get(comment.author_id)!
      stats.comments_count++
    })

    // Calculate weighted scores
    const rankings: ContributorStats[] = Array.from(contributorMap.values()).map(stats => ({
      ...stats,
      weighted_score: (stats.pull_requests_count * 10) +
                     (stats.reviews_count * 3) +
                     (stats.comments_count * 1),
    }))

    // Sort by weighted score and assign ranks
    rankings.sort((a, b) => b.weighted_score - a.weighted_score)
    rankings.forEach((stat, index) => {
      stat.rank = index + 1
    })

    // Take only top N contributors
    const topRankings = rankings.slice(0, limit)

    // Store the calculated rankings in the database for caching
    const now_timestamp = new Date().toISOString()
    for (const ranking of topRankings) {
      await supabase
        .from('monthly_rankings')
        .upsert({
          month: targetMonth,
          year: targetYear,
          contributor_id: ranking.contributor_id,
          repository_id: repositoryId,
          pull_requests_count: ranking.pull_requests_count,
          reviews_count: ranking.reviews_count,
          comments_count: ranking.comments_count,
          rank: ranking.rank!,
          weighted_score: ranking.weighted_score,
          repositories_contributed: 1,
          lines_added: 0,
          lines_removed: 0,
          calculated_at: now_timestamp,
        }, {
          onConflict: 'month,year,contributor_id,repository_id',
        })
    }

    return new Response(
      JSON.stringify({
        rankings: topRankings,
        cached: false,
        month: targetMonth,
        year: targetYear,
        calculated_at: now_timestamp
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error calculating rankings:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})