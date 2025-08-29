/**
 * Utility functions for workspace tier priority to replace nested ternary expressions
 */

export type WorkspaceTier = 'enterprise' | 'pro' | 'free' | string;

/**
 * Get priority value based on workspace tier
 * Lower values indicate higher priority for processing
 *
 * @param tier - Workspace subscription tier
 * @returns Priority value: 10 for enterprise, 50 for pro, 100 for all others
 *
 * @example
 * getWorkspacePriority('enterprise') // returns 10 (highest priority)
 * getWorkspacePriority('pro') // returns 50 (medium priority)
 * getWorkspacePriority('free') // returns 100 (standard priority)
 * getWorkspacePriority('basic') // returns 100 (standard priority)
 */
export const getWorkspacePriority = (tier: WorkspaceTier): number => {
  if (tier === 'enterprise') return 10;
  if (tier === 'pro') return 50;
  return 100;
};
