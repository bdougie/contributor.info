import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
}

export function useMonthlyContributorRankings(owner: string, repo: string): MonthlyRankingsResult {
  const [rankings, setRankings] = useState<MonthlyContributorRanking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<string>();
  const [displayYear, setDisplayYear] = useState<number>();

  useEffect(() => {
    async function fetchRankings() {
      try {
        setLoading(true);
        setIsUsingFallback(false);

        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Query monthly rankings with contributor details for current month
        const { data: currentData, error: queryError } = await supabase
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
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .eq('repositories.owner', owner)
          .eq('repositories.name', repo)
          .order('weighted_score', { ascending: false })
          .limit(10);

        if (queryError) throw queryError;

        let data = currentData;

        // If no data for current month, try to get the most recent month with data
        if (!data || data.length === 0) {
          console.log('No data for current month, trying fallback to most recent month...');

          // Get the most recent month with data
          const { data: recentData, error: recentError } = await supabase
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
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .order('weighted_score', { ascending: false })
            .limit(10);

          if (recentError) throw recentError;

          if (recentData && recentData.length > 0) {
            data = recentData;
            setIsUsingFallback(true);
            setDisplayMonth(
              new Date(recentData[0].year, recentData[0].month - 1).toLocaleString('default', {
                month: 'long',
              })
            );
            setDisplayYear(recentData[0].year);
          }
        } else {
          setDisplayMonth(now.toLocaleString('default', { month: 'long' }));
          setDisplayYear(currentYear);
        }

        if (data && data.length > 0) {
          // Transform the data into the expected format
          const transformedRankings: MonthlyContributorRanking[] = data.map((item, index) => ({
            id: item.contributors.id,
            username: item.contributors.username,
            displayName: item.contributors.display_name || item.contributors.username,
            avatarUrl:
              item.contributors.avatar_url ||
              `https://avatars.githubusercontent.com/${item.contributors.username}`,
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
      }
    }

    if (owner && repo) {
      fetchRankings();
    }
  }, [owner, repo]);

  return { rankings, loading, error, isUsingFallback, displayMonth, displayYear };
}
