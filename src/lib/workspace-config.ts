/**
 * Centralized configuration for workspace-related timeouts and settings
 */

// Timeout configuration for workspace operations (in milliseconds)
export const WORKSPACE_TIMEOUTS = {
  // Authentication check timeout
  AUTH: 2000,

  // UI feedback timeout - when to show "taking longer than usual" message
  UI_FEEDBACK: 3000,

  // Context loading timeout - max time for workspace context to load
  CONTEXT: 5000,

  // Hook timeout - max time for workspace hooks to complete
  HOOK: 10000,

  // Retry delay after failure
  RETRY_DELAY: 1000,

  // Maximum number of retry attempts
  MAX_RETRIES: 3,
} as const;

// Error messages configuration
export const WORKSPACE_ERROR_MESSAGES = {
  NOT_FOUND: (idOrSlug: string) =>
    `Workspace "${idOrSlug}" not found. Please check the URL and try again.`,
  LOAD_FAILED: 'Unable to load workspaces. You can continue working or try refreshing.',
  TIMEOUT: 'Loading is taking longer than expected. Please check your connection.',
  SWITCH_FAILED: 'Failed to switch workspace. Please try again.',
  AUTH_FAILED: 'Authentication check failed. Please ensure you are logged in.',
  GENERIC: 'An unexpected error occurred. Please try again.',
} as const;

// Local storage keys
export const WORKSPACE_STORAGE_KEYS = {
  RECENT: 'contributor_info_recent_workspaces',
  ACTIVE: 'contributor_info_active_workspace',
} as const;

// Other workspace constants
export const WORKSPACE_LIMITS = {
  MAX_RECENT: 5,
  MAX_NAME_LENGTH: 100,
  MAX_SLUG_LENGTH: 50,
} as const;

// Workspace tier configuration
export const WORKSPACE_TIERS = {
  FREE: {
    name: 'free',
    maxRepositories: 4,
    dataRetentionDays: 30,
    color: 'bg-gray-100 text-gray-700',
  },
  PRO: {
    name: 'pro',
    maxRepositories: 10,
    dataRetentionDays: 90,
    color: 'bg-blue-100 text-blue-700',
  },
  ENTERPRISE: {
    name: 'enterprise',
    maxRepositories: -1, // Unlimited
    dataRetentionDays: -1, // Unlimited
    color: 'bg-purple-100 text-purple-700',
  },
} as const;

export type WorkspaceTier = keyof typeof WORKSPACE_TIERS;
