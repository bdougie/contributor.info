/**
 * Business logic for ContributorCard component
 * Pure functions with no React dependencies
 */
import type { MonthlyContributor } from '@/lib/types';

export interface TooltipContent {
  title: string;
  items: Array<{
    iconName: string;
    label: string;
    count: number;
  }>;
}

export interface CardClasses {
  container: string;
  rank: 'default' | 'secondary';
}

export interface CardAriaLabel {
  label: string;
  role: 'article' | 'listitem';
}

/**
 * Generate tooltip content for contributor activity
 */
export function createTooltipContent(contributor: MonthlyContributor): TooltipContent {
  return {
    title: `${contributor.login}'s Activity`,
    items: [
      {
        iconName: 'GitPullRequest',
        label: 'Pull Requests',
        count: contributor.activity.pullRequests,
      },
      {
        iconName: 'GitPullRequestDraft',
        label: 'Reviews',
        count: contributor.activity.reviews,
      },
      {
        iconName: 'MessageSquare',
        label: 'Comments',
        count: contributor.activity.comments,
      },
    ],
  };
}

/**
 * Determine CSS classes for the card container
 */
export function getCardClasses(isWinner: boolean): CardClasses {
  const baseClasses =
    'relative p-4 rounded-lg border bg-card transition-all cursor-pointer hover:bg-muted/50';
  const winnerClasses = 'ring-2 ring-yellow-500 bg-yellow-50/10 dark:bg-yellow-900/10';

  return {
    container: isWinner ? `${baseClasses} ${winnerClasses}` : baseClasses,
    rank: isWinner || 1 ? 'default' : 'secondary', // Rank 1 gets default styling
  };
}

/**
 * Create accessibility label and role
 */
export function getCardAccessibility(
  login: string,
  totalScore: number,
  isWinner: boolean
): CardAriaLabel {
  const role = isWinner ? 'article' : 'listitem';
  const winnerText = isWinner ? ' - Winner' : '';
  const label = `${login}${winnerText}, ${totalScore} points`;

  return { label, role };
}

/**
 * Generate avatar fallback text
 */
export function getAvatarFallback(login: string): string {
  return login.charAt(0).toUpperCase();
}

/**
 * Generate activity display items for the card
 */
export function getActivityItems(activity: MonthlyContributor['activity']) {
  return [
    { iconName: 'GitPullRequest', count: activity.pullRequests },
    { iconName: 'GitPullRequestDraft', count: activity.reviews },
    { iconName: 'MessageSquare', count: activity.comments },
  ];
}
