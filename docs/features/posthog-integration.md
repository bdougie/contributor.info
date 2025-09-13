# PostHog Integration Guide

This guide covers the complete PostHog integration including cohorts, feature flags, and analytics.

## Table of Contents

1. [Overview](#overview)
2. [Cohorts](#cohorts)
3. [Feature Flags](#feature-flags)
4. [Setup](#setup)
5. [Management Scripts](#management-scripts)
6. [Troubleshooting](#troubleshooting)

## Overview

Our PostHog integration provides:
- **User Cohorts** - Automatic user segmentation based on behavior
- **Feature Flags** - Controlled feature rollouts tied to cohorts
- **Analytics** - Event tracking with cohort enrichment
- **A/B Testing** - Experiment framework using cohorts

## Cohorts

### Active Cohorts in PostHog

| Cohort Name | ID | Description | Criteria |
|-------------|-----|-------------|----------|
| Internal Team | 180246 | Team members for testing | GitHub username or email match |
| New Users | 180240 | Recent signups | Account < 30 days old |
| Users with Workspaces | 180241 | Workspace creators | has_workspace = true |
| Users with Multiple Repos | 180242 | Power users | tracked_repos_count ≥ 3 |
| Active Users Last 7 Days | 180243 | Recently active | Last seen < 7 days |
| High Engagement Users | 180244 | Multi-behavior users | cohort_count ≥ 2 |
| Users with Primary Cohort | 180245 | Assigned users | primary_cohort exists |

### How Cohorts Work

1. **Client-Side Calculation**
   - User behavior tracked locally in `cohort-manager.ts`
   - Cohorts calculated based on event counts and properties
   - Updates happen in real-time as users interact

2. **PostHog Synchronization**
   ```typescript
   // User properties sent to PostHog
   identifyUser(userId, {
     cohorts: ['power_users', 'active_searchers'],
     primary_cohort: 'power_users',
     cohort_count: 2,
     // ... other properties
   });
   ```

3. **Cohort Assignment Logic**
   - Users can belong to multiple cohorts
   - Primary cohort determined by priority
   - Cohorts update dynamically based on behavior

### Using Cohorts in Code

```typescript
import { useCohorts } from '@/hooks/use-cohorts';

function MyComponent() {
  const { userCohorts, primaryCohort, isInCohort } = useCohorts();
  
  // Check specific cohort membership
  if (isInCohort('power_users')) {
    // Show power user features
  }
  
  // Use primary cohort for main segmentation
  switch (primaryCohort) {
    case 'new_users':
      // Show onboarding
      break;
    case 'power_users':
      // Show advanced features
      break;
  }
}
```

## Feature Flags

### Active Feature Flags

| Flag Key | Description | Target | Status |
|----------|-------------|--------|--------|
| enable_workspace_creation | Workspace creation access | Internal Team cohort | Active |
| enable_workspace_analytics | Analytics in workspaces | 10% rollout | Testing |
| enable_new_search | Improved search algorithm | Disabled | Development |

### Using Feature Flags

```typescript
import { useFeatureFlag } from '@/lib/feature-flags';

function WorkspaceSection() {
  const canCreateWorkspace = useFeatureFlag('enable_workspace_creation');
  
  return (
    <div>
      {canCreateWorkspace && (
        <Button onClick={handleCreateWorkspace}>
          Create New Workspace
        </Button>
      )}
    </div>
  );
}
```

### Feature Flag + Cohort Targeting

Feature flags can target specific cohorts for progressive rollouts:

```javascript
// In PostHog configuration
{
  key: 'new_feature',
  filters: {
    groups: [{
      properties: [{
        key: 'id',
        type: 'cohort',
        value: 180246, // Internal Team cohort
      }],
      rollout_percentage: 100,
    }]
  }
}
```

## Setup

### Environment Variables

Add to your `.env` file:

```bash
# PostHog Project Configuration
VITE_POSTHOG_KEY=phc_YOUR_PROJECT_KEY
VITE_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_PROJECT_ID=YOUR_PROJECT_ID

# For API access (scripts only)
POSTHOG_PERSONAL_API_KEY=phx_YOUR_PERSONAL_API_KEY
```

### Initial Setup

1. **Install Dependencies**
   ```bash
   npm install posthog-js
   ```

2. **Initialize PostHog**
   - Automatically initialized in `src/lib/posthog-lazy.ts`
   - Loads asynchronously to avoid blocking

3. **Create Cohorts**
   ```bash
   # Create all standard cohorts
   node scripts/create-posthog-cohorts-simple.js
   
   # Create internal team cohort
   node scripts/create-internal-users-cohort.js
   ```

4. **Create Feature Flags**
   ```bash
   # Create workspace feature flag
   node scripts/create-workspace-feature-flag.js
   ```

## Management Scripts

### Creating Cohorts

#### Simple Property-Based Cohorts
```bash
node scripts/create-posthog-cohorts-simple.js
```
Creates cohorts based on user properties like `has_workspace`, `tracked_repos_count`.

#### Internal Team Cohort
```bash
node scripts/create-internal-users-cohort.js
```
Manages the Internal Team cohort for testing and development.

To add team members, edit the script:
```javascript
const INTERNAL_USERS = [
  'bdougie',
  'new-team-member',
  // Add more here
];
```

#### Feature Flags
```bash
node scripts/create-workspace-feature-flag.js
```
Creates or updates feature flags with cohort targeting.

### Verifying Setup

1. **Check PostHog Dashboard**
   - Visit PostHog > Cohorts to see population
   - Check Feature Flags for activation status

2. **Test User Identification**
   ```typescript
   // In browser console after login
   posthog.get_distinct_id(); // Should show user ID
   posthog.get_property('cohorts'); // Should show user's cohorts
   ```

3. **Test Feature Flags**
   ```typescript
   // In browser console
   posthog.isFeatureEnabled('enable_workspace_creation');
   ```

## Troubleshooting

### Common Issues

#### User Not in Expected Cohort

1. **Check User Properties**
   ```javascript
   // In browser console
   posthog.get_property('github_username');
   posthog.get_property('internal_user');
   ```

2. **Force Refresh**
   ```typescript
   // In application code
   const { refreshCohorts } = useCohorts();
   await refreshCohorts();
   ```

#### Feature Flag Not Working

1. **Verify Flag Status**
   - Check PostHog dashboard for flag activation
   - Ensure cohort conditions are met

2. **Clear Cache**
   ```javascript
   // Force reload feature flags
   posthog.reloadFeatureFlags();
   ```

3. **Check Network**
   - Open DevTools > Network
   - Look for PostHog API calls
   - Verify successful responses

#### Cohort Not Updating

1. **Check Event Tracking**
   ```javascript
   // Verify events are being sent
   trackEvent('workspace_created');
   ```

2. **Manual Cohort Calculation**
   ```typescript
   const cohorts = await cohortManager.calculateUserCohorts(userId);
   ```

### Debug Mode

Enable debug logging:

```typescript
// In src/lib/posthog-lazy.ts
const POSTHOG_CONFIG = {
  // ... existing config
  debug: true, // Enable debug logs
};
```

## Best Practices

1. **Cohort Design**
   - Keep cohorts mutually exclusive when possible
   - Use priority for overlapping cohorts
   - Document cohort criteria clearly

2. **Feature Flag Strategy**
   - Start with Internal Team cohort
   - Gradually expand to power users
   - Use percentage rollouts for wide releases

3. **Performance**
   - Cohort calculation is throttled (10% chance)
   - Feature flags are cached locally
   - Use `useFeatureFlag` hook for React components

4. **Privacy**
   - Never include PII in cohort names
   - Use user IDs, not emails, for tracking
   - Respect user opt-out preferences

## API Reference

### Hooks

- `useCohorts()` - Access user cohort information
- `useFeatureFlag(flagName)` - Check feature flag status
- `useCohortTracking()` - Track events with cohort context

### Services

- `cohortManager` - Manages cohort calculation and sync
- `featureFlagClient` - PostHog feature flag client
- `trackEvent()` - Send events to PostHog

## Related Documentation

- [PostHog Cohorts Documentation](./posthog-cohorts.md)
- [Feature Flags Guide](../testing/feature-flags.md)
- [Analytics Implementation](./analytics-implementation.md)