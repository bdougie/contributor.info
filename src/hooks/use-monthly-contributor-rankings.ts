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

export function useMonthlyContributorRankings(owner: string, repo: string) {
  const [rankings, setRankings] = useState<MonthlyContributorRanking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRankings() {
      try {
        setLoading(true);

        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Query monthly rankings with contributor details
        const { data, error: queryError } = await supabase
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

  return { rankings, loading, error };
}
