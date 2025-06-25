import { ContributorOfTheMonth } from "./contributor-of-the-month";
import { useContributorOfMonth } from "@/hooks/use-contributor-of-month";
import { ContributorRanking as LibContributorRanking } from "@/lib/contributors/types";
import { ContributorRanking, MonthlyContributor } from "@/lib/types";
import { useParams } from "react-router-dom";

export default function ContributorOfTheMonthWrapper() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const rankings = useContributorOfMonth();

  if (!rankings || rankings.length === 0) {
    return null;
  }

  // Get current date to determine phase
  const now = new Date();
  const dayOfMonth = now.getDate();
  const isWinnerPhase = dayOfMonth >= 1 && dayOfMonth <= 7;
  
  // Transform the data to match the expected format
  const monthlyContributors: MonthlyContributor[] = rankings.map((ranking: LibContributorRanking) => ({
    login: ranking.contributor.username,
    avatar_url: ranking.contributor.avatarUrl,
    activity: {
      pullRequests: ranking.contributor.pullRequests,
      reviews: ranking.contributor.reviews,
      comments: ranking.contributor.comments,
      totalScore: ranking.weightedScore,
      firstContributionDate: ranking.contributor.earliestContribution.toISOString(),
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

  return (
    <ContributorOfTheMonth 
      ranking={contributorRanking} 
      repositoryName={owner && repo ? `${owner}/${repo}` : undefined}
    />
  );
}