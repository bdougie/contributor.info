import { Trophy, TrendingUp } from '@/components/ui/icon';
/**
 * Production wrapper for ContributorOfTheMonth
 * Connects the simple component to real dependencies
 */
import { ContributorOfTheMonthSimple } from './contributor-of-the-month-simple';
import { ContributorCard } from './contributor-card-wrapper';
import { ContributorEmptyState, MinimalActivityDisplay } from './contributor-empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ContributorOfMonthSkeleton } from '@/components/skeletons';
import type { ContributorRanking, MonthlyContributor } from '@/lib/types';

interface ContributorOfTheMonthProps {
  ranking: ContributorRanking | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

const iconMap = {
  Trophy,
  TrendingUp,
};

export function ContributorOfTheMonth(props: ContributorOfTheMonthProps) {
  const renderCard = ({ children, className, role, ariaLabelledBy }: {
    children: React.ReactNode;
    className?: string;
    role?: string;
    ariaLabelledBy?: string;
  }) => (
    <Card className={cn(className)} role={role} aria-labelledby={ariaLabelledBy}>
      {children}
    </Card>
  );

  const renderCardHeader = ({ children }: { children: React.ReactNode }) => <CardHeader>{children}</CardHeader>;

  const renderCardContent = ({ children, className }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <CardContent className={className}>{children}</CardContent>
  );

  const renderCardTitle = ({ children, id }: {
    children: React.ReactNode;
    id?: string;
  }) => <CardTitle id={id}>{children}</CardTitle>;

  const renderCardDescription = ({ children }: { children: React.ReactNode }) => (
    <CardDescription>{children}</CardDescription>
  );

  const renderBadge = ({ children, variant }: {
    children: React.ReactNode;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }) => <Badge variant={variant}>{children}</Badge>;

  const renderIcon = ({ name, className, ariaLabel, role }: {
    name: string;
    className?: string;
    ariaLabel?: string;
    role?: string;
  }) => {
    const IconComponent = iconMap[name as keyof typeof iconMap];
    if (!IconComponent) return <span>{name}</span>;

    return <IconComponent className={className} aria-label={ariaLabel} role={role} />;
  };

  const renderContributorCard = ({ contributor, isWinner, showRank }: {
    contributor: MonthlyContributor;
    isWinner?: boolean;
    showRank?: boolean;
  }) => (
    <ContributorCard contributor={contributor} isWinner={isWinner} showRank={showRank} />
  );

  const renderSkeleton = ({ className, phase, contributorCount }: {
    className?: string;
    phase: string;
    contributorCount: number;
  }) => (
    <ContributorOfMonthSkeleton
      className={className}
      phase={phase as 'winner' | 'leaderboard'}
      contributorCount={contributorCount}
    />
  );

  const renderEmptyState = ({ type, message, className }: {
    type: string;
    message?: string;
    className?: string;
  }) => (
    <ContributorEmptyState
      type={(type as 'no_data' | 'no_activity' | 'minimal_activity' | 'loading_error') || 'no_data'}
      message={message}
      className={className}
    />
  );

  const renderMinimalActivity = ({ contributors, month, year, className }: {
    contributors?: Array<{
      login: string;
      avatar_url: string;
      activity: {
        pullRequests: number;
        reviews: number;
        comments: number;
        totalScore: number;
      };
      rank: number;
    }>;
    month?: string;
    year?: number;
    className?: string;
  }) => (
    <MinimalActivityDisplay
      contributors={contributors || []}
      month={month || ''}
      year={year || new Date().getFullYear()}
      className={className}
    />
  );

  return (
    <ContributorOfTheMonthSimple
      {...props}
      renderCard={renderCard}
      renderCardHeader={renderCardHeader}
      renderCardContent={renderCardContent}
      renderCardTitle={renderCardTitle}
      renderCardDescription={renderCardDescription}
      renderBadge={renderBadge}
      renderIcon={renderIcon}
      renderContributorCard={renderContributorCard}
      renderSkeleton={renderSkeleton}
      renderEmptyState={renderEmptyState}
      renderMinimalActivity={renderMinimalActivity}
    />
  );
}
