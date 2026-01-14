import type { TourStep } from './types';

/**
 * Default tour steps for the onboarding experience
 *
 * These steps guide users through the key features of contributor.info:
 * 1. Command palette (Cmd+K)
 * 2. Workspace creation/management
 * 3. Repository tracking
 * 4. Contributor insights
 * 5. Navigation and settings
 */
export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    content:
      'Welcome to contributor.info! Let me show you around the key features that will help you track and understand your open source contributions.',
    placement: 'center',
    disableBeacon: true,
    category: 'navigation',
  },
  {
    id: 'home-button',
    target: '[data-tour="home-button"]',
    content:
      'Click the logo anytime to return to the home page where you can search for repositories.',
    placement: 'bottom',
    category: 'navigation',
  },
  {
    id: 'command-palette',
    target: '[data-tour="workspace-switcher"], [data-tour="create-workspace-cta"]',
    content:
      'Press Cmd+K (or Ctrl+K) to open the command palette. Quickly navigate between workspaces, repositories, and actions.',
    placement: 'bottom',
    category: 'navigation',
  },
  {
    id: 'navigation-menu',
    target: '[data-tour="navigation-menu"]',
    content:
      'Access the navigation menu to explore trending repositories, view the changelog, or adjust your settings.',
    placement: 'right',
    category: 'navigation',
  },
  {
    id: 'workspace-intro',
    target: '[data-tour="workspace-switcher"], [data-tour="create-workspace-cta"]',
    content:
      'Workspaces help you organize repositories into collections. Create workspaces for different projects, teams, or interests.',
    placement: 'bottom',
    category: 'workspace',
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    content:
      'Check your notifications here. Stay updated on activity in your tracked repositories and workspaces.',
    placement: 'bottom',
    category: 'collaboration',
  },
  {
    id: 'theme-toggle',
    target: '[data-tour="theme-toggle"]',
    content:
      'Toggle between light and dark mode based on your preference. Your choice will be saved automatically.',
    placement: 'left',
    category: 'settings',
  },
  {
    id: 'search-repositories',
    target: '[data-tour="search-input"]',
    content:
      'Search for any GitHub repository by typing the owner/repo name. Results appear instantly as you type.',
    placement: 'bottom',
    category: 'repository',
  },
  {
    id: 'tour-complete',
    target: 'body',
    content:
      "You're all set! Start by searching for a repository or creating your first workspace. You can restart this tour anytime from the help menu.",
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
