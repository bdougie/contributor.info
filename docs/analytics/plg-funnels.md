# PLG Tracking Funnels - PostHog Configuration

Implementation for GitHub Issue #1236: PLG Tracking for High-Value User Flows

## Event Overview

### Flow 1: Time to Track a Repository
Measures conversion from viewing a repository to successfully tracking it.

| Event Name | Description | Key Properties |
|------------|-------------|----------------|
| `viewed_track_repository_prompt` | User views the "Track This Repository" card | `repository`, `isLoggedIn` |
| `clicked_login_to_track_repository` | Logged-out user clicks login to track | `repository` |
| `clicked_track_repository` | User clicks "Track Repository" button | `repository` |
| `repository_tracking_initiated` | API call succeeds, tracking starts | `repository`, `eventId` |
| `repository_data_ready` | Data becomes available (polling success) | `repository`, `pollAttempts` |
| `track_repository_abandoned` | User leaves before completion | `repository`, `abandon_stage`, `time_in_flow_ms` |
| `track_repository_timeout_viewed` | Polling times out (2+ minutes) | `repository`, `wait_duration_ms` |

### Flow 2: Onboarding Path to Signup/Login
Tracks user journey from first visit to authentication.

| Event Name | Description | Key Properties |
|------------|-------------|----------------|
| `first_page_view` | First page view of session | `landing_page`, `referrer_domain`, `is_organic`, `utm_*` |
| `value_prop_viewed` | User views a value proposition section | `prop_type`, `view_duration_ms` |
| `demo_repo_viewed` | User views demo/example repository | `demo_type`, `repo_name` |
| `feature_discovered` | Pre-auth feature interaction | `feature_name`, `interaction_type`, `is_logged_in` |
| `auth_started` | OAuth flow initiated | `auth_provider`, `source` |
| `auth_completed` | OAuth successful | `auth_provider`, `is_new_user` |
| `auth_redirect_completed` | OAuth round-trip timing | `auth_provider`, `time_to_complete_ms` |
| `login_prompt_dismissed` | User dismisses login prompt | `prompt_location`, `dismiss_method` |

### Flow 3: Time to Search a Second Repository
Measures activation through second repository navigation.

| Event Name | Description | Key Properties |
|------------|-------------|----------------|
| `repo_search_initiated` | User focuses search input | `search_location`, `is_first_search` |
| `repo_search_query_entered` | Debounced query tracking | `search_location`, `query_length`, `has_results` |
| `repo_search_result_clicked` | User clicks a search result | `search_location`, `result_index`, `result_type` |
| `repo_search_completed` | User navigates to repository | `search_location`, `repository`, `navigation_number` |
| `second_repo_searched` | **Activation milestone** - 2nd repo | `activation_milestone`, `time_since_first_navigation_ms` |
| `search_suggestion_viewed` | Suggestions displayed | `suggestion_type`, `suggestion_count` |
| `search_suggestion_clicked` | User clicks a suggestion | `suggestion_type`, `suggestion_index` |

---

## PostHog Funnel Configurations

### Funnel 1: Repository Tracking Conversion

```
Name: Time to Track Repository
Steps:
1. viewed_track_repository_prompt
2. clicked_track_repository (or clicked_login_to_track_repository)
3. repository_tracking_initiated
4. repository_data_ready

Conversion Window: 30 minutes
Breakdown: isLoggedIn (step 1)
```

**Key Metrics:**
- Conversion rate from view → track click
- Drop-off at login requirement
- Time to data ready
- Abandonment rate by stage

### Funnel 2: First Visit to Auth

```
Name: Onboarding to Authentication
Steps:
1. first_page_view
2. Any engagement event (value_prop_viewed, demo_repo_viewed, repo_search_initiated)
3. auth_started
4. auth_completed

Conversion Window: 7 days
Breakdown: landing_page, referrer_domain, is_organic
```

**Key Metrics:**
- Landing page effectiveness
- Organic vs paid conversion
- Feature discovery → auth correlation
- OAuth completion rate

### Funnel 3: User Activation

```
Name: Second Repository Navigation (Activation)
Steps:
1. first_page_view (or auth_completed for returning users)
2. repo_search_completed (navigation_number = 1)
3. second_repo_searched (activation_milestone = true)

Conversion Window: 30 days
Breakdown: search_location
```

**Key Metrics:**
- Time to activation (2nd repo)
- Search completion rate
- Activation by entry point

---

## Dashboard Recommendations

### PLG Overview Dashboard

1. **Funnel Visualization**
   - All 3 funnels side by side
   - Weekly trend comparison

2. **Key Conversion Metrics**
   - Repository tracking conversion %
   - First visit → auth conversion %
   - Activation rate (2nd repo searched)

3. **Abandonment Analysis**
   - `track_repository_abandoned` by `abandon_stage`
   - `login_prompt_dismissed` by `prompt_location`

4. **Time-Based Metrics**
   - `time_to_complete_ms` distribution for auth
   - `time_since_first_navigation_ms` for activation
   - `time_in_flow_ms` for abandonment

---

## Implementation Files

| File | Changes |
|------|---------|
| `src/lib/plg-tracking-utils.ts` | NEW - localStorage utilities for milestone tracking |
| `src/hooks/use-analytics.ts` | Extended with 15 PLG event trackers |
| `src/components/features/repository/repository-tracking-card.tsx` | Abandonment + timeout tracking |
| `src/components/common/layout/layout.tsx` | First page view tracking |
| `src/components/features/auth/auth-button.tsx` | OAuth redirect timing |
| `src/components/ui/github-search-input.tsx` | Search flow + activation tracking |

---

## Testing Verification

To verify events are firing correctly:

1. Open PostHog Live Events view
2. Navigate through each flow:
   - Visit untracked repo → view tracking card → click track
   - Fresh incognito session → browse → login
   - Search for repo → navigate → search for second repo
3. Confirm events appear with correct properties
4. Check funnels populate with data

## Future Enhancements

- [ ] Add `value_prop_viewed` with IntersectionObserver on homepage
- [ ] Add `feature_discovered` hover tracking on feature cards
- [ ] Add `search_suggestion_viewed/clicked` when implementing suggestions UI
- [ ] Create PostHog cohorts for activated vs non-activated users
