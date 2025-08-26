/**
 * Business logic for empty state configurations
 * This keeps the component pure and testable
 */

export type EmptyStateType = 'no_data' | 'no_activity' | 'minimal_activity' | 'loadingerror';
export type SeverityLevel = 'info' | 'warning' | 'error';

export interface EmptyStateContent {
  iconName: string;
  iconColor: string;
  title: string;
  description: string;
  suggestionText: string;
  severity: SeverityLevel;
  bgColor: string;
}

/**
 * Get empty state configuration based on type
 * Pure function - no React dependencies
 */
export function getEmptyStateContent(
  type: EmptyStateType,
  customMessage?: string,
  customSuggestion?: string,
): EmptyStateContent {
  switch (type) {
    case 'no_data':
      return {
        iconName: 'users',
        iconColor: 'text-gray-400 dark:text-gray-500',
        title: 'No Contributor Data Available',
        description: customMessage || "We couldn't find any contributor data for this repository.",
        suggestionText:
          customSuggestion || 'Make sure the repository has some activity and try again.',
        severity: 'info',
        bgColor: 'from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900',
      };

    case 'no_activity':
      return {
        iconName: 'calendar',
        iconColor: 'text-blue-400 dark:text-blue-500',
        title: 'No Activity This Month',
        description: customMessage || 'No contributor activity found for the current period.',
        suggestionText:
          customSuggestion ||
          'Check back later as contributors start making contributions this month.',
        severity: 'info',
        bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
      };

    case 'minimal_activity':
      return {
        iconName: 'trending-up',
        iconColor: 'text-yellow-500 dark:text-yellow-400',
        title: 'Limited Activity',
        description: customMessage || "There's been minimal contributor activity this month.",
        suggestionText:
          customSuggestion || 'The leaderboard will be more meaningful as more contributors join.',
        severity: 'warning',
        bgColor: 'from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30',
      };

    case 'loadingerror':
      return {
        iconName: 'trophy',
        iconColor: 'text-red-400 dark:text-red-500',
        title: 'Unable to Load Contributor Data',
        description:
          customMessage || 'We encountered an error while loading contributor information.',
        suggestionText:
          customSuggestion || 'Please try refreshing the page or check your network connection.',
        severity: 'error',
        bgColor: 'from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30',
      };

    default:
      return {
        iconName: 'users',
        iconColor: 'text-gray-400 dark:text-gray-500',
        title: 'No Data Available',
        description: 'Unable to display contributor information at this time.',
        suggestionText: 'Please try again later.',
        severity: 'info',
        bgColor: 'from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900',
      };
  }
}

/**
 * Get badge label based on severity
 */
export function getBadgeLabel(severity: SeverityLevel): string {
  switch (severity) {
    case 'error':
      return '⚠️ Error';
    case 'warning':
      return '💡 Note';
    case 'info':
    default:
      return '✨ Tip';
  }
}

/**
 * Get badge color classes based on severity
 */
export function getBadgeColorClasses(severity: SeverityLevel): string {
  switch (severity) {
    case 'error':
      return 'bg-red-500 hover:bg-red-600 text-white';
    case 'warning':
      return 'bg-yellow-500 hover:bg-yellow-600 text-white';
    case 'info':
    default:
      return 'bg-blue-500 hover:bg-blue-600 text-white';
  }
}

/**
 * Calculate activity stats for minimal activity display
 */
export interface ContributorActivity {
  login: string;
  avatar_url: string;
  activity: {
    pullRequests: number;
    reviews: number;
    comments: number;
    totalScore: number;
  };
  rank: number;
}

export function calculateActivityStats(contributors: ContributorActivity[]) {
  const totalContributors = contributors.length;
  const totalActivity = contributors.reduce((sum, c) => sum + c.activity.totalScore, 0);

  return {
    totalContributors,
    totalActivity,
    topContributors: contributors.slice(0, 3),
  };
}
