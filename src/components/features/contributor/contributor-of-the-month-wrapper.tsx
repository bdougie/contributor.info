import { Trophy, TrendingUp } from '@/components/ui/icon';
/**
 * Production wrapper for ContributorOfTheMonth
 * Connects the simple component to real dependencies
 */
import { ContributorOfTheMonthSimple } from "./contributor-of-the-month-simple";
import { ContributorCard } from "./contributor-card-wrapper";
import {
  ContributorEmptyState,
  MinimalActivityDisplay,
} from "./contributor-empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContributorOfMonthSkeleton } from "@/components/skeletons";
import type { ContributorRanking } from "@/lib/types";

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
  const renderCard = ({ children, className, role, ariaLabelledBy }: unknown) => (
    <Card className={cn(className)} role={role} aria-labelledby={ariaLabelledBy}>
      {children}
    </Card>
  );

  const renderCardHeader = ({ children }: unknown) => <CardHeader>{children}</CardHeader>;

  const renderCardContent = ({ children, className }: unknown) => (
    <CardContent className={className}>{children}</CardContent>
  );

  const renderCardTitle = ({ children, id }: unknown) => (
    <CardTitle id={id}>{children}</CardTitle>
  );

  const renderCardDescription = ({ children }: unknown) => (
    <CardDescription>{children}</CardDescription>
  );

  const renderBadge = ({ children, variant }: unknown) => (
    <Badge variant={variant}>{children}</Badge>
  );

  const renderIcon = ({ name, className, ariaLabel, role }: unknown) => {
    const IconComponent = iconMap[name as keyof typeof iconMap];
    if (!IconComponent) return <span>{name}</span>;
    
    return (
      <IconComponent 
        className={className} 
        aria-label={ariaLabel} 
        role={role} 
      />
    );
  };

  const renderContributorCard = ({ contributor, isWinner, showRank }: unknown) => (
    <ContributorCard 
      contributor={contributor} 
      isWinner={isWinner} 
      showRank={showRank} 
    />
  );

  const renderSkeleton = ({ className, phase, contributorCount }: unknown) => (
    <ContributorOfMonthSkeleton
      className={className}
      phase={phase}
      contributorCount={contributorCount}
    />
  );

  const renderEmptyState = ({ type, message, className }: unknown) => (
    <ContributorEmptyState
      type={type}
      message={message}
      className={className}
    />
  );

  const renderMinimalActivity = ({ contributors, month, year, className }: unknown) => (
    <MinimalActivityDisplay
      contributors={contributors}
      month={month}
      year={year}
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