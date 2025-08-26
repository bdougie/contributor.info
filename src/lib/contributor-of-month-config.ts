/**
 * Business logic for ContributorOfTheMonth component
 * Pure functions with no React dependencies
 */
import type { ContributorRanking } from "@/lib/types";

export type ComponentState = 
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "no_activity" }
  | { type: "minimal_activity"; contributors: unknown[]; month: string; year: number }
  | { type: "winner_phase"; ranking: ContributorRanking; topContributors: unknown[] }
  | { type: "leaderboard_phase"; ranking: ContributorRanking; topContributors: unknown[] };

export interface DisplayContent {
  title: string;
  description: string;
  badgeText: string;
  badgeVariant: "default" | "secondary";
}

export interface WinnerDisplayContent {
  sectionTitle: string;
  winnerTitle: string;
  runnersUpTitle: string;
  runnersUpCount: string;
}

export interface LeaderboardDisplayContent {
  iconName: string;
  activeCount: string;
  moreContributorsText?: string;
}

/**
 * Determine the current component state based on props
 */
export function getComponentState(
  ranking: ContributorRanking | null,
  loading: boolean,
  error: string | null
): ComponentState {
  if (loading) {
    return { type: "loading" };
  }

  if (_error) {
    return { type: "error", message: error };
  }

  if (!ranking || ranking.contributors.length === 0) {
    return { type: "no_activity" };
  }

  const isWinnerPhase = ranking.phase === "winner_announcement";
  const topContributors = ranking.contributors.slice(0, 5);
  
  // Check for minimal activity
  const totalActivity = ranking.contributors.reduce(
    (sum, c) => sum + c.activity.totalScore,
    0
  );
  const hasMinimalActivity = ranking.contributors.length < 3 || totalActivity < 10;

  if (hasMinimalActivity && !isWinnerPhase) {
    return {
      type: "minimal_activity",
      contributors: ranking.contributors,
      month: ranking.month,
      year: ranking.year,
    };
  }

  if (isWinnerPhase) {
    return {
      type: "winner_phase",
      ranking,
      topContributors,
    };
  }

  return {
    type: "leaderboard_phase",
    ranking,
    topContributors,
  };
}

/**
 * Get display content for header section
 */
export function getDisplayContent(
  ranking: ContributorRanking,
  isWinnerPhase: boolean
): DisplayContent {
  return {
    title: isWinnerPhase ? "Contributor of the Month" : "Monthly Leaderboard",
    description: isWinnerPhase 
      ? `Celebrating ${ranking.month} ${ranking.year}'s top contributor`
      : `Top contributors for ${ranking.month} ${ranking.year}`,
    badgeText: isWinnerPhase ? "Winner" : "Current",
    badgeVariant: isWinnerPhase ? "default" : "secondary",
  };
}

/**
 * Get content for winner phase display
 */
export function getWinnerDisplayContent(
  ranking: ContributorRanking,
  topContributors: unknown[]
): WinnerDisplayContent {
  return {
    sectionTitle: "Winner Display",
    winnerTitle: `${ranking.month} ${ranking.year} Winner`,
    runnersUpTitle: "Top Contributors",
    runnersUpCount: `${topContributors.length - 1} runners-up`,
  };
}

/**
 * Get content for leaderboard phase display
 */
export function getLeaderboardDisplayContent(
  ranking: ContributorRanking,
  topContributors: unknown[]
): LeaderboardDisplayContent {
  const activeCount = `${topContributors.length} active contributor${topContributors.length !== 1 ? "s" : ""}`;
  const moreContributorsText = ranking.contributors.length > 5
    ? `And ${ranking.contributors.length - 5} more contributors this month`
    : undefined;

  return {
    iconName: "TrendingUp",
    activeCount,
    moreContributorsText,
  };
}

/**
 * Get accessibility attributes for the main card
 */
export function getCardAccessibility() {
  return {
    role: "region" as const,
    ariaLabelledBy: "contributor-heading",
  };
}

/**
 * Get trophy icon display properties
 */
export function getTrophyIconProps() {
  return {
    iconName: "Trophy",
    className: "h-5 w-5 text-yellow-600",
    ariaLabel: "Trophy",
    role: "img" as const,
  };
}