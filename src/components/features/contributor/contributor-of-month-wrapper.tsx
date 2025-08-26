import { ContributorOfTheMonth } from './contributor-of-the-month';
import { useMonthlyContributorRankings } from '@/hooks/use-monthly-contributor-rankings';
import { ContributorRanking, MonthlyContributor } from '@/lib/types';
import { useParams } from 'react-router-dom';

export default function ContributorOfTheMonthWrapper() {
  const { owner = '', repo = '' } = useParams<{ owner: string; repo: string }>();
  const { rankings, loading } = useMonthlyContributorRankings(owner, repo);

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;
  }

  if (!rankings || rankings.length === 0) {
    return null;
  }

  // Get current date to determine phase
  const now = new Date();
  const dayOfMonth = now.getDate();
  const isWinnerPhase = dayOfMonth >= 1 && dayOfMonth <= 7;

  // Transform the data to match the expected format
  const monthlyContributors: MonthlyContributor[] = rankings.map((ranking) => ({
    login: ranking.username,
    avatar_url: ranking.avatarUrl,
    activity: {
      pullRequests: ranking.pullRequestsCount,
      reviews: ranking.reviewsCount,
      comments: ranking.commentsCount,
      totalScore: ranking.weightedScore,
      firstContributionDate: '', // Not available in monthly rankings
    },
    rank: ranking.rank,
    isWinner: ranking.rank === 1 && isWinnerPhase,
  }));

  const contributorRanking: ContributorRanking = {
    month: now.toLocaleString('default', { month: 'long' }),
    year: now.getFullYear(),
    contributors: monthlyContributors,
    winner: isWinnerPhase ? monthlyContributors[0] : undefined,
    phase: isWinnerPhase ? 'winner_announcement' : 'running_leaderboard',
  };

  return <ContributorOfTheMonth ranking={contributorRanking} />;
}
