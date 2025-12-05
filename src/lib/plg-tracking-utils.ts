/**
 * PLG (Product-Led Growth) Tracking Utilities
 *
 * Manages localStorage/sessionStorage for milestone tracking across sessions.
 * Used by use-analytics.ts for PLG event tracking.
 */

const STORAGE_KEYS = {
  /** Count of repositories navigated to (for activation milestone) */
  REPO_NAVIGATION_COUNT: 'plg_repo_navigation_count',
  /** Timestamp of first repository navigation */
  FIRST_REPO_NAVIGATION_TIME: 'plg_first_repo_navigation_time',
  /** Timestamp of first visit to the site */
  FIRST_VISIT_TIME: 'plg_first_visit_time',
  /** Timestamp when OAuth redirect started (for duration calculation) */
  AUTH_REDIRECT_START: 'plg_auth_redirect_start',
  /** Session key to track if first_page_view already fired this session */
  FIRST_PAGE_VIEW_TRACKED: 'plg_first_page_view_tracked',
} as const;

/**
 * Get the current count of repositories the user has navigated to.
 * Used to determine activation milestone (2nd repo = activated).
 */
export function getRepoNavigationCount(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEYS.REPO_NAVIGATION_COUNT) || '0', 10);
  } catch {
    return 0;
  }
}

/**
 * Increment the repository navigation count and track first navigation time.
 * Returns the new count after incrementing.
 */
export function incrementRepoNavigationCount(): number {
  try {
    const current = getRepoNavigationCount();
    const newCount = current + 1;
    localStorage.setItem(STORAGE_KEYS.REPO_NAVIGATION_COUNT, String(newCount));

    // Track first navigation time for "time to second repo" calculation
    if (newCount === 1) {
      localStorage.setItem(STORAGE_KEYS.FIRST_REPO_NAVIGATION_TIME, String(Date.now()));
    }

    return newCount;
  } catch {
    return 1;
  }
}

/**
 * Get the time elapsed since the first repository navigation.
 * Returns null if no first navigation has been recorded.
 */
export function getTimeSinceFirstRepoNavigation(): number | null {
  try {
    const firstNavTime = localStorage.getItem(STORAGE_KEYS.FIRST_REPO_NAVIGATION_TIME);
    if (!firstNavTime) return null;
    return Date.now() - parseInt(firstNavTime, 10);
  } catch {
    return null;
  }
}

/**
 * Mark the start of an OAuth redirect flow.
 * Called before redirecting to GitHub OAuth to calculate round-trip time.
 */
export function markAuthRedirectStart(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT_START, String(Date.now()));
  } catch {
    // Silently fail - analytics shouldn't break auth flow
  }
}

/**
 * Get the duration of the OAuth redirect flow and clear the start time.
 * Returns null if no redirect start was recorded.
 */
export function getAuthRedirectDuration(): number | null {
  try {
    const startTime = localStorage.getItem(STORAGE_KEYS.AUTH_REDIRECT_START);
    if (!startTime) return null;

    const duration = Date.now() - parseInt(startTime, 10);
    localStorage.removeItem(STORAGE_KEYS.AUTH_REDIRECT_START);
    return duration;
  } catch {
    return null;
  }
}

/**
 * Check if this is the user's first visit ever (not just this session).
 * Uses localStorage to persist across sessions.
 */
export function isFirstVisitEver(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEYS.FIRST_VISIT_TIME);
  } catch {
    return true;
  }
}

/**
 * Mark the user's first visit timestamp.
 * Only sets if not already set.
 */
export function markFirstVisit(): void {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.FIRST_VISIT_TIME)) {
      localStorage.setItem(STORAGE_KEYS.FIRST_VISIT_TIME, String(Date.now()));
    }
  } catch {
    // Silently fail
  }
}

/**
 * Check if first_page_view event has already been tracked this session.
 * Uses sessionStorage so it resets each browser session.
 */
export function hasTrackedFirstPageViewThisSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.FIRST_PAGE_VIEW_TRACKED) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that first_page_view has been tracked this session.
 */
export function markFirstPageViewTracked(): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.FIRST_PAGE_VIEW_TRACKED, 'true');
  } catch {
    // Silently fail
  }
}

/**
 * Extract UTM parameters from a URL search string.
 * Returns an object with utm_source, utm_medium, utm_campaign, etc.
 */
export function extractUTMParams(searchString: string): Record<string, string> {
  const params = new URLSearchParams(searchString);
  const utmParams: Record<string, string> = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      utmParams[key] = value;
    }
  }

  return utmParams;
}

/**
 * Safely extract hostname from a referrer URL.
 * Returns null if referrer is empty or invalid.
 */
export function getReferrerDomain(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}

/**
 * Check if the current visit is organic (no referrer or no UTM params).
 * A visit is NOT organic if ANY UTM parameter is present.
 */
export function isOrganicVisit(referrer: string, searchString: string): boolean {
  // No referrer = direct/organic
  if (!referrer) return true;

  // Has ANY UTM params = paid/campaign (not organic)
  const params = new URLSearchParams(searchString);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const hasAnyUtmParam = utmKeys.some((key) => params.has(key));

  return !hasAnyUtmParam;
}
