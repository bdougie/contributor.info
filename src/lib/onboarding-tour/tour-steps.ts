import type { TourStep } from './types';

/**
 * Default tour steps for the onboarding experience
 *
 * These steps guide users through the key features on a repository page:
 * 1. Search for repositories
 * 2. Contributor leaderboard/scatterplot
 * 3. Workspaces for organizing repositories
 *
 * The tour is designed to start on /continuedev/continue
 */
export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    content:
      'Welcome to contributor.info! Let me show you the key features for understanding open source contributions.',
    placement: 'center',
    disableBeacon: true,
    category: 'navigation',
  },
  {
    id: 'search-repositories',
    target: '[data-tour="repo-search"]',
    content:
      'Search for any GitHub repository by typing the owner/repo name. Try searching for your favorite open source project.',
    placement: 'bottom',
    category: 'repository',
  },
  {
    id: 'leaderboard',
    target: '[data-tour="leaderboard"]',
    content:
      'The contributor scatterplot visualizes PR activity. Each dot represents a pull request - hover to see details about the contributor and their work.',
    placement: 'top',
    category: 'repository',
  },
  {
    id: 'workspaces',
    target: '[data-tour="workspace-switcher"], [data-tour="create-workspace-cta"]',
    content:
      'Workspaces help you organize repositories into collections. Create workspaces for different projects, teams, or areas of interest.',
    placement: 'bottom',
    category: 'workspace',
  },
  {
    id: 'tour-complete',
    target: 'body',
    content:
      "You're all set! Explore more repositories or create a workspace to track your favorites. You can restart this tour anytime from the menu.",
    placement: 'center',
    category: 'navigation',
  },
];

/**
 * Get tour steps filtered by category
 */
export function getTourStepsByCategory(
  steps: TourStep[],
  categories: TourStep['category'][]
): TourStep[] {
  return steps.filter((step) => step.category && categories.includes(step.category));
}

/**
 * Get a specific tour step by ID
 */
export function getTourStepById(steps: TourStep[], id: string): TourStep | undefined {
  return steps.find((step) => step.id === id);
}
