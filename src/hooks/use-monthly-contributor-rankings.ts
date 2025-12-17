import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import { captureException } from '@/lib/sentry-lazy';
import { trackEvent } from '@/lib/posthog-lazy';

export interface MonthlyContributorRanking {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  profileUrl: string;
  pullRequestsCount: number;
  reviewsCount: number;
  commentsCount: number;
  weightedScore: number;
  rank: number;
}

export interface MonthlyRankingsResult {
  rankings: MonthlyContributorRanking[] | null;
  loading: boolean;
  error: Error | null;
  isUsingFallback: boolean;
  displayMonth?: string;
  displayYear?: number;
  isCalculating?: boolean;
}

export function useMonthlyContributorRankings(owner: string, repo: string): MonthlyRankingsResult {
  const [rankings, setRankings] = useState<MonthlyContributorRanking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<string>();
  const [displayYear, setDisplayYear] = useState<number>();
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    async function fetchRankings() {
      try {
        setLoading(true);
        setIsUsingFallback(false);
        setIsCalculating(false);

        // Get current month and year using UTC to match Edge Function
        const now = new Date();
        const dayOfMonth = now.getUTCDate();
        const isWinnerPhase = dayOfMonth >= 1 && dayOfMonth <= 7;

        // Determine which month to request based on cycle phase
        let targetMonth: number;
        let targetYear: number;

        if (isWinnerPhase) {
          // Winner announcement phase (1st-7th): request previous month's data
          const previousMonthDate = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
          );
          targetMonth = previousMonthDate.getUTCMonth() + 1;
          targetYear = previousMonthDate.getUTCFullYear();
        } else {
          // Running leaderboard phase (8th+): request current month's data
          targetMonth = now.getUTCMonth() + 1;
          targetYear = now.getUTCFullYear();
        }

        // First, try to call the Edge Function for on-demand calculation
        try {
          setIsCalculating(true);

          // Get current session for authentication
          const supabase = await getSupabase();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          const { data: functionData, error: functionError } = await supabase.functions.invoke(
            'calculate-monthly-rankings',
            {
              body: {
                owner,
                repo,
                month: targetMonth,
                year: targetYear,
                limit: 10,
              },
              headers: session
                ? {
                    Authorization: `Bearer ${session.access_token}`,
                  }
                : undefined,
            }
          );

          if (!functionError && functionData?.rankings) {
            // Transform the data from the Edge Function
            const transformedRankings: MonthlyContributorRanking[] = functionData.rankings.map(
              (item: {
                contributor_id: string;
                username: string;
                display_name?: string;
                avatar_url?: string;
                pull_requests_count: number;
                reviews_count: number;
                comments_count: number;
                weighted_score: number;
                rank: number;
              }) => ({
                id: item.contributor_id,
                username: item.username,
                displayName: item.display_name || item.username,
                avatarUrl: item.avatar_url || `https://github.com/${item.username}.png`,
                profileUrl: `https://github.com/${item.username}`,
                pullRequestsCount: item.pull_requests_count || 0,
                reviewsCount: item.reviews_count || 0,
                commentsCount: item.comments_count || 0,
                weightedScore: item.weighted_score || 0,
                rank: item.rank || 0,
              })
            );

            setRankings(transformedRankings);
            setDisplayMonth(
              new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
            );
            setDisplayYear(targetYear);
            setIsCalculating(false);
            return; // Successfully got rankings from Edge Function
          }
          // Edge function failed, reset state before falling back
          setIsCalculating(false);
        } catch (err) {
          // Track edge function errors to Sentry + PostHog
          const errorMessage = err instanceof Error ? err.message : 'Unknown edge function error';

          // Only track non-404 errors as actual errors (404 = repo not set up yet, expected)
          const is404 = errorMessage.includes('not found') || errorMessage.includes('404');

          if (!is404) {
            captureException(new Error(`Monthly rankings edge function error: ${errorMessage}`), {
              level: 'warning',
              tags: {
                type: 'edge_function_error',
                function: 'calculate-monthly-rankings',
              },
              extra: {
                owner,
                repo,
                targetMonth,
                targetYear,
              },
            });
          }

          // Track to PostHog for monitoring (including 404s for visibility)
          trackEvent('edge_function_error', {
            function_name: 'calculate-monthly-rankings',
            repository: `${owner}/${repo}`,
            error_message: errorMessage,
            is_expected_404: is404,
            target_month: targetMonth,
            target_year: targetYear,
          });

          console.log('Edge function error:', err, 'Falling back to database query');
          // Reset state before fallback
          setIsCalculating(false);
        }

        // Fallback to direct database query if Edge Function fails
        const supabaseFallback = await getSupabase();
        const { data: currentData, error: queryError } = await supabaseFallback
          .from('monthly_rankings')
          .select(
            `
            *,
            contributors!inner (
              id,
              username,
              display_name,
              avatar_url,
              github_id
            ),
            repositories!inner (
              owner,
              name
            )
          `
          )
          .eq('month', targetMonth)
          .eq('year', targetYear)
          .eq('repositories.owner', owner)
          .eq('repositories.name', repo)
          .order('weighted_score', { ascending: false })
          .limit(10);

        if (queryError) throw queryError;

        let data = currentData;

        // If no data for current month, try to get the most recent month with data
        if (!data || data.length === 0) {
          console.log('No data for current month, trying fallback to most recent month...');

          // First, find the most recent month that has data
          const { data: monthCheck, error: monthCheckError } = await supabaseFallback
            .from('monthly_rankings')
            .select(
              `
              year,
              month,
              repositories!inner (
                owner,
                name
              )
            `
            )
            .eq('repositories.owner', owner)
            .eq('repositories.name', repo)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(1);

          if (monthCheckError) throw monthCheckError;

          if (monthCheck && monthCheck.length > 0) {
            const recentYear = monthCheck[0].year;
            const recentMonth = monthCheck[0].month;

            // Now get all data for that specific month
            const { data: recentData, error: recentError } = await supabaseFallback
              .from('monthly_rankings')
              .select(
                `
                *,
                contributors!inner (
                  id,
                  username,
                  display_name,
                  avatar_url,
                  github_id
                ),
                repositories!inner (
                  owner,
                  name
                )
              `
              )
              .eq('repositories.owner', owner)
              .eq('repositories.name', repo)
              .eq('year', recentYear)
              .eq('month', recentMonth)
              .order('weighted_score', { ascending: false })
              .limit(10);

            if (recentError) throw recentError;

            if (recentData && recentData.length > 0) {
              data = recentData;
              setIsUsingFallback(true);
              setDisplayMonth(
                new Date(recentYear, recentMonth - 1).toLocaleString('default', {
                  month: 'long',
                })
              );
              setDisplayYear(recentYear);
            }
          }
        } else {
          setDisplayMonth(
            new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
          );
          setDisplayYear(targetYear);
        }

        if (data && data.length > 0) {
          // Transform the data into the expected format
          const transformedRankings: MonthlyContributorRanking[] = data.map((item, index) => ({
            id: item.contributors.id,
            username: item.contributors.username,
            displayName: item.contributors.display_name || item.contributors.username,
            avatarUrl:
              item.contributors.avatar_url ||
              `https://github.com/${item.contributors.username}.png`,
            profileUrl: `https://github.com/${item.contributors.username}`,
            pullRequestsCount: item.pull_requests_count || 0,
            reviewsCount: item.reviews_count || 0,
            commentsCount: item.comments_count || 0,
            weightedScore: parseFloat(item.weighted_score) || 0,
            rank: index + 1,
          }));

          setRankings(transformedRankings);
        } else {
          setRankings(null);
        }
      } catch (err) {
        console.error('Error fetching monthly rankings:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
        setIsCalculating(false);
      }
    }

    if (owner && repo) {
      fetchRankings();
    }
  }, [owner, repo]);

  return { rankings, loading, error, isUsingFallback, displayMonth, displayYear, isCalculating };
}
