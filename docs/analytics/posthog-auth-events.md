# PostHog Authentication & Workspace Events

This document describes all PostHog events related to authentication and workspace onboarding flows.

## Overview

We track key user journey events from initial authentication through workspace creation to help understand:
- Authentication funnel conversion
- Time to first workspace creation
- User activation patterns
- Drop-off points in onboarding

## Authentication Events

### `auth_button_viewed`
Fired when the auth button becomes visible to the user.

**Properties:**
- `is_logged_in` (boolean): Whether user is already authenticated
- `page_path` (string): Current page URL path

**File:** `src/components/features/auth/auth-button.tsx`

### `auth_started`
Fired when user clicks the sign-in button to initiate authentication.

**Properties:**
- `auth_provider` (string): Authentication provider (always "github")
- `source` (string): Where auth was initiated from (e.g., "header")
- `page_path` (string): Current page URL path

**File:** `src/components/features/auth/auth-button.tsx`

### `auth_completed`
Fired when authentication is successfully completed.

**Properties:**
- `auth_provider` (string): Authentication provider (always "github")
- `user_id` (string): Supabase user ID
- `is_new_user` (boolean): Whether this is a first-time login

**File:** `src/components/features/auth/auth-button.tsx`

### `auth_failed`
Fired when authentication fails for any reason.

**Properties:**
- `auth_provider` (string): Authentication provider (always "github")
- `error_message` (string, optional): Error message from auth provider
- `error_type` (string, optional): Type of error (e.g., "exception")
- `page_path` (string): Current page URL path

**File:** `src/components/features/auth/auth-button.tsx`

### `user_logout`
Fired when user logs out.

**Properties:**
- `page_path` (string): Current page URL path

**File:** `src/components/features/auth/auth-button.tsx`

## Workspace Events

### `workspace_cta_viewed`
Fired when the "Create Workspace" CTA is displayed to a logged-in user with no workspaces.

**Properties:**
- `page_path` (string): Current page URL path
- `workspace_count` (number): Number of workspaces (always 0 for CTA)

**File:** `src/components/common/layout/layout.tsx`

### `workspace_cta_clicked`
Fired when user clicks the "Create Workspace" CTA button.

**Properties:**
- `source` (string): Where CTA was clicked from (e.g., "header_cta")
- `page_path` (string): Current page URL path

**File:** `src/components/common/layout/layout.tsx`

### `workspace_creation_started`
Fired when user lands on the workspace creation page.

**Properties:**
- `source` (string): Navigation source (e.g., "workspace_new_page")
- `user_id` (string): Supabase user ID

**File:** `src/pages/workspace-new-page.tsx`

### `workspace_created`
Fired when a workspace is successfully created.

**Properties:**
- `workspace_id` (string): ID of the created workspace
- `workspace_name` (string): Name of the workspace
- `time_to_create_ms` (number): Time taken to create workspace in milliseconds
- `is_first_workspace` (boolean): Whether this is the user's first workspace

**File:** `src/pages/workspace-new-page.tsx`

### `first_workspace_created`
Special event fired only when user creates their very first workspace.

**Properties:**
- `workspace_id` (string): ID of the first workspace
- `time_to_create_ms` (number): Time taken to create first workspace

**File:** `src/pages/workspace-new-page.tsx`

### `workspace_creation_failed`
Fired when workspace creation fails with a known error.

**Properties:**
- `error` (string): Error message
- `workspace_name` (string): Attempted workspace name

**File:** `src/pages/workspace-new-page.tsx`

### `workspace_creation_error`
Fired when workspace creation fails with an exception.

**Properties:**
- `error_type` (string): Type of error (e.g., "exception")
- `workspace_name` (string): Attempted workspace name

**File:** `src/pages/workspace-new-page.tsx`

## User Identification

After successful authentication, users are identified in PostHog using:

```typescript
identifyUser(githubId, {
  github_username: user.user_metadata?.user_name,
  email: user.email,
  created_at: user.created_at,
  auth_provider: 'github',
});
```

This allows all subsequent events to be associated with the user for cohort analysis.

## Implementation Guidelines

### Privacy-First Approach
- Events are anonymous until user logs in
- User identification only happens after explicit authentication
- No personal data is tracked without user action
- Internal users (e.g., @bdougie) are filtered from analytics

### Performance Considerations
- Events use lazy-loaded PostHog client
- Rate limiting is applied to prevent event flooding
- Event tracking failures are silent in production

### Adding New Events

When adding new authentication or workspace events:

1. **Use existing functions** from `@/lib/posthog-lazy`:
   ```typescript
   import { trackEvent, identifyUser } from '@/lib/posthog-lazy';
   ```

2. **Follow naming conventions**:
   - Use snake_case for event names
   - Be descriptive but concise
   - Group related events with common prefixes

3. **Include meaningful properties**:
   - Always include context (page, source)
   - Add timing data where relevant
   - Include success/failure indicators

4. **Document the event** in this file with:
   - Event name and description
   - All properties with types
   - Source file location

## Monitoring & Analysis

### Key Metrics to Track

1. **Authentication Funnel**
   - Views → Starts → Completions
   - Drop-off rates at each step
   - Error rates and types

2. **Workspace Creation Funnel**
   - CTA Views → Clicks → Creation Starts → Completions
   - Time to first workspace
   - Success rate

3. **User Activation**
   - % of new users creating workspace within first session
   - Average time from signup to first workspace
   - Workspace CTA effectiveness

### PostHog Dashboards

Create the following dashboards in PostHog:

1. **Auth Funnel Dashboard**
   - Funnel visualization: `auth_button_viewed` → `auth_started` → `auth_completed`
   - Error rate trends
   - New vs returning user authentication

2. **Workspace Onboarding Dashboard**
   - Funnel: `workspace_cta_viewed` → `workspace_cta_clicked` → `workspace_created`
   - First workspace creation rate
   - Time to activation metrics

3. **User Journey Dashboard**
   - Complete flow from auth to workspace creation
   - Drop-off analysis
   - Cohort comparisons

## Testing

Events can be tested locally by:

1. Enable PostHog in development:
   ```javascript
   localStorage.setItem('enablePostHogDev', 'true');
   ```

2. Check browser console for event tracking:
   ```javascript
   // Events will be logged in development
   ```

3. Verify in PostHog dashboard (if configured for dev environment)

## Related Files

- `/src/lib/posthog-lazy.ts` - PostHog integration and helper functions
- `/docs/analytics/posthog-strategy.md` - Overall PostHog strategy
- `/src/hooks/use-workspace-count.ts` - Workspace counting logic
- `/src/hooks/__tests__/use-workspace-count.test.ts` - Tests for workspace hooks