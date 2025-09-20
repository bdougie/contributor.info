import { Trophy, TrendingUp, Lock, Users } from '@/components/ui/icon';
import { ContributorRanking } from '@/lib/types';
import { ContributorCard } from './contributor-card';
import { ContributorEmptyState, MinimalActivityDisplay } from './contributor-empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ContributorOfMonthSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { WorkspaceCreateModal } from '../workspace/WorkspaceCreateModal';
import { useHasPaidWorkspace } from '@/hooks/use-has-paid-workspace';
import { trackEvent } from '@/lib/posthog-lazy';

interface ContributorOfTheMonthProps {
  ranking: ContributorRanking | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  showBlurredFirst?: boolean;
  totalContributors?: number;
  repositoryOwner?: string;
  repositoryName?: string;
}

export function ContributorOfTheMonth({
  ranking,
  loading = false,
  error,
  className,
  showBlurredFirst = false,
  totalContributors = 0,
  repositoryOwner,
  repositoryName,
}: ContributorOfTheMonthProps) {
  const navigate = useNavigate();
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const { hasPaidWorkspace } = useHasPaidWorkspace();
  const hasTrackedView = useRef(false);

  // Track leaderboard view event (only once per mount)
  useEffect(() => {
    if (ranking && !hasTrackedView.current && repositoryOwner && repositoryName) {
      hasTrackedView.current = true;
      trackEvent('repo_leaderboard_viewed', {
        repository_owner: repositoryOwner,
        repository_name: repositoryName,
        month: ranking.month,
        year: ranking.year,
        is_winner_phase: ranking.phase === 'winner_announcement',
        total_contributors: ranking.contributors.length,
        has_winner: !!ranking.winner,
      });
    }
  }, [ranking, repositoryOwner, repositoryName]);
  if (loading) {
    return (
      <ContributorOfMonthSkeleton className={className} phase="leaderboard" contributorCount={5} />
    );
  }

  if (error) {
    return <ContributorEmptyState type="loading_error" message={error} className={className} />;
  }

  if (!ranking || ranking.contributors.length === 0) {
    return <ContributorEmptyState type="no_activity" className={className} />;
  }

  const isWinnerPhase = ranking.phase === 'winner_announcement';
  // Now we only show top 3 contributors
  const topContributors = ranking.contributors;

  // Handle minimal activity case (less than 3 contributors or very low total activity)
  const totalActivity = ranking.contributors.reduce((sum, c) => sum + c.activity.totalScore, 0);
  const hasMinimalActivity = ranking.contributors.length < 3 || totalActivity < 10;

  if (hasMinimalActivity && !isWinnerPhase) {
    return (
      <MinimalActivityDisplay
        contributors={ranking.contributors}
        month={ranking.month}
        year={ranking.year}
        className={className}
      />
    );
  }

  return (
    <>
      <Card className={cn('w-full', className)} role="region" aria-labelledby="contributor-heading">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle id="contributor-heading">
                {isWinnerPhase ? 'Contributor of the Month' : 'Monthly Leaderboard'}
              </CardTitle>
              <CardDescription>
                {isWinnerPhase
                  ? `Celebrating ${ranking.month} ${ranking.year}'s top contributor`
                  : `Top contributors for ${ranking.month} ${ranking.year}`}
              </CardDescription>
            </div>
            <Badge variant={isWinnerPhase ? 'default' : 'secondary'}>
              {isWinnerPhase ? 'Winner' : 'Current'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isWinnerPhase && ranking.winner ? (
            <div className="space-y-6">
              {/* Winner Display */}
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" aria-label="Trophy" role="img" />
                  <h3 className="text-lg font-semibold">
                    {ranking.month} {ranking.year} Winner
                  </h3>
                </div>
                <div className="max-w-sm mx-auto">
                  <ContributorCard
                    contributor={ranking.winner}
                    isWinner={true}
                    showRank={false}
                    repositoryOwner={repositoryOwner}
                    repositoryName={repositoryName}
                    month={ranking.month}
                    year={ranking.year}
                  />
                </div>
              </div>

              {/* Top 5 Runners-up */}
              {topContributors.length > 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">Top Contributors</h4>
                    <span className="text-xs text-muted-foreground">
                      {topContributors.length - 1} runners-up
                    </span>
                  </div>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {topContributors.slice(1).map((contributor) => (
                      <ContributorCard
                        key={contributor.login}
                        contributor={contributor}
                        showRank={true}
                        repositoryOwner={repositoryOwner}
                        repositoryName={repositoryName}
                        month={ranking.month}
                        year={ranking.year}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {totalContributors || ranking.contributors.length} active contributor
                    {(totalContributors || ranking.contributors.length) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                {topContributors.map((contributor, index) => {
                  const isFirstPlace = index === 0 && showBlurredFirst && !hasPaidWorkspace;

                  return (
                    <div key={contributor.login} className="relative">
                      {isFirstPlace && (
                        <div className="absolute inset-0 z-10 rounded-lg bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                          <Lock className="h-6 w-6 text-muted-foreground" />
                          <Button
                            size="sm"
                            onClick={() => setShowWorkspaceModal(true)}
                            className="text-xs bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            Upgrade to view
                          </Button>
                        </div>
                      )}
                      <ContributorCard
                        contributor={contributor}
                        showRank={true}
                        className={isFirstPlace ? 'blur-sm' : ''}
                        repositoryOwner={repositoryOwner}
                        repositoryName={repositoryName}
                        month={ranking.month}
                        year={ranking.year}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Workspace CTA */}
              <div className="border-t pt-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {totalContributors > 3
                      ? `See all ${totalContributors} contributors`
                      : 'Get full contributor insights'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add this repo to a workspace to unlock complete rankings, detailed analytics,
                    and team insights
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <WorkspaceCreateModal
        open={showWorkspaceModal}
        onOpenChange={setShowWorkspaceModal}
        source="home"
        onSuccess={(workspaceId) => {
          setShowWorkspaceModal(false);
          navigate(`/workspaces/${workspaceId}`);
        }}
      />
    </>
  );
}
