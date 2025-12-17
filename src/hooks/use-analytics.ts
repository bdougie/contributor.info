import { useCallback } from 'react';
import { trackEvent } from '@/lib/posthog-lazy';
import {
  getRepoNavigationCount,
  incrementRepoNavigationCount,
  getTimeSinceFirstRepoNavigation,
  hasTrackedFirstPageViewThisSession,
  markFirstPageViewTracked,
  extractUTMParams,
  getReferrerDomain,
  isOrganicVisit,
} from '@/lib/plg-tracking-utils';

/**
 * Hook for strategic event tracking across the application
 * Follows privacy-first approach - no PII, only anonymized metrics
 */
export function useAnalytics() {
  const track = useCallback((eventName: string, properties?: Record<string, unknown>) => {
    // Only track events in the browser
    if (typeof window === 'undefined') return;

    trackEvent(eventName, {
      timestamp: new Date().toISOString(),
      page_path: window.location.pathname,
      page_url: window.location.origin + window.location.pathname,
      ...properties,
    });
  }, []);

  // Search & Discovery Events
  const trackRepositorySearchInitiated = useCallback(
    (searchLocation: 'header' | 'homepage' | 'trending', termLength?: number) => {
      track('repository_searched', {
        search_term_length: termLength,
        search_location: searchLocation,
      });
    },
    [track]
  );

  const trackSearchResultsViewed = useCallback(
    (resultsCount: number, searchLocation: 'header' | 'homepage' | 'trending') => {
      track('search_results_viewed', {
        results_count: resultsCount,
        search_location: searchLocation,
      });
    },
    [track]
  );

  const trackRepositorySelectedFromSearch = useCallback(
    (searchLocation: 'header' | 'homepage' | 'trending', resultIndex?: number) => {
      const properties: Record<string, string | number | boolean> = {
        search_location: searchLocation,
      };

      // Only include result_index if it's defined to maintain data quality
      if (resultIndex !== undefined) {
        properties.result_index = resultIndex;
      }

      track('repository_selected_from_search', properties);
    },
    [track]
  );

  const trackTrendingPageInteraction = useCallback(
    (action: 'viewed' | 'repository_clicked') => {
      track('trending_page_interaction', {
        action,
      });
    },
    [track]
  );

  // Repository Interaction Events
  const trackRepositoryPageViewed = useCallback(
    (repoCategory?: string) => {
      track('repository_page_viewed', {
        repo_category: repoCategory, // e.g., 'public', 'private', 'fork'
      });
    },
    [track]
  );

  const trackRepositoryTabSwitch = useCallback(
    (fromTab: string, toTab: string, repoCategory?: string) => {
      track('repository_tab_switched', {
        from_tab: fromTab,
        to_tab: toTab,
        repo_category: repoCategory,
      });
    },
    [track]
  );

  const trackDataRefreshTriggered = useCallback(
    (trigger: 'manual' | 'automatic' | 'background', dataType?: string) => {
      track('data_refresh_triggered', {
        trigger_type: trigger,
        data_type: dataType, // e.g., 'contributors', 'activity', 'stats'
      });
    },
    [track]
  );

  const trackShareAction = useCallback(
    (shareType: 'copy_link' | 'social_share', location: string) => {
      track('share_action', {
        share_type: shareType,
        location, // e.g., 'repository_header', 'contributor_card'
      });
    },
    [track]
  );

  // Workspace Management Events
  const trackWorkspaceCreated = useCallback(
    (source: 'home' | 'settings' | 'onboarding') => {
      track('workspace_created', {
        creation_source: source,
      });
    },
    [track]
  );

  const trackRepositoryAddedToWorkspace = useCallback(
    (addMethod: 'search' | 'manual' | 'bulk', repoCategory?: string) => {
      track('repository_added_to_workspace', {
        add_method: addMethod,
        repo_category: repoCategory,
      });
    },
    [track]
  );

  const trackRepositoryRemovedFromWorkspace = useCallback(
    (removeMethod: 'individual' | 'bulk', repoCategory?: string) => {
      track('repository_removed_from_workspace', {
        remove_method: removeMethod,
        repo_category: repoCategory,
      });
    },
    [track]
  );

  const trackWorkspaceSettingsModified = useCallback(
    (settingType: string) => {
      track('workspace_settings_modified', {
        setting_type: settingType, // e.g., 'name', 'visibility', 'members'
      });
    },
    [track]
  );

  // User Authentication Events
  const trackLoginInitiated = useCallback(
    (provider: string, location: string) => {
      track('login_initiated', {
        auth_provider: provider, // e.g., 'github'
        login_location: location, // e.g., 'header', 'protected_page'
      });
    },
    [track]
  );

  const trackLoginSuccessful = useCallback(
    (provider: string, isFirstTime?: boolean) => {
      track('login_successful', {
        auth_provider: provider,
        is_first_time: isFirstTime,
      });
    },
    [track]
  );

  const trackLogout = useCallback(
    (trigger: 'user_initiated' | 'session_expired') => {
      track('logout', {
        logout_trigger: trigger,
      });
    },
    [track]
  );

  const trackSettingsPageAccessed = useCallback(
    (section?: string) => {
      track('settings_page_accessed', {
        settings_section: section,
      });
    },
    [track]
  );

  // Error & Recovery Events
  const trackPageNotFound = useCallback(
    (attemptedPath: string, referrer?: string) => {
      track('page_not_found', {
        attempted_path_length: attemptedPath.length,
        has_referrer: Boolean(referrer),
        path_segments: attemptedPath.split('/').length,
      });
    },
    [track]
  );

  const trackErrorBoundaryTriggered = useCallback(
    (errorContext: string, errorType?: string, componentStack?: string) => {
      track('error_boundary_triggered', {
        error_context: errorContext,
        error_type: errorType,
        has_component_stack: Boolean(componentStack),
      });
    },
    [track]
  );

  const trackRetryActionAfterError = useCallback(
    (errorType: string, retryMethod: string, isSuccessful?: boolean) => {
      track('retry_after_error', {
        error_type: errorType,
        retry_method: retryMethod,
        retry_successful: isSuccessful,
      });
    },
    [track]
  );

  // =============================================================================
  // PLG (Product-Led Growth) Events - Issue #1236
  // =============================================================================

  // --- Flow 1: Time to Track a Repository ---

  /**
   * Track when user abandons the repository tracking flow
   * Fired on component unmount if user was in active tracking flow
   */
  const trackTrackRepositoryAbandoned = useCallback(
    (
      owner: string,
      repo: string,
      abandonStage: 'viewing' | 'clicked_track' | 'waiting_for_data',
      timeInFlowMs?: number
    ) => {
      track('track_repository_abandoned', {
        repository: `${owner}/${repo}`,
        abandon_stage: abandonStage,
        time_in_flow_ms: timeInFlowMs,
      });
    },
    [track]
  );

  /**
   * Track when user sees timeout message during repository tracking
   */
  const trackTrackRepositoryTimeoutViewed = useCallback(
    (owner: string, repo: string, waitDurationMs: number) => {
      track('track_repository_timeout_viewed', {
        repository: `${owner}/${repo}`,
        wait_duration_ms: waitDurationMs,
      });
    },
    [track]
  );

  /**
   * Track when user previews a repository before deciding to track
   */
  const trackRepositoryPreviewViewed = useCallback(
    (
      owner: string,
      repo: string,
      previewSource: 'search_result' | 'example_repo' | 'direct_navigation' | 'trending'
    ) => {
      track('repository_preview_viewed', {
        repository: `${owner}/${repo}`,
        preview_source: previewSource,
      });
    },
    [track]
  );

  // --- Flow 2: Onboarding Path to Signup/Login ---

  /**
   * Track first page view of the session
   * Only fires once per session using sessionStorage check
   */
  const trackFirstPageView = useCallback(() => {
    // Skip if not in browser
    if (typeof window === 'undefined') return;

    if (hasTrackedFirstPageViewThisSession()) return;

    const utmParams = extractUTMParams(window.location.search);
    const referrer = typeof document !== 'undefined' ? document.referrer : '';

    track('first_page_view', {
      landing_page: window.location.pathname,
      referrer_domain: getReferrerDomain(referrer),
      is_organic: isOrganicVisit(referrer, window.location.search),
      ...utmParams,
    });

    markFirstPageViewTracked();
  }, [track]);

  /**
   * Track when user views a value proposition section
   * Use with IntersectionObserver for scroll tracking
   */
  const trackValuePropViewed = useCallback(
    (
      propType: 'analytics' | 'contributors' | 'workspace' | 'collaboration' | 'tracking',
      viewDurationMs?: number
    ) => {
      track('value_prop_viewed', {
        prop_type: propType,
        view_duration_ms: viewDurationMs,
      });
    },
    [track]
  );

  /**
   * Track when user views a demo/example repository
   */
  const trackDemoRepoViewed = useCallback(
    (demoType: 'workspace' | 'activity' | 'repository' | 'example', repoName?: string) => {
      track('demo_repo_viewed', {
        demo_type: demoType,
        repo_name: repoName,
      });
    },
    [track]
  );

  /**
   * Track feature discovery before login
   * For understanding pre-auth engagement
   */
  const trackFeatureDiscovered = useCallback(
    (featureName: string, interactionType: 'hover' | 'click' | 'scroll', isLoggedIn: boolean) => {
      track('feature_discovered', {
        feature_name: featureName,
        interaction_type: interactionType,
        is_logged_in: isLoggedIn,
      });
    },
    [track]
  );

  /**
   * Track when user dismisses a login prompt without logging in
   */
  const trackLoginPromptDismissed = useCallback(
    (
      promptLocation: 'track_repo' | 'search' | 'workspace' | 'modal' | 'header',
      dismissMethod: 'close_button' | 'click_outside' | 'escape_key' | 'navigation'
    ) => {
      track('login_prompt_dismissed', {
        prompt_location: promptLocation,
        dismiss_method: dismissMethod,
      });
    },
    [track]
  );

  /**
   * Track when user completes OAuth redirect flow
   * Measures round-trip time for auth
   */
  const trackAuthRedirectCompleted = useCallback(
    (provider: string, hadRedirectDestination: boolean, timeToCompleteMs: number | null) => {
      track('auth_redirect_completed', {
        auth_provider: provider,
        had_redirect_destination: hadRedirectDestination,
        time_to_complete_ms: timeToCompleteMs,
      });
    },
    [track]
  );

  // --- Flow 3: Time to Search a Second Repository ---

  /**
   * Track when user focuses/initiates search input
   */
  const trackRepoSearchInitiated = useCallback(
    (searchLocation: 'header' | 'homepage' | 'trending' | 'workspace') => {
      track('repo_search_initiated', {
        search_location: searchLocation,
        is_first_search: getRepoNavigationCount() === 0,
      });
    },
    [track]
  );

  /**
   * Track search query entered (call with debounce ~500ms)
   */
  const trackRepoSearchQueryEntered = useCallback(
    (
      searchLocation: 'header' | 'homepage' | 'trending',
      queryLength: number,
      hasResults: boolean
    ) => {
      track('repo_search_query_entered', {
        search_location: searchLocation,
        query_length: queryLength,
        has_results: hasResults,
      });
    },
    [track]
  );

  /**
   * Track when user clicks a search result
   */
  const trackRepoSearchResultClicked = useCallback(
    (
      searchLocation: 'header' | 'homepage' | 'trending',
      resultIndex: number,
      resultType: 'api_result' | 'suggestion' | 'recent' | 'example'
    ) => {
      track('repo_search_result_clicked', {
        search_location: searchLocation,
        result_index: resultIndex,
        result_type: resultType,
      });
    },
    [track]
  );

  /**
   * Track search completion (navigation to repository)
   * Also handles activation milestone (2nd repo = activated)
   */
  const trackRepoSearchCompleted = useCallback(
    (
      searchLocation: 'header' | 'homepage' | 'trending' | 'example' | 'direct',
      repository: string
    ) => {
      const navigationCount = incrementRepoNavigationCount();

      track('repo_search_completed', {
        search_location: searchLocation,
        repository,
        navigation_number: navigationCount,
        is_second_navigation: navigationCount === 2,
      });

      // Fire activation milestone event on second repository navigation
      if (navigationCount === 2) {
        track('second_repo_searched', {
          activation_milestone: true,
          time_since_first_navigation_ms: getTimeSinceFirstRepoNavigation(),
        });
      }
    },
    [track]
  );

  /**
   * Track when search suggestions are displayed
   */
  const trackSearchSuggestionViewed = useCallback(
    (suggestionType: 'trending' | 'recent' | 'popular' | 'example', suggestionCount: number) => {
      track('search_suggestion_viewed', {
        suggestion_type: suggestionType,
        suggestion_count: suggestionCount,
      });
    },
    [track]
  );

  /**
   * Track when user clicks a search suggestion
   */
  const trackSearchSuggestionClicked = useCallback(
    (suggestionType: 'trending' | 'recent' | 'popular' | 'example', suggestionIndex: number) => {
      track('search_suggestion_clicked', {
        suggestion_type: suggestionType,
        suggestion_index: suggestionIndex,
      });
    },
    [track]
  );

  return {
    // Generic tracking
    track,

    // Search & Discovery
    trackRepositorySearchInitiated,
    trackSearchResultsViewed,
    trackRepositorySelectedFromSearch,
    trackTrendingPageInteraction,

    // Repository Interactions
    trackRepositoryPageViewed,
    trackRepositoryTabSwitch,
    trackDataRefreshTriggered,
    trackShareAction,

    // Workspace Management
    trackWorkspaceCreated,
    trackRepositoryAddedToWorkspace,
    trackRepositoryRemovedFromWorkspace,
    trackWorkspaceSettingsModified,

    // User Authentication
    trackLoginInitiated,
    trackLoginSuccessful,
    trackLogout,
    trackSettingsPageAccessed,

    // Error & Recovery
    trackPageNotFound,
    trackErrorBoundaryTriggered,
    trackRetryActionAfterError,

    // PLG Flow 1: Time to Track Repository
    trackTrackRepositoryAbandoned,
    trackTrackRepositoryTimeoutViewed,
    trackRepositoryPreviewViewed,

    // PLG Flow 2: Onboarding Path to Signup/Login
    trackFirstPageView,
    trackValuePropViewed,
    trackDemoRepoViewed,
    trackFeatureDiscovered,
    trackLoginPromptDismissed,
    trackAuthRedirectCompleted,

    // PLG Flow 3: Time to Search Second Repository
    trackRepoSearchInitiated,
    trackRepoSearchQueryEntered,
    trackRepoSearchResultClicked,
    trackRepoSearchCompleted,
    trackSearchSuggestionViewed,
    trackSearchSuggestionClicked,
  };
}
