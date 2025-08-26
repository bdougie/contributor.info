/**
 * Simplified, testable version of ContributorOfTheMonth
 * This is a pure presentational component with no external dependencies
 */
import {
  getComponentState,
  getDisplayContent,
  getWinnerDisplayContent,
  getLeaderboardDisplayContent,
  getCardAccessibility,
  getTrophyIconProps,
} from "@/lib/contributor-of-month-config";
import type { ContributorRanking } from "@/lib/types";

interface ContributorOfTheMonthSimpleProps {
  ranking: ContributorRanking | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  // Injected dependencies
  renderCard?: (props: {
    children: React.ReactNode;
    className?: string;
    role?: string;
    ariaLabelledBy?: string;
  }) => React.ReactNode;
  renderCardHeader?: (props: { children: React.ReactNode }) => React.ReactNode;
  renderCardContent?: (props: { children: React.ReactNode; className?: string }) => React.ReactNode;
  renderCardTitle?: (props: { children: React.ReactNode; id?: string }) => React.ReactNode;
  renderCardDescription?: (props: { children: React.ReactNode }) => React.ReactNode;
  renderBadge?: (props: {
    children: React.ReactNode;
    variant: "default" | "secondary";
  }) => React.ReactNode;
  renderIcon?: (props: {
    name: string;
    className?: string;
    ariaLabel?: string;
    role?: string;
  }) => React.ReactNode;
  renderContributorCard?: (props: {
    contributor: unknown;
    isWinner?: boolean;
    showRank?: boolean;
  }) => React.ReactNode;
  renderSkeleton?: (props: {
    className?: string;
    phase: string;
    contributorCount: number;
  }) => React.ReactNode;
  renderEmptyState?: (props: {
    type: string;
    message?: string;
    className?: string;
  }) => React.ReactNode;
  renderMinimalActivity?: (props: {
    contributors: unknown[];
    month: string;
    year: number;
    className?: string;
  }) => React.ReactNode;
}

