import { ContributorOfTheMonth } from './contributor-of-the-month';
import { useMonthlyContributorRankings } from '@/hooks/use-monthly-contributor-rankings';
import { ContributorRanking, MonthlyContributor } from '@/lib/types';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { WorkspaceCreateModal } from '../workspace/WorkspaceCreateModal';

export default function ContributorOfTheMonthWrapper() {
  const { owner = '', repo = '' } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const { rankings, loading, isUsingFallback, displayMonth, displayYear } =
    useMonthlyContributorRankings(owner, repo);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;
  }

  // If no rankings data at all, show workspace CTA
  if (!rankings || rankings.length === 0) {
    return (
      <>
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Track Your Team's Contributors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              No contributor rankings available yet. Create a workspace to start tracking
              contributor metrics across multiple repositories.
            </p>

            <div className="grid gap-3 text-sm">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <strong>Monthly Rankings:</strong> Track top contributors each month
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BarChart3 className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <strong>Team Insights:</strong> Analyze contribution patterns across your
                  organization
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <strong>Recognize Contributors:</strong> Celebrate your top performers
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowWorkspaceModal(true)}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Create Workspace
              </Button>
              <Button variant="outline" onClick={() => navigate('/workspaces/new')}>
                Learn More
              </Button>
            </div>
          </CardContent>
        </Card>

        <WorkspaceCreateModal
          open={showWorkspaceModal}
          onOpenChange={setShowWorkspaceModal}
          source="home"
          onSuccess={(workspaceSlug) => {
            setShowWorkspaceModal(false);
            navigate(`/i/${workspaceSlug}`);
          }}
        />
      </>
    );
  }

  // Get current date to determine phase
  const now = new Date();
  const dayOfMonth = now.getDate();
  const isWinnerPhase = dayOfMonth >= 1 && dayOfMonth <= 7;

  // Transform the data to match the expected format - only take top 3
  const top3Rankings = rankings.slice(0, 3);
  const monthlyContributors: MonthlyContributor[] = top3Rankings.map((ranking) => ({
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

  // Use the display month/year from the hook (which handles fallback)
  const contributorRanking: ContributorRanking = {
    month: displayMonth || now.toLocaleString('default', { month: 'long' }),
    year: displayYear || now.getFullYear(),
    contributors: monthlyContributors,
    winner: isWinnerPhase ? monthlyContributors[0] : undefined,
    phase: isWinnerPhase ? 'winner_announcement' : 'running_leaderboard',
  };

  return (
    <div>
      {isUsingFallback && (
        <div className="mb-2 text-sm text-muted-foreground text-center">
          Showing {displayMonth} {displayYear} rankings (most recent available)
        </div>
      )}
      <ContributorOfTheMonth
        ranking={contributorRanking}
        showBlurredFirst={true}
        totalContributors={rankings.length}
        repositoryOwner={owner}
        repositoryName={repo}
      />
    </div>
  );
}
