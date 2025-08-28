/**
 * Data Type Mapping Utilities
 *
 * Utilities for mapping and transforming data types that typically require
 * nested ternary expressions. These utilities provide cleaner, more maintainable
 * ways to handle data type conversions and mappings.
 */

/**
 * Configuration for user/contributor type mapping
 */
export const USER_TYPE_MAP = {
  /**
   * Maps database bot flag to user type
   */
  fromBotFlag: (isBot: boolean): 'Bot' | 'User' => (isBot ? 'Bot' : 'User'),

  /**
   * Maps user type string to proper type
   */
  fromTypeString: (type?: string): 'Bot' | 'User' => (type === 'Bot' ? 'Bot' : 'User'),
} as const;

/**
 * Gets the appropriate user type from database contributor data
 *
 * @param contributor - The contributor object from database
 * @returns The properly typed user type
 *
 * @example
 * ```tsx
 * type: getUserType(dbPR.contributors)
 * // Instead of: type: (dbPR.contributors?.is_bot ? 'Bot' : 'User') as 'Bot' | 'User'
 * ```
 */
export const getUserType = (contributor?: { is_bot?: boolean }): 'Bot' | 'User' => {
  return USER_TYPE_MAP.fromBotFlag(Boolean(contributor?.is_bot));
};

/**
 * Configuration for PR/issue state mapping
 */
export const PR_STATE_MAP = {
  open: 'open',
  closed: 'closed',
} as const;

/**
 * Gets the appropriate PR state based on GitHub API data
 *
 * @param state - The state from GitHub API (may be 'OPEN', 'open', etc.)
 * @returns The normalized state value
 *
 * @example
 * ```tsx
 * state: getPRState(pullRequest.state)
 * // Instead of: state: pullRequest.state?.toLowerCase() === 'open' ? 'open' : 'closed'
 * ```
 */
export const getPRState = (state?: string): 'open' | 'closed' => {
  if (!state) return 'closed';
  return state.toLowerCase() === 'open' ? PR_STATE_MAP.open : PR_STATE_MAP.closed;
};

/**
 * Configuration for role mapping based on user properties
 */
export const ROLE_MAPPING = {
  /**
   * Default role for bots
   */
  bot: 'Bot',

  /**
   * Default role for regular contributors
   */
  contributor: 'Contributor',
} as const;

/**
 * Gets the appropriate role for a user/contributor
 *
 * @param role - The explicit role if available
 * @param user - The user object with type information
 * @returns The appropriate role string
 *
 * @example
 * ```tsx
 * role={getUserRole(role, user)}
 * // Instead of: role={role?.role || (user.isBot ? 'Bot' : 'Contributor')}
 * ```
 */
export const getUserRole = (
  role?: { role?: string },
  user?: { isBot?: boolean; type?: string }
): string => {
  if (role?.role) return role.role;

  // Check various ways the bot flag might be set
  if (user?.isBot || user?.type === 'Bot') {
    return ROLE_MAPPING.bot;
  }

  return ROLE_MAPPING.contributor;
};

/**
 * Configuration for date/timestamp handling
 */
export const DATE_MAPPING = {
  /**
   * Converts database timestamp to Date object with fallback
   */
  fromTimestamp: (timestamp?: string | null): Date | undefined => {
    return timestamp ? new Date(timestamp) : undefined;
  },

  /**
   * Formats date range display text
   */
  formatRange: (startDate?: Date | null, endDate?: Date | null): string => {
    const start = startDate ? startDate.toLocaleDateString() : 'All time';
    const end = endDate ? endDate.toLocaleDateString() : 'Present';
    return `${start} - ${end}`;
  },
} as const;

/**
 * Gets the appropriate last sync date from repository data
 *
 * @param repo - The repository object with sync timestamp
 * @returns The Date object or undefined if no sync date
 *
 * @example
 * ```tsx
 * lastSync: getLastSyncDate(repo)
 * // Instead of: lastSync: repo?.last_synced_at ? new Date(repo.last_synced_at) : undefined
 * ```
 */
export const getLastSyncDate = (repo?: { last_synced_at?: string | null }): Date | undefined => {
  return DATE_MAPPING.fromTimestamp(repo?.last_synced_at);
};

/**
 * Formats a date range for display
 *
 * @param dateRange - Object with start and end dates
 * @returns Formatted date range string
 *
 * @example
 * ```tsx
 * {formatDateRange(dateRange)}
 * // Instead of: {dateRange?.startDate ? dateRange.startDate.toLocaleDateString() : 'All time'} - {dateRange?.endDate ? dateRange.endDate.toLocaleDateString() : 'Present'}
 * ```
 */
export const formatDateRange = (dateRange?: {
  startDate?: Date | null;
  endDate?: Date | null;
}): string => {
  return DATE_MAPPING.formatRange(dateRange?.startDate, dateRange?.endDate);
};

/**
 * Configuration for validation and environment checks
 */
export const VALIDATION_MAP = {
  /**
   * DUB.CO API key validation patterns
   */
  dubKey: {
    isValid: (key?: string): boolean => Boolean(key?.startsWith('dub_')),
    getStatus: (key?: string): '✅ Valid' | '❌ Invalid' =>
      VALIDATION_MAP.dubKey.isValid(key) ? '✅ Valid' : '❌ Invalid',
  },
} as const;

/**
 * Gets the validation status for DUB.CO API key
 *
 * @param key - The API key to validate
 * @returns The validation status string
 *
 * @example
 * ```tsx
 * {getDubKeyStatus(import.meta.env.VITE_DUB_CO_KEY)}
 * // Instead of: {import.meta.env.VITE_DUB_CO_KEY?.startsWith('dub_') ? '✅ Valid' : '❌ Invalid'}
 * ```
 */
export const getDubKeyStatus = (key?: string): '✅ Valid' | '❌ Invalid' => {
  return VALIDATION_MAP.dubKey.getStatus(key);
};

/**
 * Safely finds a contributor in nested data structures
 *
 * @param quadrant - The quadrant object with nested children
 * @param selectedContributor - The contributor ID to find
 * @returns The found contributor or undefined
 *
 * @example
 * ```tsx
 * const contributor = findContributorInQuadrant(quadrant, selectedContributor);
 * // Instead of: const contributor = quadrant?.children?.find((c: any) => c.id === selectedContributor);
 * ```
 */
export const findContributorInQuadrant = (
  quadrant?: { children?: Array<{ id: string; [key: string]: any }> },
  selectedContributor?: string
) => {
  if (!quadrant?.children || !selectedContributor) return undefined;
  return quadrant.children.find((c: any) => c.id === selectedContributor);
};
