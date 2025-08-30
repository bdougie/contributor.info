import { useCallback } from 'react';
import { trackEvent } from '@/lib/posthog-lazy';

/**
 * Hook for strategic event tracking across the application
 * Follows privacy-first approach - no PII, only anonymized metrics
 */
export function useAnalytics() {
  const track = useCallback((eventName: string, properties?: Record<string, unknown>) => {
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
  };
}