export function ContributorOfTheMonthSimple({
  ranking,
  loading = false,
  error,
  className,
  renderCard,
  renderCardHeader,
  renderCardContent,
  renderCardTitle,
  renderCardDescription,
  renderBadge,
  renderIcon,
  renderContributorCard,
  renderSkeleton,
  renderEmptyState,
  renderMinimalActivity,
}: ContributorOfTheMonthSimpleProps) {
  // Get the current component state
  const state = getComponentState(ranking, loading || false, _error || null);

  // Default renderers for testing
  const cardRenderer = renderCard || (({ children, className, role, ariaLabelledBy }) => (
    <div 
      data-testid="card" 
      className={className} 
      role={role} 
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </div>
  ));

  const cardHeaderRenderer = renderCardHeader || (({ children }) => (
    <div data-testid="card-header">{children}</div>
  ));

  const cardContentRenderer = renderCardContent || (({ children, className }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ));

  const cardTitleRenderer = renderCardTitle || (({ children, id }) => (
    <h2 data-testid="card-title" id={id}>{children}</h2>
  ));

  const cardDescriptionRenderer = renderCardDescription || (({ children }) => (
    <p data-testid="card-description">{children}</p>
  ));

  const badgeRenderer = renderBadge || (({ children, variant }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ));

  const iconRenderer = renderIcon || (({ name, className, ariaLabel, role }) => (
    <span 
      data-testid={`icon-${name}`} 
      data-classname={className}
      aria-label={ariaLabel}
      role={role}
    >
      {name}
    </span>
  ));

  const contributorCardRenderer = renderContributorCard || (({ contributor, isWinner, showRank }) => (
    <div 
      data-testid="contributor-card"
      data-login={contributor.login}
      data-winner={isWinner}
      data-show-rank={showRank}
    >
      {contributor.login}
    </div>
  ));

  const skeletonRenderer = renderSkeleton || (({ className, phase, contributorCount }) => (
    <div 
      data-testid="skeleton" 
      className={className}
      data-phase={phase}
      data-count={contributorCount}
    >
      Loading...
    </div>
  ));

  const emptyStateRenderer = renderEmptyState || (({ type, message, className }) => (
    <div 
      data-testid="empty-state" 
      data-type={type}
      className={className}
    >
      {message || `Empty state: ${type}`}
    </div>
  ));

  const minimalActivityRenderer = renderMinimalActivity || (({ contributors, month, year, className }) => (
    <div 
      data-testid="minimal-activity" 
      className={className}
      data-month={month}
      data-year={year}
      data-count={contributors.length}
    >
      Minimal activity for {month} {year}
    </div>
  ));

  // Handle different states
  switch (state.type) {
    case "loading":
      return skeletonRenderer({
        className,
        phase: "leaderboard",
        contributorCount: 5,
      });

    case "error":
      return emptyStateRenderer({
        type: "loading_error",
        message: state.message,
        className,
      });

    case "no_activity":
      return emptyStateRenderer({
        type: "no_activity",
        className,
      });

    case "minimal_activity":
      return minimalActivityRenderer({
        contributors: state.contributors,
        month: state.month,
        year: state.year,
        className,
      });

    case "winner_phase": {
      const displayContent = getDisplayContent(state.ranking, true);
      const winnerContent = getWinnerDisplayContent(state.ranking, state.topContributors);
      const cardAccessibility = getCardAccessibility();
      const trophyProps = getTrophyIconProps();

      return cardRenderer({
        className: `w-full ${className || ""}`,
        ...cardAccessibility,
        children: (
          <>
            {cardHeaderRenderer({
              children: (
                <div className="flex items-center justify-between">
                  <div>
                    {cardTitleRenderer({
                      id: "contributor-heading",
                      children: displayContent.title,
                    })}
                    {cardDescriptionRenderer({
                      children: displayContent.description,
                    })}
                  </div>
                  {badgeRenderer({
                    variant: displayContent.badgeVariant,
                    children: displayContent.badgeText,
                  })}
                </div>
              ),
            })}
            {cardContentRenderer({
              className: "space-y-6",
              children: (
                <div className="space-y-6">
                  {/* Winner Display */}
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      {iconRenderer({
                        name: trophyProps.iconName,
                        className: trophyProps.className,
                        ariaLabel: trophyProps.ariaLabel,
                        role: trophyProps.role,
                      })}
                      <h3 className="text-lg font-semibold">
                        {winnerContent.winnerTitle}
                      </h3>
                    </div>
                    {state.ranking.winner && (
                      <div className="max-w-sm mx-auto">
                        {contributorCardRenderer({
                          contributor: state.ranking.winner,
                          isWinner: true,
                          showRank: false,
                        })}
                      </div>
                    )}
                  </div>

                  {/* Top 5 Runners-up */}
                  {state.topContributors.length > 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {winnerContent.runnersUpTitle}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {winnerContent.runnersUpCount}
                        </span>
                      </div>
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {state.topContributors.slice(1).map((contributor) => (
                          <div key={contributor.login}>
                            {contributorCardRenderer({
                              contributor,
                              showRank: true,
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
            })}
          </>
        ),
      });
    }

    case "leaderboard_phase": {
      const displayContent = getDisplayContent(state.ranking, false);
      const leaderboardContent = getLeaderboardDisplayContent(state.ranking, state.topContributors);
      const cardAccessibility = getCardAccessibility();

      return cardRenderer({
        className: `w-full ${className || ""}`,
        ...cardAccessibility,
        children: (
          <>
            {cardHeaderRenderer({
              children: (
                <div className="flex items-center justify-between">
                  <div>
                    {cardTitleRenderer({
                      id: "contributor-heading",
                      children: displayContent.title,
                    })}
                    {cardDescriptionRenderer({
                      children: displayContent.description,
                    })}
                  </div>
                  {badgeRenderer({
                    variant: displayContent.badgeVariant,
                    children: displayContent.badgeText,
                  })}
                </div>
              ),
            })}
            {cardContentRenderer({
              className: "space-y-4",
              children: (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {iconRenderer({
                        name: leaderboardContent.iconName,
                        className: "h-4 w-4 text-muted-foreground",
                      })}
                      <span className="text-sm text-muted-foreground">
                        {leaderboardContent.activeCount}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {state.topContributors.map((contributor) => (
                      <div key={contributor.login}>
                        {contributorCardRenderer({
                          contributor,
                          showRank: true,
                        })}
                      </div>
                    ))}
                  </div>

                  {leaderboardContent.moreContributorsText && (
                    <div className="text-center pt-4">
                      <p className="text-sm text-muted-foreground">
                        {leaderboardContent.moreContributorsText}
                      </p>
                    </div>
                  )}
                </div>
              ),
            })}
          </>
        ),
      });
    }

    default:
      return emptyStateRenderer({
        type: "unknown",
        className,
      });
  }
}